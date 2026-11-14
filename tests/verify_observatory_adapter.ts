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

// 5. Verify incremental population diff keyed by agent_id
const nextSnap = structuredClone(snap);
nextSnap.living_agents_full = nextSnap.living_agents_full.slice(1);
const diff = computePopulationDiff(snap, nextSnap);
assert.equal(diff.newlyDeceasedIds.length, 1);
assert.equal(formatDurationSeconds(3661), '01:01:01');

console.log('ALL OBSERVATORY ADAPTER CHECKS PASSED:', {
  world_id: snap.world_id,
  tick: snap.clock.tick,
  living: snap.living_agents_full.length,
  deceased: snap.deceased_agents_archive.length,
  timeline_points: snap.timeline_series.length,
});
