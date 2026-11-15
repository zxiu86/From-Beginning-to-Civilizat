"""Persistence & Checkpoint Engine — atomic SQLite + compressed neural/RNG/JSONL bundles + SHA-256 manifest."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import pickle
import random
import shutil
import sqlite3
import tempfile
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .agent import Agent, AgentEngine
from .brain import AgentBrain, TORCH_AVAILABLE, torch
from .clock import SimulationClock
from .communication import CommunicationEngine
from .config import SimulationConfig
from .history import HistoryKnowledgeEngine
from .perception import PerceptionEngine
from .society import SocietyEngine
from .world import WorldEngine


SCHEMA_VERSION = "2.0.0"


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
        timeline_series: Optional[List[dict]] = None,
        timeline_id: Optional[str] = None,
        parent_timeline_id: Optional[str] = None,
        timeline_kind: str = "original",
        branch_point_tick: Optional[int] = None,
        rebirth_records: Optional[List[dict]] = None,
    ) -> dict:
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        clock.flush_elapsed_runtime()
        resolved_timeline_id = timeline_id or str(uuid.uuid5(uuid.NAMESPACE_OID, world_id))

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
                    ("timeline_id", resolved_timeline_id),
                    ("parent_timeline_id", json.dumps(parent_timeline_id)),
                    ("timeline_kind", timeline_kind),
                    ("branch_point_tick", json.dumps(branch_point_tick)),
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
                    ("timeline_series", json.dumps(timeline_series or [])),
                    ("rebirth_records", json.dumps(rebirth_records or [])),
                ]
                cur.executemany("INSERT INTO subsystems (name, data_json) VALUES (?, ?)", sub_rows)
                conn.commit()
            finally:
                conn.close()

            # 3. Independent neural brains bundle (both living AND deceased individuals archived faithfully)
            brains_path = stage_dir / "brains_state.bin.gz"
            archived_brains = {
                aid: ag.brain.export_state()
                for aid, ag in agents.all_agents.items()
                if ag.brain is not None
            }
            if TORCH_AVAILABLE and torch is not None:
                with gzip.open(brains_path, "wb") as gz:
                    torch.save(archived_brains, gz)
            else:
                with gzip.open(brains_path, "wb") as gz:
                    gz.write(pickle.dumps(archived_brains, protocol=pickle.HIGHEST_PROTOCOL))

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

            # 5. Clean read-only Observatory JSON export (Phase 2 Civilization Observatory contract)
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
                config=config,
                timeline_series=timeline_series,
                timeline_id=resolved_timeline_id,
                parent_timeline_id=parent_timeline_id,
                timeline_kind=timeline_kind,
                branch_point_tick=branch_point_tick,
                rebirth_records=rebirth_records,
            )
            with open(obs_path, "w", encoding="utf-8") as fh:
                json.dump(obs_payload, fh, ensure_ascii=False, separators=(",", ":"))

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
                "timeline_id": resolved_timeline_id,
                "parent_timeline_id": parent_timeline_id,
                "timeline_kind": timeline_kind,
                "branch_point_tick": branch_point_tick,
                "deceased_brains_archived": True,
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
            if aid in brains_raw:
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

        manifest["restored_timeline_series"] = (
            json.loads(subs["timeline_series"]) if "timeline_series" in subs else []
        )
        manifest["timeline_id"] = meta.get("timeline_id") or manifest.get("timeline_id") or str(uuid.uuid5(uuid.NAMESPACE_OID, world_id))
        manifest["parent_timeline_id"] = (
            json.loads(meta["parent_timeline_id"]) if "parent_timeline_id" in meta else manifest.get("parent_timeline_id")
        )
        manifest["timeline_kind"] = meta.get("timeline_kind") or manifest.get("timeline_kind") or "original"
        manifest["branch_point_tick"] = (
            json.loads(meta["branch_point_tick"]) if "branch_point_tick" in meta else manifest.get("branch_point_tick")
        )
        manifest["restored_rebirth_records"] = (
            json.loads(subs["rebirth_records"]) if "rebirth_records" in subs else []
        )

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
        config: Optional[SimulationConfig] = None,
        timeline_series: Optional[List[dict]] = None,
        timeline_id: Optional[str] = None,
        parent_timeline_id: Optional[str] = None,
        timeline_kind: str = "original",
        branch_point_tick: Optional[int] = None,
        rebirth_records: Optional[List[dict]] = None,
    ) -> dict:
        """Read-only structured JSON contract for Civilization Observatory (zero mutation, zero global leaks in FPV)."""
        living_dict = {aid: ag for aid, ag in agents.all_agents.items() if ag.is_alive}
        living = list(living_dict.values())
        deceased = [ag for ag in agents.all_agents.values() if not ag.is_alive]

        base_vision = config.base_vision_radius_m if config is not None else 120.0
        base_hearing = config.base_hearing_radius_m if config is not None else 180.0
        bucket_size = 150.0
        spatial_buckets: Dict[Tuple[int, int], List[int]] = {}
        for aid, ag in living_dict.items():
            key = (int(ag.x // bucket_size), int(ag.y // bucket_size))
            spatial_buckets.setdefault(key, []).append(aid)

        age_dist = {"infant": 0, "child": 0, "adult": 0, "elder": 0}
        for ag in living:
            age_dist[ag.life_stage] = age_dist.get(ag.life_stage, 0) + 1

        living_fauna = [f for f in world.fauna.values() if f.alive]
        artifacts_export = [a.to_dict() for a in history.artifacts[-500:]]

        def _social_ties(ag: Agent) -> List[dict]:
            known_ids = set(ag.memory.familiarity.keys()) | set(ag.memory.trust.keys())
            ties = [
                {
                    "agent_id": oid,
                    "familiarity": round(ag.memory.familiarity.get(oid, 0.0), 3),
                    "trust": round(ag.memory.trust.get(oid, 0.0), 3),
                }
                for oid in sorted(known_ids)
            ]
            ties.sort(key=lambda item: (-item["familiarity"], -abs(item["trust"])))
            return ties[:30]

        living_agents_full: List[dict] = []
        for a in living:
            perc = PerceptionEngine.perceive(
                agent=a,
                world=world,
                living_agents=living_dict,
                spatial_buckets=spatial_buckets,
                recent_emissions=comm.recent_emissions,
                artifacts=history.artifacts,
                is_night=clock.is_night,
                base_vision=base_vision,
                base_hearing=base_hearing,
                bucket_size=bucket_size,
            )
            vis_fauna_ids = [
                f.fauna_id
                for f in living_fauna
                if math.hypot(f.x - a.x, f.y - a.y) <= perc.vision_radius_m
            ]
            # NOTE: Omit ground-truth `context_tag` from heard_emissions so FPV stays strictly non-telepathic
            heard_list = [
                {
                    "speaker_id": em.speaker_id,
                    "token": em.token,
                    "gesture": em.gesture,
                    "x": round(em.x, 1),
                    "y": round(em.y, 1),
                    "tick": em.tick,
                    "distance_m": round(math.hypot(em.x - a.x, em.y - a.y), 1),
                }
                for em in perc.heard_emissions
            ]
            living_agents_full.append(
                {
                    "agent_id": a.agent_id,
                    "sex": a.sex,
                    "x": round(a.x, 2),
                    "y": round(a.y, 2),
                    "birth_tick": a.birth_tick,
                    "generation": a.generation,
                    "parent_a_id": a.parent_a_id,
                    "parent_b_id": a.parent_b_id,
                    "children_ids": list(a.children_ids),
                    "is_alive": True,
                    "age_ticks": a.age_ticks,
                    "age_years": round(a.age_years, 2),
                    "life_stage": a.life_stage,
                    "health": round(a.health, 3),
                    "hunger": round(a.hunger, 3),
                    "thirst": round(a.thirst, 3),
                    "energy": round(a.energy, 3),
                    "injury": round(a.injury, 3),
                    "disease_load": round(a.disease_load, 3),
                    "is_pregnant": a.is_pregnant,
                    "gestation_ticks": a.gestation_ticks,
                    "last_action": a.last_action,
                    "last_emitted_token": a.last_emitted_token,
                    "carried_item": a.carried_item,
                    "last_partner_id": a.last_partner_id,
                    "rebirth_count": a.rebirth_count,
                    "rebirth_tick": a.rebirth_tick,
                    "original_death_tick": a.original_death_tick,
                    "original_death_date": a.original_death_date,
                    "original_cause_of_death": a.original_cause_of_death,
                    "death_penalty_record": a.death_penalty_record,
                    "brain_fingerprint": a.brain.weight_fingerprint() if a.brain is not None else None,
                    "traits": asdict(a.traits),
                    "inventory": {k: round(v, 3) for k, v in a.inventory.items()},
                    "skills": {k: round(v, 3) for k, v in a.memory.skills.items()},
                    "lexicon_size": len(a.lexicon),
                    "lexicon": {str(tok): ctx_map for tok, ctx_map in a.lexicon.items()},
                    "episodic_memories": [asdict(e) for e in a.memory.episodic[-25:]],
                    "spatial_memories": [asdict(s) for s in list(a.memory.spatial_map.values())[:20]],
                    "social_ties": _social_ties(a),
                    "local_perception": {
                        "vision_radius_m": perc.vision_radius_m,
                        "hearing_radius_m": perc.hearing_radius_m,
                        "visible_agent_ids": perc.nearby_agent_ids,
                        "visible_artifact_ids": [art.artifact_id for art in perc.nearby_artifacts],
                        "visible_fauna_ids": vis_fauna_ids,
                        "local_water": round(perc.local_water, 2),
                        "local_food": round(perc.local_food, 2),
                        "local_wood": round(perc.local_wood, 2),
                        "local_stone": round(perc.local_stone, 2),
                        "local_herb": round(perc.local_herb, 2),
                        "heard_emissions": heard_list,
                    },
                }
            )

        deceased_archive = [
            {
                "agent_id": a.agent_id,
                "sex": a.sex,
                "x": round(a.x, 2),
                "y": round(a.y, 2),
                "birth_tick": a.birth_tick,
                "death_tick": a.death_tick,
                "cause_of_death": a.cause_of_death,
                "age_ticks": a.age_ticks,
                "age_years": round(a.age_years, 2),
                "life_stage": a.life_stage,
                "generation": a.generation,
                "parent_a_id": a.parent_a_id,
                "parent_b_id": a.parent_b_id,
                "children_ids": list(a.children_ids),
                "is_alive": False,
                "last_action": a.last_action,
                "rebirth_count": a.rebirth_count,
                "rebirth_tick": a.rebirth_tick,
                "original_death_tick": a.original_death_tick,
                "original_death_date": a.original_death_date,
                "original_cause_of_death": a.original_cause_of_death,
                "death_penalty_record": a.death_penalty_record,
                "brain_fingerprint": a.brain.weight_fingerprint() if a.brain is not None else None,
                "traits": asdict(a.traits),
                "skills": {k: round(v, 3) for k, v in a.memory.skills.items()},
                "lexicon_size": len(a.lexicon),
                "episodic_memories": [asdict(e) for e in a.memory.episodic[-20:]],
                "social_ties": _social_ties(a),
            }
            for a in deceased
        ]

        milestones = {
            "first_movement_tick": agents.first_movement_tick,
            "first_interaction_tick": agents.first_interaction_tick,
            "first_birth_tick": agents.first_birth_tick,
            "first_death_tick": agents.first_death_tick,
            "first_communication_tick": comm.milestones.first_communication_tick,
            "first_repeated_signal_tick": comm.milestones.first_repeated_signal_tick,
            "first_shared_symbol_tick": comm.milestones.first_shared_symbol_tick,
            "first_stable_protoword_tick": comm.milestones.first_stable_protoword_tick,
            "first_grammar_sequence_tick": comm.milestones.first_grammar_sequence_tick,
            "first_dialect_divergence_tick": comm.milestones.first_dialect_divergence_tick,
            "first_documentation_tick": history.first_documentation_tick,
            "first_history_written_tick": history.first_history_written_tick,
            "first_alliance_tick": society.first_alliance_tick,
            "first_conflict_tick": society.first_conflict_tick,
            "first_crime_tick": society.first_crime_tick,
            "first_barter_tick": society.first_barter_tick,
            "first_market_tick": society.first_market_tick,
            "first_norm_tick": society.first_norm_tick,
            "first_governance_tick": society.first_governance_tick,
            "first_currency_exchange_tick": society.first_currency_exchange_tick,
        }

        eco_summary = world.ecosystem_summary()
        eco_summary["fauna"] = [
            {
                "fauna_id": f.fauna_id,
                "species": f.species,
                "x": round(f.x, 1),
                "y": round(f.y, 1),
                "energy": round(f.energy, 3),
                "health": round(f.health, 3),
                "age_ticks": f.age_ticks,
            }
            for f in living_fauna
        ]

        lang_summary = comm.summary()
        lang_summary["extinct_tokens_count"] = comm.milestones.extinct_tokens_count

        crime_payload = dict(metrics)
        crime_payload["recent_crimes"] = [c.to_dict() for c in society.crimes[-120:]]
        crime_payload["exchange_hubs"] = [
            {
                "x": round((hx + 0.5) * 125.0, 1),
                "y": round((hy + 0.5) * 125.0, 1),
                "count": cnt,
                "is_market": cnt >= 12,
            }
            for (hx, hy), cnt in society.exchange_hubs.items()
        ]

        return {
            "export_schema_version": SCHEMA_VERSION,
            "exported_at_utc": datetime.now(timezone.utc).isoformat(),
            "world_id": world_id,
            "timeline_id": timeline_id or str(uuid.uuid5(uuid.NAMESPACE_OID, world_id)),
            "parent_timeline_id": parent_timeline_id,
            "timeline_kind": timeline_kind,
            "branch_point_tick": branch_point_tick,
            "rebirth_records": list(rebirth_records or []),
            "backend": backend_name,
            "clock": clock.to_dict(),
            "engine_capabilities": {
                "has_buildings_grid": False,
                "has_roads_grid": False,
                "has_farms_grid": False,
                "has_shelter_tech_milestone": "simple_shelter" in agents.discovered_techs,
                "has_market_hubs": len(society.exchange_hubs) > 0,
            },
            "world_terrain": {
                "width_m": world.width_m,
                "height_m": world.height_m,
                "cell_size_m": world.cell_size_m,
                "cols": world.cols,
                "rows": world.rows,
                "elevation": [round(v, 1) for v in world.elevation],
                "water": [round(v, 1) for v in world.water],
                "moisture": [round(v, 2) for v in world.moisture],
                "fertility": [round(v, 2) for v in world.fertility],
                "food_flora": [round(v, 1) for v in world.food_flora],
                "wood_flora": [round(v, 1) for v in world.wood_flora],
                "herb_flora": [round(v, 1) for v in world.herb_flora],
                "stone_mineral": [round(v, 1) for v in world.stone_mineral],
            },
            "demographics": {
                "living_count": len(living),
                "deceased_count": len(deceased),
                "total_ever_born": len(agents.all_agents),
                "births_total": sum(1 for a in agents.all_agents.values() if a.birth_tick > 0),
                "deaths_total": len(deceased),
                "max_generation": max((a.generation for a in agents.all_agents.values()), default=0),
                "avg_age_years": round(sum(a.age_years for a in living) / max(1, len(living)), 2),
                "age_distribution": age_dist,
                "discovered_techs": dict(agents.discovered_techs),
            },
            "ecosystem": eco_summary,
            "emergent_language": lang_summary,
            "crime_and_stability": crime_payload,
            "groups": [g.to_dict() for g in society.groups.values()],
            "history_layers": {
                "milestones": milestones,
                "layer_1_ground_truth_tail": [e.to_dict() for e in history.observer_get_truth_tail(400)],
                "layer_2_witness_accounts_tail": [w.to_dict() for w in history.witness_accounts[-250:]],
                "layer_2_surface_artifacts_count": len(history.artifacts),
                "layer_2_surface_artifacts": artifacts_export,
                "layer_3_interpretations_tail": [i.to_dict() for i in history.interpretations[-250:]],
            },
            "living_agents_full": living_agents_full,
            "deceased_agents_archive": deceased_archive,
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
            "timeline_series": list(timeline_series or []),
        }


def new_world_id(seed: int) -> str:
    return f"world_{seed}_{uuid.uuid4().hex[:8]}"
