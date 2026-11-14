"""Practical CPU Performance Benchmark — measures real ticks/sec, RAM, brain update cost, and checkpoint size."""

from __future__ import annotations

import argparse
import json
import resource
import tempfile
import time
from pathlib import Path

from sim.config import SimulationConfig, detect_hardware_budget
from sim.orchestrator import SimulationEngine


def run_benchmark(ticks: int = 120, require_torch: bool = False) -> dict:
    hw = detect_hardware_budget()
    cfg = SimulationConfig(
        seed=909,
        initial_population=100,
        speed_mode="max_cpu_research",
        require_torch=require_torch,
    )

    t0 = time.monotonic()
    engine = SimulationEngine.create_new(cfg)
    init_sec = time.monotonic() - t0

    t1 = time.monotonic()
    for _ in range(ticks):
        engine.step_tick()
    sim_sec = time.monotonic() - t1

    with tempfile.TemporaryDirectory() as tmp:
        ckpt_dir = Path(tmp) / "bench_ckpt"
        t2 = time.monotonic()
        manifest = engine.save_checkpoint(ckpt_dir)
        save_sec = time.monotonic() - t2

        ckpt_bytes = sum(p.stat().st_size for p in ckpt_dir.iterdir() if p.is_file())

        t3 = time.monotonic()
        _restored = SimulationEngine.resume_from_checkpoint(ckpt_dir, require_torch=require_torch)
        restore_sec = time.monotonic() - t3

    rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    ticks_per_sec = ticks / max(1e-6, sim_sec)
    sim_months_per_real_min = (ticks_per_sec * 60.0) / float(cfg.ticks_per_month)
    brain_updates_total = sum(
        ag.brain.total_updates for ag in engine.agents.all_agents.values() if ag.brain is not None
    )

    return {
        "backend": engine.backend_name,
        "hardware": {
            "cpu_count": hw.cpu_count,
            "total_ram_mb": hw.total_ram_mb,
            "available_ram_mb": hw.available_ram_mb,
            "torch_threads": hw.recommended_torch_threads,
        },
        "ticks_executed": ticks,
        "sim_months_simulated": round(ticks / float(cfg.ticks_per_month), 2),
        "init_seconds": round(init_sec, 4),
        "sim_seconds": round(sim_sec, 4),
        "ticks_per_real_sec": round(ticks_per_sec, 2),
        "max_sim_months_per_real_min": round(sim_months_per_real_min, 2),
        "brain_gradient_updates_executed": brain_updates_total,
        "checkpoint_save_seconds": round(save_sec, 4),
        "checkpoint_restore_seconds": round(restore_sec, 4),
        "checkpoint_total_size_kb": round(ckpt_bytes / 1024.0, 2),
        "peak_rss_mb": round(rss_kb / 1024.0, 2),
        "living_population_end": manifest["living_population"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark CPU performance of the simulation engine")
    parser.add_argument("--ticks", type=int, default=120)
    parser.add_argument("--require-torch", action="store_true")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    res = run_benchmark(ticks=args.ticks, require_torch=args.require_torch)
    text = json.dumps(res, indent=2)
    print(text)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
