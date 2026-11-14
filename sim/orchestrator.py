"""Simulation Orchestrator — coordinates all engines, runtime budget, error isolation, and atomic saves."""

from __future__ import annotations

import logging
import random
import signal
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .agent import Agent, AgentEngine
from .brain import configure_torch_cpu
from .clock import SimulationClock
from .communication import CommunicationEngine
from .config import SimulationConfig, detect_hardware_budget
from .evolution import EvolutionEngine
from .history import HistoryKnowledgeEngine
from .perception import PerceptionEngine
from .persistence import PersistenceEngine, new_world_id
from .society import SocietyEngine
from .world import WorldEngine


logger = logging.getLogger("civilization.sim")


class SimulationEngine:
    """Top-level simulation runtime managing world creation, resumption, ticking, and graceful teardown."""

    def __init__(
        self,
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
        timeline_series: Optional[List[dict]] = None,
    ) -> None:
        self.world_id = world_id
        self.config = config
        self.clock = clock
        self.world = world
        self.agents = agents
        self.comm = comm
        self.society = society
        self.history = history
        self.rng = rng
        self.backend_name = backend_name
        self.evolution = EvolutionEngine()
        self.timeline_series: List[dict] = list(timeline_series or [])

        self._stop_requested = False
        self._stop_reason: Optional[str] = None
        self.agent_step_errors: int = 0

    @classmethod
    def create_new(cls, config: SimulationConfig) -> "SimulationEngine":
        hw = detect_hardware_budget()
        backend_name = configure_torch_cpu(hw.recommended_torch_threads)
        # Validate torch availability if --require-torch is set
        from .brain import active_backend_name

        backend_name = active_backend_name(require_torch=config.require_torch)
        rng = random.Random(config.seed)
        world_id = new_world_id(config.seed)
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
            seed=config.seed,
        )
        world.generate(rng)

        agents = AgentEngine(require_torch=config.require_torch)
        agents.spawn_initial_population(
            count=config.initial_population,
            world=world,
            rng=rng,
            obs_dim=config.observation_dim,
            hidden_dim=config.hidden_dim,
            num_actions=config.num_actions,
            num_signals=config.num_signal_tokens,
            learning_rate=config.learning_rate,
        )

        comm = CommunicationEngine()
        society = SocietyEngine(
            election_cycle_ticks=config.election_cycle_years * config.ticks_per_year
        )
        history = HistoryKnowledgeEngine()
        history.record_truth(
            tick=0,
            sim_date=clock.sim_date_str(),
            event_type="world_start",
            agent_ids=sorted(agents.all_agents.keys()),
            x=world.width_m * 0.5,
            y=world.height_m * 0.5,
            description=(
                f"World {world_id} initialized (5 km^2, {config.initial_population} independent agents, "
                f"seed={config.seed}, backend={backend_name})."
            ),
        )

        engine = cls(
            world_id=world_id,
            config=config,
            clock=clock,
            world=world,
            agents=agents,
            comm=comm,
            society=society,
            history=history,
            rng=rng,
            backend_name=backend_name,
        )
        engine._record_timeline_point()
        return engine

    @classmethod
    def resume_from_checkpoint(cls, checkpoint_dir: Path, require_torch: bool = False) -> "SimulationEngine":
        hw = detect_hardware_budget()
        configure_torch_cpu(hw.recommended_torch_threads)
        from .brain import active_backend_name

        backend_name = active_backend_name(require_torch=require_torch)
        (
            world_id,
            config,
            clock,
            world,
            agents,
            comm,
            society,
            history,
            rng,
            manifest,
        ) = PersistenceEngine.load_checkpoint(checkpoint_dir, require_torch=require_torch)

        return cls(
            world_id=world_id,
            config=config,
            clock=clock,
            world=world,
            agents=agents,
            comm=comm,
            society=society,
            history=history,
            rng=rng,
            backend_name=backend_name,
            timeline_series=manifest.get("restored_timeline_series", []),
        )

    def install_signal_handlers(self) -> None:
        def _handle(signum, _frame):
            self._stop_requested = True
            self._stop_reason = f"signal_{signum}"
            logger.warning("Received signal %s; finishing current atomic tick before saving checkpoint.", signum)

        try:
            signal.signal(signal.SIGTERM, _handle)
            signal.signal(signal.SIGINT, _handle)
        except ValueError:
            # Signal registration only works in main thread
            pass

    def _build_spatial_buckets(self, living: Dict[int, Agent], bucket_size: float = 150.0) -> Dict[Tuple[int, int], List[int]]:
        buckets: Dict[Tuple[int, int], List[int]] = {}
        for aid, ag in living.items():
            key = (int(ag.x // bucket_size), int(ag.y // bucket_size))
            buckets.setdefault(key, []).append(aid)
        return buckets

    def step_tick(self) -> None:
        """Advance the entire simulation by exactly one atomic tick."""
        self.clock.step(speed_mode=self.config.speed_mode)
        tick = self.clock.tick
        sim_date = self.clock.sim_date_str()
        is_night = self.clock.is_night

        # 1. Environment & climate updates
        env_events = self.world.step_environment(tick, self.clock.season, self.clock.month, self.rng)
        for ev in env_events:
            self.history.record_truth(
                tick, sim_date, ev["event_type"], [],
                self.world.width_m * 0.5, self.world.height_m * 0.5, ev["description"],
                metadata={"subtype": ev.get("subtype"), "severity": ev.get("severity")},
            )

        # 2. Living agent perceptions, decisions, actions, and local learning
        living = self.agents.living_agents()
        if not living:
            self._stop_requested = True
            self._stop_reason = "population_extinct"
            self.history.record_truth(
                tick, sim_date, "population_extinct", [],
                self.world.width_m * 0.5, self.world.height_m * 0.5,
                "All individuals in the world have died; simulation halted naturally.",
            )
            return

        spatial_buckets = self._build_spatial_buckets(living)
        ordered_ids = list(living.keys())
        self.rng.shuffle(ordered_ids)

        # Keep emissions from this tick accessible to nearby listeners; clear older emissions
        self.comm.clear_tick_emissions()
        artifacts_snapshot = self.history.artifacts

        for aid in ordered_ids:
            ag = living.get(aid)
            if ag is None or not ag.is_alive or ag.brain is None:
                continue
            try:
                perc = PerceptionEngine.perceive(
                    agent=ag,
                    world=self.world,
                    living_agents=living,
                    spatial_buckets=spatial_buckets,
                    recent_emissions=self.comm.recent_emissions,
                    artifacts=artifacts_snapshot,
                    is_night=is_night,
                    base_vision=self.config.base_vision_radius_m,
                    base_hearing=self.config.base_hearing_radius_m,
                )
                bias = self.agents.compute_action_bias(ag, perc)
                action_idx, signal_idx, log_prob, val_est, h_before = ag.brain.step_decision(
                    obs=perc.obs_vector,
                    rng=self.rng,
                    action_bias=bias,
                )
                reward = self.agents.execute_action(
                    agent=ag,
                    action_idx=action_idx,
                    signal_idx=signal_idx,
                    perc=perc,
                    tick=tick,
                    sim_date=sim_date,
                    world=self.world,
                    comm=self.comm,
                    society=self.society,
                    history=self.history,
                    rng=self.rng,
                )
                ag.brain.record_experience(
                    obs=perc.obs_vector,
                    hidden_before=h_before,
                    action_idx=action_idx,
                    signal_idx=signal_idx,
                    log_prob_action=log_prob,
                    reward=reward,
                    value_est=val_est,
                    max_buffer=self.config.max_experience_buffer,
                )
                if (
                    ag.is_alive
                    and (tick + aid) % self.config.learn_interval_ticks == 0
                    and len(ag.brain.experience) >= self.config.learn_batch_size
                ):
                    ag.brain.learn_from_experience(batch_size=self.config.learn_batch_size)
            except Exception as exc:
                self.agent_step_errors += 1
                logger.exception("Isolated error stepping agent %s at tick %s: %s", aid, tick, exc)

        # 3. Demographics, births, cultural/linguistic extinction, institutions
        self.evolution.step_demographics(
            tick=tick,
            sim_date=sim_date,
            config=self.config,
            agents=self.agents,
            world=self.world,
            comm=self.comm,
            society=self.society,
            history=self.history,
            rng=self.rng,
        )

        # 4. Read-only macro telemetry point every 30 ticks (never touches RNG or simulation state)
        if tick % 30 == 0:
            self._record_timeline_point()

    def _record_timeline_point(self) -> None:
        living = self.agents.living_agents()
        crime_metrics = self.society.crime_and_stability_metrics(self.clock.tick, living)
        eco = self.world.ecosystem_summary()
        lang = self.comm.summary()
        active_tokens = len({tok for ag in living.values() for tok in ag.lexicon.keys()})
        point = {
            "tick": self.clock.tick,
            "sim_date": self.clock.sim_date_str(),
            "sim_year": self.clock.year,
            "season": self.clock.season,
            "living_count": len(living),
            "deceased_count": len(self.agents.all_agents) - len(living),
            "births_total": sum(1 for a in self.agents.all_agents.values() if a.birth_tick > 0),
            "food_total": round(eco["total_food_biomass"], 1),
            "water_total": round(sum(self.world.water), 1),
            "wood_total": round(eco["total_wood_biomass"], 1),
            "herbivores": eco["herbivores_alive"],
            "predators": eco["predators_alive"],
            "active_tokens": active_tokens,
            "protowords": lang["stable_protowords_count"],
            "groups_count": crime_metrics["active_groups"],
            "crime_rate_per_1000": crime_metrics["recent_180d_crimes_per_1000"],
            "crimes_per_1000_pop": crime_metrics["crimes_per_1000_pop"],
            "barters": crime_metrics["total_barters"],
        }
        self.timeline_series.append(point)
        if len(self.timeline_series) > 600:
            # Keep every point for recent history and downsample older tail safely
            self.timeline_series = self.timeline_series[::2] + self.timeline_series[-100:]

    def current_metrics(self) -> dict:
        living = self.agents.living_agents()
        crime_metrics = self.society.crime_and_stability_metrics(self.clock.tick, living)
        return {
            **crime_metrics,
            "living_population": len(living),
            "deceased_population": len(self.agents.all_agents) - len(living),
            "total_agents_ever": len(self.agents.all_agents),
            "agent_step_errors": self.agent_step_errors,
            "discovered_techs": dict(self.agents.discovered_techs),
        }

    def save_checkpoint(self, checkpoint_dir: Path) -> dict:
        return PersistenceEngine.save_checkpoint(
            checkpoint_dir=checkpoint_dir,
            world_id=self.world_id,
            config=self.config,
            clock=self.clock,
            world=self.world,
            agents=self.agents,
            comm=self.comm,
            society=self.society,
            history=self.history,
            rng=self.rng,
            backend_name=self.backend_name,
            metrics_snapshot=self.current_metrics(),
            timeline_series=self.timeline_series,
        )

    def run(
        self,
        checkpoint_dir: Path,
        max_ticks: Optional[int] = None,
    ) -> dict:
        """
        Execute simulation loop respecting internal time budget, periodic checkpointing,
        signals, and guaranteed final atomic checkpoint before exit.
        """
        self.install_signal_handlers()
        start_mono = time.monotonic()
        last_ckpt_mono = start_mono
        last_ckpt_tick = self.clock.tick

        budget_sec = max(10.0, (self.config.runtime_budget_minutes - self.config.shutdown_reserve_minutes) * 60.0)
        if self.config.runtime_budget_minutes <= self.config.shutdown_reserve_minutes:
            budget_sec = max(5.0, self.config.runtime_budget_minutes * 60.0 * 0.75)
        ckpt_interval_sec = max(30.0, self.config.checkpoint_interval_minutes * 60.0)

        ticks_run = 0
        try:
            while not self._stop_requested:
                if max_ticks is not None and ticks_run >= max_ticks:
                    self._stop_reason = "max_ticks_reached"
                    break

                elapsed = time.monotonic() - start_mono
                if elapsed >= budget_sec:
                    self._stop_reason = "runtime_budget_reached"
                    logger.info("Internal runtime budget reached (%.1fs); initiating clean checkpoint.", elapsed)
                    break

                self.step_tick()
                ticks_run += 1

                now = time.monotonic()
                if (
                    (now - last_ckpt_mono) >= ckpt_interval_sec
                    or (self.clock.tick - last_ckpt_tick) >= self.config.checkpoint_interval_ticks
                ):
                    self.save_checkpoint(checkpoint_dir)
                    last_ckpt_mono = now
                    last_ckpt_tick = self.clock.tick
                    logger.info(
                        "Periodic checkpoint saved at tick=%d (%s), living=%d",
                        self.clock.tick,
                        self.clock.sim_date_str(),
                        len(self.agents.living_agents()),
                    )
        except Exception as exc:
            self._stop_reason = f"error:{exc}"
            logger.exception("Fatal error during simulation loop; attempting emergency checkpoint save.")
            manifest = self.save_checkpoint(checkpoint_dir)
            raise RuntimeError(f"Simulation aborted after saving recovery checkpoint: {manifest}") from exc

        final_manifest = self.save_checkpoint(checkpoint_dir)
        return {
            "world_id": self.world_id,
            "stop_reason": self._stop_reason or "completed",
            "ticks_executed_this_run": ticks_run,
            "final_tick": self.clock.tick,
            "final_sim_date": self.clock.sim_date_str(),
            "backend": self.backend_name,
            "manifest": final_manifest,
            "metrics": self.current_metrics(),
        }
