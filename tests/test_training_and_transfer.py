"""Comprehensive automated test suite & benchmark measurements for Isolated Survival Training,
One-File Population Bundle Transfer, Civilization Promotion, and 6-Stage Analytics."""

from __future__ import annotations

import json
import os
import random
import tempfile
import time
import unittest
import zipfile
from pathlib import Path

from sim.agent import ACTION_NAMES, AgentEngine
from sim.bundle import (
    BundleIntegrityError,
    export_population_bundle,
    promote_bundle_to_civilization,
    verify_population_bundle,
)
from sim.training import IsolatedSurvivalTrainer, TrainingConfig


def _read_rss_mb() -> float:
    try:
        for line in Path("/proc/self/status").read_text(encoding="utf-8").splitlines():
            if line.startswith("VmRSS:"):
                kb = int(line.split()[1])
                return round(kb / 1024.0, 2)
    except Exception:
        pass
    return 0.0


class TestIsolatedTrainingAndTransfer(unittest.TestCase):
    def test_1_to_12_isolated_training_identity_template_stages_rebirth_and_checkpoint(self) -> None:
        cfg = TrainingConfig(template_seed=42, agent_count=100, learn_interval_ticks=6, learn_batch_size=12)
        trainer = IsolatedSurvivalTrainer.create_new(cfg)

        # 1-2: 100 unique IDs, independent brains/memories/traits
        self.assertEqual(len(trainer.agents.all_agents), 100)
        self.assertEqual(len(trainer.env_slots), 100)
        ids = sorted(trainer.agents.all_agents.keys())
        self.assertEqual(ids, list(range(1, 101)))
        fps = {trainer.agents.all_agents[i].brain.weight_fingerprint() for i in ids}
        self.assertEqual(len(fps), 100, "Each of 100 individuals must have unique neural weights")

        # 3: Identical starting environment conditions across all 100 isolated slots
        slot1 = trainer.env_slots[1]
        slot50 = trainer.env_slots[50]
        slot100 = trainer.env_slots[100]
        self.assertEqual(slot1.world.food_flora[:50], slot50.world.food_flora[:50])
        self.assertEqual(slot1.world.water[:50], slot100.world.water[:50])
        self.assertEqual(slot1.world.weather.condition, slot100.world.weather.condition)
        self.assertAlmostEqual(slot1.world.weather.temperature_c, slot100.world.weather.temperature_c, places=3)
        self.assertEqual(
            (trainer.agents.all_agents[1].x, trainer.agents.all_agents[1].y),
            (trainer.agents.all_agents[100].x, trainer.agents.all_agents[100].y),
        )

        # 4: Zero cross-agent visibility (mutating agent 1 slot cannot affect agent 2 slot)
        a1 = trainer.agents.all_agents[1]
        cidx1 = slot1.world.cell_index_at(a1.x, a1.y)
        orig_food_slot2 = slot50.world.food_flora[cidx1]
        slot1.world.food_flora[cidx1] = 0.0
        self.assertEqual(slot50.world.food_flora[cidx1], orig_food_slot2)
        slot1.reset_to_template(trainer.template_world)

        # Verify zero visible agents even when all start on identical spawn coordinates
        from sim.perception import PerceptionEngine

        perc_isolated = PerceptionEngine.perceive(
            agent=a1,
            world=slot1.world,
            living_agents={1: a1},
            spatial_buckets={(int(a1.x // 150.0), int(a1.y // 150.0)): [1]},
            recent_emissions=[],
            artifacts=[],
            is_night=False,
            base_vision=cfg.base_vision_radius_m,
            base_hearing=cfg.base_hearing_radius_m,
            tick=0,
        )
        self.assertEqual(perc_isolated.nearby_agent_ids, [])

        # 5-8: Training death -> auto-rebirth preserves EXACT same ID, weights, memory, skills, traits
        # Inject realistic starvation / dehydration pre-death experience + memory before triggering death
        a1.memory.record_episode(tick=5, event_kind="resource_found", x=a1.x + 10, y=a1.y, other_agent_id=None, valence=0.5, detail="berry bush")
        a1.memory.remember_location(tick=5, cell_idx=cidx1, x=a1.x, y=a1.y, kind="food", richness=3.0)
        a1.memory.skills["foraging"] = 0.42
        traits_before = (a1.traits.boldness, a1.traits.empathy, a1.traits.curiosity, a1.traits.aggression, a1.traits.cooperation)
        fp_before_dp = a1.brain.weight_fingerprint()

        # Feed real negative experiences simulating hunger -> starvation
        for t in range(1, 13):
            obs = [0.1] * 36
            obs[0] = 0.25  # hunger cue high
            a1.hunger = 0.92
            a1.brain.record_experience(
                obs=obs,
                hidden_before=[0.0] * a1.brain.hidden_dim,
                action_idx=0,
                signal_idx=0,
                log_prob_action=-2.0,
                reward=-1.2,
                value_est=0.1,
                tick=t,
                context_tag="hungry",
            )
        dp_starve = a1.brain.apply_death_penalty_learning(
            cause="starvation",
            death_tick=13,
            perceived_cues={"hunger": 0.92, "thirst": 0.10},
        )
        self.assertTrue(dp_starve["applied"])
        self.assertEqual(dp_starve["evidence_basis"], "hunger_deficit_preceding_experience")
        self.assertNotEqual(fp_before_dp, dp_starve["weight_fingerprint_after"], "Starvation death penalty must update neural weights")

        fp_after_dp = a1.brain.weight_fingerprint()
        trainer._revive_in_isolated_training(a1, slot1, trainer.records[1], "starvation")
        self.assertTrue(a1.is_alive)
        self.assertEqual(a1.agent_id, 1)
        self.assertEqual(a1.rebirth_count, 1)
        self.assertEqual(a1.brain.weight_fingerprint(), fp_after_dp, "Weights must NOT be wiped on rebirth")
        self.assertEqual(a1.memory.skills["foraging"], 0.42, "Skills must NOT be wiped on rebirth")
        self.assertGreaterEqual(len(a1.memory.episodic), 1, "Episodic memories must persist across rebirth")
        self.assertGreaterEqual(len(a1.memory.spatial_map), 1, "Spatial map must persist across rebirth")
        self.assertEqual(
            (a1.traits.boldness, a1.traits.empathy, a1.traits.curiosity, a1.traits.aggression, a1.traits.cooperation),
            traits_before,
            "Personality traits must remain intact after rebirth",
        )
        self.assertEqual(slot1.local_tick, 0, "Only that agent's isolated slot resets on rebirth")

        # 9: Disease death does NOT grant medical omniscience
        a2 = trainer.agents.all_agents[2]
        dp_dis = a2.brain.apply_death_penalty_learning(
            cause="disease",
            death_tick=20,
            perceived_cues={"disease": 0.85},
        )
        self.assertEqual(dp_dis["evidence_basis"], "bodily_distress_without_causal_knowledge")
        self.assertEqual(a2.memory.skills.get("healing", 0.0), 0.0)

        # 10-12: Multi-tick run + 4-stage tracking + 6-stage analytics + atomic checkpoint save/resume
        for _ in range(18):
            trainer.step_tick()

        self.assertEqual(trainer.training_step_errors, 0)
        ta = trainer.build_training_analytics_payload()
        self.assertEqual(ta["agent_count"], 100)
        self.assertEqual(ta["training_tick"], 18)
        self.assertTrue(ta["isolation_enforced"])
        self.assertTrue(ta["training_rebirth_active"])

        rep = trainer.analytics.build_report(
            clock=trainer.clock,
            world=trainer.template_world,
            agents=trainer.agents,
            comm=trainer.env_slots[1].comm,
            society=trainer.env_slots[1].society,
            history=trainer.env_slots[1].history,
        )
        expected_funnel_keys = {
            "absent",
            "present_undiscovered",
            "discovered_no_decision",
            "decision_move_failed",
            "reached_consume_failed",
            "consumed_success",
        }
        self.assertEqual(set(rep["food_water"]["food_funnel"].keys()), expected_funnel_keys)
        self.assertEqual(set(rep["food_water"]["water_funnel"].keys()), expected_funnel_keys)
        self.assertEqual(
            rep["learning_intelligence"]["total_experiences_stored"],
            1800,
            "100 agents * 18 ticks must record 1800 genuine step samples",
        )

        # Checkpoint save + resume roundtrip
        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp) / "train_ckpt"
            trainer.save_checkpoint(ckpt)
            resumed = IsolatedSurvivalTrainer.resume_from_checkpoint(ckpt)
            self.assertEqual(resumed.clock.tick, trainer.clock.tick)
            self.assertEqual(len(resumed.agents.all_agents), 100)
            self.assertEqual(
                resumed.agents.all_agents[1].brain.weight_fingerprint(),
                trainer.agents.all_agents[1].brain.weight_fingerprint(),
            )
            obs_export = json.loads((ckpt / "observatory_export.json").read_text(encoding="utf-8"))
            self.assertEqual(obs_export["simulation_phase"], "training")
            self.assertIsNotNone(obs_export["training_analytics"])
            self.assertEqual(len(obs_export["training_analytics"]["agents"]), 100)

    def test_13_to_25_bundle_transfer_integrity_civilization_promotion_and_benchmarks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            train_ckpt = tmp_dir / "train_ckpt"
            bundle_path = tmp_dir / "trained_population.bundle"
            civ_ckpt = tmp_dir / "civ_ckpt"

            # Create and step 100-agent training briefly
            trainer = IsolatedSurvivalTrainer.create_new(TrainingConfig(template_seed=77, agent_count=100))
            mem_train_mb = _read_rss_mb()

            t0 = time.perf_counter()
            for _ in range(15):
                trainer.step_tick()
            train_dt = max(1e-6, time.perf_counter() - t0)
            train_tps = round(15.0 / train_dt, 2)

            # Mutate agent 14 & 88 memory & skills so transfer fidelity is verifiable
            trainer.agents.all_agents[14].memory.record_episode(
                tick=10, event_kind="danger", x=250.0, y=350.0, other_agent_id=None, valence=-0.8, detail="steep cliff"
            )
            trainer.agents.all_agents[88].memory.skills["navigation"] = 0.55

            fp_before_export = {
                aid: trainer.agents.all_agents[aid].brain.weight_fingerprint()
                for aid in range(1, 101)
            }

            t_save0 = time.perf_counter()
            trainer.save_checkpoint(train_ckpt)
            train_save_ms = round((time.perf_counter() - t_save0) * 1000.0, 2)

            # Export ONE bundle excluding 100 training environments
            t_exp0 = time.perf_counter()
            export_manifest = export_population_bundle(train_ckpt, bundle_path)
            export_ms = round((time.perf_counter() - t_exp0) * 1000.0, 2)
            bundle_size_mb = round(bundle_path.stat().st_size / (1024 * 1024), 3)

            self.assertTrue(bundle_path.exists())
            self.assertTrue(export_manifest["excludes_training_environments"])
            with zipfile.ZipFile(bundle_path, "r") as zf:
                members = set(zf.namelist())
                self.assertEqual(
                    members,
                    {"bundle_manifest.json", "agents_population.json", "brains_state.bin.gz", "training_analytics.json"},
                )

            # Verify valid bundle passes
            ver = verify_population_bundle(bundle_path)
            self.assertTrue(ver["valid"])
            self.assertEqual(ver["agent_count"], 100)

            # Tamper detection + missing file detection + architecture mismatch rejection
            with self.assertRaises(BundleIntegrityError):
                verify_population_bundle(tmp_dir / "does_not_exist.bundle")

            tampered_bundle = tmp_dir / "tampered.bundle"
            with zipfile.ZipFile(bundle_path, "r") as zsrc, zipfile.ZipFile(tampered_bundle, "w") as zdst:
                for name in zsrc.namelist():
                    data = zsrc.read(name)
                    if name == "agents_population.json":
                        data = data[:-1] + b" "
                    zdst.writestr(name, data)
            with self.assertRaises(BundleIntegrityError):
                verify_population_bundle(tampered_bundle)

            with self.assertRaises(BundleIntegrityError):
                verify_population_bundle(bundle_path, expected_arch={"obs_dim": 99, "hidden_dim": 24, "num_actions": 18, "num_signals": 24})

            # Promote bundle to full 5km^2 Civilization world
            t_prom0 = time.perf_counter()
            civ_engine = promote_bundle_to_civilization(bundle_path=bundle_path, civilization_checkpoint_dir=civ_ckpt, world_seed=101)
            promote_ms = round((time.perf_counter() - t_prom0) * 1000.0, 2)

            self.assertEqual(civ_engine.simulation_phase, "civilization")
            self.assertFalse(civ_engine.config.training_rebirth_enabled)
            self.assertFalse(civ_engine.config.auto_recover_on_extinction)
            self.assertEqual(len(civ_engine.agents.all_agents), 100)
            self.assertEqual(civ_engine.world.width_m, 2500.0)
            self.assertEqual(civ_engine.world.height_m, 2000.0)

            # Exact weight fingerprint, memory, skills preservation
            for aid in range(1, 101):
                self.assertEqual(
                    civ_engine.agents.all_agents[aid].brain.weight_fingerprint(),
                    fp_before_export[aid],
                    f"Promoted agent {aid} brain fingerprint drifted!",
                )
            self.assertTrue(any(e.detail == "steep cliff" for e in civ_engine.agents.all_agents[14].memory.episodic))
            self.assertEqual(civ_engine.agents.all_agents[88].memory.skills["navigation"], 0.55)

            # Run 10 ticks of promoted Civilization and benchmark
            t_civ0 = time.perf_counter()
            for _ in range(10):
                civ_engine.step_tick()
            civ_dt = max(1e-6, time.perf_counter() - t_civ0)
            civ_tps = round(10.0 / civ_dt, 2)
            mem_civ_mb = _read_rss_mb()

            # Verify permanent death in Civilization (NO training rebirth & NO 60-founder extinction loop)
            for ag in list(civ_engine.agents.living_agents().values()):
                ag.is_alive = False
                ag.death_tick = civ_engine.clock.tick
                ag.cause_of_death = "starvation"
            civ_engine._active_checkpoint_dir = civ_ckpt
            civ_engine.step_tick()
            self.assertEqual(len(civ_engine.agents.living_agents()), 0, "Promoted Civilization must NEVER auto-revive or respawn 60 founders")
            self.assertEqual(civ_engine.recovery_cycle_count, 0)

            civ_engine.save_checkpoint(civ_ckpt)
            obs_civ = json.loads((civ_ckpt / "observatory_export.json").read_text(encoding="utf-8"))
            self.assertEqual(obs_civ["simulation_phase"], "civilization")
            self.assertIsNotNone(obs_civ["training_analytics"], "Civilization snapshot must retain transferred training_analytics")
            self.assertIn("analytics", obs_civ)
            self.assertIn("food_funnel", obs_civ["analytics"]["food_water"])
            self.assertIn("wealth_distribution", obs_civ["analytics"]["economy"])
            self.assertIn("gini_inventory", obs_civ["analytics"]["economy"]["wealth_distribution"])

            print(
                "\n[BENCHMARK_SUMMARY]",
                json.dumps({
                    "rss_training_mb": mem_train_mb,
                    "rss_civilization_mb": mem_civ_mb,
                    "train_ticks_per_sec": train_tps,
                    "civ_ticks_per_sec": civ_tps,
                    "bundle_size_mb": bundle_size_mb,
                    "train_save_ms": train_save_ms,
                    "bundle_export_ms": export_ms,
                    "bundle_promote_ms": promote_ms,
                }),
            )

    def test_26_to_34_ci_artifact_transfer_auto_discovery_and_failure_guards(self) -> None:
        from scripts.ci_artifact_transfer import (
            ArtifactResolutionError,
            ArtifactTransferError,
            package_training_artifact,
            resolve_source_artifact,
            verify_downloaded_artifact,
        )
        from sim.cli import main as cli_main

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            train_ckpt = tmp_dir / "train_ckpt"
            pkg_dir = tmp_dir / "training_package"
            verified_bundle = tmp_dir / "staged" / "trained_population.bundle"
            civ_ckpt = tmp_dir / "civ_ckpt"

            # 1. Run brief isolated training & preserve discovered_techs + lexicon + memory
            trainer = IsolatedSurvivalTrainer.create_new(TrainingConfig(template_seed=55, agent_count=100))
            trainer.agents.discovered_techs = {"basic_foraging": 4, "water_tracking": 7}
            trainer.agents.all_agents[1].memory.record_episode(
                tick=3, event_kind="shelter_found", x=100.0, y=150.0, other_agent_id=None, valence=0.7, detail="warm cave"
            )
            trainer.agents.all_agents[1].lexicon["food_word"] = {"symbol": 5, "meaning": "berry", "confidence": 0.9}
            trainer.run(checkpoint_dir=train_ckpt, max_ticks=6)

            fp_1 = trainer.agents.all_agents[1].brain.weight_fingerprint()

            # 2. Package completed training into ONE unified artifact
            meta = package_training_artifact(
                checkpoint_dir=train_ckpt,
                output_dir=pkg_dir,
                run_id="9002",
                run_number="12",
                workflow_mode="start_training",
                require_torch=False,
            )
            self.assertEqual(meta["github_run_id"], "9002")
            self.assertEqual(meta["artifact_kind"], "isolated_training_package")
            self.assertEqual(meta["completion_status"], "completed_success")
            self.assertTrue((pkg_dir / "transfer_metadata.json").exists())
            self.assertTrue((pkg_dir / "trained_population.bundle").exists())
            self.assertTrue((pkg_dir / "checkpoint" / "manifest.json").exists())

            # 3. Auto-discovery WITHOUT source_run_id skips current, failed, expired, and verify_only runs
            mock_api_data = {
                "/actions/workflows/simulation.yml/runs?status=completed&per_page=50": {
                    "workflow_runs": [
                        {"id": 9006, "status": "completed", "conclusion": "success", "created_at": "2026-11-15T06:00:00Z"},  # current_run_id
                        {"id": 9005, "status": "completed", "conclusion": "failure", "created_at": "2026-11-15T05:00:00Z"},  # failed
                        {"id": 9004, "status": "completed", "conclusion": "success", "created_at": "2026-11-15T04:00:00Z"},  # verify_only (only logs)
                        {"id": 9003, "status": "completed", "conclusion": "success", "created_at": "2026-11-15T03:00:00Z"},  # expired artifact
                        {"id": 9002, "status": "completed", "conclusion": "success", "created_at": "2026-11-15T02:00:00Z"},  # VALID training!
                        {"id": 9001, "status": "completed", "conclusion": "success", "created_at": "2026-11-15T01:00:00Z"},  # older civ
                    ]
                },
                "/actions/runs/9004/artifacts?per_page=100": {
                    "artifacts": [{"id": 4, "name": "sim-logs-9004", "expired": False}]
                },
                "/actions/runs/9003/artifacts?per_page=100": {
                    "artifacts": [{"id": 3, "name": "isolated-training-artifact-9003", "expired": True}]
                },
                "/actions/runs/9002/artifacts?per_page=100": {
                    "artifacts": [
                        {"id": 2, "name": "isolated-training-artifact-9002", "expired": False, "size_in_bytes": 102400},
                        {"id": 22, "name": "sim-logs-9002", "expired": False},
                    ]
                },
                "/actions/runs/9001/artifacts?per_page=100": {
                    "artifacts": [{"id": 1, "name": "sim-checkpoint-9001", "expired": False}]
                },
                "/actions/runs/9005": {"id": 9005, "status": "completed", "conclusion": "failure"},
                "/actions/runs/9003": {"id": 9003, "status": "completed", "conclusion": "success"},
                "/actions/runs/9003/artifacts?per_page=100": {
                    "artifacts": [{"id": 3, "name": "isolated-training-artifact-9003", "expired": True}]
                },
                "/actions/runs/9004": {"id": 9004, "status": "completed", "conclusion": "success"},
            }

            def fake_api_get(url: str) -> dict:
                for suffix, payload in mock_api_data.items():
                    if url.endswith(suffix):
                        return payload
                raise AssertionError(f"Unexpected mocked URL: {url}")

            resolved = resolve_source_artifact(
                mode="promote_to_civilization",
                repo="owner/civ-repo",
                workflow_file="simulation.yml",
                source_run_id="",
                current_run_id="9006",
                api_get=fake_api_get,
            )
            self.assertTrue(resolved["resolved_automatically"])
            self.assertEqual(resolved["run_id"], "9002")
            self.assertEqual(resolved["artifact_name"], "isolated-training-artifact-9002")
            self.assertEqual(resolved["artifact_kind"], "isolated_training_package")

            # Also resolves latest civilization checkpoint automatically for run_civilization
            resolved_civ = resolve_source_artifact(
                mode="run_civilization",
                repo="owner/civ-repo",
                workflow_file="simulation.yml",
                source_run_id="",
                current_run_id="9006",
                api_get=fake_api_get,
            )
            self.assertEqual(resolved_civ["run_id"], "9001")
            self.assertEqual(resolved_civ["artifact_name"], "sim-checkpoint-9001")

            # Explicit failure checks on resolve_source_artifact
            with self.assertRaises(ArtifactResolutionError):
                resolve_source_artifact(mode="promote_to_civilization", repo="owner/civ-repo", source_run_id="9005", api_get=fake_api_get)
            with self.assertRaises(ArtifactResolutionError):
                resolve_source_artifact(mode="promote_to_civilization", repo="owner/civ-repo", source_run_id="9003", api_get=fake_api_get)
            with self.assertRaises(ArtifactResolutionError):
                resolve_source_artifact(mode="promote_to_civilization", repo="owner/civ-repo", source_run_id="9004", api_get=fake_api_get)
            with self.assertRaises(ArtifactResolutionError):
                resolve_source_artifact(
                    mode="promote_to_civilization",
                    repo="owner/civ-repo",
                    source_run_id="",
                    api_get=lambda _u: {"workflow_runs": []},
                )

            # 4. Verify downloaded package + promote via CLI with --run-simulation
            ver_rep = verify_downloaded_artifact(
                download_dir=pkg_dir,
                expected_run_id="9002",
                artifact_kind="isolated_training_package",
                mode="promote_to_civilization",
                require_torch=False,
                verified_bundle_out=verified_bundle,
            )
            self.assertTrue(ver_rep["verified"])
            self.assertTrue(verified_bundle.exists())

            rc = cli_main([
                "promote-to-civilization",
                "--bundle-path", str(verified_bundle),
                "--checkpoint-dir", str(civ_ckpt),
                "--seed", "88",
                "--expected-run-id", "9002",
                "--run-simulation",
                "--max-ticks", "4",
            ])
            self.assertEqual(rc, 0)
            civ_manifest = json.loads((civ_ckpt / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(civ_manifest["sim_tick"], 4)
            self.assertEqual(cli_main(["inspect-world", "--checkpoint-dir", str(civ_ckpt)]), 0)

            # Confirm weights, memory, lexicon, discovered_techs survived Full World import & run
            from sim.persistence import PersistenceEngine
            _, _, _, _, civ_agents, _, _, _, _, _ = PersistenceEngine.load_checkpoint(civ_ckpt, require_torch=False)
            self.assertEqual(civ_agents.discovered_techs, {"basic_foraging": 4, "water_tracking": 7})
            self.assertTrue(any(e.detail == "warm cave" for e in civ_agents.all_agents[1].memory.episodic))
            self.assertEqual(civ_agents.all_agents[1].lexicon.get("food_word", {}).get("meaning"), "berry")
            self.assertEqual(civ_agents.all_agents[1].brain.weight_fingerprint(), fp_1)

            # 5. Failure guards + preserve existing Full World data on failed promotion
            existing_manifest_bytes = (civ_ckpt / "manifest.json").read_bytes()

            # 5a. Empty downloaded dir
            empty_dir = tmp_dir / "empty_dl"
            empty_dir.mkdir()
            with self.assertRaises(ArtifactTransferError):
                verify_downloaded_artifact(
                    download_dir=empty_dir,
                    expected_run_id="9002",
                    artifact_kind="isolated_training_package",
                    mode="promote_to_civilization",
                )

            # 5b. Run ID mismatch
            with self.assertRaises(ArtifactTransferError):
                verify_downloaded_artifact(
                    download_dir=pkg_dir,
                    expected_run_id="9999",
                    artifact_kind="isolated_training_package",
                    mode="promote_to_civilization",
                )

            # 5c. Incompatible version in transfer_metadata.json
            bad_ver_pkg = tmp_dir / "bad_ver_pkg"
            import shutil as _shutil
            _shutil.copytree(pkg_dir, bad_ver_pkg)
            bad_meta = json.loads((bad_ver_pkg / "transfer_metadata.json").read_text(encoding="utf-8"))
            bad_meta["metadata_version"] = "99.0.0"
            (bad_ver_pkg / "transfer_metadata.json").write_text(json.dumps(bad_meta), encoding="utf-8")
            with self.assertRaises(ArtifactTransferError):
                verify_downloaded_artifact(
                    download_dir=bad_ver_pkg,
                    expected_run_id="9002",
                    artifact_kind="isolated_training_package",
                    mode="promote_to_civilization",
                )

            # 5d. Corrupted bundle inside package fails verify & failed promotion does NOT overwrite civ_ckpt!
            tampered_pkg = tmp_dir / "tampered_pkg"
            _shutil.copytree(pkg_dir, tampered_pkg)
            (tampered_pkg / "trained_population.bundle").write_bytes(b"corrupted-archive")
            with self.assertRaises(ArtifactTransferError):
                verify_downloaded_artifact(
                    download_dir=tampered_pkg,
                    expected_run_id="9002",
                    artifact_kind="isolated_training_package",
                    mode="promote_to_civilization",
                )

            with self.assertRaises(BundleIntegrityError):
                promote_bundle_to_civilization(
                    bundle_path=tampered_pkg / "trained_population.bundle",
                    civilization_checkpoint_dir=civ_ckpt,
                    expected_run_id="9002",
                )
            self.assertEqual((civ_ckpt / "manifest.json").read_bytes(), existing_manifest_bytes)

            # 5e. Incomplete/failed training checkpoint cannot be packaged
            failed_ckpt = tmp_dir / "failed_train_ckpt"
            _shutil.copytree(train_ckpt, failed_ckpt)
            fman = json.loads((failed_ckpt / "manifest.json").read_text(encoding="utf-8"))
            fman["completion_status"] = "failed_incomplete"
            (failed_ckpt / "manifest.json").write_text(json.dumps(fman), encoding="utf-8")
            with self.assertRaises(ArtifactTransferError):
                package_training_artifact(
                    checkpoint_dir=failed_ckpt,
                    output_dir=tmp_dir / "should_not_exist",
                    run_id="9010",
                )
            with self.assertRaises(BundleIntegrityError):
                export_population_bundle(failed_ckpt, tmp_dir / "bad.bundle")


if __name__ == "__main__":
    unittest.main()
