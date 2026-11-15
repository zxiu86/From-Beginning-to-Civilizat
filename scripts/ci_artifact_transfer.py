"""CI Artifact Packaging, Automatic Run Discovery, and Integrity Verification Helper.

Lives outside `/sim/` to preserve strict decoupling between the deterministic simulation
engine and GitHub Actions REST API orchestration. Never prints or persists secrets/tokens.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sim.bundle import (
    BUNDLE_FORMAT_VERSION,
    SUPPORTED_BUNDLE_VERSIONS,
    BundleIntegrityError,
    export_population_bundle,
    verify_population_bundle,
)
from sim.persistence import CheckpointIntegrityError, PersistenceEngine
from sim.training import (
    SUPPORTED_TRAINING_SCHEMA_VERSIONS,
    TRAINING_SCHEMA_VERSION,
    IsolatedSurvivalTrainer,
    TrainingIntegrityError,
)


TRANSFER_METADATA_VERSION = "1.0.0"
SUPPORTED_TRANSFER_METADATA_VERSIONS = {"1.0.0"}


class ArtifactTransferError(RuntimeError):
    """Raised when artifact packaging, discovery, download, or verification fails."""


class ArtifactResolutionError(ArtifactTransferError):
    """Raised when no valid completed/non-expired GitHub Actions source artifact can be resolved."""


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _atomic_copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".copy_", suffix=".tmp", dir=str(dst.parent))
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        shutil.copy2(src, tmp_path)
        os.replace(tmp_path, dst)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def _atomic_replace_dir_from_stage(stage_dir: Path, target_dir: Path) -> None:
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    backup_dir: Optional[Path] = None
    try:
        if target_dir.exists():
            backup_dir = Path(tempfile.mkdtemp(prefix=".art_backup_", dir=str(target_dir.parent)))
            shutil.rmtree(backup_dir)
            shutil.move(str(target_dir), str(backup_dir))
        shutil.move(str(stage_dir), str(target_dir))
        if backup_dir is not None and backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
    except Exception:
        if backup_dir is not None and backup_dir.exists() and not target_dir.exists():
            try:
                shutil.move(str(backup_dir), str(target_dir))
            except Exception:
                pass
        raise


def _copy_verified_tree(src_dir: Path, dst_dir: Path) -> None:
    if src_dir.resolve() == dst_dir.resolve():
        return
    dst_dir.parent.mkdir(parents=True, exist_ok=True)
    stage_dir = Path(tempfile.mkdtemp(prefix=".ckpt_copy_stage_", dir=str(dst_dir.parent)))
    try:
        for item in src_dir.iterdir():
            target_item = stage_dir / item.name
            if item.is_dir():
                shutil.copytree(item, target_item)
            else:
                shutil.copy2(item, target_item)
        _atomic_replace_dir_from_stage(stage_dir, dst_dir)
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)


def package_training_artifact(
    checkpoint_dir: Path,
    output_dir: Path,
    run_id: str,
    run_number: str = "",
    workflow_mode: str = "start_training",
    require_torch: bool = False,
) -> dict:
    """
    Validate a completed Isolated Survival Training checkpoint and package everything needed
    for both training resumption AND Full World promotion into ONE organized directory:
      - checkpoint/ (verified checkpoint files + manifest.json)
      - trained_population.bundle (single compressed verified population bundle with provenance)
      - transfer_metadata.json (versioned manifest with SHA-256 checksums & run metadata)
    """
    clean_run_id = str(run_id).strip()
    if not clean_run_id:
        raise ArtifactTransferError("Cannot package training artifact without a valid run_id.")

    if not checkpoint_dir.exists() or not checkpoint_dir.is_dir():
        raise ArtifactTransferError(f"Training checkpoint directory not found: {checkpoint_dir}")

    manifest_path = checkpoint_dir / "manifest.json"
    if not manifest_path.exists():
        raise ArtifactTransferError(f"Training checkpoint manifest.json missing in {checkpoint_dir}")

    try:
        ckpt_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ArtifactTransferError(f"Unreadable training manifest.json: {exc}") from exc

    comp_status = str(ckpt_manifest.get("completion_status") or "completed_success")
    if comp_status != "completed_success":
        raise ArtifactTransferError(
            f"Refusing to package incomplete/failed training run (completion_status='{comp_status}')."
        )

    schema_ver = str(ckpt_manifest.get("schema_version") or "")
    if schema_ver not in SUPPORTED_TRAINING_SCHEMA_VERSIONS:
        raise ArtifactTransferError(
            f"Incompatible training schema_version '{schema_ver}'; supported={sorted(SUPPORTED_TRAINING_SCHEMA_VERSIONS)}"
        )

    try:
        trainer = IsolatedSurvivalTrainer.resume_from_checkpoint(checkpoint_dir, require_torch=require_torch)
    except TrainingIntegrityError as exc:
        raise ArtifactTransferError(f"Training checkpoint failed integrity verification: {exc}") from exc

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    stage_dir = Path(tempfile.mkdtemp(prefix=".pkg_stage_", dir=str(output_dir.parent)))
    try:
        bundle_path = stage_dir / "trained_population.bundle"
        try:
            bundle_manifest = export_population_bundle(
                training_checkpoint_dir=checkpoint_dir,
                output_bundle_path=bundle_path,
                require_torch=require_torch,
                source_run_id=clean_run_id,
            )
            verify_population_bundle(
                bundle_path=bundle_path,
                require_torch=require_torch,
                expected_run_id=clean_run_id,
            )
        except BundleIntegrityError as exc:
            raise ArtifactTransferError(f"Population bundle export/verification failed: {exc}") from exc

        staged_ckpt = stage_dir / "checkpoint"
        staged_ckpt.mkdir(parents=True, exist_ok=True)
        checksums = ckpt_manifest.get("checksums") or {}
        files_to_copy = list(checksums.keys()) + ["manifest.json"]
        for fname in files_to_copy:
            src_f = checkpoint_dir / fname
            if not src_f.exists() or not src_f.is_file():
                raise ArtifactTransferError(f"Missing expected training checkpoint file '{fname}' in {checkpoint_dir}")
            dst_f = staged_ckpt / fname
            shutil.copy2(src_f, dst_f)
            if fname in checksums and _sha256_file(dst_f) != checksums[fname]:
                raise ArtifactTransferError(f"Copied checkpoint file '{fname}' failed post-copy SHA-256 verification.")

        bundle_sha256 = _sha256_file(bundle_path)
        ckpt_manifest_sha256 = _sha256_file(staged_ckpt / "manifest.json")

        metadata = {
            "metadata_version": TRANSFER_METADATA_VERSION,
            "artifact_kind": "isolated_training_package",
            "artifact_name": f"isolated-training-artifact-{clean_run_id}",
            "github_run_id": clean_run_id,
            "github_run_number": str(run_number or ""),
            "workflow_mode": str(workflow_mode),
            "completion_status": "completed_success",
            "training_id": trainer.training_id,
            "training_tick": int(trainer.clock.tick),
            "agent_count": int(len(trainer.agents.all_agents)),
            "training_schema_version": str(ckpt_manifest.get("schema_version", TRAINING_SCHEMA_VERSION)),
            "bundle_id": str(bundle_manifest["bundle_id"]),
            "bundle_format_version": str(bundle_manifest.get("bundle_format_version", BUNDLE_FORMAT_VERSION)),
            "bundle_sha256": bundle_sha256,
            "checkpoint_manifest_sha256": ckpt_manifest_sha256,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        }
        meta_path = stage_dir / "transfer_metadata.json"
        meta_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

        _atomic_replace_dir_from_stage(stage_dir, output_dir)
        return metadata
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)


def _candidate_artifacts_for_mode(mode: str, run_id: str) -> List[Tuple[str, str]]:
    if mode == "promote_to_civilization":
        return [
            ("isolated_training_package", f"isolated-training-artifact-{run_id}"),
            ("legacy_bundle", f"trained-population-bundle-{run_id}"),
        ]
    if mode in ("resume_training", "export_trained_population"):
        return [
            ("isolated_training_package", f"isolated-training-artifact-{run_id}"),
            ("legacy_training_checkpoint", f"training-checkpoint-{run_id}"),
        ]
    if mode == "run_civilization":
        return [
            ("civilization_checkpoint", f"sim-checkpoint-{run_id}"),
        ]
    raise ArtifactResolutionError(f"Mode '{mode}' does not consume a source artifact.")


def _default_github_api_get(url: str, token: Optional[str]) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "from-beginning-to-civilization-ci-transfer",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        body_snippet = ""
        try:
            body_snippet = exc.read(300).decode("utf-8", errors="replace").strip()
        except Exception:
            pass
        raise ArtifactResolutionError(
            f"GitHub API HTTP {exc.code} while querying {urllib.parse.urlsplit(url).path}: {body_snippet or exc.reason}"
        ) from exc
    except urllib.error.URLError as exc:
        raise ArtifactResolutionError(
            f"Network error querying GitHub API ({urllib.parse.urlsplit(url).path}): {exc.reason}"
        ) from exc


def resolve_source_artifact(
    *,
    mode: str,
    repo: str,
    workflow_file: str = "simulation.yml",
    source_run_id: str = "",
    current_run_id: str = "",
    token: Optional[str] = None,
    api_base_url: str = "https://api.github.com",
    api_get: Optional[Callable[[str], dict]] = None,
) -> dict:
    """
    Resolve the exact GitHub Actions Run ID + Artifact name to download for `mode`.
    - When `source_run_id` is blank, automatically scans completed & successful runs (newest first)
      for the latest non-expired matching artifact, ignoring failed, in-progress, expired, or
      unrelated runs (e.g. verify_only).
    - When `source_run_id` is provided, strictly validates that that run succeeded, matches
      expected artifact type, and has not expired.
    """
    fetcher = api_get or (lambda url: _default_github_api_get(url, token))
    base = api_base_url.rstrip("/")
    clean_repo = repo.strip()
    if not clean_repo or "/" not in clean_repo:
        raise ArtifactResolutionError(f"Invalid repository identifier '{repo}'. Expected 'owner/repo'.")

    clean_source = str(source_run_id or "").strip()
    clean_current = str(current_run_id or "").strip()

    def _pick_artifact_from_run(run_obj: dict, artifacts_list: List[dict]) -> Tuple[Optional[Tuple[str, dict]], bool]:
        rid = str(run_obj.get("id") or "").strip()
        by_name = {str(a.get("name") or ""): a for a in artifacts_list if isinstance(a, dict)}
        saw_expired = False
        for kind, expected_name in _candidate_artifacts_for_mode(mode, rid):
            art = by_name.get(expected_name)
            if art is None:
                continue
            if bool(art.get("expired", False)):
                saw_expired = True
                continue
            return (kind, art), saw_expired
        return None, saw_expired

    # Validate candidate mapping early so invalid modes fail immediately
    _candidate_artifacts_for_mode(mode, "0")

    if clean_source:
        if not clean_source.isdigit():
            raise ArtifactResolutionError(
                f"Invalid source_run_id '{clean_source}'. Expected a numeric GitHub Actions Run ID or blank for auto-discovery."
            )
        if clean_current and clean_source == clean_current:
            raise ArtifactResolutionError(
                f"source_run_id '{clean_source}' cannot refer to the currently executing workflow run."
            )
        run_obj = fetcher(f"{base}/repos/{clean_repo}/actions/runs/{clean_source}")
        status = str(run_obj.get("status") or "")
        conclusion = str(run_obj.get("conclusion") or "")
        if status != "completed" or conclusion != "success":
            raise ArtifactResolutionError(
                f"Refusing source_run_id={clean_source}: workflow run is not a completed successful run "
                f"(status='{status or 'unknown'}', conclusion='{conclusion or 'none'}')."
            )
        arts_resp = fetcher(f"{base}/repos/{clean_repo}/actions/runs/{clean_source}/artifacts?per_page=100")
        arts_list = list(arts_resp.get("artifacts") or [])
        picked, saw_expired = _pick_artifact_from_run(run_obj, arts_list)
        if picked is None:
            available_names = [str(a.get("name") or "") for a in arts_list]
            if saw_expired:
                raise ArtifactResolutionError(
                    f"Matching artifact on run {clean_source} has expired (retention window elapsed) and cannot be downloaded."
                )
            expected_names = [name for _, name in _candidate_artifacts_for_mode(mode, clean_source)]
            raise ArtifactResolutionError(
                f"No compatible artifact found on run {clean_source} for mode '{mode}'. "
                f"Expected one of {expected_names}; run has artifacts={available_names}."
            )
        art_kind, art_obj = picked
        return {
            "resolved_automatically": False,
            "run_id": clean_source,
            "artifact_name": str(art_obj["name"]),
            "artifact_kind": art_kind,
            "artifact_id": art_obj.get("id"),
            "size_in_bytes": art_obj.get("size_in_bytes"),
            "created_at": art_obj.get("created_at"),
            "workflow_run_url": run_obj.get("html_url") or f"https://github.com/{clean_repo}/actions/runs/{clean_source}",
            "head_branch": run_obj.get("head_branch"),
        }

    # Automatic discovery: list completed runs of this workflow and find newest successful non-expired match
    wf_encoded = urllib.parse.quote(workflow_file.strip(), safe="")
    try:
        runs_resp = fetcher(f"{base}/repos/{clean_repo}/actions/workflows/{wf_encoded}/runs?status=completed&per_page=50")
    except ArtifactResolutionError:
        runs_resp = fetcher(f"{base}/repos/{clean_repo}/actions/runs?status=completed&per_page=50")

    runs = list(runs_resp.get("workflow_runs") or [])
    runs.sort(
        key=lambda r: (str(r.get("created_at") or ""), int(r.get("id") or 0) if str(r.get("id") or "").isdigit() else 0),
        reverse=True,
    )

    inspected_success_runs = 0
    skipped_non_success = 0
    skipped_expired = 0
    skipped_incompatible = 0

    for run_obj in runs:
        rid = str(run_obj.get("id") or "").strip()
        if not rid or (clean_current and rid == clean_current):
            continue
        status = str(run_obj.get("status") or "")
        conclusion = str(run_obj.get("conclusion") or "")
        if status != "completed" or conclusion != "success":
            skipped_non_success += 1
            continue

        inspected_success_runs += 1
        arts_resp = fetcher(f"{base}/repos/{clean_repo}/actions/runs/{rid}/artifacts?per_page=100")
        arts_list = list(arts_resp.get("artifacts") or [])
        picked, saw_expired = _pick_artifact_from_run(run_obj, arts_list)
        if picked is not None:
            art_kind, art_obj = picked
            return {
                "resolved_automatically": True,
                "run_id": rid,
                "artifact_name": str(art_obj["name"]),
                "artifact_kind": art_kind,
                "artifact_id": art_obj.get("id"),
                "size_in_bytes": art_obj.get("size_in_bytes"),
                "created_at": art_obj.get("created_at"),
                "workflow_run_url": run_obj.get("html_url") or f"https://github.com/{clean_repo}/actions/runs/{rid}",
                "head_branch": run_obj.get("head_branch"),
            }
        if saw_expired:
            skipped_expired += 1
        else:
            skipped_incompatible += 1

    raise ArtifactResolutionError(
        f"No valid non-expired source artifact found automatically for mode '{mode}' in '{clean_repo}' ({workflow_file}). "
        f"Summary: inspected_successful_runs={inspected_success_runs}, skipped_failed_or_incomplete={skipped_non_success}, "
        f"skipped_expired_artifacts={skipped_expired}, skipped_other_mode_runs={skipped_incompatible}. "
        f"Run 'start_training' successfully first (or 'promote_to_civilization' before 'run_civilization'), or provide an explicit valid 'source_run_id'."
    )


def verify_downloaded_artifact(
    *,
    download_dir: Path,
    expected_run_id: str,
    artifact_kind: str,
    mode: str,
    require_torch: bool = False,
    verified_bundle_out: Optional[Path] = None,
    verified_checkpoint_out: Optional[Path] = None,
) -> dict:
    """
    Strictly verify downloaded artifact files, version compatibility, SHA-256 digests,
    run ID provenance, neural brains, and completeness BEFORE staging into working paths.
    """
    if not download_dir.exists() or not download_dir.is_dir():
        raise ArtifactTransferError(f"Downloaded artifact directory missing: {download_dir}")
    entries = list(download_dir.iterdir())
    if not entries:
        raise ArtifactTransferError(
            f"Downloaded artifact directory '{download_dir}' is empty — artifact download produced no files."
        )

    clean_expected_run = str(expected_run_id or "").strip()

    if artifact_kind == "isolated_training_package":
        meta_path = download_dir / "transfer_metadata.json"
        bundle_path = download_dir / "trained_population.bundle"
        ckpt_dir = download_dir / "checkpoint"
        ckpt_manifest_path = ckpt_dir / "manifest.json"

        missing_parts = [
            rel
            for rel, p in (
                ("transfer_metadata.json", meta_path),
                ("trained_population.bundle", bundle_path),
                ("checkpoint/manifest.json", ckpt_manifest_path),
            )
            if not p.exists()
        ]
        if missing_parts:
            raise ArtifactTransferError(
                f"Downloaded isolated training package is incomplete; missing: {missing_parts}"
            )

        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise ArtifactTransferError(f"Corrupt transfer_metadata.json: {exc}") from exc

        meta_ver = str(meta.get("metadata_version") or "")
        if meta_ver not in SUPPORTED_TRANSFER_METADATA_VERSIONS:
            raise ArtifactTransferError(
                f"Incompatible transfer metadata_version '{meta_ver}'; supported={sorted(SUPPORTED_TRANSFER_METADATA_VERSIONS)}"
            )
        if str(meta.get("artifact_kind") or "") != "isolated_training_package":
            raise ArtifactTransferError(
                f"Unexpected metadata artifact_kind '{meta.get('artifact_kind')}' (expected 'isolated_training_package')."
            )
        actual_run_id = str(meta.get("github_run_id") or "").strip()
        if clean_expected_run and actual_run_id != clean_expected_run:
            raise ArtifactTransferError(
                f"Run ID mismatch in transfer_metadata.json: expected '{clean_expected_run}', found '{actual_run_id or 'none'}'."
            )
        comp_status = str(meta.get("completion_status") or "")
        if comp_status != "completed_success":
            raise ArtifactTransferError(
                f"Refusing incomplete or failed training artifact (completion_status='{comp_status}')."
            )

        actual_bundle_sha = _sha256_file(bundle_path)
        expected_bundle_sha = str(meta.get("bundle_sha256") or "")
        if not expected_bundle_sha or actual_bundle_sha != expected_bundle_sha:
            raise ArtifactTransferError(
                f"SHA-256 mismatch for trained_population.bundle: expected '{expected_bundle_sha}', got '{actual_bundle_sha}'."
            )

        actual_ckpt_sha = _sha256_file(ckpt_manifest_path)
        expected_ckpt_sha = str(meta.get("checkpoint_manifest_sha256") or "")
        if not expected_ckpt_sha or actual_ckpt_sha != expected_ckpt_sha:
            raise ArtifactTransferError(
                f"SHA-256 mismatch for checkpoint/manifest.json: expected '{expected_ckpt_sha}', got '{actual_ckpt_sha}'."
            )

        try:
            bundle_report = verify_population_bundle(
                bundle_path=bundle_path,
                require_torch=require_torch,
                expected_run_id=clean_expected_run or None,
            )
        except BundleIntegrityError as exc:
            raise ArtifactTransferError(f"Downloaded population bundle failed integrity check: {exc}") from exc

        if str(bundle_report.get("bundle_id") or "") != str(meta.get("bundle_id") or ""):
            raise ArtifactTransferError(
                f"Bundle ID mismatch between transfer_metadata.json ({meta.get('bundle_id')}) and bundle ({bundle_report.get('bundle_id')})."
            )

        try:
            trainer = IsolatedSurvivalTrainer.resume_from_checkpoint(ckpt_dir, require_torch=require_torch)
        except TrainingIntegrityError as exc:
            raise ArtifactTransferError(f"Downloaded training checkpoint failed integrity check: {exc}") from exc

        if trainer.training_id != str(meta.get("training_id") or ""):
            raise ArtifactTransferError(
                f"Training ID mismatch: metadata has '{meta.get('training_id')}', checkpoint has '{trainer.training_id}'."
            )

        if verified_bundle_out is not None:
            _atomic_copy_file(bundle_path, verified_bundle_out)
        if verified_checkpoint_out is not None:
            _copy_verified_tree(ckpt_dir, verified_checkpoint_out)

        return {
            "verified": True,
            "artifact_kind": artifact_kind,
            "mode": mode,
            "github_run_id": actual_run_id,
            "training_id": trainer.training_id,
            "training_tick": int(trainer.clock.tick),
            "agent_count": int(len(trainer.agents.all_agents)),
            "bundle_id": bundle_report.get("bundle_id"),
            "bundle_sha256": actual_bundle_sha,
        }

    if artifact_kind == "legacy_bundle":
        bundle_path = download_dir / "trained_population.bundle"
        if not bundle_path.exists():
            candidates = sorted(download_dir.glob("*.bundle"))
            if len(candidates) != 1:
                raise ArtifactTransferError(f"Expected trained_population.bundle in {download_dir}, found {[p.name for p in entries]}")
            bundle_path = candidates[0]
        try:
            bundle_report = verify_population_bundle(bundle_path=bundle_path, require_torch=require_torch)
        except BundleIntegrityError as exc:
            raise ArtifactTransferError(f"Downloaded legacy bundle failed integrity check: {exc}") from exc
        if verified_bundle_out is not None:
            _atomic_copy_file(bundle_path, verified_bundle_out)
        return {
            "verified": True,
            "artifact_kind": artifact_kind,
            "mode": mode,
            "github_run_id": clean_expected_run,
            "bundle_id": bundle_report.get("bundle_id"),
            "agent_count": bundle_report.get("agent_count"),
        }

    if artifact_kind == "legacy_training_checkpoint":
        try:
            trainer = IsolatedSurvivalTrainer.resume_from_checkpoint(download_dir, require_torch=require_torch)
        except TrainingIntegrityError as exc:
            raise ArtifactTransferError(f"Downloaded legacy training checkpoint failed integrity check: {exc}") from exc
        if verified_checkpoint_out is not None:
            _copy_verified_tree(download_dir, verified_checkpoint_out)
        return {
            "verified": True,
            "artifact_kind": artifact_kind,
            "mode": mode,
            "github_run_id": clean_expected_run,
            "training_id": trainer.training_id,
            "training_tick": int(trainer.clock.tick),
            "agent_count": int(len(trainer.agents.all_agents)),
        }

    if artifact_kind == "civilization_checkpoint":
        try:
            world_id, _cfg, clock, _w, agents, _c, _s, _h, _rng, _manifest = PersistenceEngine.load_checkpoint(
                download_dir, require_torch=require_torch
            )
        except CheckpointIntegrityError as exc:
            raise ArtifactTransferError(f"Downloaded civilization checkpoint failed integrity check: {exc}") from exc
        if verified_checkpoint_out is not None:
            _copy_verified_tree(download_dir, verified_checkpoint_out)
        return {
            "verified": True,
            "artifact_kind": artifact_kind,
            "mode": mode,
            "github_run_id": clean_expected_run,
            "world_id": world_id,
            "tick": int(clock.tick),
            "living_agents": len(agents.living_agents()),
        }

    raise ArtifactTransferError(f"Unsupported artifact_kind '{artifact_kind}'.")


def _write_github_output(github_output_path: Optional[Path], values: Dict[str, Any]) -> None:
    if github_output_path is None:
        return
    lines = []
    for k, v in values.items():
        s = str(v if v is not None else "").replace("\n", " ").replace("\r", " ")
        lines.append(f"{k}={s}")
    with open(github_output_path, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python3 scripts/ci_artifact_transfer.py",
        description="CI Artifact Packaging, Automatic Source Run Resolution, and Verification Helper",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_pkg = sub.add_parser("package-training", help="Package verified training checkpoint + bundle + metadata into one directory")
    p_pkg.add_argument("--checkpoint-dir", type=Path, required=True)
    p_pkg.add_argument("--output-dir", type=Path, required=True)
    p_pkg.add_argument("--run-id", type=str, required=True)
    p_pkg.add_argument("--run-number", type=str, default="")
    p_pkg.add_argument("--workflow-mode", type=str, default="start_training")
    p_pkg.add_argument("--require-torch", action="store_true")

    p_res = sub.add_parser("resolve-source", help="Resolve latest successful or explicit source run & artifact")
    p_res.add_argument("--mode", type=str, required=True)
    p_res.add_argument("--source-run-id", type=str, default="")
    p_res.add_argument("--repo", type=str, required=True)
    p_res.add_argument("--workflow-file", type=str, default="simulation.yml")
    p_res.add_argument("--current-run-id", type=str, default="")
    p_res.add_argument("--token-env", type=str, default="GITHUB_TOKEN")
    p_res.add_argument("--github-output", type=Path, default=None)

    p_ver = sub.add_parser("verify-downloaded", help="Verify downloaded artifact integrity before simulation/promotion")
    p_ver.add_argument("--download-dir", type=Path, required=True)
    p_ver.add_argument("--expected-run-id", type=str, default="")
    p_ver.add_argument("--artifact-kind", type=str, required=True)
    p_ver.add_argument("--mode", type=str, required=True)
    p_ver.add_argument("--require-torch", action="store_true")
    p_ver.add_argument("--verified-bundle-out", type=Path, default=None)
    p_ver.add_argument("--verified-checkpoint-out", type=Path, default=None)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "package-training":
            meta = package_training_artifact(
                checkpoint_dir=args.checkpoint_dir,
                output_dir=args.output_dir,
                run_id=args.run_id,
                run_number=args.run_number,
                workflow_mode=args.workflow_mode,
                require_torch=args.require_torch,
            )
            print(json.dumps(meta, indent=2, ensure_ascii=False))
            return 0

        if args.command == "resolve-source":
            token = os.environ.get(args.token_env, "") if args.token_env else ""
            resolved = resolve_source_artifact(
                mode=args.mode,
                repo=args.repo,
                workflow_file=args.workflow_file,
                source_run_id=args.source_run_id,
                current_run_id=args.current_run_id,
                token=token or None,
            )
            _write_github_output(
                args.github_output,
                {
                    "run_id": resolved["run_id"],
                    "artifact_name": resolved["artifact_name"],
                    "artifact_kind": resolved["artifact_kind"],
                    "workflow_run_url": resolved["workflow_run_url"],
                    "resolved_automatically": "true" if resolved["resolved_automatically"] else "false",
                },
            )
            print(json.dumps(resolved, indent=2, ensure_ascii=False))
            return 0

        if args.command == "verify-downloaded":
            report = verify_downloaded_artifact(
                download_dir=args.download_dir,
                expected_run_id=args.expected_run_id,
                artifact_kind=args.artifact_kind,
                mode=args.mode,
                require_torch=args.require_torch,
                verified_bundle_out=args.verified_bundle_out,
                verified_checkpoint_out=args.verified_checkpoint_out,
            )
            print(json.dumps(report, indent=2, ensure_ascii=False))
            return 0
    except ArtifactTransferError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
