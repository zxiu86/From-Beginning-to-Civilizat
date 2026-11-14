"""Command-line interface for manual new-world, resume-world, and world inspection operations."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .config import SimulationConfig, detect_hardware_budget
from .orchestrator import SimulationEngine
from .persistence import CheckpointIntegrityError, PersistenceEngine


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python3 -m sim.cli",
        description="From Beginning to Civilization — Autonomous Simulation Engine CLI",
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

    p_new = sub.add_parser("new-world", help="Create a brand-new 5 km^2 world with 100 independent agents")
    add_common(p_new)
    p_new.add_argument("--seed", type=int, default=42)
    p_new.add_argument("--initial-population", type=int, default=100)

    p_res = sub.add_parser("resume-world", help="Strictly resume an existing world from a verified checkpoint")
    add_common(p_res)

    p_insp = sub.add_parser("inspect-world", help="Verify and print summary metrics of a saved checkpoint")
    p_insp.add_argument("--checkpoint-dir", type=Path, required=True)

    return parser


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

    if args.command == "inspect-world":
        try:
            world_id, _cfg, clock, _w, agents, comm, society, _h, _rng, manifest = PersistenceEngine.load_checkpoint(
                args.checkpoint_dir, require_torch=False
            )
            summary = {
                "world_id": world_id,
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

    if args.command == "new-world":
        cfg = SimulationConfig(
            seed=args.seed,
            initial_population=args.initial_population,
            speed_mode=args.speed_mode,
            require_torch=args.require_torch,
            runtime_budget_minutes=args.runtime_budget_minutes,
            shutdown_reserve_minutes=args.shutdown_reserve_minutes,
            checkpoint_interval_minutes=args.checkpoint_interval_minutes,
            checkpoint_interval_ticks=args.checkpoint_interval_ticks,
        )
        engine = SimulationEngine.create_new(cfg)
    elif args.command == "resume-world":
        try:
            engine = SimulationEngine.resume_from_checkpoint(
                args.checkpoint_dir, require_torch=args.require_torch
            )
        except CheckpointIntegrityError as exc:
            logging.error("RESUME ABORTED (never creating a replacement world): %s", exc)
            return 2
        engine.config.speed_mode = args.speed_mode
        engine.config.runtime_budget_minutes = args.runtime_budget_minutes
        engine.config.shutdown_reserve_minutes = args.shutdown_reserve_minutes
        engine.config.checkpoint_interval_minutes = args.checkpoint_interval_minutes
        engine.config.checkpoint_interval_ticks = args.checkpoint_interval_ticks
    else:
        parser.print_help()
        return 1

    result = engine.run(checkpoint_dir=args.checkpoint_dir, max_ticks=args.max_ticks)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
