"""Tests for atomic checkpoint save/restore, mid-run resume equivalence, and strict corruption failure."""

import json
import tempfile
import unittest
from pathlib import Path

from sim.config import SimulationConfig
from sim.orchestrator import SimulationEngine
from sim.persistence import CheckpointIntegrityError


class TestPersistenceAndResume(unittest.TestCase):
    def test_14_15_16_17_checkpoint_save_restore_and_mid_run_equivalence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            ckpt_dir = Path(tmp) / "ckpt_a"
            cfg = SimulationConfig(seed=404, initial_population=40)
            engine = SimulationEngine.create_new(cfg)

            # Run 30 ticks, kill one living agent permanently to test deceased preservation across resume
            for _ in range(30):
                engine.step_tick()
            victim = next(iter(engine.agents.living_agents().values()))
            victim_id = victim.agent_id
            engine.agents.kill_agent(victim, tick=engine.clock.tick, sim_date=engine.clock.sim_date_str(), cause="test_injury", history=engine.history)

            manifest = engine.save_checkpoint(ckpt_dir)
            self.assertEqual(manifest["sim_tick"], 30)
            self.assertEqual(manifest["world_id"], engine.world_id)
            self.assertTrue((ckpt_dir / "world_state.db").exists())
            self.assertTrue((ckpt_dir / "brains_state.bin.gz").exists())
            self.assertTrue((ckpt_dir / "events_truth.jsonl.gz").exists())
            self.assertTrue((ckpt_dir / "rng_state.json.gz").exists())
            self.assertTrue((ckpt_dir / "observatory_export.json").exists())
            self.assertTrue((ckpt_dir / "manifest.json").exists())

            # Snapshot fingerprints and positions at tick 30
            living_fps_before = {
                aid: ag.brain.weight_fingerprint()
                for aid, ag in engine.agents.living_agents().items()
            }
            next_id_before = engine.agents.next_agent_id
            total_ever_before = len(engine.agents.all_agents)

            # Resume into a brand-new engine instance
            resumed = SimulationEngine.resume_from_checkpoint(ckpt_dir, require_torch=False)
            self.assertEqual(resumed.world_id, engine.world_id)
            self.assertEqual(resumed.clock.tick, 30)
            self.assertEqual(resumed.agents.next_agent_id, next_id_before)
            self.assertEqual(len(resumed.agents.all_agents), total_ever_before)
            self.assertFalse(resumed.agents.all_agents[victim_id].is_alive)
            self.assertEqual(resumed.agents.all_agents[victim_id].cause_of_death, "test_injury")

            living_fps_resumed = {
                aid: ag.brain.weight_fingerprint()
                for aid, ag in resumed.agents.living_agents().items()
            }
            self.assertEqual(living_fps_before, living_fps_resumed)

            # Advance BOTH original and resumed engines 15 more ticks and verify deterministic equivalence
            for _ in range(15):
                engine.step_tick()
                resumed.step_tick()

            self.assertEqual(resumed.clock.tick, 45)
            self.assertEqual(len(resumed.agents.living_agents()), len(engine.agents.living_agents()))
            self.assertFalse(resumed.agents.all_agents[victim_id].is_alive)
            self.assertEqual(resumed.agents.next_agent_id, engine.agents.next_agent_id)
            self.assertEqual(
                {aid: round(ag.x, 3) for aid, ag in engine.agents.living_agents().items()},
                {aid: round(ag.x, 3) for aid, ag in resumed.agents.living_agents().items()},
            )

    def test_corrupt_or_missing_checkpoint_refuses_silently_starting_new_world(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing_dir = Path(tmp) / "does_not_exist"
            with self.assertRaises(CheckpointIntegrityError):
                SimulationEngine.resume_from_checkpoint(missing_dir)

            # Tamper with checksum
            ckpt_dir = Path(tmp) / "tampered"
            cfg = SimulationConfig(seed=405, initial_population=10)
            engine = SimulationEngine.create_new(cfg)
            engine.step_tick()
            engine.save_checkpoint(ckpt_dir)

            manifest_file = ckpt_dir / "manifest.json"
            data = json.loads(manifest_file.read_text(encoding="utf-8"))
            data["checksums"]["world_state.db"] = "0" * 64
            manifest_file.write_text(json.dumps(data), encoding="utf-8")

            with self.assertRaises(CheckpointIntegrityError):
                SimulationEngine.resume_from_checkpoint(ckpt_dir)


if __name__ == "__main__":
    unittest.main()
