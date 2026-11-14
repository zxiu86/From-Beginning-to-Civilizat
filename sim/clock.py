"""Simulation Clock — decoupled from rendering, calibrated to 1 real min = 1 sim month."""

from __future__ import annotations

import time
from dataclasses import dataclass, field


SEASONS = ("spring", "summer", "autumn", "winter")


@dataclass
class SimulationClock:
    """Tracks monotonic simulation time independently of UI frame rates."""

    tick: int = 0
    days_per_month: int = 30
    months_per_year: int = 12
    ticks_per_day: int = 1
    real_seconds_per_sim_month: float = 60.0

    # Cumulative active CPU runtime across all resumed sessions
    cumulative_real_seconds: float = 0.0
    _session_start_mono: float = field(default_factory=time.monotonic, repr=False)
    _last_measure_mono: float = field(default_factory=time.monotonic, repr=False)
    _last_measure_tick: int = field(default=0, repr=False)
    measured_ticks_per_real_sec: float = 0.0
    measured_sim_months_per_real_min: float = 0.0

    @property
    def ticks_per_month(self) -> int:
        return self.days_per_month * self.ticks_per_day

    @property
    def ticks_per_year(self) -> int:
        return self.ticks_per_month * self.months_per_year

    @property
    def total_days(self) -> int:
        return self.tick // self.ticks_per_day

    @property
    def year(self) -> int:
        return self.total_days // (self.days_per_month * self.months_per_year)

    @property
    def month(self) -> int:
        return (self.total_days // self.days_per_month) % self.months_per_year

    @property
    def day_of_month(self) -> int:
        return self.total_days % self.days_per_month

    @property
    def total_months(self) -> int:
        return self.total_days // self.days_per_month

    @property
    def season(self) -> str:
        return SEASONS[(self.month // 3) % 4]

    @property
    def day_phase(self) -> float:
        """Fractional phase of day [0.0, 1.0). When ticks_per_day == 1, alternates solar exposure smoothly."""
        if self.ticks_per_day > 1:
            return (self.tick % self.ticks_per_day) / float(self.ticks_per_day)
        # With 1 tick/day, model twilight/diurnal cycle deterministically via micro-phase
        return ((self.tick * 0.37) % 1.0)

    @property
    def is_night(self) -> bool:
        phase = self.day_phase
        return phase < 0.25 or phase > 0.78

    def sim_date_str(self) -> str:
        return f"Y{self.year:04d}-M{self.month + 1:02d}-D{self.day_of_month + 1:02d}"

    def begin_session(self) -> None:
        now = time.monotonic()
        self._session_start_mono = now
        self._last_measure_mono = now
        self._last_measure_tick = self.tick

    def step(self, speed_mode: str = "max_cpu_research") -> None:
        """Advance simulation by one tick and pace only if realtime_1m_1mo is active."""
        tick_start = time.monotonic()
        self.tick += 1

        if speed_mode == "realtime_1m_1mo":
            target_tick_real_sec = self.real_seconds_per_sim_month / float(self.ticks_per_month)
            elapsed = time.monotonic() - tick_start
            if elapsed < target_tick_real_sec:
                time.sleep(target_tick_real_sec - elapsed)

        now = time.monotonic()
        dt = now - self._last_measure_mono
        if dt >= 0.5:
            delta_ticks = self.tick - self._last_measure_tick
            self.measured_ticks_per_real_sec = delta_ticks / dt
            self.measured_sim_months_per_real_min = (
                (delta_ticks / float(self.ticks_per_month)) / (dt / 60.0)
            )
            self.cumulative_real_seconds += dt
            self._last_measure_mono = now
            self._last_measure_tick = self.tick

    def flush_elapsed_runtime(self) -> None:
        now = time.monotonic()
        dt = now - self._last_measure_mono
        if dt > 0:
            self.cumulative_real_seconds += dt
            self._last_measure_mono = now
            self._last_measure_tick = self.tick

    def to_dict(self) -> dict:
        return {
            "tick": self.tick,
            "days_per_month": self.days_per_month,
            "months_per_year": self.months_per_year,
            "ticks_per_day": self.ticks_per_day,
            "real_seconds_per_sim_month": self.real_seconds_per_sim_month,
            "cumulative_real_seconds": round(self.cumulative_real_seconds, 4),
            "measured_ticks_per_real_sec": round(self.measured_ticks_per_real_sec, 3),
            "measured_sim_months_per_real_min": round(self.measured_sim_months_per_real_min, 3),
            "sim_date": self.sim_date_str(),
            "season": self.season,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SimulationClock":
        clock = cls(
            tick=int(data["tick"]),
            days_per_month=int(data.get("days_per_month", 30)),
            months_per_year=int(data.get("months_per_year", 12)),
            ticks_per_day=int(data.get("ticks_per_day", 1)),
            real_seconds_per_sim_month=float(data.get("real_seconds_per_sim_month", 60.0)),
            cumulative_real_seconds=float(data.get("cumulative_real_seconds", 0.0)),
            measured_ticks_per_real_sec=float(data.get("measured_ticks_per_real_sec", 0.0)),
            measured_sim_months_per_real_min=float(data.get("measured_sim_months_per_real_min", 0.0)),
        )
        clock.begin_session()
        return clock
