import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {processJsonImportBatch, type ImportFileLike} from '../lib/observatory/importer';

const fixturePath = path.join(process.cwd(), 'public', 'fixtures', 'test_world_snapshot.json');
const baseFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;

function makeMockFile(name: string, payload: unknown, relativePath?: string): ImportFileLike {
  const textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    name,
    webkitRelativePath: relativePath ?? name,
    size: textContent.length,
    text: async () => textContent,
  };
}

function makeSnapshotForTick(
  tick: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const copy = structuredClone(baseFixture) as Record<string, unknown>;
  const clock = copy.clock as Record<string, unknown>;
  clock.tick = tick;
  clock.sim_date = `Y0001-M01-D${String((tick % 30) + 1).padStart(2, '0')}`;
  copy.timeline_id = 'orig-timeline';
  copy.timeline_kind = 'original';
  return {...copy, ...extra};
}

async function runTests(): Promise<void> {
  // Test 1: Unsorted step numbers (25, 10, 2, 1) sort numerically, not lexicographically
  {
    const files: ImportFileLike[] = [
      makeMockFile('step_25.json', makeSnapshotForTick(25, {step_number: 25})),
      makeMockFile('step_10.json', makeSnapshotForTick(10, {step_number: 10})),
      makeMockFile('step_2.json', makeSnapshotForTick(2, {step_number: 2})),
      makeMockFile('step_1.json', makeSnapshotForTick(1, {step_number: 1})),
    ];
    const report = await processJsonImportBatch(files);
    assert.equal(report.timelines.length, 1);
    assert.deepEqual(report.timelines[0].orderedTicks, [1, 2, 10, 25]);
    assert.equal(report.timelines[0].snapshot.clock.tick, 25);
  }

  // Test 2: Misleading filenames overridden by internal metadata (`step_id`, `dependencies`, `tick`)
  {
    const files: ImportFileLike[] = [
      makeMockFile(
        'alpha_first_name.json',
        makeSnapshotForTick(30, {step_id: 's3', dependencies: ['s2']}),
      ),
      makeMockFile(
        'zzz_last_name.json',
        makeSnapshotForTick(10, {step_id: 's1'}),
      ),
      makeMockFile(
        'mmm_mid_name.json',
        makeSnapshotForTick(20, {step_id: 's2', parent_step: 's1'}),
      ),
    ];
    const report = await processJsonImportBatch(files);
    assert.deepEqual(report.timelines[0].orderedTicks, [10, 20, 30]);
    assert.deepEqual(report.timelines[0].orderedFiles, [
      'zzz_last_name.json',
      'mmm_mid_name.json',
      'alpha_first_name.json',
    ]);
  }

  // Test 3: Topological cycle detection halts cyclic branch cleanly
  {
    const files: ImportFileLike[] = [
      makeMockFile('a.json', makeSnapshotForTick(1, {step_id: 'A', dependencies: ['B']})),
      makeMockFile('b.json', makeSnapshotForTick(2, {step_id: 'B', dependencies: ['A']})),
    ];
    const report = await processJsonImportBatch(files);
    assert.equal(report.timelines[0].haltedDueToCycle, true);
    assert.ok(report.cycleErrors.length > 0, 'Expected cycle error to be reported');
  }

  // Test 4: Duplicate detection (exact identical deduplicated, conflicting duplicate resolved deterministically)
  {
    const s5a = makeSnapshotForTick(5, {step_number: 5, step_id: 'step-5'});
    const s5b = makeSnapshotForTick(5, {step_number: 5, step_id: 'step-5'});
    const s5Conflict = makeSnapshotForTick(5, {
      step_number: 5,
      step_id: 'step-5',
      timestamp: '2026-11-14T18:00:00Z',
    });
    const report = await processJsonImportBatch([
      makeMockFile('s5_a.json', s5a),
      makeMockFile('s5_b.json', s5b),
      makeMockFile('s5_conflict.json', s5Conflict),
    ]);
    assert.equal(report.timelines[0].orderedTicks.length, 1);
    assert.ok(report.timelines[0].duplicateResolutions.length >= 2);
  }

  // Test 5: Gap warning detection when sequence skips step numbers
  {
    const report = await processJsonImportBatch([
      makeMockFile('s1.json', makeSnapshotForTick(1, {step_number: 1})),
      makeMockFile('s5.json', makeSnapshotForTick(5, {step_number: 5})),
    ]);
    assert.ok(report.timelines[0].gapWarnings.some((w) => w.includes('1') && w.includes('5')));
  }

  // Test 6: Corrupt JSON quarantine + Unindexed file queue without halting valid files
  {
    const report = await processJsonImportBatch([
      makeMockFile('valid.json', makeSnapshotForTick(10, {step_number: 10})),
      makeMockFile('corrupt.json', '{invalid json'),
      makeMockFile('unknown.json', {foo: 'bar', baz: 123}),
    ]);
    assert.equal(report.quarantinedFiles.length, 1);
    assert.equal(report.quarantinedFiles[0].fileName, 'corrupt.json');
    assert.equal(report.unindexedQueue.length, 1);
    assert.equal(report.unindexedQueue[0].fileName, 'unknown.json');
    assert.equal(report.timelines.length, 1);
    assert.equal(report.timelines[0].orderedTicks[0], 10);
  }

  // Test 7: Timeline branch isolation (`original` vs `experimental_rebirth`) + delta event merging
  {
    const orig10 = makeSnapshotForTick(10, {
      timeline_id: 'orig-t1',
      timeline_kind: 'original',
      step_number: 10,
    });
    const origEvent12 = {
      timeline_id: 'orig-t1',
      timeline_kind: 'original',
      tick: 12,
      step_number: 12,
      events: [
        {
          event_id: 99999,
          tick: 12,
          event_type: 'discovery',
          description: 'Delta event imported from incremental log',
          agent_ids: [1, 2],
          location: [500, 600],
          importance: 0.9,
        },
      ],
    };
    const exp11 = makeSnapshotForTick(11, {
      timeline_id: 'exp-t2',
      timeline_kind: 'experimental_rebirth',
      parent_timeline_id: 'orig-t1',
      step_number: 11,
    });
    const report = await processJsonImportBatch([
      makeMockFile('exp/11.json', exp11, 'exp/11.json'),
      makeMockFile('orig/12_delta.json', origEvent12, 'orig/12_delta.json'),
      makeMockFile('orig/10.json', orig10, 'orig/10.json'),
    ]);
    assert.equal(report.timelines.length, 2);
    const origBundle = report.timelines.find((t) => t.timelineId === 'orig-t1');
    const expBundle = report.timelines.find((t) => t.timelineId === 'exp-t2');
    assert.ok(origBundle && expBundle);
    assert.deepEqual(origBundle.orderedFiles, ['orig/10.json', 'orig/12_delta.json']);
    assert.deepEqual(origBundle.orderedTicks, [10]);
    assert.ok(
      origBundle.snapshot.history_layers.layer_1_ground_truth_tail.some(
        (e) => e.event_id === 99999,
      ),
      'Incremental event delta must merge into its matching timeline',
    );
    assert.ok(
      !expBundle.snapshot.history_layers.layer_1_ground_truth_tail.some(
        (e) => e.event_id === 99999,
      ),
      'Events from original timeline must NEVER leak into experimental timeline',
    );
  }

  // Test 8: Scale / chunking stress test (300 unsorted incremental & snapshot files)
  {
    const files: ImportFileLike[] = [];
    for (let i = 300; i >= 1; i--) {
      if (i % 50 === 0 || i === 1) {
        files.push(makeMockFile(`f_${i}.json`, makeSnapshotForTick(i, {step_number: i})));
      } else {
        files.push(
          makeMockFile(`f_${i}.json`, {
            timeline_id: 'orig-timeline',
            timeline_kind: 'original',
            tick: i,
            step_number: i,
            events: [
              {
                event_id: 100000 + i,
                tick: i,
                event_type: 'forage',
                description: `Tick ${i} foraging record`,
                agent_ids: [1],
                location: [100, 100],
                importance: 0.2,
              },
            ],
          }),
        );
      }
    }
    const stages: string[] = [];
    const report = await processJsonImportBatch(files, (p) => {
      if (stages[stages.length - 1] !== p.stage) stages.push(p.stage);
    });
    assert.equal(report.totalFiles, 300);
    assert.equal(report.timelines.length, 1);
    assert.equal(report.timelines[0].orderedFiles.length, 300);
    assert.equal(report.timelines[0].orderedFiles[0], 'f_1.json');
    assert.equal(report.timelines[0].orderedFiles[299], 'f_300.json');
    assert.deepEqual(report.timelines[0].orderedTicks, [1, 50, 100, 150, 200, 250, 300]);
    assert.ok(stages.includes('parse') && stages.includes('sequence') && stages.includes('complete'));
  }

  console.log('ALL MULTI-FILE JSON IMPORTER CHECKS PASSED (8 scenarios including 300-file batch)');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
