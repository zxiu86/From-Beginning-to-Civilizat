"""Rebirth & Experimental Timeline System — independent checkpoint branching, neural continuity, and memory isolation."""

from __future__ import annotations

import json
import shutil
import uuid
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

from .orchestrator import SimulationEngine
from .physics import find_nearest_passable


class RebirthIntegrityError(RuntimeError):
    """Raised when an experimental rebirth branch cannot be safely created from verified source data."""


def create_experimental_rebirth_branch(
    source_checkpoint_dir: Path,
    target_branch_dir: Path,
    agent_ids: Optional[List[int]] = None,
    require_torch: bool = False,
) -> dict:
    """
    Create a completely independent experimental timeline branched from a verified checkpoint.
    Preserves the exact world state at the branch point (without resetting terrain, depletion,
    weather, fauna, or artifacts), revives deceased individuals with their exact original identity,
    neural weights/optimizer/hidden state, traits, lexicon, skills, and strictly pre-death memories,
    and writes an isolated checkpoint in `target_branch_dir` while leaving `source_checkpoint_dir` untouched.
    """
    src_resolved = source_checkpoint_dir.resolve()
    dst_resolved = target_branch_dir.resolve()
    if src_resolved == dst_resolved:
        raise RebirthIntegrityError(
            "Target experimental branch directory must be separate from the original checkpoint directory."
        )

    engine = SimulationEngine.resume_from_checkpoint(source_checkpoint_dir, require_torch=require_torch)
    branch_tick = engine.clock.tick
    sim_date = engine.clock.sim_date_str()
    parent_timeline_id = engine.timeline_id
    new_timeline_id = str(uuid.uuid4())

    target_filter = set(agent_ids) if agent_ids is not None else None
    candidates = [
        ag for aid, ag in sorted(engine.agents.all_agents.items())
        if (not ag.is_alive) and (target_filter is None or aid in target_filter)
    ]

    if not candidates:
        raise RebirthIntegrityError(
            "No deceased individuals eligible for rebirth were found in the source checkpoint."
        )

    revived_records: List[dict] = []
    revived_ids: List[int] = []

    for ag in candidates:
        if ag.brain is None:
            raise RebirthIntegrityError(
                f"Deceased agent {ag.agent_id} lacks archived neural network weights in source checkpoint; "
                "refusing to fabricate a replacement brain."
            )

        death_cutoff = ag.death_tick if ag.death_tick is not None else branch_tick
        orig_death_tick = ag.original_death_tick if ag.original_death_tick is not None else death_cutoff
        orig_cause = ag.original_cause_of_death or ag.cause_of_death or "unknown"
        orig_death_date = ag.original_death_date or ""

        # Strict pre-death memory isolation: NEVER expose events, deaths, or extinction after death_cutoff
        ag.memory.episodic = [
            ep for ep in ag.memory.episodic if ep.tick <= death_cutoff
        ]
        ag.memory.spatial_map = {
            key: trace
            for key, trace in ag.memory.spatial_map.items()
            if trace.last_seen_tick <= death_cutoff
        }
        if ag.brain.experience:
            ag.brain.experience = [
                exp for exp in ag.brain.experience if exp.tick <= death_cutoff
            ]

        # Biological restoration for safe post-rebirth agency (preserving true chronological age_ticks)
        safe_x, safe_y = find_nearest_passable(engine.world, ag.x, ag.y)
        ag.x = safe_x
        ag.y = safe_y
        ag.is_alive = True
        ag.health = 0.88
        ag.hunger = 0.22
        ag.thirst = 0.22
        ag.energy = 0.82
        ag.injury = 0.0
        ag.disease_load = 0.0
        ag.is_pregnant = False
        ag.gestation_ticks = 0
        ag.mate_father_id = None
        ag.last_action = "rest"
        ag.last_partner_id = None
        ag.inventory["food"] = max(float(ag.inventory.get("food", 0.0)), 0.8)

        if ag.age_ticks >= ag.max_lifespan_ticks:
            ag.max_lifespan_ticks = ag.age_ticks + 2400

        ag.original_death_tick = orig_death_tick
        ag.original_death_date = orig_death_date
        ag.original_cause_of_death = orig_cause
        ag.death_tick = None
        ag.cause_of_death = None
        ag.rebirth_count += 1
        ag.rebirth_tick = branch_tick

        brain_fp = ag.brain.weight_fingerprint()
        rec = {
            "agent_id": ag.agent_id,
            "generation": ag.generation,
            "birth_tick": ag.birth_tick,
            "original_death_tick": orig_death_tick,
            "original_cause_of_death": orig_cause,
            "rebirth_tick": branch_tick,
            "rebirth_date": sim_date,
            "rebirth_count": ag.rebirth_count,
            "preserved_age_ticks": ag.age_ticks,
            "brain_fingerprint": brain_fp,
            "episodic_memories_kept": len(ag.memory.episodic),
            "spatial_memories_kept": len(ag.memory.spatial_map),
            "death_penalty_applied": bool(ag.death_penalty_record and ag.death_penalty_record.get("applied")),
            "death_penalty_record": ag.death_penalty_record,
        }
        revived_records.append(rec)
        revived_ids.append(ag.agent_id)

        engine.history.record_truth(
            tick=branch_tick,
            sim_date=sim_date,
            event_type="experimental_rebirth",
            agent_ids=[ag.agent_id],
            x=ag.x,
            y=ag.y,
            description=(
                f"Experimental rebirth of agent {ag.agent_id} (prior death tick {orig_death_tick}: {orig_cause}) "
                f"into independent timeline {new_timeline_id[:8]}."
            ),
            metadata={
                "timeline_id": new_timeline_id,
                "parent_timeline_id": parent_timeline_id,
                "original_death_tick": orig_death_tick,
                "original_cause_of_death": orig_cause,
                "brain_fingerprint": brain_fp,
            },
        )

    engine.timeline_id = new_timeline_id
    engine.parent_timeline_id = parent_timeline_id
    engine.timeline_kind = "experimental_rebirth"
    engine.branch_point_tick = branch_tick
    engine.rebirth_records.extend(revived_records)
    engine._stop_requested = False
    engine._stop_reason = None
    engine._record_timeline_point()

    # Copy original truth archive to target branch directory first so historical Layer-1 log is preserved
    target_branch_dir.mkdir(parents=True, exist_ok=True)
    src_truth = source_checkpoint_dir / "events_truth.jsonl.gz"
    dst_truth = target_branch_dir / "events_truth.jsonl.gz"
    if src_truth.exists():
        shutil.copy2(src_truth, dst_truth)

    manifest = engine.save_checkpoint(target_branch_dir, truth_archive_path=dst_truth)
    return {
        "status": "created",
        "world_id": engine.world_id,
        "timeline_id": new_timeline_id,
        "parent_timeline_id": parent_timeline_id,
        "timeline_kind": engine.timeline_kind,
        "branch_point_tick": branch_tick,
        "branch_sim_date": sim_date,
        "revived_count": len(revived_ids),
        "revived_agent_ids": revived_ids,
        "target_branch_dir": str(target_branch_dir),
        "manifest": manifest,
        "rebirth_records": revived_records,
    }


def _load_observatory_json(path_or_dir: Path) -> dict:
    target = path_or_dir / "observatory_export.json" if path_or_dir.is_dir() else path_or_dir
    if not target.exists():
        raise FileNotFoundError(f"Observatory snapshot not found: {target}")
    with open(target, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _summarize_snapshot(snap: dict) -> dict:
    living = snap.get("living_agents_full", [])
    deceased = snap.get("deceased_agents_archive", [])
    total_agents = len(living) + len(deceased)
    demo = snap.get("demographics", {})
    crime = snap.get("crime_and_stability", {})
    causes: Counter = Counter()
    for ag in deceased:
        cause = str(ag.get("cause_of_death") or "unknown")
        causes[cause] += 1

    pop = max(0, len(living))
    return {
        "world_id": snap.get("world_id"),
        "timeline_id": snap.get("timeline_id"),
        "parent_timeline_id": snap.get("parent_timeline_id"),
        "timeline_kind": snap.get("timeline_kind", "original"),
        "branch_point_tick": snap.get("branch_point_tick"),
        "tick": int(snap.get("clock", {}).get("tick", 0)),
        "sim_date": snap.get("clock", {}).get("sim_date"),
        "living_count": len(living),
        "deceased_count": len(deceased),
        "total_agents_ever": total_agents,
        "survival_rate_pct": round((len(living) / max(1, total_agents)) * 100.0, 2),
        "births_total": int(demo.get("births_total", 0)),
        "causes_of_death": dict(causes),
        "total_crimes": int(crime.get("total_crimes", 0)),
        "crimes_by_type": dict(crime.get("crimes_by_type", {})),
        "crimes_per_1000_pop": crime.get("crimes_per_1000_pop", 0.0),
        "murder_rate_per_1000": crime.get("murder_rate_per_1000", 0.0),
        "assault_rate_per_1000": crime.get("assault_rate_per_1000", 0.0),
        "theft_rate_per_1000": crime.get("theft_rate_per_1000", 0.0),
        "total_barters": int(crime.get("total_barters", 0)),
        "social_trust_index": crime.get("social_trust_index", 0.0),
        "stability_index": crime.get("stability_index"),
        "active_groups": int(crime.get("active_groups", 0)),
        "pop": pop,
    }


def compare_timelines(original_path: Path, experimental_path: Path) -> dict:
    """Compare real observed metrics and per-agent rebirth/learning outcomes between two timelines."""
    orig_snap = _load_observatory_json(original_path)
    exp_snap = _load_observatory_json(experimental_path)

    orig_summary = _summarize_snapshot(orig_snap)
    exp_summary = _summarize_snapshot(exp_snap)

    exp_agents_by_id: Dict[int, dict] = {}
    for ag in exp_snap.get("living_agents_full", []) + exp_snap.get("deceased_agents_archive", []):
        exp_agents_by_id[int(ag["agent_id"])] = ag

    rebirth_audit: List[dict] = []
    for rec in exp_snap.get("rebirth_records", []):
        aid = int(rec["agent_id"])
        cur = exp_agents_by_id.get(aid, {})
        rebirth_audit.append({
            "agent_id": aid,
            "generation": rec.get("generation", 0),
            "original_death_tick": rec.get("original_death_tick"),
            "original_cause_of_death": rec.get("original_cause_of_death"),
            "rebirth_tick": rec.get("rebirth_tick"),
            "death_penalty_applied": rec.get("death_penalty_applied", False),
            "death_penalty_record": rec.get("death_penalty_record"),
            "currently_alive": bool(cur.get("is_alive", False)),
            "current_last_action": cur.get("last_action"),
            "post_rebirth_death_tick": cur.get("death_tick") if not cur.get("is_alive", True) else None,
            "post_rebirth_cause_of_death": cur.get("cause_of_death") if not cur.get("is_alive", True) else None,
            "brain_fingerprint": cur.get("brain_fingerprint") or rec.get("brain_fingerprint"),
        })

    return {
        "original": orig_summary,
        "experimental": exp_summary,
        "deltas": {
            "living_count_delta": exp_summary["living_count"] - orig_summary["living_count"],
            "survival_rate_pct_delta": round(exp_summary["survival_rate_pct"] - orig_summary["survival_rate_pct"], 2),
            "births_delta": exp_summary["births_total"] - orig_summary["births_total"],
            "crimes_delta": exp_summary["total_crimes"] - orig_summary["total_crimes"],
            "barters_delta": exp_summary["total_barters"] - orig_summary["total_barters"],
        },
        "rebirth_agents_count": len(rebirth_audit),
        "rebirth_agents_still_alive": sum(1 for r in rebirth_audit if r["currently_alive"]),
        "rebirth_audit": rebirth_audit,
    }
