"""Evolution Engine — gestation, births, cultural/dialect extinctions, and non-linear change."""

from __future__ import annotations

import random
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from .agent import AgentEngine
    from .communication import CommunicationEngine
    from .config import SimulationConfig
    from .history import HistoryKnowledgeEngine
    from .society import SocietyEngine
    from .world import WorldEngine


class EvolutionEngine:
    """
    Drives demographic turnover, biological gestation/births, and non-monotonic
    cultural/linguistic survival without enforcing hardcoded historical stages.
    """

    GESTATION_DURATION_TICKS = 270  # ~9 simulated months

    def step_demographics(
        self,
        tick: int,
        sim_date: str,
        config: "SimulationConfig",
        agents: "AgentEngine",
        world: "WorldEngine",
        comm: "CommunicationEngine",
        society: "SocietyEngine",
        history: "HistoryKnowledgeEngine",
        rng: random.Random,
    ) -> None:
        living = agents.living_agents()
        living_count = len(living)

        for ag in list(living.values()):
            if ag.is_pregnant:
                ag.gestation_ticks += 1
                # Severe starvation/dehydration can cause pregnancy loss
                if ag.health < 0.25 or ag.hunger > 0.92:
                    ag.is_pregnant = False
                    ag.gestation_ticks = 0
                    ag.mate_father_id = None
                    continue

                if ag.gestation_ticks >= self.GESTATION_DURATION_TICKS:
                    ag.is_pregnant = False
                    ag.gestation_ticks = 0
                    father_id = ag.mate_father_id
                    ag.mate_father_id = None
                    if living_count < config.max_population_soft_cap:
                        child = agents.spawn_newborn(
                            tick=tick,
                            mother=ag,
                            father_id=father_id,
                            rng=rng,
                            obs_dim=config.observation_dim,
                            hidden_dim=config.hidden_dim,
                            num_actions=config.num_actions,
                            num_signals=config.num_signal_tokens,
                            learning_rate=config.learning_rate,
                        )
                        living_count += 1
                        if agents.first_birth_tick is None:
                            agents.first_birth_tick = tick
                            history.record_truth(
                                tick, sim_date, "first_birth",
                                [child.agent_id, ag.agent_id], ag.x, ag.y,
                                f"First birth in world: agent {child.agent_id} born to {ag.agent_id}.",
                            )
                        history.record_truth(
                            tick, sim_date, "birth",
                            [child.agent_id, ag.agent_id] + ([father_id] if father_id else []),
                            ag.x, ag.y,
                            f"Agent {child.agent_id} (gen {child.generation}) born to mother {ag.agent_id}.",
                        )

        # Periodically check if any stabilized proto-words became extinct because all bearers died
        if tick > 0 and tick % 90 == 0 and comm.milestones.stable_protowords:
            active_tokens = set()
            for ag in agents.living_agents().values():
                for tok, ctx_map in ag.lexicon.items():
                    if any(w >= 0.3 for w in ctx_map.values()):
                        active_tokens.add(tok)
            for pw_key, meta in list(comm.milestones.stable_protowords.items()):
                if meta["token"] not in active_tokens and not meta.get("extinct"):
                    meta["extinct"] = True
                    comm.milestones.extinct_tokens_count += 1
                    history.record_truth(
                        tick, sim_date, "protoword_extinct", [],
                        world.width_m * 0.5, world.height_m * 0.5,
                        f"Stabilized proto-word {pw_key} ({meta['context']}) vanished with its bearers.",
                    )

        # Periodically decay surface artifacts and evaluate emergent dialects & institutions
        if tick % 30 == 0:
            history.decay_artifacts(world.weather.condition)
            dialect_evs = comm.evaluate_dialects(tick, agents.living_agents(), world.width_m, world.height_m)
            for ev in dialect_evs:
                history.record_truth(
                    tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                )

        inst_evs = society.step_institutions(tick, agents.living_agents(), rng)
        for ev in inst_evs:
            history.record_truth(
                tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
            )
