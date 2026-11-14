"""Tests for births, permanent death, social knowledge transfer, 3-layer history, crimes, and emergent language."""

import random
import unittest

from sim.config import SimulationConfig
from sim.orchestrator import SimulationEngine


class TestDemographicsLanguageSocietyHistory(unittest.TestCase):
    def test_9_and_10_birth_and_permanent_death(self) -> None:
        cfg = SimulationConfig(seed=301, initial_population=10)
        engine = SimulationEngine.create_new(cfg)
        rng = random.Random(301)

        mom = engine.agents.all_agents[1]
        mom.sex = "F"
        dad = engine.agents.all_agents[2]
        dad.sex = "M"

        # Spawn newborn and verify independent fresh brain + empty personal memory
        mom.memory.record_episode(5, "resource_found", mom.x, mom.y, None, 0.9, "secret_grove")
        child = engine.agents.spawn_newborn(
            tick=10,
            mother=mom,
            father_id=dad.agent_id,
            rng=rng,
            obs_dim=cfg.observation_dim,
            hidden_dim=cfg.hidden_dim,
            num_actions=cfg.num_actions,
            num_signals=cfg.num_signal_tokens,
            learning_rate=cfg.learning_rate,
        )
        self.assertEqual(child.agent_id, 11)
        self.assertEqual(child.generation, 1)
        self.assertEqual(child.parent_a_id, mom.agent_id)
        self.assertEqual(child.parent_b_id, dad.agent_id)
        self.assertEqual(len(child.memory.episodic), 0)
        self.assertNotEqual(child.brain.weight_fingerprint(), mom.brain.weight_fingerprint())

        # Permanent death: dead agent stays dead and never re-enters living pool
        engine.agents.kill_agent(dad, tick=12, sim_date=engine.clock.sim_date_str(), cause="starvation", history=engine.history)
        self.assertFalse(dad.is_alive)
        self.assertEqual(dad.death_tick, 12)
        self.assertNotIn(dad.agent_id, engine.agents.living_agents())

        for _ in range(10):
            engine.step_tick()
        self.assertFalse(engine.agents.all_agents[dad.agent_id].is_alive)
        self.assertIn(dad.agent_id, engine.agents.all_agents)  # Genealogy identity preserved forever

    def test_11_social_knowledge_transfer_without_mind_copying(self) -> None:
        cfg = SimulationConfig(seed=302, initial_population=10)
        engine = SimulationEngine.create_new(cfg)
        ag1 = engine.agents.all_agents[1]
        ag2 = engine.agents.all_agents[2]

        # Co-locate ag1 and ag2; give ag1 private episodic memory & skill + signal experience
        ag1.x, ag1.y = 500.0, 500.0
        ag2.x, ag2.y = 510.0, 505.0
        ag1.memory.skills["foraging"] = 0.85
        ag1.memory.record_episode(1, "secret_event", 500.0, 500.0, None, 0.9, "only_ag1_saw_this")

        buckets = engine._build_spatial_buckets(engine.agents.living_agents())
        from sim.perception import PerceptionEngine
        perc = PerceptionEngine.perceive(
            ag1, engine.world, engine.agents.living_agents(), buckets, [], [], False,
            cfg.base_vision_radius_m, cfg.base_hearing_radius_m
        )
        # Action 12 = communicate_or_teach
        engine.agents.execute_action(
            ag1, 12, 7, perc, 5, engine.clock.sim_date_str(),
            engine.world, engine.comm, engine.society, engine.history, engine.rng
        )

        # Skill and token association transferred socially, while private episodic memory was NOT copied
        self.assertGreater(ag2.memory.skills["foraging"], 0.10)
        self.assertIn(7, ag2.lexicon)
        self.assertEqual(len(ag2.memory.episodic), 0)

    def test_12_and_13_three_layer_history_and_unblocked_crime_metrics(self) -> None:
        cfg = SimulationConfig(seed=303, initial_population=25)
        engine = SimulationEngine.create_new(cfg)
        ag1 = engine.agents.all_agents[1]
        ag2 = engine.agents.all_agents[2]
        ag1.x, ag1.y = 400.0, 400.0
        ag2.x, ag2.y = 405.0, 405.0

        # Ensure crime is NOT prevented by the engine and is logged in Layer 1 truth
        ag2.health = 0.15
        from sim.perception import PerceptionEngine
        buckets = engine._build_spatial_buckets(engine.agents.living_agents())
        perc = PerceptionEngine.perceive(
            ag1, engine.world, engine.agents.living_agents(), buckets, [], [], False,
            cfg.base_vision_radius_m, cfg.base_hearing_radius_m
        )
        engine.agents.execute_action(
            ag1, 15, 3, perc, 20, engine.clock.sim_date_str(),
            engine.world, engine.comm, engine.society, engine.history, engine.rng
        )
        self.assertGreaterEqual(engine.society.total_crimes, 1)
        self.assertEqual(engine.society.last_crime_tick, 20)

        truth_types = {e.event_type for e in engine.history.observer_get_truth_tail(50)}
        self.assertTrue("crime_murder" in truth_types or "crime_assault" in truth_types)

        # Layer 2 witness chronicle + artifact and Layer 3 generational interpretation stay distinct from Layer 1
        art, acc, _ = engine.history.create_artifact_and_chronicle(
            tick=25, sim_date="Y0000-M01-D26", author_id=ag1.agent_id,
            x=400.0, y=400.0, medium="stone_carving", symbol_tokens=[3, 9],
            topic="conflict", observed_agent_ids=[ag1.agent_id, ag2.agent_id],
            author_skill=0.2, author_bias=0.6, rng=engine.rng,
        )
        interp = engine.history.attempt_generational_interpretation(
            tick=300, interpreter_id=3, interpreter_age_years=18.0,
            nearby_artifacts=[art], rng=engine.rng,
        )
        self.assertIsNotNone(interp)
        # Agents have zero methods to read _truth_events
        self.assertFalse(hasattr(ag1, "truth_events"))
        self.assertFalse(hasattr(perc, "truth_events"))


if __name__ == "__main__":
    unittest.main()
