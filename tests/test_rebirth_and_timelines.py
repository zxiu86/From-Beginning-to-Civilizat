"""Comprehensive tests for Rebirth & Experimental Timeline System, Agent 14 & 16 isolation, Death Penalty Learning, and Physics."""

import json
import math
import tempfile
import unittest
from pathlib import Path

from sim.agent import ACTION_NAMES
from sim.config import SimulationConfig
from sim.orchestrator import SimulationEngine
from sim.physics import attempt_steered_move, bounded_astar_next_heading, is_cell_passable
from sim.rebirth import RebirthIntegrityError, compare_timelines, create_experimental_rebirth_branch


class TestRebirthAndExperimentalTimelines(unittest.TestCase):
    def _build_post_extinction_checkpoint(self, root: Path, pop: int = 24) -> tuple[Path, SimulationEngine, dict]:
        """Build a realistic evolved & depleted world with offspring, artifacts, and deaths ending in extinction."""
        orig_dir = root / "original_ckpt"
        cfg = SimulationConfig(seed=31415, initial_population=pop)
        engine = SimulationEngine.create_new(cfg)

        # Evolve naturally for 40 ticks
        for _ in range(40):
            engine.step_tick()

        # Spawn two realistic offspring (so both original founders and newborn children are represented)
        living_list = list(engine.agents.living_agents().values())
        mother_a = next((a for a in living_list if a.sex == "F"), living_list[0])
        father_a = next((a for a in living_list if a.sex == "M"), living_list[-1])
        child_1 = engine.agents.spawn_newborn(
            tick=engine.clock.tick,
            mother=mother_a,
            father_id=father_a.agent_id,
            rng=engine.rng,
            obs_dim=cfg.observation_dim,
            hidden_dim=cfg.hidden_dim,
            num_actions=cfg.num_actions,
            num_signals=cfg.num_signal_tokens,
            learning_rate=cfg.learning_rate,
        )

        # Ensure Agents 14 and 16 exist and experience distinct pre-death realities
        ag14 = engine.agents.all_agents[14]
        ag16 = engine.agents.all_agents[16]

        # Harvest heavy depletion in cell (20, 20) & advance drought streak to verify environment state isn't reset
        dep_idx = 20 * engine.world.cols + 20
        engine.world.food_flora[dep_idx] = 0.0
        engine.world.wood_flora[dep_idx] = 0.0
        engine.world.weather.drought_streak_days = 19

        # Record distinct earlier experiences for Agent 14 (hunger deficit) and Agent 16 (assault threat)
        ag14.hunger = 0.96
        ag14.thirst = 0.20
        ag14.health = 0.02
        ag14.memory.record_episode(engine.clock.tick, "hunger_crisis", ag14.x, ag14.y, None, -0.9, "starving")
        if ag14.brain is not None:
            ag14.brain.record_experience(
                obs=[0.5] * cfg.observation_dim,
                hidden_before=list(ag14.brain.hidden_state),
                action_idx=0,
                signal_idx=1,
                log_prob_action=-2.0,
                reward=-0.8,
                value_est=0.1,
                tick=engine.clock.tick,
                context_tag="hunger_crisis",
            )
        fp14_pre_death = ag14.brain.weight_fingerprint() if ag14.brain else ""
        engine.agents.kill_agent(ag14, tick=engine.clock.tick, sim_date=engine.clock.sim_date_str(), cause="starvation", history=engine.history)
        ag14_death_tick = ag14.death_tick

        # Advance 8 ticks after Agent 14 died, then kill Agent 16 by violence
        for _ in range(8):
            engine.step_tick()

        ag16.injury = 0.85
        ag16.health = 0.03
        ag16.memory.record_episode(engine.clock.tick, "attack_suffered", ag16.x, ag16.y, 1, -0.95, "assault")
        if ag16.brain is not None:
            ag16.brain.record_experience(
                obs=[0.4] * cfg.observation_dim,
                hidden_before=list(ag16.brain.hidden_state),
                action_idx=15,
                signal_idx=2,
                log_prob_action=-2.1,
                reward=-0.7,
                value_est=0.05,
                tick=engine.clock.tick,
                context_tag="ctx_hostile",
            )
        fp16_pre_death = ag16.brain.weight_fingerprint() if ag16.brain else ""
        engine.agents.kill_agent(ag16, tick=engine.clock.tick, sim_date=engine.clock.sim_date_str(), cause="murdered_by_1", history=engine.history)
        ag16_death_tick = ag16.death_tick

        # Advance 5 more ticks so post-death world events exist (Agent 14 & 16 must NEVER know about them!)
        for _ in range(5):
            engine.step_tick()

        # Bring all remaining living agents including child_1 to natural death -> full post-extinction checkpoint
        for ag in list(engine.agents.living_agents().values()):
            cause = "illness_or_injury" if ag.agent_id % 3 == 0 else "dehydration"
            engine.agents.kill_agent(ag, tick=engine.clock.tick, sim_date=engine.clock.sim_date_str(), cause=cause, history=engine.history)

        engine.step_tick()  # Records natural extinction event on final tick
        orig_manifest = engine.save_checkpoint(orig_dir)

        meta = {
            "dep_idx": dep_idx,
            "orig_food_dep": engine.world.food_flora[dep_idx],
            "orig_wood_dep": engine.world.wood_flora[dep_idx],
            "orig_drought_days": engine.world.weather.drought_streak_days,
            "child_1_id": child_1.agent_id,
            "ag14_death_tick": ag14_death_tick,
            "ag16_death_tick": ag16_death_tick,
            "fp14_pre_death": fp14_pre_death,
            "fp16_pre_death": fp16_pre_death,
            "fp14_post_death_penalty": ag14.brain.weight_fingerprint() if ag14.brain else "",
            "fp16_post_death_penalty": ag16.brain.weight_fingerprint() if ag16.brain else "",
            "extinction_tick": engine.clock.tick,
        }
        return orig_dir, engine, meta

    def test_rebirth_independence_memory_isolation_agent_14_16_and_world_continuity(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            orig_dir, orig_engine, meta = self._build_post_extinction_checkpoint(root, pop=22)

            # Verify original checkpoint really reached 0 living individuals
            orig_manifest_before = json.loads((orig_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(orig_manifest_before["living_population"], 0)
            self.assertTrue(orig_manifest_before["deceased_brains_archived"])

            # Verify death penalty updated neural weights authentically for Agent 14 & 16
            self.assertNotEqual(meta["fp14_pre_death"], meta["fp14_post_death_penalty"])
            self.assertNotEqual(meta["fp16_pre_death"], meta["fp16_post_death_penalty"])

            exp_dir = root / "experimental_branch"
            report = create_experimental_rebirth_branch(
                source_checkpoint_dir=orig_dir,
                target_branch_dir=exp_dir,
                require_torch=False,
            )

            # 1. Verify Experimental Timeline has new UUID, correct parent lineage, and did NOT touch original
            self.assertEqual(report["timeline_kind"], "experimental_rebirth")
            self.assertEqual(report["parent_timeline_id"], orig_engine.timeline_id)
            self.assertNotEqual(report["timeline_id"], orig_engine.timeline_id)
            self.assertEqual(report["branch_point_tick"], meta["extinction_tick"])

            orig_manifest_after = json.loads((orig_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(orig_manifest_before, orig_manifest_after)

            # 2. Load Experimental timeline and inspect world preservation + revived individuals
            exp_engine = SimulationEngine.resume_from_checkpoint(exp_dir, require_torch=False)
            self.assertEqual(exp_engine.timeline_id, report["timeline_id"])
            self.assertEqual(exp_engine.parent_timeline_id, orig_engine.timeline_id)
            self.assertEqual(exp_engine.clock.tick, meta["extinction_tick"])
            # World NOT reset: depleted resources & weather state stay preserved identically to source checkpoint
            self.assertEqual(exp_engine.world.food_flora[meta["dep_idx"]], meta["orig_food_dep"])
            self.assertEqual(exp_engine.world.wood_flora[meta["dep_idx"]], meta["orig_wood_dep"])
            self.assertEqual(exp_engine.world.weather.drought_streak_days, meta["orig_drought_days"])

            # All individuals (22 founders + 1 deceased child) revived with exact original IDs & intact brains
            self.assertEqual(len(exp_engine.agents.living_agents()), 23)
            self.assertIn(meta["child_1_id"], exp_engine.agents.living_agents())

            # 3. Inspect Agent 14 & Agent 16 specifically
            exp14 = exp_engine.agents.all_agents[14]
            exp16 = exp_engine.agents.all_agents[16]
            self.assertTrue(exp14.is_alive)
            self.assertTrue(exp16.is_alive)
            self.assertIsNotNone(exp14.brain)
            self.assertIsNotNone(exp16.brain)
            self.assertEqual(exp14.brain.weight_fingerprint(), meta["fp14_post_death_penalty"])
            self.assertEqual(exp16.brain.weight_fingerprint(), meta["fp16_post_death_penalty"])
            self.assertEqual(exp14.original_death_tick, meta["ag14_death_tick"])
            self.assertEqual(exp16.original_death_tick, meta["ag16_death_tick"])
            self.assertEqual(exp14.original_cause_of_death, "starvation")
            self.assertEqual(exp16.original_cause_of_death, "murdered_by_1")
            self.assertEqual(exp14.rebirth_count, 1)

            # Memory isolation: NO memories exist after each agent's own death tick (zero extinction omniscience!)
            self.assertTrue(all(ep.tick <= meta["ag14_death_tick"] for ep in exp14.memory.episodic))
            self.assertTrue(all(tr.last_seen_tick <= meta["ag14_death_tick"] for tr in exp14.memory.spatial_map.values()))
            self.assertTrue(all(ep.tick <= meta["ag16_death_tick"] for ep in exp16.memory.episodic))
            self.assertTrue(all(tr.last_seen_tick <= meta["ag16_death_tick"] for tr in exp16.memory.spatial_map.values()))

            # Safe biological post-rebirth baselines
            self.assertGreaterEqual(exp14.health, 0.85)
            self.assertLessEqual(exp14.hunger, 0.25)
            self.assertLessEqual(exp14.thirst, 0.25)

            # Check event type logged is `experimental_rebirth`, distinct from `birth`
            truth_tail = exp_engine.history.observer_get_truth_tail(100)
            rebirth_events = [e for e in truth_tail if e.event_type == "experimental_rebirth"]
            self.assertEqual(len(rebirth_events), 23)

            # 4. Run Experimental timeline forward 25 ticks; verify zero impact on Original checkpoint and full resume fidelity
            for _ in range(25):
                exp_engine.step_tick()
            exp_engine.save_checkpoint(exp_dir)

            # Original remains untouched at extinction tick with 0 living population
            orig_reloaded = SimulationEngine.resume_from_checkpoint(orig_dir, require_torch=False)
            self.assertEqual(orig_reloaded.clock.tick, meta["extinction_tick"])
            self.assertEqual(len(orig_reloaded.agents.living_agents()), 0)

            # Timeline comparison engine produces authentic real delta stats
            cmp_report = compare_timelines(orig_dir, exp_dir)
            self.assertEqual(cmp_report["original"]["living_count"], 0)
            self.assertGreater(cmp_report["deltas"]["living_count_delta"], 0)
            self.assertEqual(cmp_report["rebirth_agents_count"], 23)

    def test_refuses_branching_same_directory_or_no_deceased(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ckpt = root / "alive_only"
            cfg = SimulationConfig(seed=99, initial_population=10)
            engine = SimulationEngine.create_new(cfg)
            engine.step_tick()
            engine.save_checkpoint(ckpt)

            with self.assertRaises(RebirthIntegrityError):
                create_experimental_rebirth_branch(ckpt, ckpt)
            with self.assertRaises(RebirthIntegrityError):
                create_experimental_rebirth_branch(ckpt, root / "branch_empty")

    def test_disease_death_does_not_inject_medical_cure_and_actions_stay_unblocked(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cfg = SimulationConfig(seed=71, initial_population=10)
            engine = SimulationEngine.create_new(cfg)
            ag = engine.agents.all_agents[1]
            ag.skills = dict(ag.memory.skills)
            healing_before = ag.memory.skills.get("healing", 0.0)
            ag.disease_load = 0.9
            ag.health = 0.01
            ag.brain.record_experience(
                obs=[0.2] * cfg.observation_dim,
                hidden_before=list(ag.brain.hidden_state),
                action_idx=0,
                signal_idx=0,
                log_prob_action=-1.5,
                reward=-0.2,
                value_est=0.0,
                tick=engine.clock.tick,
            )
            engine.agents.kill_agent(ag, tick=1, sim_date=engine.clock.sim_date_str(), cause="illness_or_injury", history=engine.history)

            self.assertIsNotNone(ag.death_penalty_record)
            self.assertEqual(ag.death_penalty_record["cause_category"], "illness_or_injury")
            self.assertEqual(ag.death_penalty_record["evidence_basis"], "bodily_distress_without_causal_knowledge")
            # Zero medical skill magically granted upon dying of disease!
            self.assertEqual(ag.memory.skills.get("healing", 0.0), healing_before)
            self.assertIn("steal", ACTION_NAMES)
            self.assertIn("assault_or_kill", ACTION_NAMES)

    def test_physics_astar_detours_around_deep_water_and_separates_entities(self) -> None:
        cfg = SimulationConfig(seed=51, initial_population=6)
        engine = SimulationEngine.create_new(cfg)
        world = engine.world
        # Paint a vertical deep-water barrier in col 20 across rows 15..25
        for r in range(15, 26):
            world.water[r * world.cols + 20] = 120.0
        start_x = 19.5 * world.cell_size_m
        start_y = 20.5 * world.cell_size_m
        goal_x = 22.5 * world.cell_size_m
        goal_y = 20.5 * world.cell_size_m

        ux, uy = bounded_astar_next_heading(world, start_x, start_y, goal_x, goal_y, max_expansions=128)
        self.assertGreater(math.hypot(ux, uy), 0.5)
        nx, ny, dist = attempt_steered_move(world, start_x, start_y, ux, uy, 25.0, nearby_obstacles=[(start_x + 0.4, start_y)])
        nc, nr = world.cell_coords_at(nx, ny)
        self.assertTrue(is_cell_passable(world, nc, nr))
        self.assertGreater(dist, 0.0)


if __name__ == "__main__":
    unittest.main()
