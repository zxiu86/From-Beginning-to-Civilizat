"""Tests for 100 independent agents, neural weight independence, memory isolation, sensory locality, and biology."""

import random
import unittest

from sim.brain import AgentBrain
from sim.config import SimulationConfig
from sim.orchestrator import SimulationEngine
from sim.perception import PerceptionEngine


class TestAgentsBrainsAndLocality(unittest.TestCase):
    def test_2_and_3_hundred_unique_agents_and_independent_neural_weights(self) -> None:
        cfg = SimulationConfig(seed=202, initial_population=100)
        engine = SimulationEngine.create_new(cfg)
        self.assertEqual(len(engine.agents.all_agents), 100)

        ids = sorted(engine.agents.all_agents.keys())
        self.assertEqual(ids, list(range(1, 101)))

        # Every individual has unique neural weights
        fingerprints = {ag.brain.weight_fingerprint() for ag in engine.agents.all_agents.values()}
        self.assertEqual(len(fingerprints), 100)

        # Training agent 1 MUST NOT alter agent 2's neural weights
        ag1 = engine.agents.all_agents[1]
        ag2 = engine.agents.all_agents[2]
        fp2_before = ag2.brain.weight_fingerprint()
        fp1_before = ag1.brain.weight_fingerprint()

        rng = random.Random(9)
        obs = [0.25] * cfg.observation_dim
        for step in range(cfg.learn_batch_size):
            a_idx, s_idx, lp, val, h_prev = ag1.brain.step_decision(obs, rng)
            ag1.brain.record_experience(obs, h_prev, a_idx, s_idx, lp, reward=1.0 if step % 2 == 0 else -0.5, value_est=val)
        loss = ag1.brain.learn_from_experience(batch_size=cfg.learn_batch_size)
        self.assertIsNotNone(loss)
        self.assertNotEqual(ag1.brain.weight_fingerprint(), fp1_before)
        self.assertEqual(ag2.brain.weight_fingerprint(), fp2_before)

    def test_4_memory_independence(self) -> None:
        cfg = SimulationConfig(seed=203, initial_population=100)
        engine = SimulationEngine.create_new(cfg)
        ag1 = engine.agents.all_agents[1]
        ag2 = engine.agents.all_agents[2]
        ag1.memory.record_episode(1, "resource_found", 100.0, 200.0, None, 0.9, "berries")
        ag1.memory.remember_location(1, 42, 100.0, 200.0, "food", 5.0)
        self.assertEqual(len(ag1.memory.episodic), 1)
        self.assertEqual(len(ag2.memory.episodic), 0)
        self.assertIsNone(ag2.memory.recall_nearest(100.0, 200.0, "food"))

    def test_5_strict_sensory_locality_no_distant_omniscience(self) -> None:
        cfg = SimulationConfig(seed=204, initial_population=100)
        engine = SimulationEngine.create_new(cfg)
        living = engine.agents.living_agents()

        # Place agent 1 at west corner and agent 2 far away (> 1800m away)
        ag1 = living[1]
        ag2 = living[2]
        ag1.x, ag1.y = 100.0, 100.0
        ag2.x, ag2.y = 2300.0, 1800.0
        # Move all other agents away from (100, 100) to isolate sensory test
        for aid, ag in living.items():
            if aid not in (1, 2):
                ag.x, ag.y = 1500.0, 1500.0

        buckets = engine._build_spatial_buckets(living)
        engine.comm.clear_tick_emissions()
        engine.comm.emit(tick=1, speaker_id=2, x=2300.0, y=1800.0, token=5, gesture=1, context_tag="ctx_food")

        perc = PerceptionEngine.perceive(
            agent=ag1,
            world=engine.world,
            living_agents=living,
            spatial_buckets=buckets,
            recent_emissions=engine.comm.recent_emissions,
            artifacts=engine.history.artifacts,
            is_night=False,
            base_vision=cfg.base_vision_radius_m,
            base_hearing=cfg.base_hearing_radius_m,
        )
        self.assertNotIn(2, perc.nearby_agent_ids)
        self.assertIsNone(perc.nearest_agent_id)
        self.assertEqual(len(perc.heard_emissions), 0)

    def test_7_and_8_biology_movement_and_interaction(self) -> None:
        cfg = SimulationConfig(seed=205, initial_population=100)
        engine = SimulationEngine.create_new(cfg)
        initial_positions = {aid: (ag.x, ag.y) for aid, ag in engine.agents.all_agents.items()}
        initial_hunger = engine.agents.all_agents[1].hunger

        for _ in range(15):
            engine.step_tick()

        moved_count = sum(
            1 for aid, ag in engine.agents.all_agents.items()
            if (ag.x, ag.y) != initial_positions[aid]
        )
        self.assertGreater(moved_count, 5)
        self.assertNotEqual(engine.agents.all_agents[1].hunger, initial_hunger)
        self.assertGreater(engine.clock.tick, 0)


if __name__ == "__main__":
    unittest.main()
