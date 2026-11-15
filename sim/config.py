"""Core configuration, spatial scale, time scale, and host hardware inspection."""

from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from typing import Literal


SpeedMode = Literal["realtime_1m_1mo", "max_cpu_research"]


@dataclass(frozen=True)
class HardwareBudget:
    cpu_count: int
    total_ram_mb: int
    available_ram_mb: int
    recommended_torch_threads: int
    batch_learn_interval_ticks: int


def detect_hardware_budget() -> HardwareBudget:
    """Inspect actual host CPU and memory resources without assuming unlimited compute."""
    cpu_count = os.cpu_count() or 2
    total_ram_mb = 4096
    available_ram_mb = 2048

    meminfo_path = "/proc/meminfo"
    if os.path.exists(meminfo_path):
        try:
            with open(meminfo_path, "r", encoding="utf-8") as fh:
                info = {}
                for line in fh:
                    parts = line.split(":")
                    if len(parts) == 2:
                        val_tokens = parts[1].strip().split()
                        if val_tokens and val_tokens[0].isdigit():
                            info[parts[0].strip()] = int(val_tokens[0]) // 1024
                if "MemTotal" in info:
                    total_ram_mb = info["MemTotal"]
                if "MemAvailable" in info:
                    available_ram_mb = info["MemAvailable"]
                elif "MemFree" in info:
                    available_ram_mb = info["MemFree"]
        except OSError:
            pass

    # Keep PyTorch CPU threads bounded to avoid thread-oversubscription overhead on small networks
    recommended_threads = max(1, min(cpu_count, 4))
    batch_interval = 6 if cpu_count >= 2 else 10

    return HardwareBudget(
        cpu_count=cpu_count,
        total_ram_mb=total_ram_mb,
        available_ram_mb=available_ram_mb,
        recommended_torch_threads=recommended_threads,
        batch_learn_interval_ticks=batch_interval,
    )


@dataclass
class SimulationConfig:
    # 5 km^2 area = 2500m x 2000m = 5,000,000 m^2
    world_width_m: float = 2500.0
    world_height_m: float = 2000.0
    cell_size_m: float = 25.0  # 100 x 80 = 8,000 ecological cells

    # Initial autonomous population
    initial_population: int = 100
    max_population_soft_cap: int = 1200  # Ecological/CPU safeguard, not an artificial target

    # Time scale: 1 real minute = 1 sim month (30 sim days)
    # 1 tick = 1 simulated day -> 30 ticks/month, 360 ticks/year, 3600 ticks = 10 years
    days_per_month: int = 30
    months_per_year: int = 12
    ticks_per_day: int = 1
    real_seconds_per_sim_month: float = 60.0
    election_cycle_years: int = 10  # 10 years (120 months) available ONLY if society invents voting

    # Neural brain sizing (compact per-agent GRU + MLP for CPU efficiency)
    observation_dim: int = 36
    hidden_dim: int = 24
    num_actions: int = 18
    num_signal_tokens: int = 24
    learning_rate: float = 0.005
    max_experience_buffer: int = 64
    learn_batch_size: int = 12
    learn_interval_ticks: int = 6
    entropy_coef: float = 0.018
    gae_lambda: float = 0.90

    # Sensory limits (strict locality)
    base_vision_radius_m: float = 120.0
    base_hearing_radius_m: float = 180.0
    interaction_radius_m: float = 35.0

    # Automatic Population Recovery System (post-total-extinction only)
    auto_recover_on_extinction: bool = True
    recovery_founder_count: int = 4

    # Runtime & Persistence
    seed: int = 42
    speed_mode: SpeedMode = "max_cpu_research"
    require_torch: bool = False
    runtime_budget_minutes: float = 300.0
    shutdown_reserve_minutes: float = 12.0
    checkpoint_interval_minutes: float = 25.0
    checkpoint_interval_ticks: int = 3600  # Every 10 sim years or every 25 real minutes

    @property
    def grid_cols(self) -> int:
        return int(self.world_width_m // self.cell_size_m)

    @property
    def grid_rows(self) -> int:
        return int(self.world_height_m // self.cell_size_m)

    @property
    def ticks_per_month(self) -> int:
        return self.days_per_month * self.ticks_per_day

    @property
    def ticks_per_year(self) -> int:
        return self.ticks_per_month * self.months_per_year

    def to_dict(self) -> dict:
        return asdict(self)
