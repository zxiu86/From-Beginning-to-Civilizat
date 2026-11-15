"""Isolated Survival Training System — 100 independent isolated clones of a shared environment template."""

from __future__ import annotations

import gzip
import hashlib
import json
import logging
import math
import os
import pickle
import random
import shutil
import signal
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .agent import ACTION_NAMES, Agent, AgentEngine, PersonalityTraits
from .analytics import AnalyticsTracker
from .brain import AgentBrain, TORCH_AVAILABLE, active_backend_name, configure_torch_cpu, torch
from .clock import SimulationClock
from .communication import CommunicationEngine
from .config import SimulationConfig, detect_hardware_budget
from .history import HistoryKnowledgeEngine
from .memory import MemoryEngine
from .perception import PerceptionEngine
from .persistence import PersistenceEngine
from .society import SocietyEngine
from .world import FaunaEntity, WeatherState, WorldEngine


logger = logging.getLogger("civilization.training")

TRAINING_SCHEMA_VERSION = "1.0.0"


class TrainingIntegrityError(RuntimeError):
    """Raised when a training checkpoint is missing, unreadable, or fails integrity verification."""


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


@dataclass
class TrainingConfig:
    template_seed: int = 42
    agent_count: int = 100
    world_width_m: float = 2500.0
    world_height_m: float = 2000.0
    cell_size_m: float = 25.0
    observation_dim: int = 36
    hidden_dim: int = 24
    num_actions: int = 18
    num_signals: int = 24
    learning_rate: float = 0.005
    max_experience_buffer: int = 64
    learn_batch_size: int = 12
    learn_interval_ticks: int = 6
    entropy_coef: float = 0.018
    gae_lambda: float = 0.90
    base_vision_radius_m: float = 120.0
    base_hearing_radius_m: float = 180.0
    speed_mode: str = "max_cpu_research"
    require_torch: bool = False
    runtime_budget_minutes: float = 300.0
    shutdown_reserve_minutes: float = 12.0
    checkpoint_interval_minutes: float = 25.0
    checkpoint_interval_ticks: int = 1200

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AgentTrainingRecord:
    agent_id: int
    initial_age_ticks: int
    attempts: int = 1
    deaths: int = 0
    current_attempt_start_tick: int = 0
    current_survival_ticks: int = 0
    longest_survival_ticks: int = 0
    total_survival_ticks: int = 0
    last_cause_of_death: Optional[str] = None
    causes_of_death: Dict[str, int] = field(default_factory=dict)

    # 4-stage resource interaction metrics (Discover -> Decide -> Reach -> Consume)
    food_discovered_count: int = 0
    food_reach_decisions_count: int = 0
    food_physical_reaches_count: int = 0
    food_consumed_count: int = 0
    water_discovered_count: int = 0
    water_reach_decisions_count: int = 0
    water_physical_reaches_count: int = 0
    water_consumed_count: int = 0

    food_discovery_first_tick: Optional[int] = None
    food_consume_first_tick: Optional[int] = None
    water_discovery_first_tick: Optional[int] = None
    water_consume_first_tick: Optional[int] = None

    attempt_history: List[dict] = field(default_factory=list)

    @property
    def avg_survival_ticks(self) -> float:
        completed = self.deaths
        if completed <= 0:
            return float(self.current_survival_ticks)
        return round((self.total_survival_ticks + self.current_survival_ticks) / float(completed + 1), 2)

    def to_summary_dict(self, agent: Optional[Agent] = None) -> dict:
        skills_count = sum(1 for v in agent.memory.skills.values() if v > 0.0) if agent is not None else 0
        episodic_cnt = len(agent.memory.episodic) if agent is not None else 0
        spatial_cnt = len(agent.memory.spatial_map) if agent is not None else 0
        updates = agent.brain.total_updates if (agent is not None and agent.brain is not None) else 0
        mean_reward = round(agent.brain.mean_recent_reward, 4) if (agent is not None and agent.brain is not None) else 0.0
        learning_level = round(
            min(1.0, (updates / 60.0) * 0.55 + (skills_count / 6.0) * 0.25 + (self.food_consumed_count + self.water_consumed_count) / 40.0 * 0.20),
            3,
        )
        return {
            "agent_id": self.agent_id,
            "sex": agent.sex if agent is not None else "F",
            "attempts": self.attempts,
            "deaths": self.deaths,
            "current_survival_ticks": self.current_survival_ticks,
            "longest_survival_ticks": max(self.longest_survival_ticks, self.current_survival_ticks),
            "avg_survival_ticks": self.avg_survival_ticks,
            "last_cause_of_death": self.last_cause_of_death,
            "causes_of_death": dict(self.causes_of_death),
            "food_discovered_count": self.food_discovered_count,
            "food_reach_decisions_count": self.food_reach_decisions_count,
            "food_physical_reaches_count": self.food_physical_reaches_count,
            "food_consumed_count": self.food_consumed_count,
            "water_discovered_count": self.water_discovered_count,
            "water_reach_decisions_count": self.water_reach_decisions_count,
            "water_physical_reaches_count": self.water_physical_reaches_count,
            "water_consumed_count": self.water_consumed_count,
            "food_discovery_first_tick": self.food_discovery_first_tick,
            "food_consume_first_tick": self.food_consume_first_tick,
            "water_discovery_first_tick": self.water_discovery_first_tick,
            "water_consume_first_tick": self.water_consume_first_tick,
            "learning_level": learning_level,
            "brain_updates": updates,
            "mean_recent_reward": mean_reward,
            "skills_count": skills_count,
            "episodic_memories_count": episodic_cnt,
            "spatial_memories_count": spatial_cnt,
            "status": "active_training" if (agent is None or agent.is_alive) else "inactive",
            "recent_attempts": list(self.attempt_history[-10:]),
        }

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "initial_age_ticks": self.initial_age_ticks,
            "attempts": self.attempts,
            "deaths": self.deaths,
            "current_attempt_start_tick": self.current_attempt_start_tick,
            "current_survival_ticks": self.current_survival_ticks,
            "longest_survival_ticks": self.longest_survival_ticks,
            "total_survival_ticks": self.total_survival_ticks,
            "last_cause_of_death": self.last_cause_of_death,
            "causes_of_death": dict(self.causes_of_death),
            "food_discovered_count": self.food_discovered_count,
            "food_reach_decisions_count": self.food_reach_decisions_count,
            "food_physical_reaches_count": self.food_physical_reaches_count,
            "food_consumed_count": self.food_consumed_count,
            "water_discovered_count": self.water_discovered_count,
            "water_reach_decisions_count": self.water_reach_decisions_count,
            "water_physical_reaches_count": self.water_physical_reaches_count,
            "water_consumed_count": self.water_consumed_count,
            "food_discovery_first_tick": self.food_discovery_first_tick,
            "food_consume_first_tick": self.food_consume_first_tick,
            "water_discovery_first_tick": self.water_discovery_first_tick,
            "water_consume_first_tick": self.water_consume_first_tick,
            "attempt_history": list(self.attempt_history[-40:]),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "AgentTrainingRecord":
        return cls(
            agent_id=int(d["agent_id"]),
            initial_age_ticks=int(d.get("initial_age_ticks", 18 * 360)),
            attempts=int(d.get("attempts", 1)),
            deaths=int(d.get("deaths", 0)),
            current_attempt_start_tick=int(d.get("current_attempt_start_tick", 0)),
            current_survival_ticks=int(d.get("current_survival_ticks", 0)),
            longest_survival_ticks=int(d.get("longest_survival_ticks", 0)),
            total_survival_ticks=int(d.get("total_survival_ticks", 0)),
            last_cause_of_death=d.get("last_cause_of_death"),
            causes_of_death=dict(d.get("causes_of_death", {})),
            food_discovered_count=int(d.get("food_discovered_count", 0)),
            food_reach_decisions_count=int(d.get("food_reach_decisions_count", 0)),
            food_physical_reaches_count=int(d.get("food_physical_reaches_count", 0)),
            food_consumed_count=int(d.get("food_consumed_count", 0)),
            water_discovered_count=int(d.get("water_discovered_count", 0)),
            water_reach_decisions_count=int(d.get("water_reach_decisions_count", 0)),
            water_physical_reaches_count=int(d.get("water_physical_reaches_count", 0)),
            water_consumed_count=int(d.get("water_consumed_count", 0)),
            food_discovery_first_tick=d.get("food_discovery_first_tick"),
            food_consume_first_tick=d.get("food_consume_first_tick"),
            water_discovery_first_tick=d.get("water_discovery_first_tick"),
            water_consume_first_tick=d.get("water_consume_first_tick"),
            attempt_history=list(d.get("attempt_history", [])),
        )


def _clone_world_from_template(template: WorldEngine) -> WorldEngine:
    """Create an operationally isolated WorldEngine sharing strictly read-only geometry with independent mutable grids."""
    w = WorldEngine.__new__(WorldEngine)
    w.width_m = template.width_m
    w.height_m = template.height_m
    w.cell_size_m = template.cell_size_m
    w.cols = template.cols
    w.rows = template.rows
    w.num_cells = template.num_cells
    w.seed = template.seed

    # Read-only immutable terrain layers (shared safely, never mutated)
    w.elevation = template.elevation
    w.slope = template.slope
    w.wood_max = template.wood_max
    w.spring_cells = template.spring_cells

    # Independent mutable operational copies per isolated training environment
    w.fertility = template.fertility[:]
    w.moisture = template.moisture[:]
    w.water = template.water[:]
    w.food_flora = template.food_flora[:]
    w.food_max = template.food_max[:]
    w.wood_flora = template.wood_flora[:]
    w.herb_flora = template.herb_flora[:]
    w.stone_mineral = template.stone_mineral[:]
    w.weather = WeatherState(**template.weather.to_dict())
    w.next_fauna_id = template.next_fauna_id
    w.fauna = {
        fid: FaunaEntity(**f.to_dict())
        for fid, f in template.fauna.items()
    }
    return w


def _find_identical_template_spawn(template: WorldEngine, rng: random.Random) -> Tuple[float, float]:
    """Select one deterministic habitable starting coordinate on the template shared across all 100 clones."""
    best_xy = (template.width_m * 0.5, template.height_m * 0.5)
    best_score = -1.0
    for _ in range(300):
        tx = rng.uniform(160.0, template.width_m - 160.0)
        ty = rng.uniform(160.0, template.height_m - 160.0)
        cidx = template.cell_index_at(tx, ty)
        if template.water[cidx] < 40.0 and template.slope[cidx] <= 0.85 and template.food_flora[cidx] > 1.0:
            w_idx = template.has_nearby_water(tx, ty, 110.0)
            if w_idx is not None:
                score = template.food_flora[cidx] + (1.0 - template.slope[cidx]) * 5.0
                if score > best_score:
                    best_score = score
                    best_xy = (round(tx, 2), round(ty, 2))
    return best_xy


@dataclass
class IsolatedEnvSlot:
    agent_id: int
    world: WorldEngine
    rng: random.Random
    local_tick: int = 0
    comm: CommunicationEngine = field(default_factory=CommunicationEngine)
    society: SocietyEngine = field(default_factory=SocietyEngine)
    history: HistoryKnowledgeEngine = field(default_factory=HistoryKnowledgeEngine)

    def reset_to_template(self, template: WorldEngine) -> None:
        self.world.fertility = template.fertility[:]
        self.world.moisture = template.moisture[:]
        self.world.water = template.water[:]
        self.world.food_flora = template.food_flora[:]
        self.world.food_max = template.food_max[:]
        self.world.wood_flora = template.wood_flora[:]
        self.world.herb_flora = template.herb_flora[:]
        self.world.stone_mineral = template.stone_mineral[:]
        self.world.weather = WeatherState(**template.weather.to_dict())
        self.world.next_fauna_id = template.next_fauna_id
        self.world.fauna = {
            fid: FaunaEntity(**f.to_dict())
            for fid, f in template.fauna.items()
        }
        self.local_tick = 0
        self.comm.clear_tick_emissions()


class IsolatedSurvivalTrainer:
    """
    Manages 100 completely isolated agents inside identical cloned operational environments.
    Supports autonomous survival training, death-penalty rebirth inside training ONLY,
    full 4-stage resource discovery->decision->reach->consume tracking, and atomic checkpointing.
    """

    def __init__(
        self,
        training_id: str,
        config: TrainingConfig,
        clock: SimulationClock,
        template_world: WorldEngine,
        template_spawn_xy: Tuple[float, float],
        agents: AgentEngine,
        env_slots: Dict[int, IsolatedEnvSlot],
        records: Dict[int, AgentTrainingRecord],
        rng: random.Random,
        backend_name: str,
        analytics: Optional[AnalyticsTracker] = None,
        attempt_progression: Optional[List[dict]] = None,
    ) -> None:
        self.training_id = training_id
        self.config = config
        self.clock = clock
        self.template_world = template_world
        self.template_spawn_xy = template_spawn_xy
        self.agents = agents
        self.env_slots = env_slots
        self.records = records
        self.rng = rng
        self.backend_name = backend_name
        self.analytics = analytics or AnalyticsTracker()
        self.attempt_progression: List[dict] = list(attempt_progression or [])

        self._prev_food_seen: Dict[int, bool] = {}
        self._prev_food_local: Dict[int, bool] = {}
        self._prev_water_seen: Dict[int, bool] = {}
        self._prev_water_local: Dict[int, bool] = {}
        self._stop_requested = False
        self._stop_reason: Optional[str] = None
        self.training_step_errors: int = 0

    @classmethod
    def create_new(cls, config: TrainingConfig) -> "IsolatedSurvivalTrainer":
        hw = detect_hardware_budget()
        configure_torch_cpu(hw.recommended_torch_threads)
        backend_name = active_backend_name(require_torch=config.require_torch)

        rng = random.Random(config.template_seed)
        training_id = f"train_{config.template_seed}_{uuid.uuid4().hex[:8]}"
        clock = SimulationClock(tick=0)
        clock.begin_session()

        template_world = WorldEngine(
            width_m=config.world_width_m,
            height_m=config.world_height_m,
            cell_size_m=config.cell_size_m,
            seed=config.template_seed,
        )
        template_world.generate(random.Random(config.template_seed))
        spawn_xy = _find_identical_template_spawn(template_world, random.Random(config.template_seed + 17))

        agent_engine = AgentEngine(require_torch=config.require_torch)
        env_slots: Dict[int, IsolatedEnvSlot] = {}
        records: Dict[int, AgentTrainingRecord] = {}

        for i in range(config.agent_count):
            aid = agent_engine.next_agent_id
            agent_engine.next_agent_id += 1
            init_age = 18 * 360 + (i % 7) * 360
            trait_rng = random.Random(config.template_seed + aid * 997)
            brain = AgentBrain(
                agent_id=aid,
                obs_dim=config.observation_dim,
                hidden_dim=config.hidden_dim,
                num_actions=config.num_actions,
                num_signals=config.num_signals,
                learning_rate=config.learning_rate,
                seed=config.template_seed + aid * 7919,
                require_torch=config.require_torch,
            )
            ag = Agent(
                agent_id=aid,
                sex="F" if (i % 2 == 0) else "M",
                x=spawn_xy[0],
                y=spawn_xy[1],
                birth_tick=0,
                generation=0,
                age_ticks=init_age,
                max_lifespan_ticks=21600,
                inventory={"food": 2.0, "wood": 0.0, "stone": 0.0, "herb": 0.0, "tool": 0.0},
                traits=PersonalityTraits.random_init(trait_rng),
                memory=MemoryEngine(),
                brain=brain,
            )
            rec = AgentTrainingRecord(agent_id=aid, initial_age_ticks=init_age)
            ag.training_stats = rec.to_summary_dict(ag)
            agent_engine.all_agents[aid] = ag
            records[aid] = rec
            env_slots[aid] = IsolatedEnvSlot(
                agent_id=aid,
                world=_clone_world_from_template(template_world),
                rng=random.Random(config.template_seed * 1009 + aid * 37),
                local_tick=0,
            )

        trainer = cls(
            training_id=training_id,
            config=config,
            clock=clock,
            template_world=template_world,
            template_spawn_xy=spawn_xy,
            agents=agent_engine,
            env_slots=env_slots,
            records=records,
            rng=rng,
            backend_name=backend_name,
        )
        trainer._record_progression_point()
        return trainer

    def install_signal_handlers(self) -> None:
        def _handle(signum, _frame):
            self._stop_requested = True
            self._stop_reason = f"signal_{signum}"

        try:
            signal.signal(signal.SIGTERM, _handle)
            signal.signal(signal.SIGINT, _handle)
        except ValueError:
            pass

    def _revive_in_isolated_training(self, ag: Agent, slot: IsolatedEnvSlot, rec: AgentTrainingRecord, cause: str) -> None:
        """Reset ONLY physical body and ONLY this agent's isolated world slot while preserving identity, weights, optimizer, memory, and traits."""
        global_tick = self.clock.tick
        survival_ticks = max(1, rec.current_survival_ticks)
        rec.deaths += 1
        rec.attempts += 1
        rec.total_survival_ticks += survival_ticks
        if survival_ticks > rec.longest_survival_ticks:
            rec.longest_survival_ticks = survival_ticks
        rec.last_cause_of_death = cause
        rec.causes_of_death[cause] = rec.causes_of_death.get(cause, 0) + 1

        rec.attempt_history.append({
            "attempt": rec.attempts - 1,
            "start_global_tick": rec.current_attempt_start_tick,
            "death_global_tick": global_tick,
            "survival_ticks": survival_ticks,
            "cause_of_death": cause,
            "pre_death_hunger": round(ag.hunger, 3),
            "pre_death_thirst": round(ag.thirst, 3),
            "pre_death_energy": round(ag.energy, 3),
            "last_action": ag.last_action,
            "perceived_cues": list((ag.death_penalty_record or {}).get("perceived_cues") or []),
            "death_penalty_applied": bool(ag.death_penalty_record and ag.death_penalty_record.get("applied")),
            "weight_fingerprint_after": ag.brain.weight_fingerprint() if ag.brain else None,
        })
        if len(rec.attempt_history) > 40:
            rec.attempt_history = rec.attempt_history[-40:]

        # Revive SAME individual with intact weights, optimizer, memory, skills, traits
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
        ag.age_ticks = rec.initial_age_ticks
        ag.x = self.template_spawn_xy[0]
        ag.y = self.template_spawn_xy[1]
        ag.inventory = {"food": 2.0, "wood": 0.0, "stone": 0.0, "herb": 0.0, "tool": 0.0}
        ag.carried_item = None
        ag.last_action = "rest"
        ag.rebirth_count += 1
        ag.rebirth_tick = global_tick
        if ag.brain is not None:
            ag.brain.hidden_state = [0.0] * ag.brain.hidden_dim

        rec.current_attempt_start_tick = global_tick
        rec.current_survival_ticks = 0

        # Reset ONLY this agent's isolated environment back to shared initial template
        slot.reset_to_template(self.template_world)
        self._prev_food_seen[ag.agent_id] = False
        self._prev_food_local[ag.agent_id] = False
        self._prev_water_seen[ag.agent_id] = False
        self._prev_water_local[ag.agent_id] = False

    def step_tick(self) -> None:
        """Advance all 100 completely isolated survival environments by 1 tick."""
        self.clock.step(speed_mode=self.config.speed_mode)
        global_tick = self.clock.tick

        for aid, ag in self.agents.all_agents.items():
            if ag.brain is None:
                continue
            slot = self.env_slots[aid]
            rec = self.records[aid]
            try:
                slot.local_tick += 1
                # Compute local season/month from slot's own local clock so every retry starts in identical climate
                days_total = slot.local_tick
                local_month = ((days_total // 30) % 12) + 1
                local_season = (
                    "spring" if local_month in (3, 4, 5) else
                    "summer" if local_month in (6, 7, 8) else
                    "autumn" if local_month in (9, 10, 11) else
                    "winter"
                )
                is_night = (slot.local_tick % 2) == 1
                sim_date = f"TR-A{aid:03d}-T{slot.local_tick:05d}"

                slot.world.step_environment(slot.local_tick, local_season, local_month, slot.rng)
                slot.comm.clear_tick_emissions()

                # STRICT ISOLATION: living_agents contains ONLY this agent; zero emissions or artifacts from others
                single_living = {aid: ag}
                single_bucket = {(int(ag.x // 150.0), int(ag.y // 150.0)): [aid]}
                perc = PerceptionEngine.perceive(
                    agent=ag,
                    world=slot.world,
                    living_agents=single_living,
                    spatial_buckets=single_bucket,
                    recent_emissions=[],
                    artifacts=[],
                    is_night=is_night,
                    base_vision=self.config.base_vision_radius_m,
                    base_hearing=self.config.base_hearing_radius_m,
                    tick=slot.local_tick,
                )

                bias = self.agents.compute_action_bias(ag, perc)
                action_idx, signal_idx, log_prob, val_est, h_before = ag.brain.step_decision(
                    obs=perc.obs_vector,
                    rng=slot.rng,
                    action_bias=bias,
                )
                action_name = ACTION_NAMES[action_idx]
                reward = self.agents.execute_action(
                    agent=ag,
                    action_idx=action_idx,
                    signal_idx=signal_idx,
                    perc=perc,
                    tick=global_tick,
                    sim_date=sim_date,
                    world=slot.world,
                    comm=slot.comm,
                    society=slot.society,
                    history=slot.history,
                    rng=slot.rng,
                )
                if len(slot.history.truth_events) > 25:
                    slot.history.truth_events = slot.history.truth_events[-25:]
                    slot.history.pending_truth_flush.clear()

                step_info = ag.last_step_telemetry
                self.analytics.record_agent_step(
                    agent=ag,
                    perc=perc,
                    world=slot.world,
                    action_name=action_name,
                    step_info=step_info,
                    reward=reward,
                    base_vision_radius_m=self.config.base_vision_radius_m,
                )

                # Track the 4 explicit training stages per individual (Discover -> Decide -> Reach -> Consume)
                food_dx, food_dy = perc.obs_vector[18], perc.obs_vector[19]
                water_dx, water_dy = perc.obs_vector[20], perc.obs_vector[21]
                food_known = perc.local_food > 0.25 or abs(food_dx) > 0.01 or abs(food_dy) > 0.01
                water_known = perc.local_water > 0.25 or abs(water_dx) > 0.01 or abs(water_dy) > 0.01
                food_local_now = perc.local_food > 0.25
                water_local_now = perc.local_water > 0.25
                moved_m = float(step_info.get("moved_m", 0.0))

                if food_known and not self._prev_food_seen.get(aid, False):
                    rec.food_discovered_count += 1
                    if rec.food_discovery_first_tick is None:
                        rec.food_discovery_first_tick = global_tick
                if water_known and not self._prev_water_seen.get(aid, False):
                    rec.water_discovered_count += 1
                    if rec.water_discovery_first_tick is None:
                        rec.water_discovery_first_tick = global_tick

                if food_known and not food_local_now:
                    if AnalyticsTracker._move_alignment(action_name, food_dx, food_dy) > 0.2:
                        rec.food_reach_decisions_count += 1
                if water_known and not water_local_now:
                    if AnalyticsTracker._move_alignment(action_name, water_dx, water_dy) > 0.2:
                        rec.water_reach_decisions_count += 1

                if food_local_now and not self._prev_food_local.get(aid, False) and moved_m > 0.2:
                    rec.food_physical_reaches_count += 1
                if water_local_now and not self._prev_water_local.get(aid, False) and moved_m > 0.2:
                    rec.water_physical_reaches_count += 1

                if float(step_info.get("food_consumed", 0.0)) > 0.05:
                    rec.food_consumed_count += 1
                    if rec.food_consume_first_tick is None:
                        rec.food_consume_first_tick = global_tick
                if float(step_info.get("water_consumed", 0.0)) > 0.05:
                    rec.water_consumed_count += 1
                    if rec.water_consume_first_tick is None:
                        rec.water_consume_first_tick = global_tick

                self._prev_food_seen[aid] = food_known
                self._prev_food_local[aid] = food_local_now
                self._prev_water_seen[aid] = water_known
                self._prev_water_local[aid] = water_local_now

                ag.brain.record_experience(
                    obs=perc.obs_vector,
                    hidden_before=h_before,
                    action_idx=action_idx,
                    signal_idx=signal_idx,
                    log_prob_action=log_prob,
                    reward=reward,
                    value_est=val_est,
                    max_buffer=self.config.max_experience_buffer,
                    tick=global_tick,
                    context_tag=self.agents._infer_current_context(ag, perc),
                )

                if not ag.is_alive:
                    cause = ag.cause_of_death or "illness_or_injury"
                    self._revive_in_isolated_training(ag, slot, rec, cause)
                else:
                    rec.current_survival_ticks += 1
                    if (global_tick + aid) % self.config.learn_interval_ticks == 0 and len(ag.brain.experience) >= self.config.learn_batch_size:
                        ag.brain.learn_from_experience(
                            batch_size=self.config.learn_batch_size,
                            gae_lambda=self.config.gae_lambda,
                            entropy_coef=self.config.entropy_coef,
                        )

                ag.training_stats = rec.to_summary_dict(ag)
            except Exception as exc:
                self.training_step_errors += 1
                logger.exception("Isolated training error for agent %s at tick %s: %s", aid, global_tick, exc)

        if global_tick % 10 == 0:
            self._record_progression_point()

    def _record_progression_point(self) -> None:
        recs = list(self.records.values())
        total_deaths = sum(r.deaths for r in recs)
        avg_cur_surv = round(sum(r.current_survival_ticks for r in recs) / max(1, len(recs)), 2)
        avg_longest = round(sum(max(r.longest_survival_ticks, r.current_survival_ticks) for r in recs) / max(1, len(recs)), 2)
        total_food_c = sum(r.food_consumed_count for r in recs)
        total_water_c = sum(r.water_consumed_count for r in recs)
        self.attempt_progression.append({
            "tick": self.clock.tick,
            "total_deaths": total_deaths,
            "avg_current_survival_ticks": avg_cur_surv,
            "avg_longest_survival_ticks": avg_longest,
            "food_consumed_events": total_food_c,
            "water_consumed_events": total_water_c,
        })
        if len(self.attempt_progression) > 400:
            self.attempt_progression = self.attempt_progression[::2] + self.attempt_progression[-80:]

    def build_training_analytics_payload(self) -> dict:
        agent_rows: List[dict] = []
        for aid in sorted(self.records.keys()):
            ag = self.agents.all_agents.get(aid)
            agent_rows.append(self.records[aid].to_summary_dict(ag))

        death_causes_total: Dict[str, int] = {}
        for row in agent_rows:
            for c, cnt in row["causes_of_death"].items():
                death_causes_total[c] = death_causes_total.get(c, 0) + cnt

        best_agent = max(agent_rows, key=lambda r: (r["longest_survival_ticks"], r["food_consumed_count"] + r["water_consumed_count"]), default=None)
        avg_learning = round(sum(r["learning_level"] for r in agent_rows) / max(1, len(agent_rows)), 3)

        return {
            "training_id": self.training_id,
            "agent_count": len(agent_rows),
            "training_tick": self.clock.tick,
            "template_seed": self.config.template_seed,
            "template_spawn_xy": list(self.template_spawn_xy),
            "isolation_enforced": True,
            "training_rebirth_active": True,
            "total_attempts": sum(r["attempts"] for r in agent_rows),
            "total_deaths": sum(r["deaths"] for r in agent_rows),
            "avg_survival_ticks": round(sum(r["avg_survival_ticks"] for r in agent_rows) / max(1, len(agent_rows)), 2),
            "max_longest_survival_ticks": max((r["longest_survival_ticks"] for r in agent_rows), default=0),
            "avg_learning_level": avg_learning,
            "top_performer_agent_id": best_agent["agent_id"] if best_agent else None,
            "death_causes_breakdown": death_causes_total,
            "stage_totals": {
                "food_discovered": sum(r["food_discovered_count"] for r in agent_rows),
                "food_reach_decisions": sum(r["food_reach_decisions_count"] for r in agent_rows),
                "food_physical_reaches": sum(r["food_physical_reaches_count"] for r in agent_rows),
                "food_consumed": sum(r["food_consumed_count"] for r in agent_rows),
                "water_discovered": sum(r["water_discovered_count"] for r in agent_rows),
                "water_reach_decisions": sum(r["water_reach_decisions_count"] for r in agent_rows),
                "water_physical_reaches": sum(r["water_physical_reaches_count"] for r in agent_rows),
                "water_consumed": sum(r["water_consumed_count"] for r in agent_rows),
            },
            "attempt_progression": list(self.attempt_progression),
            "agents": agent_rows,
        }

    def build_observatory_export(self) -> dict:
        training_payload = self.build_training_analytics_payload()
        dummy_comm = CommunicationEngine()
        dummy_soc = SocietyEngine()
        dummy_hist = HistoryKnowledgeEngine()
        sim_cfg = SimulationConfig(
            seed=self.config.template_seed,
            initial_population=self.config.agent_count,
            auto_recover_on_extinction=False,
            training_rebirth_enabled=True,
        )
        obs = PersistenceEngine.build_observatory_export(
            world_id=self.training_id,
            clock=self.clock,
            world=self.template_world,
            agents=self.agents,
            comm=dummy_comm,
            society=dummy_soc,
            history=dummy_hist,
            metrics={
                "training_tick": self.clock.tick,
                "total_deaths": training_payload["total_deaths"],
                "total_attempts": training_payload["total_attempts"],
            },
            backend_name=self.backend_name,
            config=sim_cfg,
            analytics=self.analytics,
            simulation_phase="training",
            training_analytics=training_payload,
        )
        # Do not ship 5km^2 elevation terrain array unnecessarily large if not needed, or keep null for non-3D observatory
        obs["world_terrain"] = None
        return obs

    def save_checkpoint(self, checkpoint_dir: Path) -> dict:
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.clock.flush_elapsed_runtime()
        stage_dir = Path(tempfile.mkdtemp(prefix=".train_stage_", dir=str(checkpoint_dir.parent)))
        try:
            # 1. Single shared template world
            tpl_path = stage_dir / "template_world.json.gz"
            with gzip.open(tpl_path, "wb") as gz:
                gz.write(json.dumps(self.template_world.to_snapshot()).encode("utf-8"))

            # 2. Isolated environment mutable states + RNG states
            envs_path = stage_dir / "env_states.pkl.gz"
            env_payload = {
                aid: {
                    "local_tick": slot.local_tick,
                    "rng_state": slot.rng.getstate(),
                    "fertility": slot.world.fertility,
                    "moisture": slot.world.moisture,
                    "water": slot.world.water,
                    "food_flora": slot.world.food_flora,
                    "food_max": slot.world.food_max,
                    "wood_flora": slot.world.wood_flora,
                    "herb_flora": slot.world.herb_flora,
                    "stone_mineral": slot.world.stone_mineral,
                    "weather": slot.world.weather.to_dict(),
                    "fauna": [f.to_dict() for f in slot.world.fauna.values()],
                    "next_fauna_id": slot.world.next_fauna_id,
                }
                for aid, slot in self.env_slots.items()
            }
            with gzip.open(envs_path, "wb") as gz:
                gz.write(pickle.dumps(env_payload, protocol=pickle.HIGHEST_PROTOCOL))

            # 3. Training state + agents + records + analytics
            tstate_path = stage_dir / "training_state.json.gz"
            tstate = {
                "training_id": self.training_id,
                "config": self.config.to_dict(),
                "clock": self.clock.to_dict(),
                "template_spawn_xy": list(self.template_spawn_xy),
                "next_agent_id": self.agents.next_agent_id,
                "discovered_techs": self.agents.discovered_techs,
                "agents": {str(aid): ag.to_registry_dict() for aid, ag in self.agents.all_agents.items()},
                "records": {str(aid): rec.to_dict() for aid, rec in self.records.items()},
                "analytics": self.analytics.to_dict(),
                "attempt_progression": self.attempt_progression,
                "rng_state": [self.rng.getstate()[0], list(self.rng.getstate()[1]), self.rng.getstate()[2]],
            }
            with gzip.open(tstate_path, "wb") as gz:
                gz.write(json.dumps(tstate, ensure_ascii=False).encode("utf-8"))

            # 4. Brains bundle (PyTorch state_dict + Adam optimizers + fallback parity)
            brains_path = stage_dir / "brains_state.bin.gz"
            brains_raw = {
                aid: ag.brain.export_state()
                for aid, ag in self.agents.all_agents.items()
                if ag.brain is not None
            }
            if TORCH_AVAILABLE and torch is not None:
                with gzip.open(brains_path, "wb") as gz:
                    torch.save(brains_raw, gz)
            else:
                with gzip.open(brains_path, "wb") as gz:
                    gz.write(pickle.dumps(brains_raw, protocol=pickle.HIGHEST_PROTOCOL))

            # 5. Observatory JSON snapshot
            obs_path = stage_dir / "observatory_export.json"
            with open(obs_path, "w", encoding="utf-8") as fh:
                json.dump(self.build_observatory_export(), fh, ensure_ascii=False, separators=(",", ":"))

            files_to_hash = [
                "template_world.json.gz",
                "env_states.pkl.gz",
                "training_state.json.gz",
                "brains_state.bin.gz",
                "observatory_export.json",
            ]
            checksums = {fname: _sha256_file(stage_dir / fname) for fname in files_to_hash}
            manifest = {
                "mode": "isolated_survival_training",
                "schema_version": TRAINING_SCHEMA_VERSION,
                "training_id": self.training_id,
                "training_tick": self.clock.tick,
                "agent_count": len(self.agents.all_agents),
                "template_seed": self.config.template_seed,
                "backend": self.backend_name,
                "saved_at_utc": datetime.now(timezone.utc).isoformat(),
                "total_deaths": sum(r.deaths for r in self.records.values()),
                "total_attempts": sum(r.attempts for r in self.records.values()),
                "checksums": checksums,
            }
            with open(stage_dir / "manifest.json", "w", encoding="utf-8") as fh:
                json.dump(manifest, fh, indent=2, ensure_ascii=False)

            for fname in files_to_hash + ["manifest.json"]:
                dst = checkpoint_dir / fname
                tmp_dst = checkpoint_dir / f".tmp_{fname}"
                shutil.copy2(stage_dir / fname, tmp_dst)
                os.replace(tmp_dst, dst)
            return manifest
        finally:
            shutil.rmtree(stage_dir, ignore_errors=True)

    @classmethod
    def resume_from_checkpoint(cls, checkpoint_dir: Path, require_torch: bool = False) -> "IsolatedSurvivalTrainer":
        if not checkpoint_dir.exists() or not checkpoint_dir.is_dir():
            raise TrainingIntegrityError(f"Training checkpoint directory not found: {checkpoint_dir}")
        manifest_path = checkpoint_dir / "manifest.json"
        if not manifest_path.exists():
            raise TrainingIntegrityError(f"Missing manifest.json in {checkpoint_dir}")
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise TrainingIntegrityError(f"Corrupt manifest.json: {exc}") from exc

        if manifest.get("mode") != "isolated_survival_training":
            raise TrainingIntegrityError(f"Checkpoint mode is '{manifest.get('mode')}', expected 'isolated_survival_training'")

        checksums = manifest.get("checksums", {})
        required = [
            "template_world.json.gz",
            "env_states.pkl.gz",
            "training_state.json.gz",
            "brains_state.bin.gz",
            "observatory_export.json",
        ]
        for fname in required:
            fpath = checkpoint_dir / fname
            if not fpath.exists():
                raise TrainingIntegrityError(f"Missing training file '{fname}'")
            expected = checksums.get(fname)
            actual = _sha256_file(fpath)
            if not expected or actual != expected:
                raise TrainingIntegrityError(f"Checksum mismatch for '{fname}': expected {expected}, got {actual}")

        hw = detect_hardware_budget()
        configure_torch_cpu(hw.recommended_torch_threads)
        backend_name = active_backend_name(require_torch=require_torch)

        with gzip.open(checkpoint_dir / "template_world.json.gz", "rb") as gz:
            template_world = WorldEngine.from_snapshot(json.loads(gz.read().decode("utf-8")))

        with gzip.open(checkpoint_dir / "training_state.json.gz", "rb") as gz:
            tstate = json.loads(gz.read().decode("utf-8"))

        cfg_dict = dict(tstate["config"])
        cfg_dict["require_torch"] = require_torch
        config = TrainingConfig(**cfg_dict)
        clock = SimulationClock.from_dict(tstate["clock"])
        clock.begin_session()

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
                raise TrainingIntegrityError("--require-torch set but torch missing.")
            with gzip.open(brains_path, "rb") as gz:
                brains_raw = pickle.load(gz)

        agent_engine = AgentEngine(require_torch=require_torch)
        agent_engine.next_agent_id = int(tstate["next_agent_id"])
        agent_engine.discovered_techs = dict(tstate.get("discovered_techs", {}))

        for aid_s, ag_dict in tstate["agents"].items():
            aid = int(aid_s)
            brain = AgentBrain.from_exported_state(brains_raw[aid], require_torch=require_torch) if aid in brains_raw else None
            agent_engine.all_agents[aid] = Agent.from_registry_dict(ag_dict, brain=brain)

        records = {int(aid_s): AgentTrainingRecord.from_dict(r) for aid_s, r in tstate["records"].items()}

        with gzip.open(checkpoint_dir / "env_states.pkl.gz", "rb") as gz:
            envs_raw = pickle.loads(gz.read())

        env_slots: Dict[int, IsolatedEnvSlot] = {}
        for aid, edata in envs_raw.items():
            w = _clone_world_from_template(template_world)
            w.fertility = list(edata["fertility"])
            w.moisture = list(edata["moisture"])
            w.water = list(edata["water"])
            w.food_flora = list(edata["food_flora"])
            w.food_max = list(edata["food_max"])
            w.wood_flora = list(edata["wood_flora"])
            w.herb_flora = list(edata["herb_flora"])
            w.stone_mineral = list(edata["stone_mineral"])
            w.weather = WeatherState.from_dict(edata["weather"])
            w.next_fauna_id = int(edata["next_fauna_id"])
            w.fauna = {int(f["fauna_id"]): FaunaEntity.from_dict(f) for f in edata["fauna"]}
            erng = random.Random()
            erng.setstate(edata["rng_state"])
            env_slots[int(aid)] = IsolatedEnvSlot(
                agent_id=int(aid),
                world=w,
                rng=erng,
                local_tick=int(edata["local_tick"]),
            )

        rng = random.Random()
        rs = tstate["rng_state"]
        rng.setstate((int(rs[0]), tuple(rs[1]), rs[2]))

        spawn_xy = (float(tstate["template_spawn_xy"][0]), float(tstate["template_spawn_xy"][1]))
        return cls(
            training_id=str(tstate["training_id"]),
            config=config,
            clock=clock,
            template_world=template_world,
            template_spawn_xy=spawn_xy,
            agents=agent_engine,
            env_slots=env_slots,
            records=records,
            rng=rng,
            backend_name=backend_name,
            analytics=AnalyticsTracker.from_dict(tstate.get("analytics")),
            attempt_progression=list(tstate.get("attempt_progression", [])),
        )

    def run(self, checkpoint_dir: Path, max_ticks: Optional[int] = None) -> dict:
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
                if (time.monotonic() - start_mono) >= budget_sec:
                    self._stop_reason = "runtime_budget_reached"
                    break
                self.step_tick()
                ticks_run += 1

                now = time.monotonic()
                if (now - last_ckpt_mono) >= ckpt_interval_sec or (self.clock.tick - last_ckpt_tick) >= self.config.checkpoint_interval_ticks:
                    self.save_checkpoint(checkpoint_dir)
                    last_ckpt_mono = now
                    last_ckpt_tick = self.clock.tick
        except Exception as exc:
            self._stop_reason = f"error:{exc}"
            self.save_checkpoint(checkpoint_dir)
            raise

        final_manifest = self.save_checkpoint(checkpoint_dir)
        return {
            "training_id": self.training_id,
            "mode": "isolated_survival_training",
            "stop_reason": self._stop_reason or "completed",
            "ticks_executed_this_run": ticks_run,
            "final_tick": self.clock.tick,
            "backend": self.backend_name,
            "manifest": final_manifest,
        }
