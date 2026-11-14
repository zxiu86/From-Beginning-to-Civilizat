"""Persistence & Checkpoint Engine — atomic SQLite + compressed neural/RNG/JSONL bundles + SHA-256 manifest."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import pickle
import random
import shutil
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .agent import Agent, AgentEngine
from .brain import AgentBrain, TORCH_AVAILABLE, torch
from .clock import SimulationClock
from .communication import CommunicationEngine
from .config import SimulationConfig
from .history import HistoryKnowledgeEngine
from .society import SocietyEngine
from .world import WorldEngine


SCHEMA_VERSION = "1.0.0"


class CheckpointIntegrityError(RuntimeError):
    """Raised when a requested resume checkpoint is missing, unreadable, or fails checksum verification."""


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


class PersistenceEngine:
    """
    Writes and restores complete, checksum-verified simulation checkpoints atomically:
      - world_state.db (SQLite: config, clock, world grid/fauna, all living & dead agents, society, history L2/L3)
      - brains_state.bin.gz (compressed PyTorch/Python per-agent neural weights, hidden states, buffers, optimizers)
      - events_truth.jsonl.gz (compressed append-only Layer 1 ground-truth events)
      - rng_state.json.gz (Python + Torch CPU RNG states for deterministic resume continuity)
      - observatory_export.json (clean read-only snapshot for Phase 2 Civilization Observatory)
      - manifest.json (world_id, schema_version, tick, sim_date, backend, checksums)
    """

    @staticmethod
    def save_checkpoint(
        checkpoint_dir: Path,
        world_id: str,
        config: SimulationConfig,
        clock: SimulationClock,
        world: WorldEngine,
        agents: AgentEngine,
        comm: CommunicationEngine,
        society: SocietyEngine,
        history: HistoryKnowledgeEngine,
        rng: random.Random,
        backend_name: str,
        metrics_snapshot: dict,
        truth_archive_path: Optional[Path] = None,
    ) -> dict:
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        clock.flush_elapsed_runtime()

        # Append any newly recorded Layer-1 truth events into compressed archive first
        if truth_archive_path is None:
            truth_archive_path = checkpoint_dir / "events_truth.jsonl.gz"

        # Stage new checkpoint into a temporary directory on the same filesystem for atomic swap
        stage_dir = Path(tempfile.mkdtemp(prefix=".ckpt_stage_", dir=str(checkpoint_dir.parent)))
        try:
            # 1. Layer-1 truth JSONL.gz (carry forward existing + append pending)
            staged_truth = stage_dir / "events_truth.jsonl.gz"
            if truth_archive_path.exists():
                shutil.copy2(truth_archive_path, staged_truth)
            if history.pending_truth_flush or not staged_truth.exists():
                mode = "ab" if staged_truth.exists() else "wb"
                with gzip.open(staged_truth, mode) as gz:
                    for ev in history.pending_truth_flush:
                        line = (json.dumps(ev.to_dict(), ensure_ascii=False) + "\n").encode("utf-8")
                        gz.write(line)
                history.pending_truth_flush.clear()

            # 2. SQLite relational & world snapshot
            db_path = stage_dir / "world_state.db"
            conn = sqlite3.connect(str(db_path))
            try:
                cur = conn.cursor()
                cur.execute("PRAGMA journal_mode=DELETE;")
                cur.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
                cur.execute("CREATE TABLE agents (agent_id INTEGER PRIMARY KEY, is_alive INTEGER NOT NULL, birth_tick INTEGER NOT NULL, death_tick INTEGER, data_json TEXT NOT NULL)")
                cur.execute("CREATE TABLE subsystems (name TEXT PRIMARY KEY, data_json TEXT NOT NULL)")

                meta_rows = [
                    ("world_id", world_id),
                    ("schema_version", SCHEMA_VERSION),
                    ("tick", str(clock.tick)),
                    ("next_agent_id", str(agents.next_agent_id)),
                    ("first_movement_tick", json.dumps(agents.first_movement_tick)),
                    ("first_interaction_tick", json.dumps(agents.first_interaction_tick)),
                    ("first_birth_tick", json.dumps(agents.first_birth_tick)),
                    ("first_death_tick", json.dumps(agents.first_death_tick)),
                    ("discovered_techs", json.dumps(agents.discovered_techs)),
                ]
                cur.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", meta_rows)

                agent_rows = [
                    (
                        ag.agent_id,
                        1 if ag.is_alive else 0,
                        ag.birth_tick,
                        ag.death_tick,
                        json.dumps(ag.to_registry_dict(), ensure_ascii=False),
                    )
                    for ag in agents.all_agents.values()
                ]
                cur.executemany(
                    "INSERT INTO agents (agent_id, is_alive, birth_tick, death_tick, data_json) VALUES (?, ?, ?, ?, ?)",
                    agent_rows,
                )

                sub_rows = [
                    ("config", json.dumps(config.to_dict())),
                    ("clock", json.dumps(clock.to_dict())),
                    ("world", json.dumps(world.to_snapshot())),
                    ("communication", json.dumps(comm.to_dict())),
                    ("society", json.dumps(society.to_snapshot())),
                    ("history", json.dumps(history.to_snapshot())),
                ]
                cur.executemany("INSERT INTO subsystems (name, data_json) VALUES (?, ?)", sub_rows)
                conn.commit()
            finally:
                conn.close()

            # 3. Independent neural brains bundle (living agents only — dead brains never resurrected)
            brains_path = stage_dir / "brains_state.bin.gz"
            living_brains = {
                aid: ag.brain.export_state()
                for aid, ag in agents.all_agents.items()
                if ag.is_alive and ag.brain is not None
            }
            if TORCH_AVAILABLE and torch is not None:
                with gzip.open(brains_path, "wb") as gz:
                    torch.save(living_brains, gz)
            else:
                with gzip.open(brains_path, "wb") as gz:
                    gz.write(pickle.dumps(living_brains, protocol=pickle.HIGHEST_PROTOCOL))

            # 4. RNG states (Python + Torch CPU if active)
            rng_path = stage_dir / "rng_state.json.gz"
            rng_payload: Dict[str, Any] = {
                "python_rng_state": list(rng.getstate()[1]),
                "python_rng_version": rng.getstate()[0],
                "python_rng_gauss": rng.getstate()[2],
            }
            if TORCH_AVAILABLE and torch is not None:
                rng_payload["torch_rng_bytes_hex"] = bytes(torch.get_rng_state().tolist()).hex()
            with gzip.open(rng_path, "wb") as gz:
                gz.write(json.dumps(rng_payload).encode("utf-8"))

            # 5. Clean read-only Observatory JSON export (Phase 2 ready)
            obs_path = stage_dir / "observatory_export.json"
            obs_payload = PersistenceEngine.build_observatory_export(
                world_id=world_id,
                clock=clock,
                world=world,
                agents=agents,
                comm=comm,
                society=society,
                history=history,
                metrics=metrics_snapshot,
                backend_name=backend_name,
            )
            with open(obs_path, "w", encoding="utf-8") as fh:
                json.dump(obs_payload, fh, ensure_ascii=False, indent=2)

            # 6. SHA-256 Manifest
            files_to_hash = [
                "world_state.db",
                "brains_state.bin.gz",
                "events_truth.jsonl.gz",
                "rng_state.json.gz",
                "observatory_export.json",
            ]
            checksums = {fname: _sha256_file(stage_dir / fname) for fname in files_to_hash}
            living_count = sum(1 for a in agents.all_agents.values() if a.is_alive)
            manifest = {
                "world_id": world_id,
                "schema_version": SCHEMA_VERSION,
                "sim_tick": clock.tick,
                "sim_date": clock.sim_date_str(),
                "season": clock.season,
                "saved_at_utc": datetime.now(timezone.utc).isoformat(),
                "backend": backend_name,
                "living_population": living_count,
                "total_agents_ever": len(agents.all_agents),
                "next_agent_id": agents.next_agent_id,
                "checksums": checksums,
            }
            manifest_path = stage_dir / "manifest.json"
            with open(manifest_path, "w", encoding="utf-8") as fh:
                json.dump(manifest, fh, ensure_ascii=False, indent=2)

            # Atomic commit into checkpoint_dir
            for fname in files_to_hash + ["manifest.json"]:
                dst = checkpoint_dir / fname
                tmp_dst = checkpoint_dir / f".tmp_{fname}"
                shutil.copy2(stage_dir / fname, tmp_dst)
                os.replace(tmp_dst, dst)

            return manifest
        finally:
            shutil.rmtree(stage_dir, ignore_errors=True)

    @staticmethod
    def load_checkpoint(checkpoint_dir: Path, require_torch: bool = False) -> Tuple[
        str,
        SimulationConfig,
        SimulationClock,
        WorldEngine,
        AgentEngine,
        CommunicationEngine,
        SocietyEngine,
        HistoryKnowledgeEngine,
        random.Random,
        dict,
    ]:
        """Strictly validate checksums and restore complete world state. Never creates a fallback world."""
        if not checkpoint_dir.exists() or not checkpoint_dir.is_dir():
            raise CheckpointIntegrityError(f"Checkpoint directory not found: {checkpoint_dir}")

        manifest_path = checkpoint_dir / "manifest.json"
        if not manifest_path.exists():
            raise CheckpointIntegrityError(f"Missing manifest.json in checkpoint directory: {checkpoint_dir}")

        try:
            with open(manifest_path, "r", encoding="utf-8") as fh:
                manifest = json.load(fh)
        except Exception as exc:
            raise CheckpointIntegrityError(f"Unreadable manifest.json: {exc}") from exc

        checksums = manifest.get("checksums", {})
        required_files = [
            "world_state.db",
            "brains_state.bin.gz",
            "events_truth.jsonl.gz",
            "rng_state.json.gz",
            "observatory_export.json",
        ]
        for fname in required_files:
            fpath = checkpoint_dir / fname
            if not fpath.exists():
                raise CheckpointIntegrityError(f"Checkpoint missing required file '{fname}' in {checkpoint_dir}")
            expected = checksums.get(fname)
            actual = _sha256_file(fpath)
            if not expected or actual != expected:
                raise CheckpointIntegrityError(
                    f"Checksum mismatch for '{fname}': expected {expected}, got {actual}"
                )

        # Restore brains bundle
        brains_path = checkpoint_dir / "brains_state.bin.gz"
        if TORCH_AVAILABLE and torch is not None:
            try:
                with gzip.open(brains_path, "rb") as gz:
                    brains_raw = torch.load(gz, map_location="cpu", weights_only=False)
            except Exception:
                with gzip.open(brains_path, "rb") as gz:
                    brains_raw = pickle.load(gz)
        else:
            if require_torch:
                raise CheckpointIntegrityError("--require-torch is set, but torch is not installed.")
            with gzip.open(brains_path, "rb") as gz:
                brains_raw = pickle.load(gz)

        # Restore SQLite state
        db_path = checkpoint_dir / "world_state.db"
        conn = sqlite3.connect(str(db_path))
        try:
            cur = conn.cursor()
            meta = dict(cur.execute("SELECT key, value FROM meta").fetchall())
            subs = dict(cur.execute("SELECT name, data_json FROM subsystems").fetchall())
            agent_rows = cur.execute("SELECT agent_id, data_json FROM agents ORDER BY agent_id ASC").fetchall()
        finally:
            conn.close()

        world_id = meta["world_id"]
        cfg_dict = json.loads(subs["config"])
        cfg_dict["require_torch"] = require_torch
        config = SimulationConfig(**cfg_dict)
        clock = SimulationClock.from_dict(json.loads(subs["clock"]))
        world = WorldEngine.from_snapshot(json.loads(subs["world"]))
        comm = CommunicationEngine.from_dict(json.loads(subs["communication"]))
        society = SocietyEngine.from_snapshot(json.loads(subs["society"]))
        history = HistoryKnowledgeEngine.from_snapshot(json.loads(subs["history"]))

        agent_engine = AgentEngine(require_torch=require_torch)
        agent_engine.next_agent_id = int(meta["next_agent_id"])
        agent_engine.first_movement_tick = json.loads(meta["first_movement_tick"])
        agent_engine.first_interaction_tick = json.loads(meta["first_interaction_tick"])
        agent_engine.first_birth_tick = json.loads(meta["first_birth_tick"])
        agent_engine.first_death_tick = json.loads(meta["first_death_tick"])
        agent_engine.discovered_techs = json.loads(meta["discovered_techs"])

        for aid, data_json in agent_rows:
            ag_dict = json.loads(data_json)
            brain = None
            if ag_dict["is_alive"] and aid in brains_raw:
                brain = AgentBrain.from_exported_state(brains_raw[aid], require_torch=require_torch)
            agent_engine.all_agents[aid] = Agent.from_registry_dict(ag_dict, brain=brain)

        # Restore RNG states
        with gzip.open(checkpoint_dir / "rng_state.json.gz", "rb") as gz:
            rng_payload = json.loads(gz.read().decode("utf-8"))
        rng = random.Random()
        rng.setstate((
            int(rng_payload["python_rng_version"]),
            tuple(rng_payload["python_rng_state"]),
            rng_payload["python_rng_gauss"],
        ))
        if TORCH_AVAILABLE and torch is not None and "torch_rng_bytes_hex" in rng_payload:
            raw_bytes = list(bytes.fromhex(rng_payload["torch_rng_bytes_hex"]))
            torch.set_rng_state(torch.tensor(raw_bytes, dtype=torch.uint8))

        return world_id, config, clock, world, agent_engine, comm, society, history, rng, manifest

    @staticmethod
    def build_observatory_export(
        world_id: str,
        clock: SimulationClock,
        world: WorldEngine,
        agents: AgentEngine,
        comm: CommunicationEngine,
        society: SocietyEngine,
        history: HistoryKnowledgeEngine,
        metrics: dict,
        backend_name: str,
    ) -> dict:
        """Read-only structured JSON contract for the deferred Phase 2 Civilization Observatory."""
        living = [ag for ag in agents.all_agents.values() if ag.is_alive]
        deceased = [ag for ag in agents.all_agents.values() if not ag.is_alive]
        return {
            "export_schema_version": SCHEMA_VERSION,
            "world_id": world_id,
            "backend": backend_name,
            "clock": clock.to_dict(),
            "demographics": {
                "living_count": len(living),
                "deceased_count": len(deceased),
                "total_ever_born": len(agents.all_agents),
                "max_generation": max((a.generation for a in agents.all_agents.values()), default=0),
                "avg_age_years": round(sum(a.age_years for a in living) / max(1, len(living)), 2),
                "discovered_techs": agents.discovered_techs,
            },
            "ecosystem": world.ecosystem_summary(),
            "emergent_language": comm.summary(),
            "crime_and_stability": metrics,
            "groups": [g.to_dict() for g in society.groups.values()],
            "history_layers": {
                "layer_1_ground_truth_tail": [e.to_dict() for e in history.observer_get_truth_tail(100)],
                "layer_2_witness_accounts_tail": [w.to_dict() for w in history.witness_accounts[-100:]],
                "layer_2_surface_artifacts_count": len(history.artifacts),
                "layer_3_interpretations_tail": [i.to_dict() for i in history.interpretations[-100:]],
            },
            "living_agents_summary": [
                {
                    "agent_id": a.agent_id,
                    "sex": a.sex,
                    "x": round(a.x, 1),
                    "y": round(a.y, 1),
                    "age_years": round(a.age_years, 2),
                    "generation": a.generation,
                    "health": round(a.health, 3),
                    "hunger": round(a.hunger, 3),
                    "thirst": round(a.thirst, 3),
                    "last_action": a.last_action,
                    "lexicon_size": len(a.lexicon),
                }
                for a in living
            ],
            "genealogy_nodes": [
                {
                    "agent_id": a.agent_id,
                    "birth_tick": a.birth_tick,
                    "death_tick": a.death_tick,
                    "is_alive": a.is_alive,
                    "cause_of_death": a.cause_of_death,
                    "parent_a_id": a.parent_a_id,
                    "parent_b_id": a.parent_b_id,
                    "children_ids": a.children_ids,
                }
                for a in agents.all_agents.values()
            ],
        }


def new_world_id(seed: int) -> str:
    return f"world_{seed}_{uuid.uuid4().hex[:8]}"
