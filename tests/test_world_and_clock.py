"""Tests for 5 km^2 WorldEngine, EnvironmentEngine, finite resource dynamics, and SimulationClock."""

import random
import unittest

from sim.clock import SimulationClock
from sim.config import SimulationConfig
from sim.orchestrator import SimulationEngine
from sim.world import WorldEngine


class TestWorldAndClock(unittest.TestCase):
    def test_1_new_world_dimensions_and_ecosystem(self) -> None:
        cfg = SimulationConfig(seed=101, initial_population=100)
        engine = SimulationEngine.create_new(cfg)
        self.assertEqual(engine.world.width_m * engine.world.height_m, 5_000_000.0)
        self.assertEqual(engine.world.num_cells, 8000)
        self.assertGreater(sum(engine.world.water), 0.0)
        self.assertGreater(sum(engine.world.food_flora), 0.0)
        self.assertGreater(len(engine.world.fauna), 0)
        self.assertEqual(engine.clock.tick, 0)

    def test_6_resource_depletion_and_bounded_regeneration(self) -> None:
        rng = random.Random(77)
        world = WorldEngine(seed=77)
        world.generate(rng)

        # Find a fertile food cell away from deep water
        target_idx = max(range(world.num_cells), key=lambda i: world.food_flora[i])
        initial_food = world.food_flora[target_idx]
        self.assertGreater(initial_food, 2.0)

        # Heavy consumption depletes resource
        taken = world.harvest_food(target_idx, initial_food * 0.9)
        self.assertGreater(taken, 0.0)
        after_harvest = world.food_flora[target_idx]
        self.assertLess(after_harvest, initial_food * 0.25)

        # Regeneration happens gradually based on soil/moisture/season, NOT instant full reset
        world.step_environment(tick=1, season="spring", month=1, rng=rng)
        after_one_day = world.food_flora[target_idx]
        self.assertGreater(after_one_day, after_harvest)
        self.assertLess(after_one_day, initial_food)

        # Stripped to 0 during drought recovers extremely slowly (no automatic rescue!)
        world.food_flora[target_idx] = 0.0
        world.weather.condition = "drought"
        world.weather.drought_streak_days = 40
        world.moisture[target_idx] = 0.05
        world.step_environment(tick=2, season="winter", month=11, rng=rng)
        self.assertLess(world.food_flora[target_idx], 0.05)

    def test_clock_math_and_monotonic_advance(self) -> None:
        clock = SimulationClock()
        self.assertEqual(clock.ticks_per_month, 30)
        self.assertEqual(clock.ticks_per_year, 360)
        self.assertEqual(clock.real_seconds_per_sim_month, 60.0)
        for _ in range(360):
            clock.step(speed_mode="max_cpu_research")
        self.assertEqual(clock.tick, 360)
        self.assertEqual(clock.year, 1)
        self.assertEqual(clock.month, 0)


if __name__ == "__main__":
    unittest.main()
