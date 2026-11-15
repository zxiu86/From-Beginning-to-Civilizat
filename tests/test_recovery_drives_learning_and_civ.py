"""Verification tests for fresh 100-agent start, survival/reproductive drives,
atomic Automatic Population Recovery, neural learning (GAE/entropy/GRU BPTT),
deception crimes, cultivation skill, experience-gated norms, and real mediation."""

from __future__ import annotations

import json
import random
import tempfile
import unittest
from pathlib import Path

from sim.agent import ACTION_NAMES, Agent
from sim.brain import AgentBrain
from sim.config import SimulationConfig
from sim.orchestrator import SimulationEngine
from sim.perception import LocalPerception
from sim.persistence import PersistenceEngine


def _make_perc(
    *,
    nearby_agent_ids=None,
    nearest_agent_id=None,
    nearest_agent_dist=999.0,
    local_water=0.0,
    local_food=0.0,
    local_predator_dist=999.0,
    food_dx=0.0,
    food_dy=0.0,
    water_dx=0.0,
    water_dy=0.0,
    near_dx=0.0,
    near_dy=0.0,
    local_mate_id=None,
    local_mate_dx=0.0,
    local_mate_dy=0.0,
    local_mate_dist=999.0,
    local_kin_need_id=None,
    local_kin_need_dx=0.0,
    local_kin_need_dy=0.0,
    local_hazard_dx=0.0,
    local_hazard_dy=0.0,
    local_hazard_dist=999.0,
) -> LocalPerception:
    obs = [0.0] * 36
    obs[18] = food_dx
    obs[19] = food_dy
    obs[20] = water_dx
    obs[21] = water_dy
    obs[24] = near_dx
    obs[25] = near_dy
    return LocalPerception(
        vision_radius_m=120.0,
        hearing_radius_m=180.0,
        nearby_agent_ids=list(nearby_agent_ids or []),
        nearest_agent_id=nearest_agent_id,
        nearest_agent_dist=nearest_agent_dist,
        nearest_agent_trust=0.0,
        nearest_agent_familiarity=0.0,
        heard_emissions=[],
        nearby_artifacts=[],
        local_water=local_water,
        local_food=local_food,
        local_wood=0.0,
        local_stone=0.0,
        local_herb=0.0,
        local_predator_dist=local_predator_dist,
        local_herbivore_dist=999.0,
        obs_vector=obs,
        local_mate_id=local_mate_id,
        local_mate_dx=local_mate_dx,
        local_mate_dy=local_mate_dy,
        local_mate_dist=local_mate_dist,
        local_kin_need_id=local_kin_need_id,
        local_kin_need_dx=local_kin_need_dx,
        local_kin_need_dy=local_kin_need_dy,
        local_hazard_dx=local_hazard_dx,
        local_hazard_dy=local_hazard_dy,
        local_hazard_dist=local_hazard_dist,
    )


class TestRecoveryDrivesLearningAndCiv(unittest.TestCase):
    def test_fresh_100_agents_and_zero_experiment1_leakage(self) -> None:
        cfg = SimulationConfig(seed=101, initial_population=100)
        engine = SimulationEngine.create_new(cfg)

        living = engine.agents.living_agents()
        self.assertEqual(len(living), 100)
        self.assertEqual(len(engine.agents.all_agents), 100)
        self.assertEqual(sorted(living.keys()), list(range(1, 101)))
        self.assertEqual(engine.current_cycle_number, 1)
        self.assertEqual(engine.recovery_cycle_count, 0)

        # Unique brain weights, empty memories, empty lexicons, zero social ties
        fps = {ag.brain.weight_fingerprint() for ag in living.values() if ag.brain is not None}
        self.assertEqual(len(fps), 100)
        for ag in living.values():
            self.assertEqual(len(ag.memory.episodic), 0)
            self.assertEqual(len(ag.memory.spatial_map), 0)
            self.assertEqual(len(ag.memory.action_outcomes), 0)
            self.assertEqual(len(ag.lexicon), 0)
            self.assertEqual(len(ag.memory.familiarity), 0)
            self.assertEqual(len(ag.memory.trust), 0)
            self.assertEqual(ag.rebirth_count, 0)
            self.assertIsNone(ag.original_death_tick)

    def test_survival_drive_hunger_thirst_hazard_memory_and_care(self) -> None:
        cfg = SimulationConfig(seed=202, initial_population=10)
        engine = SimulationEngine.create_new(cfg)
        ag = engine.agents.living_agents()[1]

        # Hungry agent locally perceives food -> bias favours forage_food
        ag.hunger = 0.85
        ag.thirst = 0.1
        ag.inventory["food"] = 0.0
        perc_food = _make_perc(local_food=3.5, food_dx=1.0, food_dy=0.0)
        bias_food = engine.agents.compute_action_bias(ag, perc_food)
        self.assertGreater(bias_food[ACTION_NAMES.index("forage_food")], 0.5)

        # Thirsty agent near water favours drink_water
        ag.thirst = 0.88
        ag.hunger = 0.15
        perc_water = _make_perc(local_water=2.0, water_dx=0.0, water_dy=1.0)
        bias_water = engine.agents.compute_action_bias(ag, perc_water)
        self.assertGreater(bias_water[ACTION_NAMES.index("drink_water")], 0.5)

        # Predator hazard proximity boosts directional flee move away from hazard (+dx,+dy -> move_west/move_north)
        ag.hunger = 0.2
        ag.thirst = 0.2
        perc_pred = _make_perc(
            local_predator_dist=18.0,
            local_hazard_dx=0.6,
            local_hazard_dy=0.8,
            local_hazard_dist=18.0,
        )
        bias_pred = engine.agents.compute_action_bias(ag, perc_pred)
        self.assertGreater(bias_pred[ACTION_NAMES.index("move_west")], 0.3)
        self.assertGreater(bias_pred[ACTION_NAMES.index("move_north")], 0.3)

        # Mother/father care impulse for needy child (<14y)
        parent = engine.agents.living_agents()[2]
        child = engine.agents.living_agents()[3]
        child.age_ticks = 360 * 6  # 6 years old child
        child.hunger = 0.72
        parent.hunger = 0.15
        parent.children_ids.append(child.agent_id)
        parent.inventory["food"] = 3.0
        child.x, child.y = parent.x + 8.0, parent.y
        perc_care = _make_perc(
            nearby_agent_ids=[child.agent_id],
            nearest_agent_id=child.agent_id,
            nearest_agent_dist=8.0,
            local_kin_need_id=child.agent_id,
            local_kin_need_dx=1.0,
            local_kin_need_dy=0.0,
        )
        bias_care = engine.agents.compute_action_bias(parent, perc_care)
        self.assertGreater(bias_care[ACTION_NAMES.index("share_or_barter")], 0.5)

        # Executing share_or_barter transfers real food from parent inventory to child & feeds child
        food_before = parent.inventory["food"]
        child_food_before = child.inventory.get("food", 0.0)
        engine.agents.execute_action(
            agent=parent,
            action_idx=ACTION_NAMES.index("share_or_barter"),
            signal_idx=0,
            perc=perc_care,
            tick=10,
            sim_date="Y0001-M01-D11",
            world=engine.world,
            comm=engine.comm,
            society=engine.society,
            history=engine.history,
            rng=engine.rng,
        )
        self.assertLess(parent.inventory["food"], food_before)
        self.assertGreater(child.inventory.get("food", 0.0), child_food_before)

    def test_reproductive_drive_mutual_conception_and_gestation_cost(self) -> None:
        cfg = SimulationConfig(seed=303, initial_population=6)
        engine = SimulationEngine.create_new(cfg)
        living = list(engine.agents.living_agents().values())
        mother = next(a for a in living if a.sex == "F")
        father = next(a for a in living if a.sex == "M")
        mother.age_ticks = 360 * 24
        father.age_ticks = 360 * 25
        mother.hunger = 0.1
        mother.thirst = 0.1
        mother.health = 0.98
        mother.energy = 0.95
        father.hunger = 0.1
        father.thirst = 0.1
        father.health = 0.98
        father.energy = 0.95
        father.x = mother.x + 6.0
        father.y = mother.y + 4.0

        # Maternal gestation imposes metabolic demand when step_demographics runs
        mother.is_pregnant = True
        mother.gestation_ticks = 10
        h_before = mother.hunger
        e_before = mother.energy
        engine.evolution.step_demographics(
            tick=5,
            sim_date="Y0001-M01-D06",
            config=cfg,
            agents=engine.agents,
            world=engine.world,
            comm=engine.comm,
            society=engine.society,
            history=engine.history,
            rng=engine.rng,
        )
        self.assertGreater(mother.hunger, h_before)
        self.assertLess(mother.energy, e_before)

        # Mutual adult attraction increases socialize_mate_or_mediate bias when partner is locally visible
        mother.is_pregnant = False
        mother.gestation_ticks = 0
        perc = _make_perc(
            nearby_agent_ids=[father.agent_id],
            nearest_agent_id=father.agent_id,
            nearest_agent_dist=7.2,
            local_mate_id=father.agent_id,
            local_mate_dx=6.0,
            local_mate_dy=4.0,
            local_mate_dist=7.2,
        )
        bias = engine.agents.compute_action_bias(mother, perc)
        self.assertGreater(bias[ACTION_NAMES.index("socialize_mate_or_mediate")], 0.5)

    def test_automatic_population_recovery_atomic_pre_archive_and_world_continuity(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            ckpt_dir = Path(tmp) / "run_auto"
            cfg = SimulationConfig(seed=404, initial_population=6, auto_recover_on_extinction=True)
            engine = SimulationEngine.create_new(cfg)
            engine._active_checkpoint_dir = ckpt_dir

            # 1) Must NEVER trigger recovery while even 1 individual is still alive
            all_agents = list(engine.agents.living_agents().values())
            for a in all_agents[1:]:
                a.is_alive = False
                a.death_tick = 1
                a.cause_of_death = "starvation"
            engine.clock.tick = 1
            engine.step_tick()
            # Ensure last survivor still not triggers recovery if alive
            if len(engine.agents.living_agents()) >= 1:
                self.assertEqual(engine.recovery_cycle_count, 0)

            # Mutate world state deliberately to verify ZERO world resets occur on recovery
            engine.world.weather.drought_streak_days = 17
            engine.world.weather.condition = "drought"
            sample_cell = 123
            engine.world.food_flora[sample_cell] = 2.25
            engine.world.water[sample_cell] = 0.05
            engine.history.create_artifact_and_chronicle(
                tick=2,
                sim_date="Y0001-M01-D03",
                author_id=1,
                x=400.0,
                y=500.0,
                medium="stone_carving",
                symbol_tokens=[3],
                topic="food_here",
                observed_agent_ids=[1],
                author_skill=0.5,
                author_bias=0.0,
                rng=engine.rng,
            )

            # Kill all remaining living agents -> step_tick triggers atomic extinction + recovery
            for a in list(engine.agents.living_agents().values()):
                a.is_alive = False
                a.death_tick = engine.clock.tick
                a.cause_of_death = "dehydration"

            max_dead_id = max(engine.agents.all_agents.keys())
            engine.step_tick()

            # Verify recovery cycle state
            self.assertEqual(engine.recovery_cycle_count, 1)
            self.assertEqual(engine.current_cycle_number, 2)
            living_after = engine.agents.living_agents()
            self.assertEqual(len(living_after), 4)
            sexes = sorted(a.sex for a in living_after.values())
            self.assertEqual(sexes, ["F", "F", "M", "M"])

            # Verify brand-new IDs > all prior dead IDs, fresh weights, empty memories/lexicon
            for ag in living_after.values():
                self.assertGreater(ag.agent_id, max_dead_id)
                self.assertEqual(len(ag.memory.episodic), 0)
                self.assertEqual(len(ag.memory.spatial_map), 0)
                self.assertEqual(len(ag.lexicon), 0)
                self.assertAlmostEqual(ag.inventory.get("food", 0.0), 2.0, places=3)
                cell = engine.world.cell_index_at(ag.x, ag.y)
                self.assertLess(engine.world.water[cell], 0.4)

            # Verify world state was NOT reset by recovery (compare pre-recovery archive vs live recovered world)
            arch_dir_chk = ckpt_dir / engine.population_recovery_history[0]["pre_recovery_archive"]
            arch_obs_chk = json.loads((arch_dir_chk / "observatory_export.json").read_text(encoding="utf-8"))
            self.assertEqual(engine.world.weather.condition, arch_obs_chk["ecosystem"]["weather_condition"])
            self.assertEqual(
                engine.world.weather.drought_streak_days,
                arch_obs_chk["ecosystem"]["drought_streak_days"],
            )
            self.assertAlmostEqual(
                round(engine.world.food_flora[sample_cell], 1),
                arch_obs_chk["world_terrain"]["food_flora"][sample_cell],
                places=1,
            )
            self.assertEqual(len(engine.history.artifacts), 1)

            # Verify truth events recorded (`population_extinct` and `population_recovery`)
            truth_types = [e.event_type for e in engine.history.truth_events]
            self.assertIn("population_extinct", truth_types)
            self.assertIn("population_recovery", truth_types)

            # Verify pre-recovery extinction archive was written with living == 0 BEFORE founder spawn
            self.assertEqual(arch_obs_chk["demographics"]["living_count"], 0)
            self.assertGreaterEqual(arch_obs_chk["demographics"]["deceased_count"], 6)

            # Verify atomic idempotency across save/resume at same tick: MUST stay 4, NOT double to 8!
            engine.save_checkpoint(ckpt_dir)
            resumed = SimulationEngine.resume_from_checkpoint(ckpt_dir)
            self.assertEqual(len(resumed.agents.living_agents()), 4)
            self.assertEqual(resumed.recovery_cycle_count, 1)
            # Re-invoking extinction handler at same tick is a no-op
            self.assertFalse(resumed._handle_extinction_if_needed(resumed.clock.tick, resumed.clock.sim_date_str()))
            self.assertEqual(len(resumed.agents.living_agents()), 4)

            # Kill all 4 founders in Cycle 2 -> Cycle 2 outcome becomes `re_extinct`, Cycle 3 launches cleanly
            for a in list(resumed.agents.living_agents().values()):
                a.is_alive = False
                a.death_tick = resumed.clock.tick
                a.cause_of_death = "predator"
            resumed._active_checkpoint_dir = ckpt_dir
            resumed.step_tick()

            self.assertEqual(resumed.recovery_cycle_count, 2)
            self.assertEqual(resumed.current_cycle_number, 3)
            self.assertEqual(len(resumed.agents.living_agents()), 4)
            self.assertEqual(len(resumed.population_recovery_history), 2)
            self.assertEqual(resumed.population_recovery_history[0]["outcome"], "re_extinct")
            self.assertEqual(resumed.population_recovery_history[1]["outcome"], "active")

            # Export contains recovery_state and learning_telemetry
            export = PersistenceEngine.build_observatory_export(
                world_id=resumed.world_id,
                clock=resumed.clock,
                world=resumed.world,
                agents=resumed.agents,
                comm=resumed.comm,
                society=resumed.society,
                history=resumed.history,
                backend_name=resumed.backend_name,
                config=resumed.config,
                timeline_series=resumed.timeline_series,
                recovery_state=resumed._recovery_state_dict(),
            )
            self.assertEqual(export["recovery_state"]["recovery_cycle_count"], 2)
            self.assertEqual(len(export["recovery_state"]["population_recovery_history"]), 2)
            self.assertIn("learning_telemetry", export)

    def test_brain_gae_entropy_gru_bptt_and_telemetry(self) -> None:
        brain = AgentBrain(agent_id=1, obs_dim=36, hidden_dim=16, num_actions=18, num_signals=24)
        fp_before = brain.weight_fingerprint()
        rng = random.Random(77)

        for t in range(16):
            obs = [rng.uniform(0.0, 1.0) for _ in range(36)]
            act, sig, lp, val, h_prev = brain.step_decision(obs=obs, rng=rng)
            brain.record_experience(
                obs=obs,
                hidden_before=h_prev,
                action_idx=act,
                signal_idx=sig,
                log_prob_action=lp,
                reward=1.2 if t % 2 == 0 else -0.4,
                value_est=val,
                max_buffer=64,
                tick=t,
            )

        loss = brain.learn_from_experience(batch_size=8, gae_lambda=0.90, entropy_coef=0.018)
        self.assertGreater(brain.total_updates, 0)
        self.assertNotEqual(brain.weight_fingerprint(), fp_before)
        # Sliding buffer retains un-trained history rather than wiping down to 4 items
        self.assertGreaterEqual(len(brain.experience), 8)
        self.assertTrue(brain.policy_entropy > 0.0)
        self.assertGreater(loss, 0.0)

        # Telemetry survives round-trip serialization
        d = brain.export_state()
        restored = AgentBrain.from_exported_state(d)
        self.assertEqual(restored.weight_fingerprint(), brain.weight_fingerprint())
        self.assertAlmostEqual(restored.policy_entropy, brain.policy_entropy, places=4)
        self.assertAlmostEqual(restored.mean_td_error, brain.mean_td_error, places=4)

    def test_deception_cultivation_experience_norms_and_real_mediation(self) -> None:
        cfg = SimulationConfig(seed=505, initial_population=8)
        engine = SimulationEngine.create_new(cfg)
        living = list(engine.agents.living_agents().values())

        # 1. Cultivation tends moist fertile cell and advances cultivation skill
        farmer = living[0]
        farmer.inventory["wood"] = 0.0
        farmer.inventory["stone"] = 0.0
        farmer_cell = engine.world.cell_index_at(farmer.x, farmer.y)
        engine.world.water[farmer_cell] = 0.0
        engine.world.moisture[farmer_cell] = 0.6
        engine.world.fertility[farmer_cell] = 0.7
        engine.world.food_flora[farmer_cell] = 1.0
        cult_before = farmer.memory.skills["cultivation"]
        engine.agents.execute_action(
            agent=farmer,
            action_idx=ACTION_NAMES.index("craft_or_build"),
            signal_idx=0,
            perc=_make_perc(),
            tick=15,
            sim_date="Y0001-M01-D16",
            world=engine.world,
            comm=engine.comm,
            society=engine.society,
            history=engine.history,
            rng=engine.rng,
        )
        delta = engine.world.tend_cultivation(farmer_cell, 0.4)
        self.assertGreater(delta, 0.0)
        self.assertGreater(farmer.memory.skills["cultivation"], cult_before)

        # 2. Deception crime path during opportunistic trade
        deceiver = living[1]
        victim = living[2]
        deceiver.traits.cooperation = 0.05
        deceiver.traits.empathy = 0.05
        deceiver.inventory["food"] = 1.5
        victim.inventory["food"] = 2.5
        deceiver.x = victim.x + 5.0
        deceiver.y = victim.y
        perc_trade = _make_perc(
            nearby_agent_ids=[victim.agent_id],
            nearest_agent_id=victim.agent_id,
            nearest_agent_dist=5.0,
        )
        for t in range(30):
            deceiver.inventory["food"] = max(deceiver.inventory["food"], 1.5)
            victim.inventory["food"] = max(victim.inventory["food"], 2.5)
            engine.agents.execute_action(
                agent=deceiver,
                action_idx=ACTION_NAMES.index("share_or_barter"),
                signal_idx=1,
                perc=perc_trade,
                tick=20 + t,
                sim_date="Y0001-M01-D21",
                world=engine.world,
                comm=engine.comm,
                society=engine.society,
                history=engine.history,
                rng=engine.rng,
            )
            if engine.society.crimes_by_type.get("deception", 0) > 0:
                break
        self.assertGreater(engine.society.crimes_by_type.get("deception", 0), 0)

        # 3. Experience-gated norm adoption + real mediation restitution
        grp_members = [a.agent_id for a in living[:5]]
        engine.society.maybe_form_or_evolve_group(
            tick=60,
            proposer_id=grp_members[0],
            proposer_x=farmer.x,
            proposer_y=farmer.y,
            proposer_mediation_skill=0.6,
            allied_nearby_ids=grp_members[1:],
            rng=engine.rng,
        )
        grp = engine.society.get_agent_group(grp_members[0])
        self.assertIsNotNone(grp)
        assert grp is not None

        thief = engine.agents.living_agents()[grp_members[1]]
        wronged = engine.agents.living_agents()[grp_members[2]]
        thief.inventory["food"] = 3.0
        wronged.inventory["food"] = 0.0
        rec, _ = engine.society.record_crime(
            tick=70,
            sim_date="Y0001-M03-D11",
            crime_type="theft",
            perpetrator_id=thief.agent_id,
            victim_id=wronged.agent_id,
            x=wronged.x,
            y=wronged.y,
            witness_ids=[grp_members[0]],
        )
        resolved = engine.society.resolve_dispute_in_group(
            tick=75,
            mediator_id=grp_members[0],
            x=farmer.x,
            y=farmer.y,
            living_agents=engine.agents.living_agents(),
        )
        self.assertIsNotNone(resolved)
        self.assertTrue(rec.resolved)
        self.assertLess(thief.inventory["food"], 3.0)
        self.assertGreater(wronged.inventory["food"], 0.0)


if __name__ == "__main__":
    unittest.main()
