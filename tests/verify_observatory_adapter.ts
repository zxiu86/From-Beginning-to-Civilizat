import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computePopulationDiff,
  formatDurationSeconds,
  SnapshotValidationError,
  validateAndNormalizeSnapshot,
} from '../lib/observatory/adapter';

const fixturePath = path.join(process.cwd(), 'public', 'fixtures', 'test_world_snapshot.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

// 1. Validate real v2.0.0 snapshot
const snap = validateAndNormalizeSnapshot(rawFixture);
assert.equal(snap.export_schema_version, '2.0.0');
assert.ok(snap.world_terrain !== null, 'Expected 100x80 terrain grid');
assert.equal(
  snap.world_terrain.elevation.length,
  snap.world_terrain.cols * snap.world_terrain.rows,
);
assert.equal(snap.engine_capabilities.has_buildings_grid, false);
assert.ok(snap.living_agents_full.length > 0, 'Expected living agents');

// 2. Verify FPV non-telepathic sanitization strips any injected context_tag
const polluted = structuredClone(rawFixture);
polluted.living_agents_full[0].local_perception.heard_emissions = [
  {
    speaker_id: 2,
    token: 7,
    gesture: 1,
    x: 1200,
    y: 900,
    tick: 259,
    distance_m: 15,
    context_tag: 'danger_predator',
  },
];
const clean = validateAndNormalizeSnapshot(polluted);
const em = clean.living_agents_full[0].local_perception.heard_emissions[0] as unknown as Record<
  string,
  unknown
>;
assert.equal(em.context_tag, undefined, 'context_tag MUST be stripped from FPV heard_emissions');

// 3. Verify v1.0.0 backward compatibility fallback
const v1Minimal = {
  export_schema_version: '1.0.0',
  world_id: 'world_v1_test',
  clock: {tick: 10, year: 1, month: 1, day: 10, season: 'spring', is_night: false, sim_date: 'Y0001-M01-D10', real_elapsed_seconds: 12},
  demographics: {living_count: 1, deceased_count: 1, total_ever_born: 2},
  history_layers: {milestones: {}},
  living_agents_summary: [{agent_id: 1, sex: 'F', x: 100, y: 100, age_years: 20, generation: 0, health: 0.9, hunger: 0.1, thirst: 0.1, last_action: 'forage', lexicon_size: 0}],
  genealogy_nodes: [
    {agent_id: 1, birth_tick: 0, death_tick: null, is_alive: true, cause_of_death: null, parent_a_id: null, parent_b_id: null, children_ids: []},
    {agent_id: 2, birth_tick: 0, death_tick: 8, is_alive: false, cause_of_death: 'dehydration', parent_a_id: null, parent_b_id: null, children_ids: []},
  ],
};
const normalizedV1 = validateAndNormalizeSnapshot(v1Minimal);
assert.equal(normalizedV1.living_agents_full.length, 1);
assert.equal(normalizedV1.deceased_agents_archive.length, 1);
assert.equal(normalizedV1.deceased_agents_archive[0].cause_of_death, 'dehydration');

// 4. Verify invalid payload throws SnapshotValidationError
assert.throws(() => validateAndNormalizeSnapshot({bad: true}), SnapshotValidationError);

// 5. Verify groups normalization (Python `norms` -> `norm_rules`) and deduplicated event agent_ids
assert.ok(snap.groups.length > 0, 'Expected emergent groups in fixture');
for (const grp of snap.groups) {
  assert.ok(Array.isArray(grp.member_ids), 'member_ids must always be an array');
  assert.ok(Array.isArray(grp.norm_rules), 'norm_rules must always be an array');
}
for (const ev of snap.history_layers.layer_1_ground_truth_tail) {
  assert.equal(new Set(ev.agent_ids).size, ev.agent_ids.length, 'event.agent_ids must be deduplicated');
}

// 6. Verify incremental population diff keyed by agent_id
const nextSnap = structuredClone(snap);
nextSnap.living_agents_full = nextSnap.living_agents_full.slice(1);
const diff = computePopulationDiff(snap, nextSnap);
assert.equal(diff.newlyDeceasedIds.length, 1);
assert.equal(formatDurationSeconds(3661), '01:01:01');

// 7. Verify Python raw field normalization across traits, memories, witness accounts, artifacts, layer-3, & rebirth records
const pythonRich = structuredClone(rawFixture);
pythonRich.timeline_id = 'exp-branch-uuid-01';
pythonRich.timeline_kind = 'experimental_rebirth';
pythonRich.parent_timeline_id = 'orig-timeline-00';
pythonRich.living_agents_full[0].traits = {
  boldness: 0.77,
  empathy: 0.63,
  curiosity: 0.81,
  aggression: 0.19,
  cooperation: 0.72,
};
pythonRich.living_agents_full[0].episodic_memories = [
  {tick: 120, event_kind: 'illness', other_agent_id: null, x: 400, y: 500, valence: -0.9, detail: 'fever'},
];
pythonRich.living_agents_full[0].spatial_memories = [
  {x: 310, y: 410, kind: 'water', richness: 0.88, last_seen_tick: 118},
];
pythonRich.living_agents_full[0].rebirth_count = 1;
pythonRich.living_agents_full[0].original_death_tick = 140;
pythonRich.living_agents_full[0].original_cause_of_death = 'disease';
pythonRich.living_agents_full[0].brain_fingerprint = 'abc123def456';
pythonRich.living_agents_full[0].death_penalty_record = {
  applied: true,
  cause: 'disease',
  death_tick: 140,
  perceived_cues: ['disease_onset_health_drop'],
  evidence_count: 18,
  mean_advantage: -1.42,
  loss_value: 0.84,
  pre_weight_fingerprint: 'pre_fp',
  post_weight_fingerprint: 'post_fp',
  medical_knowledge_added: false,
};
pythonRich.history_layers.layer_2_witness_accounts_tail = [
  {
    account_id: 99,
    author_id: 4,
    tick_recorded: 150,
    distortion_score: 0.34,
    narrative_summary: 'Winter storm near river',
    bias_type: 'heroic',
  },
];
pythonRich.history_layers.layer_2_surface_artifacts = [
  {
    artifact_id: 55,
    creator_id: 7,
    tick_created: 160,
    medium: 'stone_tablet',
    intended_topic: 'flood',
    durability: 0.91,
    x: 200,
    y: 300,
  },
];
pythonRich.history_layers.layer_3_interpretations_tail = [
  {
    interpretation_id: 12,
    tick_formed: 220,
    generation_depth: 3,
    interpreter_id: 19,
    interpretation_summary: 'Sacred drought memory',
    accuracy_vs_reality: 0.62,
  },
];
pythonRich.rebirth_records = [
  {
    agent_id: 1,
    generation: 0,
    birth_tick: 0,
    original_death_tick: 140,
    original_cause_of_death: 'disease',
    rebirth_tick: 141,
    rebirth_date: 'Y0001-M05-D21',
    rebirth_count: 1,
    preserved_age_ticks: 140,
    brain_fingerprint: 'post_fp',
    episodic_memories_kept: 1,
    spatial_memories_kept: 1,
    death_penalty_applied: true,
    death_penalty_record: pythonRich.living_agents_full[0].death_penalty_record,
  },
];

const richNorm = validateAndNormalizeSnapshot(pythonRich);
assert.equal(richNorm.timeline_id, 'exp-branch-uuid-01');
assert.equal(richNorm.timeline_kind, 'experimental_rebirth');
assert.equal(richNorm.parent_timeline_id, 'orig-timeline-00');
assert.equal(richNorm.living_agents_full[0].traits.boldness, 0.77);
assert.equal(richNorm.living_agents_full[0].traits.cooperation, 0.72);
assert.equal(richNorm.living_agents_full[0].episodic_memories[0].event_type, 'illness');
assert.equal(richNorm.living_agents_full[0].episodic_memories[0].note, 'fever');
assert.equal(richNorm.living_agents_full[0].spatial_memories[0].resource_kind, 'water');
assert.equal(richNorm.living_agents_full[0].spatial_memories[0].estimated_amount, 0.88);
assert.equal(richNorm.living_agents_full[0].rebirth_count, 1);
assert.equal(richNorm.living_agents_full[0].death_penalty_record?.medical_knowledge_added, false);

const w = richNorm.history_layers.layer_2_witness_accounts_tail[0];
assert.equal(w.witness_agent_id, 4);
assert.equal(w.tick, 150);
assert.equal(w.distortion_score, 0.34);
assert.equal(w.summary, 'Winter storm near river');

const art = richNorm.history_layers.layer_2_surface_artifacts[0];
assert.equal(art.author_agent_id, 7);
assert.equal(art.created_tick, 160);
assert.equal(art.artifact_kind, 'stone_tablet');
assert.equal(art.topic, 'flood');
assert.equal(art.integrity, 0.91);

const gi = richNorm.history_layers.layer_3_interpretations_tail[0];
assert.equal(gi.tick, 220);
assert.equal(gi.generation, 3);
assert.equal(gi.interpreter_agent_id, 19);
assert.ok(Number.isFinite(gi.accuracy_estimate) && gi.accuracy_estimate === 0.62);
assert.equal(richNorm.rebirth_records.length, 1);
assert.equal(richNorm.rebirth_records[0].brain_fingerprint, 'post_fp');

console.log('ALL OBSERVATORY ADAPTER CHECKS PASSED:', {
  world_id: snap.world_id,
  tick: snap.clock.tick,
  living: snap.living_agents_full.length,
  deceased: snap.deceased_agents_archive.length,
  timeline_points: snap.timeline_series.length,
});
