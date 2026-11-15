"""Command-line interface for Isolated Survival Training, Population Transfer, and Civilization Simulation."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .bundle import (
    BundleIntegrityError,
    export_population_bundle,
    promote_bundle_to_civilization,
    verify_population_bundle,
)
from .config import SimulationConfig, detect_hardware_budget
from .orchestrator import SimulationEngine
from .persistence import CheckpointIntegrityError, PersistenceEngine
from .rebirth import RebirthIntegrityError, compare_timelines, create_experimental_rebirth_branch
from .training import IsolatedSurvivalTrainer, TrainingConfig, TrainingIntegrityError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python3 -m sim.cli",
        description="From Beginning to Civilization — Autonomous Simulation & Training Engine CLI",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--checkpoint-dir", type=Path, required=True, help="Directory for atomic checkpoints & logs")
        p.add_argument("--runtime-budget-minutes", type=float, default=300.0)
        p.add_argument("--shutdown-reserve-minutes", type=float, default=12.0)
        p.add_argument("--checkpoint-interval-minutes", type=float, default=25.0)
        p.add_argument("--checkpoint-interval-ticks", type=int, default=3600)
        p.add_argument("--max-ticks", type=int, default=None, help="Optional hard tick limit for this run")
        p.add_argument("--speed-mode", choices=["realtime_1m_1mo", "max_cpu_research"], default="max_cpu_research")
        p.add_argument("--require-torch", action="store_true", help="Fail if PyTorch CPU is unavailable")
        p.add_argument("--log-file", type=Path, default=None)

    # --- Isolated Survival Training Phase ---
    p_tr_new = sub.add_parser("start-training", help="Start isolated survival training with 100 identical template clones")
    add_common(p_tr_new)
    p_tr_new.add_argument("--seed", type=int, default=42)
    p_tr_new.add_argument("--agent-count", type=int, default=100)

    p_tr_res = sub.add_parser("resume-training", help="Resume isolated survival training from verified checkpoint")
    add_common(p_tr_res)

    p_tr_insp = sub.add_parser("inspect-training", help="Verify and print summary metrics of a training checkpoint")
    p_tr_insp.add_argument("--checkpoint-dir", type=Path, required=True)

    # --- Single-File Population Transfer & Promotion ---
    p_exp = sub.add_parser("export-population", help="Export 100 trained agents & brains into one compressed bundle")
    p_exp.add_argument("--checkpoint-dir", type=Path, required=True)
    p_exp.add_argument("--output-bundle", type=Path, required=True)
    p_exp.add_argument("--require-torch", action="store_true")

    p_ver = sub.add_parser("verify-bundle", help="Strictly verify checksums & schema of a population bundle")
    p_ver.add_argument("--bundle-path", type=Path, required=True)
    p_ver.add_argument("--require-torch", action="store_true")

    p_prom = sub.add_parser("promote-to-civilization", help="Promote verified trained population bundle into full 5km^2 civilization")
    p_prom.add_argument("--bundle-path", type=Path, required=True)
    p_prom.add_argument("--checkpoint-dir", type=Path, required=True)
    p_prom.add_argument("--seed", type=int, default=42)
    p_prom.add_argument("--runtime-budget-minutes", type=float, default=300.0)
    p_prom.add_argument("--shutdown-reserve-minutes", type=float, default=12.0)
    p_prom.add_argument("--checkpoint-interval-minutes", type=float, default=25.0)
    p_prom.add_argument("--checkpoint-interval-ticks", type=int, default=3600)
    p_prom.add_argument("--max-ticks", type=int, default=None)
    p_prom.add_argument("--speed-mode", choices=["realtime_1m_1mo", "max_cpu_research"], default="max_cpu_research")
    p_prom.add_argument("--require-torch", action="store_true")
    p_prom.add_argument("--log-file", type=Path, default=None)

    p_civ = sub.add_parser("run-civilization", help="Continue a promoted civilization simulation from verified checkpoint")
    add_common(p_civ)

    # --- Legacy / Standard Civilization Commands ---
    p_new = sub.add_parser("new-world", help="Create a brand-new 5 km^2 world with 100 independent agents")
    add_common(p_new)
    p_new.add_argument("--seed", type=int, default=42)
    p_new.add_argument("--initial-population", type=int, default=100)
    p_new.add_argument("--no-auto-recover", action="store_true", help="Disable legacy 4-founder post-extinction recovery")
    p_new.add_argument("--frames-dir", type=Path, default=None, help="Optional directory to store initial snapshot frame")

    p_res = sub.add_parser("resume-world", help="Strictly resume an existing world from a verified checkpoint")
    add_common(p_res)

    p_insp = sub.add_parser("inspect-world", help="Verify and print summary metrics of a saved checkpoint")
    p_insp.add_argument("--checkpoint-dir", type=Path, required=True)

    p_step = sub.add_parser("step-checkpoint", help="Advance checkpoint by N ticks and optionally store frame snapshots")
    p_step.add_argument("--checkpoint-dir", type=Path, required=True)
    p_step.add_argument("--ticks", type=int, default=1)
    p_step.add_argument("--frames-dir", type=Path, default=None)
    p_step.add_argument("--frame-stride", type=int, default=1)
    p_step.add_argument("--require-torch", action="store_true")

    p_reb = sub.add_parser(
        "create-experimental-branch",
        help="Create an independent experimental rebirth timeline from a verified checkpoint",
    )
    p_reb.add_argument("--source-dir", type=Path, required=True)
    p_reb.add_argument("--target-dir", type=Path, required=True)
    p_reb.add_argument("--agent-ids", type=str, default=None, help="Comma-separated IDs (default: all deceased)")
    p_reb.add_argument("--require-torch", action="store_true")

    p_cmp = sub.add_parser("compare-timelines", help="Compare real outcomes between original and experimental timelines")
    p_cmp.add_argument("--original-dir", type=Path, required=True)
    p_cmp.add_argument("--experimental-dir", type=Path, required=True)

    return parser


def _write_frame_snapshot(engine: SimulationEngine, frames_dir: Path) -> None:
    frames_dir.mkdir(parents=True, exist_ok=True)
    obs = PersistenceEngine.build_observatory_export(
        world_id=engine.world_id,
        clock=engine.clock,
        world=engine.world,
        agents=engine.agents,
        comm=engine.comm,
        society=engine.society,
        history=engine.history,
        metrics=engine.current_metrics(),
        backend_name=engine.backend_name,
        config=engine.config,
        timeline_series=engine.timeline_series,
        timeline_id=engine.timeline_id,
        parent_timeline_id=engine.parent_timeline_id,
        timeline_kind=engine.timeline_kind,
        branch_point_tick=engine.branch_point_tick,
        rebirth_records=engine.rebirth_records,
        recovery_state=engine._recovery_state_dict(),
        analytics=engine.analytics,
        simulation_phase=engine.simulation_phase,
        training_analytics=engine.training_analytics,
    )
    frame_path = frames_dir / f"tick_{engine.clock.tick:06d}.json"
    frame_path.write_text(json.dumps(obs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if getattr(args, "log_file", None) is not None:
        args.log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(args.log_file, encoding="utf-8"))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )

    hw = detect_hardware_budget()
    logging.info("Host hardware detected: %s", hw)

    if args.command == "start-training":
        tcfg = TrainingConfig(
            template_seed=args.seed,
            agent_count=args.agent_count,
            speed_mode=args.speed_mode,
            require_torch=args.require_torch,
            runtime_budget_minutes=args.runtime_budget_minutes,
            shutdown_reserve_minutes=args.shutdown_reserve_minutes,
            checkpoint_interval_minutes=args.checkpoint_interval_minutes,
            checkpoint_interval_ticks=args.checkpoint_interval_ticks,
        )
        trainer = IsolatedSurvivalTrainer.create_new(tcfg)
        result = trainer.run(checkpoint_dir=args.checkpoint_dir, max_ticks=args.max_ticks)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "resume-training":
        try:
            trainer = IsolatedSurvivalTrainer.resume_from_checkpoint(
                args.checkpoint_dir, require_torch=args.require_torch
            )
        except TrainingIntegrityError as exc:
            logging.error("TRAINING RESUME ABORTED: %s", exc)
            return 2
        trainer.config.speed_mode = args.speed_mode
        trainer.config.runtime_budget_minutes = args.runtime_budget_minutes
        trainer.config.shutdown_reserve_minutes = args.shutdown_reserve_minutes
        trainer.config.checkpoint_interval_minutes = args.checkpoint_interval_minutes
        trainer.config.checkpoint_interval_ticks = args.checkpoint_interval_ticks
        result = trainer.run(checkpoint_dir=args.checkpoint_dir, max_ticks=args.max_ticks)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "inspect-training":
        try:
            trainer = IsolatedSurvivalTrainer.resume_from_checkpoint(args.checkpoint_dir, require_torch=False)
            ta = trainer.build_training_analytics_payload()
            summary = {
                "training_id": trainer.training_id,
                "training_tick": trainer.clock.tick,
                "agent_count": ta["agent_count"],
                "total_attempts": ta["total_attempts"],
                "total_deaths": ta["total_deaths"],
                "avg_survival_ticks": ta["avg_survival_ticks"],
                "max_longest_survival_ticks": ta["max_longest_survival_ticks"],
                "avg_learning_level": ta["avg_learning_level"],
                "stage_totals": ta["stage_totals"],
                "death_causes_breakdown": ta["death_causes_breakdown"],
            }
            print(json.dumps(summary, indent=2, ensure_ascii=False))
            return 0
        except TrainingIntegrityError as exc:
            logging.error("Training checkpoint inspection failed: %s", exc)
            return 2

    if args.command == "export-population":
        try:
            manifest = export_population_bundle(
                training_checkpoint_dir=args.checkpoint_dir,
                output_bundle_path=args.output_bundle,
                require_torch=args.require_torch,
            )
            print(json.dumps(manifest, indent=2, ensure_ascii=False))
            return 0
        except BundleIntegrityError as exc:
            logging.error("Population export failed: %s", exc)
            return 2

    if args.command == "verify-bundle":
        try:
            report = verify_population_bundle(args.bundle_path, require_torch=args.require_torch)
            print(json.dumps(report, indent=2, ensure_ascii=False))
            return 0
        except BundleIntegrityError as exc:
            logging.error("Bundle verification failed: %s", exc)
            return 2

    if args.command == "promote-to-civilization":
        try:
            engine = promote_bundle_to_civilization(
                bundle_path=args.bundle_path,
                civilization_checkpoint_dir=args.checkpoint_dir,
                world_seed=args.seed,
                speed_mode=args.speed_mode,
                runtime_budget_minutes=args.runtime_budget_minutes,
                shutdown_reserve_minutes=args.shutdown_reserve_minutes,
                checkpoint_interval_minutes=args.checkpoint_interval_minutes,
                require_torch=args.require_torch,
            )
        except BundleIntegrityError as exc:
            logging.error("Promotion aborted (never creating untrained fallback world): %s", exc)
            return 2
        if args.max_ticks is not None and args.max_ticks > 0:
            result = engine.run(checkpoint_dir=args.checkpoint_dir, max_ticks=args.max_ticks)
        else:
            manifest = engine.save_checkpoint(args.checkpoint_dir)
            result = {
                "world_id": engine.world_id,
                "simulation_phase": engine.simulation_phase,
                "stop_reason": "promoted_initial_checkpoint",
                "ticks_executed_this_run": 0,
                "final_tick": engine.clock.tick,
                "final_sim_date": engine.clock.sim_date_str(),
                "backend": engine.backend_name,
                "manifest": manifest,
                "metrics": engine.current_metrics(),
            }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "inspect-world":
        try:
            world_id, cfg, clock, _w, agents, comm, society, _h, _rng, manifest = PersistenceEngine.load_checkpoint(
                args.checkpoint_dir, require_torch=False
            )
            summary = {
                "world_id": world_id,
                "simulation_phase": manifest.get("simulation_phase", "civilization"),
                "auto_recover_on_extinction": bool(cfg.auto_recover_on_extinction),
                "training_rebirth_enabled": bool(cfg.training_rebirth_enabled),
                "timeline_id": manifest.get("timeline_id"),
                "parent_timeline_id": manifest.get("parent_timeline_id"),
                "timeline_kind": manifest.get("timeline_kind", "original"),
                "manifest": manifest,
                "clock": clock.to_dict(),
                "living_population": len(agents.living_agents()),
                "total_agents_ever": len(agents.all_agents),
                "emergent_language": comm.summary(),
                "crime_and_stability": society.crime_and_stability_metrics(clock.tick, agents.living_agents()),
            }
            print(json.dumps(summary, indent=2, ensure_ascii=False))
            return 0
        except CheckpointIntegrityError as exc:
            logging.error("Checkpoint inspection failed: %s", exc)
            return 2

    if args.command == "create-experimental-branch":
        try:
            parsed_ids = (
                [int(tok.strip()) for tok in args.agent_ids.split(",") if tok.strip()]
                if args.agent_ids
                else None
            )
            report = create_experimental_rebirth_branch(
                source_checkpoint_dir=args.source_dir,
                target_branch_dir=args.target_dir,
                agent_ids=parsed_ids,
                require_torch=args.require_torch,
            )
            print(json.dumps(report, indent=2, ensure_ascii=False))
            return 0
        except (CheckpointIntegrityError, RebirthIntegrityError) as exc:
            logging.error("Experimental branch creation failed: %s", exc)
            return 2

    if args.command == "compare-timelines":
        try:
            report = compare_timelines(args.original_dir, args.experimental_dir)
            print(json.dumps(report, indent=2, ensure_ascii=False))
            return 0
        except FileNotFoundError as exc:
            logging.error("Compare failed: %s", exc)
            return 2

    if args.command == "step-checkpoint":
        try:
            engine = SimulationEngine.resume_from_checkpoint(args.checkpoint_dir, require_torch=args.require_torch)
            engine._active_checkpoint_dir = args.checkpoint_dir
        except CheckpointIntegrityError as exc:
            logging.error("Step aborted: %s", exc)
            return 2
        n_ticks = max(0, int(args.ticks))
        stride = max(1, int(args.frame_stride))
        if args.frames_dir is not None and engine.clock.tick == 0:
            _write_frame_snapshot(engine, args.frames_dir)
        executed = 0
        for _ in range(n_ticks):
            if engine._stop_requested:
                break
            engine.step_tick()
            executed += 1
            if args.frames_dir is not None and (executed % stride == 0 or executed == n_ticks or engine._stop_requested):
                _write_frame_snapshot(engine, args.frames_dir)
        manifest = engine.save_checkpoint(args.checkpoint_dir)
        print(
            json.dumps(
                {
                    "world_id": engine.world_id,
                    "timeline_id": engine.timeline_id,
                    "timeline_kind": engine.timeline_kind,
                    "ticks_executed": executed,
                    "final_tick": engine.clock.tick,
                    "final_sim_date": engine.clock.sim_date_str(),
                    "living_population": len(engine.agents.living_agents()),
                    "stop_reason": engine._stop_reason or "stepped",
                    "manifest": manifest,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 0

    if args.command == "new-world":
        cfg = SimulationConfig(
            seed=args.seed,
            initial_population=args.initial_population,
            auto_recover_on_extinction=not args.no_auto_recover,
            training_rebirth_enabled=False,
            speed_mode=args.speed_mode,
            require_torch=args.require_torch,
            runtime_budget_minutes=args.runtime_budget_minutes,
            shutdown_reserve_minutes=args.shutdown_reserve_minutes,
            checkpoint_interval_minutes=args.checkpoint_interval_minutes,
            checkpoint_interval_ticks=args.checkpoint_interval_ticks,
        )
        engine = SimulationEngine.create_new(cfg)
        if getattr(args, "frames_dir", None) is not None:
            _write_frame_snapshot(engine, args.frames_dir)
    elif args.command in ("resume-world", "run-civilization"):
        try:
            engine = SimulationEngine.resume_from_checkpoint(
                args.checkpoint_dir, require_torch=args.require_torch
            )
        except CheckpointIntegrityError as exc:
            logging.error("RESUME ABORTED (never creating a replacement world): %s", exc)
            return 2
        if args.command == "run-civilization":
            engine.config.auto_recover_on_extinction = False
            engine.config.training_rebirth_enabled = False
            engine.simulation_phase = "civilization"
        engine.config.speed_mode = args.speed_mode
        engine.config.runtime_budget_minutes = args.runtime_budget_minutes
        engine.config.shutdown_reserve_minutes = args.shutdown_reserve_minutes
        engine.config.checkpoint_interval_minutes = args.checkpoint_interval_minutes
        engine.config.checkpoint_interval_ticks = args.checkpoint_interval_ticks
    else:
        parser.print_help()
        return 1

    result = engine.run(checkpoint_dir=args.checkpoint_dir, max_ticks=args.max_ticks)
    if args.command == "new-world" and getattr(args, "frames_dir", None) is not None:
        _write_frame_snapshot(engine, args.frames_dir)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
