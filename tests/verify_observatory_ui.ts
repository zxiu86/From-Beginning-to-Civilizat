import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {validateAndNormalizeSnapshot} from '../lib/observatory/adapter';
import {getTranslations} from '../lib/observatory/i18n';
import AgentInspector from '../components/observatory/AgentInspector';
import CivilizationDrawer from '../components/observatory/CivilizationDrawer';
import ComparisonDrawer from '../components/observatory/ComparisonDrawer';
import HistoryDrawer from '../components/observatory/HistoryDrawer';
import LearningPanel from '../components/observatory/LearningPanel';
import ObservatoryShell from '../components/observatory/ObservatoryShell';
import PopulationDrawer from '../components/observatory/PopulationDrawer';
import ResourcesPanel from '../components/observatory/ResourcesPanel';
import SurvivalPanel from '../components/observatory/SurvivalPanel';
import TelemetryDrawer from '../components/observatory/TelemetryDrawer';
import TopBar from '../components/observatory/TopBar';
import TrainingPanel from '../components/observatory/TrainingPanel';

// 1. Assert ZERO remaining 3D packages or 3D UI modules in frontend / package.json
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
assert.equal(pkg.dependencies?.three, undefined, 'three dependency MUST be removed');
assert.equal(pkg.devDependencies?.three, undefined, 'three devDependency MUST be removed');
assert.equal(pkg.devDependencies?.['@types/three'], undefined, '@types/three MUST be removed');

const forbiddenFiles = [
  'components/observatory/WorldCanvas3D.tsx',
  'components/observatory/FallbackCanvas2D.tsx',
  'components/observatory/FpvHud.tsx',
  'components/observatory/BottomDock.tsx',
  'lib/three/actors.ts',
  'lib/three/instanced-props.ts',
  'lib/three/terrain.ts',
];
for (const rel of forbiddenFiles) {
  assert.equal(fs.existsSync(path.join(root, rel)), false, `Forbidden 3D file still exists: ${rel}`);
}

const forbiddenPatterns = ['WorldCanvas3D', 'FallbackCanvas2D', 'FpvHud', 'BottomDock', '@/lib/three', "from 'three'", 'from "three"'];
function scanDir(dir: string) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) scanDir(full);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      const content = fs.readFileSync(full, 'utf-8');
      for (const pat of forbiddenPatterns) {
        assert.equal(content.includes(pat), false, `Found forbidden 3D reference '${pat}' in ${full}`);
      }
    }
  }
}
for (const sub of ['app', 'components', 'lib']) {
  scanDir(path.join(root, sub));
}

// 2. Render ALL Observatory components via SSR with v2.0.0 stable_protowords objects + training_analytics
//    to prove React Error #31 is permanently resolved across both AR (RTL) and EN (LTR).
const fixturePath = path.join(root, 'public', 'fixtures', 'test_world_snapshot.json');
const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;
raw.emergent_language = {
  ...(raw.emergent_language as Record<string, unknown>),
  stable_protowords_count: 1,
  stable_protowords: {
    tok_7: {
      token: 7,
      context: 'food_here',
      first_stabilized_tick: 45,
      adopter_count: 6,
      extinct: false,
    },
  },
};
raw.training_analytics = {
  training_id: 'train_ui_verify',
  agent_count: 1,
  training_tick: 50,
  total_attempts: 2,
  total_deaths: 1,
  avg_survival_ticks: 25,
  max_longest_survival_ticks: 30,
  stage_totals: {
    food_discovered: 3,
    food_reach_decisions: 2,
    food_physical_reaches: 2,
    food_consumed: 1,
    water_discovered: 3,
    water_reach_decisions: 2,
    water_physical_reaches: 1,
    water_consumed: 1,
  },
  death_causes_breakdown: {starvation: 1},
  attempt_progression: [],
  agents: [
    {
      agent_id: 1,
      sex: 'F',
      attempts: 2,
      deaths: 1,
      longest_survival_ticks: 30,
      avg_survival_ticks: 25,
      last_cause_of_death: 'starvation',
      food_discovered_count: 3,
      food_reach_decisions_count: 2,
      food_physical_reaches_count: 2,
      food_consumed_count: 1,
      water_discovered_count: 3,
      water_reach_decisions_count: 2,
      water_physical_reaches_count: 1,
      water_consumed_count: 1,
      skills_count: 2,
      episodic_memories_count: 2,
      spatial_memories_count: 1,
      brain_updates: 10,
      learning_level: 0.45,
      mean_recent_reward: 0.2,
      status: 'active_training',
      recent_attempts: [{attempt: 1, death_global_tick: 25, survival_ticks: 25, cause_of_death: 'starvation', perceived_cues: ['severe_hunger'], last_action: 'forage_food'}],
    },
  ],
};

const snap = validateAndNormalizeSnapshot(raw);
const lookup = new Map(
  [...snap.living_agents_full, ...snap.deceased_agents_archive].map((a) => [a.agent_id, a]),
);

for (const locale of ['ar', 'en'] as const) {
  const t = getTranslations(locale);
  const noop = () => {};

  const civHtml = renderToStaticMarkup(React.createElement(CivilizationDrawer, {t, snapshot: snap}));
  assert.ok(civHtml.includes('T-7'), `Expected stable protoword T-7 rendered cleanly in ${locale}`);
  assert.equal(civHtml.includes('[object Object]'), false, 'Detected raw [object Object] in CivilizationDrawer');

  const topHtml = renderToStaticMarkup(
    React.createElement(TopBar, {
      t,
      locale,
      snapshot: snap,
      sourceMode: 'published',
      liveApiAvailable: false,
      creatingLiveWorld: false,
      onToggleLocale: noop,
      onUploadClick: noop,
      onOpenMultiImporter: noop,
      onStartLiveWorld: noop,
      onRefreshPublished: noop,
    }),
  );
  assert.ok(topHtml.length > 100);

  for (const el of [
    React.createElement(PopulationDrawer, {t, snapshot: snap, selectedAgentId: snap.living_agents_full[0]?.agent_id ?? null, agentLookup: lookup, onSelectAgent: noop}),
    React.createElement(AgentInspector, {t, agent: snap.living_agents_full[0] ?? null, agentLookup: lookup, onSelectAgent: noop}),
    React.createElement(SurvivalPanel, {t, snapshot: snap}),
    React.createElement(ResourcesPanel, {t, snapshot: snap}),
    React.createElement(LearningPanel, {t, snapshot: snap}),
    React.createElement(TrainingPanel, {t, snapshot: snap, onSelectAgent: noop}),
    React.createElement(HistoryDrawer, {t, snapshot: snap, replayTarget: null, onReplayEvent: noop, onClearReplay: noop, onSelectAgent: noop}),
    React.createElement(ComparisonDrawer, {t, snapshot: snap, liveApiAvailable: false, liveTimelines: [], importedPairSnapshots: null, onSelectAgent: noop}),
    React.createElement(TelemetryDrawer, {t, locale, snapshot: snap}),
    React.createElement(ObservatoryShell),
  ]) {
    const html = renderToStaticMarkup(el);
    assert.equal(html.includes('[object Object]'), false, `Detected [object Object] rendering in ${locale}`);
  }
}

console.log('ALL OBSERVATORY UI & ANTI-3D & ANTI-ERROR-#31 CHECKS PASSED (ar + en SSR verified)');
