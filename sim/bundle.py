"""Population Bundle Transfer — single-file compressed export, SHA-256 verification, and Civilization promotion."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import os
import pickle
import random
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .agent import Agent, AgentEngine
from .analytics import AnalyticsTracker
from .brain import AgentBrain, TORCH_AVAILABLE, active_backend_name, configure_torch_cpu, torch
from .clock import SimulationClock
from .communication import CommunicationEngine
from .config import SimulationConfig, detect_hardware_budget
from .history import HistoryKnowledgeEngine
from .orchestrator import SimulationEngine
from .persistence import PersistenceEngine, new_world_id
from .society import SocietyEngine
from .training import (
    IsolatedSurvivalTrainer,
    SUPPORTED_TRAINING_SCHEMA_VERSIONS,
    TRAINING_SCHEMA_VERSION,
    TrainingIntegrityError,
)
from .world import WorldEngine


BUNDLE_FORMAT_VERSION = "1.0.0"
SUPPORTED_BUNDLE_VERSIONS = {"1.0.0"}


class BundleIntegrityError(RuntimeError):
    """Raised when a trained population bundle is missing, corrupted, tampered with, or incompatible."""


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def export_population_bundle(
    training_checkpoint_dir: Path,
    output_bundle_path: Path,
    require_torch: bool = False,
    source_run_id: Optional[str] = None,
) -> dict:
    """
    Export all trained individuals, their neural weights/optimizers, memories, skills,
    traits, and training analytics into a SINGLE compressed bundle file — strictly
    excluding the 100 isolated training environments.
    """
    manifest_path = training_checkpoint_dir / "manifest.json"
    if manifest_path.exists():
        try:
            raw_ckpt_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise BundleIntegrityError(f"Unreadable training manifest.json: {exc}") from exc
        comp_status = str(raw_ckpt_manifest.get("completion_status") or "completed_success")
        if comp_status != "completed_success":
            raise BundleIntegrityError(
                f"Refusing to export bundle from incomplete/failed training run (completion_status='{comp_status}')."
            )

    try:
        trainer = IsolatedSurvivalTrainer.resume_from_checkpoint(
            training_checkpoint_dir, require_torch=require_torch
        )
    except TrainingIntegrityError as exc:
        raise BundleIntegrityError(f"Cannot export bundle from invalid training checkpoint: {exc}") from exc

    agents_list = [
        trainer.agents.all_agents[aid].to_registry_dict()
        for aid in sorted(trainer.agents.all_agents.keys())
    ]
    if not agents_list:
        raise BundleIntegrityError("Training checkpoint contains zero agents.")

    # Serialize all 100 neural brains + optimizer states
    brains_raw: Dict[int, dict] = {}
    weight_fingerprints: Dict[str, str] = {}
    for aid in sorted(trainer.agents.all_agents.keys()):
        ag = trainer.agents.all_agents[aid]
        if ag.brain is None:
            raise BundleIntegrityError(f"Agent {aid} has no neural brain.")
        brains_raw[aid] = ag.brain.export_state()
        weight_fingerprints[str(aid)] = ag.brain.weight_fingerprint()

    # Pack brains in memory cleanly
    brains_buf = io.BytesIO()
    if TORCH_AVAILABLE and torch is not None:
        with gzip.GzipFile(fileobj=brains_buf, mode="wb") as gz:
            torch.save(brains_raw, gz)
    else:
        with gzip.GzipFile(fileobj=brains_buf, mode="wb") as gz:
            gz.write(pickle.dumps(brains_raw, protocol=pickle.HIGHEST_PROTOCOL))
    brains_bytes = brains_buf.getvalue()

    agents_bytes = json.dumps(agents_list, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    training_analytics = trainer.build_training_analytics_payload()
    analytics_bytes = json.dumps(training_analytics, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    arch = {
        "obs_dim": int(trainer.config.observation_dim),
        "hidden_dim": int(trainer.config.hidden_dim),
        "num_actions": int(trainer.config.num_actions),
        "num_signals": int(trainer.config.num_signals),
        "learning_rate": float(trainer.config.learning_rate),
        "architecture": "GRUCell_ActorCriticSignalValue",
    }

    manifest = {
        "bundle_format_version": BUNDLE_FORMAT_VERSION,
        "training_schema_version": TRAINING_SCHEMA_VERSION,
        "completion_status": "completed_success",
        "source_run_id": str(source_run_id).strip() if source_run_id else None,
        "bundle_id": str(uuid.uuid4()),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_id": trainer.training_id,
        "training_ticks_completed": trainer.clock.tick,
        "agent_count": len(agents_list),
        "agent_ids": [int(a["agent_id"]) for a in agents_list],
        "backend": trainer.backend_name,
        "neural_architecture": arch,
        "discovered_techs": dict(trainer.agents.discovered_techs),
        "excludes_training_environments": True,
        "weight_fingerprints": weight_fingerprints,
        "payload_checksums": {
            "agents_population.json": _sha256_bytes(agents_bytes),
            "brains_state.bin.gz": _sha256_bytes(brains_bytes),
            "training_analytics.json": _sha256_bytes(analytics_bytes),
        },
    }
    manifest_bytes = json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8")

    output_bundle_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".bundle_", suffix=".tmp", dir=str(output_bundle_path.parent))
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            zf.writestr("bundle_manifest.json", manifest_bytes)
            zf.writestr("agents_population.json", agents_bytes)
            zf.writestr("brains_state.bin.gz", brains_bytes)
            zf.writestr("training_analytics.json", analytics_bytes)
        os.replace(tmp_path, output_bundle_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    return manifest


def _load_and_verify_bundle_parts(
    bundle_path: Path,
    require_torch: bool = False,
    expected_arch: Optional[dict] = None,
    expected_run_id: Optional[str] = None,
    verify_brains: bool = False,
) -> Tuple[dict, List[dict], Dict[int, dict], dict]:
    if not bundle_path.exists() or not bundle_path.is_file():
        raise BundleIntegrityError(f"Population bundle not found: {bundle_path}")

    try:
        zf_ctx = zipfile.ZipFile(bundle_path, "r")
    except Exception as exc:
        raise BundleIntegrityError(f"Population bundle is unreadable or not a valid archive: {exc}") from exc

    with zf_ctx as zf:
        names = set(zf.namelist())
        required_members = {
            "bundle_manifest.json",
            "agents_population.json",
            "brains_state.bin.gz",
            "training_analytics.json",
        }
        missing = required_members - names
        if missing:
            raise BundleIntegrityError(f"Bundle missing required entries: {sorted(missing)}")

        try:
            manifest = json.loads(zf.read("bundle_manifest.json").decode("utf-8"))
        except Exception as exc:
            raise BundleIntegrityError(f"Corrupt bundle_manifest.json: {exc}") from exc

        bundle_ver = str(manifest.get("bundle_format_version") or "")
        if bundle_ver not in SUPPORTED_BUNDLE_VERSIONS:
            raise BundleIntegrityError(
                f"Incompatible bundle_format_version '{bundle_ver}'; supported: {sorted(SUPPORTED_BUNDLE_VERSIONS)}"
            )

        t_schema_ver = str(manifest.get("training_schema_version") or "1.0.0")
        if t_schema_ver not in SUPPORTED_TRAINING_SCHEMA_VERSIONS:
            raise BundleIntegrityError(
                f"Incompatible training_schema_version '{t_schema_ver}'; supported: {sorted(SUPPORTED_TRAINING_SCHEMA_VERSIONS)}"
            )

        comp_status = str(manifest.get("completion_status") or "completed_success")
        if comp_status != "completed_success":
            raise BundleIntegrityError(
                f"Refusing bundle from incomplete/failed training (completion_status='{comp_status}')."
            )

        if expected_run_id is not None and str(expected_run_id).strip():
            actual_run_id = str(manifest.get("source_run_id") or "").strip()
            if actual_run_id != str(expected_run_id).strip():
                raise BundleIntegrityError(
                    f"Run ID mismatch: expected source_run_id='{expected_run_id}', bundle has '{actual_run_id or 'none'}'."
                )

        if not manifest.get("excludes_training_environments", False):
            raise BundleIntegrityError("Bundle manifest violates environment exclusion guarantee.")

        checksums = manifest.get("payload_checksums", {})
        payload_bytes: Dict[str, bytes] = {}
        for member in ("agents_population.json", "brains_state.bin.gz", "training_analytics.json"):
            raw = zf.read(member)
            expected_sha = checksums.get(member)
            actual_sha = _sha256_bytes(raw)
            if not expected_sha or actual_sha != expected_sha:
                raise BundleIntegrityError(
                    f"Checksum mismatch for '{member}': expected {expected_sha}, got {actual_sha}"
                )
            payload_bytes[member] = raw

    # Verify architecture compatibility
    arch = manifest.get("neural_architecture", {})
    req_arch = expected_arch or {
        "obs_dim": 36,
        "hidden_dim": 24,
        "num_actions": 18,
        "num_signals": 24,
    }
    for key in ("obs_dim", "hidden_dim", "num_actions", "num_signals"):
        if int(arch.get(key, -1)) != int(req_arch[key]):
            raise BundleIntegrityError(
                f"Incompatible neural architecture '{key}': bundle has {arch.get(key)}, expected {req_arch[key]}"
            )

    try:
        agents_list = json.loads(payload_bytes["agents_population.json"].decode("utf-8"))
        training_analytics = json.loads(payload_bytes["training_analytics.json"].decode("utf-8"))
    except Exception as exc:
        raise BundleIntegrityError(f"Corrupt JSON payload inside bundle: {exc}") from exc

    brains_buf = io.BytesIO(payload_bytes["brains_state.bin.gz"])
    try:
        if TORCH_AVAILABLE and torch is not None:
            try:
                with gzip.GzipFile(fileobj=brains_buf, mode="rb") as gz:
                    brains_raw = torch.load(gz, map_location="cpu", weights_only=False)
            except Exception:
                brains_buf.seek(0)
                with gzip.GzipFile(fileobj=brains_buf, mode="rb") as gz:
                    brains_raw = pickle.load(gz)
        else:
            if require_torch:
                raise BundleIntegrityError("--require-torch set, but torch is unavailable.")
            with gzip.GzipFile(fileobj=brains_buf, mode="rb") as gz:
                brains_raw = pickle.load(gz)
    except BundleIntegrityError:
        raise
    except Exception as exc:
        raise BundleIntegrityError(f"Corrupt or unreadable brains_state.bin.gz inside bundle: {exc}") from exc

    if not isinstance(agents_list, list) or len(agents_list) != int(manifest.get("agent_count", -1)) or len(agents_list) == 0:
        raise BundleIntegrityError(
            f"Agent count mismatch: manifest={manifest.get('agent_count')}, actual={len(agents_list) if isinstance(agents_list, list) else 'invalid'}"
        )

    expected_fps = manifest.get("weight_fingerprints", {})
    seen_ids = set()
    for a in agents_list:
        aid = int(a["agent_id"])
        if aid in seen_ids:
            raise BundleIntegrityError(f"Duplicate agent_id {aid} found in bundle.")
        seen_ids.add(aid)
        if aid not in brains_raw:
            raise BundleIntegrityError(f"Missing neural brain state for agent {aid} in bundle.")
        if verify_brains:
            brain = AgentBrain.from_exported_state(brains_raw[aid], require_torch=require_torch)
            actual_fp = brain.weight_fingerprint()
            expected_fp = expected_fps.get(str(aid))
            if expected_fp and actual_fp != expected_fp:
                raise BundleIntegrityError(
                    f"Brain weight fingerprint mismatch for agent {aid}: expected {expected_fp}, got {actual_fp}"
                )

    return manifest, agents_list, brains_raw, training_analytics


def verify_population_bundle(
    bundle_path: Path,
    require_torch: bool = False,
    expected_arch: Optional[dict] = None,
    expected_run_id: Optional[str] = None,
) -> dict:
    """Strictly validate bundle integrity, version, run ID, checksums, agent IDs, brain weights, and neural architecture."""
    manifest, _, _, _ = _load_and_verify_bundle_parts(
        bundle_path=bundle_path,
        require_torch=require_torch,
        expected_arch=expected_arch,
        expected_run_id=expected_run_id,
        verify_brains=True,
    )
    return {
        "valid": True,
        "bundle_id": manifest.get("bundle_id"),
        "bundle_format_version": manifest.get("bundle_format_version"),
        "training_schema_version": manifest.get("training_schema_version", "1.0.0"),
        "source_run_id": manifest.get("source_run_id"),
        "completion_status": manifest.get("completion_status", "completed_success"),
        "agent_count": manifest.get("agent_count"),
        "training_ticks_completed": manifest.get("training_ticks_completed"),
        "neural_architecture": manifest.get("neural_architecture"),
        "backend": manifest.get("backend"),
        "excludes_training_environments": manifest.get("excludes_training_environments"),
    }


def promote_bundle_to_civilization(
    bundle_path: Path,
    civilization_checkpoint_dir: Path,
    world_seed: int = 42,
    speed_mode: str = "max_cpu_research",
    runtime_budget_minutes: float = 300.0,
    shutdown_reserve_minutes: float = 12.0,
    checkpoint_interval_minutes: float = 25.0,
    require_torch: bool = False,
    expected_run_id: Optional[str] = None,
) -> SimulationEngine:
    """
    Promote verified trained population bundle into a brand-new full 5 km^2 Civilization World.
    Strictly preserves every agent's identity, neural weights, optimizer state, memories, skills,
    traits, lexicon, discovered_techs, and training stats, while permanently disabling training rebirth
    and legacy 60-founder recovery.
    Never modifies or replaces any existing `civilization_checkpoint_dir` unless full verification
    and staged checkpoint verification succeed completely.
    """
    hw = detect_hardware_budget()
    configure_torch_cpu(hw.recommended_torch_threads)
    backend_name = active_backend_name(require_torch=require_torch)

    manifest, agents_list, brains_raw, training_analytics = _load_and_verify_bundle_parts(
        bundle_path=bundle_path,
        require_torch=require_torch,
        expected_run_id=expected_run_id,
        verify_brains=True,
    )

    arch = manifest["neural_architecture"]
    config = SimulationConfig(
        seed=world_seed,
        initial_population=len(agents_list),
        observation_dim=int(arch["obs_dim"]),
        hidden_dim=int(arch["hidden_dim"]),
        num_actions=int(arch["num_actions"]),
        num_signal_tokens=int(arch["num_signals"]),
        learning_rate=float(arch.get("learning_rate", 0.005)),
        auto_recover_on_extinction=False,  # Permanently disabled in promoted Civilization Mode!
        training_rebirth_enabled=False,    # Permanently disabled in Civilization Mode!
        speed_mode=speed_mode,             # type: ignore[arg-type]
        require_torch=require_torch,
        runtime_budget_minutes=runtime_budget_minutes,
        shutdown_reserve_minutes=shutdown_reserve_minutes,
        checkpoint_interval_minutes=checkpoint_interval_minutes,
    )

    rng = random.Random(world_seed)
    world_id = new_world_id(world_seed)
    clock = SimulationClock(
        tick=0,
        days_per_month=config.days_per_month,
        months_per_year=config.months_per_year,
        ticks_per_day=config.ticks_per_day,
        real_seconds_per_sim_month=config.real_seconds_per_sim_month,
    )
    clock.begin_session()

    world = WorldEngine(
        width_m=config.world_width_m,
        height_m=config.world_height_m,
        cell_size_m=config.cell_size_m,
        seed=world_seed,
    )
    world.generate(rng)

    agent_engine = AgentEngine(require_torch=require_torch)
    agent_engine.discovered_techs = {
        str(k): int(v) for k, v in (manifest.get("discovered_techs") or {}).items()
    }
    expected_fps = manifest.get("weight_fingerprints", {})
    max_aid = 0

    for ag_dict in agents_list:
        aid = int(ag_dict["agent_id"])
        max_aid = max(max_aid, aid)
        brain = AgentBrain.from_exported_state(brains_raw[aid], require_torch=require_torch)
        actual_fp = brain.weight_fingerprint()
        expected_fp = expected_fps.get(str(aid))
        if expected_fp and actual_fp != expected_fp:
            raise BundleIntegrityError(
                f"Brain weight fingerprint mismatch for promoted agent {aid}: expected {expected_fp}, got {actual_fp}"
            )
        # Fresh hidden state on world entry while keeping weights, optimizer state, and experience
        brain.hidden_state = [0.0] * brain.hidden_dim

        # Place agent cleanly on habitable terrain inside the 5 km^2 Civilization world
        px, py = world.width_m * 0.5, world.height_m * 0.5
        for attempt in range(140):
            tx = rng.uniform(120.0, world.width_m - 120.0)
            ty = rng.uniform(120.0, world.height_m - 120.0)
            cidx = world.cell_index_at(tx, ty)
            rad = 120.0 if attempt < 100 else 180.0
            if world.water[cidx] < 50.0 and world.food_flora[cidx] > 0.8 and world.has_nearby_water(tx, ty, rad) is not None:
                px, py = tx, ty
                break

        ag = Agent.from_registry_dict(ag_dict, brain=brain)
        ag.x = px
        ag.y = py
        ag.birth_tick = 0
        ag.is_alive = True
        ag.death_tick = None
        ag.cause_of_death = None
        ag.health = 1.0
        ag.hunger = 0.10
        ag.thirst = 0.10
        ag.energy = 0.85
        ag.injury = 0.0
        ag.disease_load = 0.0
        ag.is_pregnant = False
        ag.gestation_ticks = 0
        ag.mate_father_id = None
        ag.last_action = "rest"
        ag.inventory = {"food": 2.0, "wood": 0.0, "stone": 0.0, "herb": 0.0, "tool": 0.0}
        agent_engine.all_agents[aid] = ag

    agent_engine.next_agent_id = max_aid + 1

    comm = CommunicationEngine()
    society = SocietyEngine(
        election_cycle_ticks=config.election_cycle_years * config.ticks_per_year
    )
    history = HistoryKnowledgeEngine()
    history.record_truth(
        tick=0,
        sim_date=clock.sim_date_str(),
        event_type="population_promoted",
        agent_ids=sorted(agent_engine.all_agents.keys()),
        x=world.width_m * 0.5,
        y=world.height_m * 0.5,
        description=(
            f"Promoted {len(agents_list)} trained individuals from bundle {manifest.get('bundle_id')} "
            f"into Civilization world {world_id} (training_rebirth=OFF, legacy_recovery=OFF)."
        ),
        metadata={
            "bundle_id": manifest.get("bundle_id"),
            "source_run_id": manifest.get("source_run_id"),
            "training_id": manifest.get("training_id"),
            "training_ticks_completed": manifest.get("training_ticks_completed"),
            "promoted_agent_count": len(agents_list),
        },
    )

    engine = SimulationEngine(
        world_id=world_id,
        config=config,
        clock=clock,
        world=world,
        agents=agent_engine,
        comm=comm,
        society=society,
        history=history,
        rng=rng,
        backend_name=backend_name,
        analytics=AnalyticsTracker(),
        simulation_phase="civilization",
        training_analytics=training_analytics,
    )
    engine._record_timeline_point()

    # Stage & verify promoted checkpoint BEFORE replacing any existing civilization_checkpoint_dir
    civilization_checkpoint_dir.parent.mkdir(parents=True, exist_ok=True)
    stage_dir = Path(tempfile.mkdtemp(prefix=".civ_promote_stage_", dir=str(civilization_checkpoint_dir.parent)))
    backup_dir: Optional[Path] = None
    try:
        engine.save_checkpoint(stage_dir)
        PersistenceEngine.load_checkpoint(stage_dir, require_torch=require_torch)

        if civilization_checkpoint_dir.exists():
            backup_dir = Path(
                tempfile.mkdtemp(prefix=".civ_promote_backup_", dir=str(civilization_checkpoint_dir.parent))
            )
            shutil.rmtree(backup_dir)
            shutil.move(str(civilization_checkpoint_dir), str(backup_dir))

        shutil.move(str(stage_dir), str(civilization_checkpoint_dir))
        if backup_dir is not None and backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
    except Exception:
        if backup_dir is not None and backup_dir.exists() and not civilization_checkpoint_dir.exists():
            try:
                shutil.move(str(backup_dir), str(civilization_checkpoint_dir))
            except Exception:
                pass
        raise
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)

    return engine
