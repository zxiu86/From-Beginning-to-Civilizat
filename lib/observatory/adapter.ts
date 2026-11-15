import type {
  AgentTraits,
  AnyAgentRecord,
  CrimeRecordItem,
  DeathPenaltyRecord,
  DeceasedAgentArchive,
  EpisodicMemoryItem,
  GenealogyNodeItem,
  GenerationalInterpretationItem,
  HeardEmissionItem,
  LearningTelemetryData,
  LivingAgentFull,
  ObservatorySnapshot,
  PopulationRecoveryCycleItem,
  RebirthRecordItem,
  RecoveryStateData,
  SpatialMemoryItem,
  SurfaceArtifactItem,
  WitnessAccountItem,
  WorldTerrainGrid,
} from './types';

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotValidationError';
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function asNumber(val: unknown, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

function asNullableNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function asNumberArray(val: unknown): number[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
}

function normalizeTraits(raw: unknown): AgentTraits {
  const obj = isObject(raw) ? raw : {};
  return {
    boldness: asNumber(obj.boldness ?? obj.risk_tolerance, 0.5),
    empathy: asNumber(obj.empathy, 0.5),
    curiosity: asNumber(obj.curiosity, 0.5),
    aggression: asNumber(obj.aggression, 0.3),
    cooperation: asNumber(obj.cooperation ?? obj.sociability, 0.5),
  };
}

function normalizeDeathPenalty(raw: unknown): DeathPenaltyRecord | null {
  if (!isObject(raw)) return null;
  return {
    applied: Boolean(raw.applied),
    cause: typeof raw.cause === 'string' ? raw.cause : undefined,
    death_tick: asNullableNumber(raw.death_tick) ?? undefined,
    perceived_cues: Array.isArray(raw.perceived_cues)
      ? raw.perceived_cues.filter((c): c is string => typeof c === 'string')
      : undefined,
    evidence_count: asNullableNumber(raw.evidence_count) ?? undefined,
    mean_advantage: asNullableNumber(raw.mean_advantage) ?? undefined,
    loss_value: asNullableNumber(raw.loss_value) ?? undefined,
    pre_weight_fingerprint:
      typeof raw.pre_weight_fingerprint === 'string' ? raw.pre_weight_fingerprint : undefined,
    post_weight_fingerprint:
      typeof raw.post_weight_fingerprint === 'string' ? raw.post_weight_fingerprint : undefined,
    note: typeof raw.note === 'string' ? raw.note : undefined,
    medical_knowledge_added:
      typeof raw.medical_knowledge_added === 'boolean' ? raw.medical_knowledge_added : undefined,
  };
}

function normalizeEpisodicList(raw: unknown): EpisodicMemoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((e) => ({
    tick: asNumber(e.tick),
    event_type: asString(e.event_type ?? e.event_kind, 'event'),
    other_agent_id: asNullableNumber(e.other_agent_id),
    x: asNumber(e.x),
    y: asNumber(e.y),
    valence: asNumber(e.valence),
    note: asString(e.note ?? e.detail),
  }));
}

function normalizeSpatialList(raw: unknown): SpatialMemoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((s) => ({
    x: asNumber(s.x),
    y: asNumber(s.y),
    resource_kind: asString(s.resource_kind ?? s.kind, 'resource'),
    estimated_amount: asNumber(s.estimated_amount ?? s.richness),
    last_seen_tick: asNumber(s.last_seen_tick),
  }));
}

function sanitizeHeardEmissions(raw: unknown): HeardEmissionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObject)
    .map((item) => ({
      speaker_id: asNumber(item.speaker_id),
      token: asNumber(item.token),
      gesture: asNumber(item.gesture),
      x: asNumber(item.x),
      y: asNumber(item.y),
      tick: asNumber(item.tick),
      distance_m: asNumber(item.distance_m),
      // Deliberately omit any context_tag if an unpatched payload ever contained it
    }));
}

function normalizeLivingAgent(
  raw: Record<string, unknown>,
  genealogyMap: Map<number, GenealogyNodeItem>,
  allLivingRaw: Record<string, unknown>[],
  isNight: boolean,
): LivingAgentFull {
  const aid = asNumber(raw.agent_id);
  const gNode = genealogyMap.get(aid);
  const x = asNumber(raw.x);
  const y = asNumber(raw.y);
  const ageYears = asNumber(raw.age_years);
  const lifeStage =
    asString(raw.life_stage) ||
    (ageYears < 4 ? 'infant' : ageYears < 14 ? 'child' : ageYears < 48 ? 'adult' : 'elder');

  const rawLp = isObject(raw.local_perception) ? raw.local_perception : null;
  const visionRadius = rawLp ? Math.max(10, asNumber(rawLp.vision_radius_m, isNight ? 54 : 120)) : isNight ? 54 : 120;
  const hearingRadius = rawLp ? Math.max(20, asNumber(rawLp.hearing_radius_m, 180)) : 180;

  let visibleAgentIds: number[];
  if (rawLp && Array.isArray(rawLp.visible_agent_ids)) {
    visibleAgentIds = asNumberArray(rawLp.visible_agent_ids);
  } else {
    visibleAgentIds = allLivingRaw
      .filter((other) => {
        const oid = asNumber(other.agent_id);
        if (oid === aid) return false;
        const dx = asNumber(other.x) - x;
        const dy = asNumber(other.y) - y;
        return Math.hypot(dx, dy) <= visionRadius;
      })
      .map((other) => asNumber(other.agent_id));
  }

  const invObj = isObject(raw.inventory) ? raw.inventory : {};
  const skillsObj = isObject(raw.skills) ? raw.skills : {};
  const lexObj = isObject(raw.lexicon) ? raw.lexicon : {};

  const normalizedLexicon: Record<string, Record<string, number>> = {};
  for (const [tok, ctxMap] of Object.entries(lexObj)) {
    if (isObject(ctxMap)) {
      const cleanMap: Record<string, number> = {};
      for (const [ctx, w] of Object.entries(ctxMap)) {
        cleanMap[ctx] = asNumber(w);
      }
      normalizedLexicon[tok] = cleanMap;
    }
  }

  return {
    agent_id: aid,
    sex: asString(raw.sex, 'F'),
    x,
    y,
    birth_tick: asNumber(raw.birth_tick, gNode?.birth_tick ?? 0),
    generation: asNumber(raw.generation, 0),
    parent_a_id: raw.parent_a_id !== undefined ? asNullableNumber(raw.parent_a_id) : gNode?.parent_a_id ?? null,
    parent_b_id: raw.parent_b_id !== undefined ? asNullableNumber(raw.parent_b_id) : gNode?.parent_b_id ?? null,
    children_ids: Array.isArray(raw.children_ids)
      ? asNumberArray(raw.children_ids)
      : gNode?.children_ids ?? [],
    is_alive: true,
    age_ticks: asNumber(raw.age_ticks, Math.round(ageYears * 360)),
    age_years: ageYears,
    life_stage: lifeStage,
    health: asNumber(raw.health, 1),
    hunger: asNumber(raw.hunger, 0),
    thirst: asNumber(raw.thirst, 0),
    energy: asNumber(raw.energy, 1),
    injury: asNumber(raw.injury, 0),
    disease_load: asNumber(raw.disease_load, 0),
    is_pregnant: Boolean(raw.is_pregnant),
    gestation_ticks: asNumber(raw.gestation_ticks, 0),
    last_action: asString(raw.last_action, 'rest'),
    last_emitted_token: asNullableNumber(raw.last_emitted_token),
    carried_item: typeof raw.carried_item === 'string' ? raw.carried_item : null,
    last_partner_id: asNullableNumber(raw.last_partner_id),
    rebirth_count: asNumber(raw.rebirth_count, 0),
    rebirth_tick: asNullableNumber(raw.rebirth_tick),
    original_death_tick: asNullableNumber(raw.original_death_tick),
    original_death_date: typeof raw.original_death_date === 'string' ? raw.original_death_date : null,
    original_cause_of_death:
      typeof raw.original_cause_of_death === 'string' ? raw.original_cause_of_death : null,
    death_penalty_record: normalizeDeathPenalty(raw.death_penalty_record),
    brain_fingerprint: typeof raw.brain_fingerprint === 'string' ? raw.brain_fingerprint : null,
    traits: normalizeTraits(raw.traits),
    inventory: Object.fromEntries(Object.entries(invObj).map(([k, v]) => [k, asNumber(v)])),
    skills: Object.fromEntries(Object.entries(skillsObj).map(([k, v]) => [k, asNumber(v)])),
    lexicon_size: asNumber(raw.lexicon_size, Object.keys(normalizedLexicon).length),
    lexicon: normalizedLexicon,
    episodic_memories: normalizeEpisodicList(raw.episodic_memories),
    spatial_memories: normalizeSpatialList(raw.spatial_memories),
    social_ties: Array.isArray(raw.social_ties)
      ? raw.social_ties.filter(isObject).map((t) => ({
          agent_id: asNumber(t.agent_id),
          familiarity: asNumber(t.familiarity),
          trust: asNumber(t.trust),
        }))
      : [],
    local_perception: {
      vision_radius_m: visionRadius,
      hearing_radius_m: hearingRadius,
      visible_agent_ids: visibleAgentIds,
      visible_artifact_ids: rawLp ? asNumberArray(rawLp.visible_artifact_ids) : [],
      visible_fauna_ids: rawLp ? asNumberArray(rawLp.visible_fauna_ids) : [],
      local_water: rawLp ? asNumber(rawLp.local_water) : 0,
      local_food: rawLp ? asNumber(rawLp.local_food) : 0,
      local_wood: rawLp ? asNumber(rawLp.local_wood) : 0,
      local_stone: rawLp ? asNumber(rawLp.local_stone) : 0,
      local_herb: rawLp ? asNumber(rawLp.local_herb) : 0,
      heard_emissions: rawLp ? sanitizeHeardEmissions(rawLp.heard_emissions) : [],
    },
  };
}

function normalizeTerrain(raw: unknown): WorldTerrainGrid | null {
  if (!isObject(raw)) return null;
  const cols = asNumber(raw.cols);
  const rows = asNumber(raw.rows);
  const elevation = asNumberArray(raw.elevation);
  if (cols <= 0 || rows <= 0 || elevation.length !== cols * rows) {
    return null;
  }
  return {
    width_m: asNumber(raw.width_m, 2500),
    height_m: asNumber(raw.height_m, 2000),
    cell_size_m: asNumber(raw.cell_size_m, 25),
    cols,
    rows,
    elevation,
    water: asNumberArray(raw.water),
    moisture: asNumberArray(raw.moisture),
    fertility: asNumberArray(raw.fertility),
    food_flora: asNumberArray(raw.food_flora),
    wood_flora: asNumberArray(raw.wood_flora),
    herb_flora: asNumberArray(raw.herb_flora),
    stone_mineral: asNumberArray(raw.stone_mineral),
  };
}

function normalizeWitnessAccounts(raw: unknown): WitnessAccountItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((w) => {
    const distortion = asNumber(w.distortion_score, w.distorted ? 0.5 : 0);
    return {
      account_id: asNumber(w.account_id),
      tick: asNumber(w.tick ?? w.tick_recorded),
      witness_agent_id: asNumber(w.witness_agent_id ?? w.author_id),
      subject_agent_ids: asNumberArray(w.subject_agent_ids ?? w.claimed_agent_ids),
      perceived_type: asString(w.perceived_type ?? w.topic, 'observation'),
      x: asNumber(w.x),
      y: asNumber(w.y),
      confidence: asNumber(w.confidence, 0.5),
      distortion_score: distortion,
      distorted: typeof w.distorted === 'boolean' ? w.distorted : distortion > 0.25,
      artifact_id: asNullableNumber(w.artifact_id),
      summary: asString(w.summary ?? w.narrative_summary),
    };
  });
}

function normalizeSurfaceArtifacts(raw: unknown): SurfaceArtifactItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((a) => ({
    artifact_id: asNumber(a.artifact_id),
    created_tick: asNumber(a.created_tick ?? a.tick_created),
    author_agent_id: asNumber(a.author_agent_id ?? a.creator_id),
    x: asNumber(a.x),
    y: asNumber(a.y),
    artifact_kind: asString(a.artifact_kind ?? a.medium, 'earth_mark'),
    symbol_tokens: asNumberArray(a.symbol_tokens),
    topic: asString(a.topic ?? a.intended_topic, 'record'),
    integrity: asNumber(a.integrity ?? a.durability, 0.5),
  }));
}

function normalizeGenerationalInterpretations(raw: unknown): GenerationalInterpretationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((it) => {
    const srcArr = asNumberArray(it.source_artifact_ids);
    const srcSingle = asNullableNumber(it.source_artifact_id);
    return {
      interpretation_id: asNumber(it.interpretation_id),
      tick: asNumber(it.tick ?? it.tick_formed),
      generation: asNumber(it.generation ?? it.generation_depth, 1),
      interpreter_agent_id: asNumber(it.interpreter_agent_id ?? it.interpreter_id),
      source_artifact_id: srcSingle ?? (srcArr.length > 0 ? srcArr[0] : null),
      inferred_topic: asString(it.inferred_topic, ''),
      belief_narrative: asString(it.belief_narrative ?? it.summary),
      accuracy_estimate: asNumber(it.accuracy_estimate ?? it.accuracy_vs_reality, 0),
      belief_confidence: asNumber(it.belief_confidence, 0.5),
      is_revisionist: Boolean(it.is_revisionist),
    };
  });
}

function normalizeCrimeRecords(raw: unknown): CrimeRecordItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((c) => ({
    crime_id: asNumber(c.crime_id),
    tick: asNumber(c.tick),
    crime_type: asString(c.crime_type, 'crime'),
    perpetrator_id: asNumber(c.perpetrator_id),
    victim_id: asNullableNumber(c.victim_id),
    x: asNumber(c.x),
    y: asNumber(c.y),
    known_to_society: Boolean(c.known_to_society),
    punished: typeof c.punished === 'boolean' ? c.punished : Boolean(c.resolved),
    resolution_type: typeof c.resolution_type === 'string' ? c.resolution_type : null,
  }));
}

function normalizeRebirthRecords(raw: unknown): RebirthRecordItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map((r) => ({
    agent_id: asNumber(r.agent_id),
    generation: asNumber(r.generation, 0),
    birth_tick: asNumber(r.birth_tick, 0),
    original_death_tick: asNullableNumber(r.original_death_tick),
    original_cause_of_death:
      typeof r.original_cause_of_death === 'string' ? r.original_cause_of_death : null,
    rebirth_tick: asNumber(r.rebirth_tick, 0),
    rebirth_date: asString(r.rebirth_date),
    rebirth_count: asNumber(r.rebirth_count, 1),
    preserved_age_ticks: asNumber(r.preserved_age_ticks, 0),
    brain_fingerprint: asString(r.brain_fingerprint),
    episodic_memories_kept: asNumber(r.episodic_memories_kept, 0),
    spatial_memories_kept: asNumber(r.spatial_memories_kept, 0),
    death_penalty_applied: Boolean(r.death_penalty_applied),
    death_penalty_record: normalizeDeathPenalty(r.death_penalty_record),
  }));
}

function normalizeRecoveryState(raw: unknown): RecoveryStateData {
  const obj = isObject(raw) ? raw : {};
  const histRaw = Array.isArray(obj.population_recovery_history)
    ? obj.population_recovery_history.filter(isObject)
    : [];
  const history: PopulationRecoveryCycleItem[] = histRaw.map((h) => {
    const causesRaw = isObject(h.death_causes) ? h.death_causes : {};
    return {
      cycle_number: asNumber(h.cycle_number, 1),
      previous_cycle_number: asNumber(h.previous_cycle_number, 1),
      extinction_tick: asNumber(h.extinction_tick, 0),
      extinction_date: asString(h.extinction_date, 'Y0001-M01-D01'),
      deaths_in_previous_cycle: asNumber(h.deaths_in_previous_cycle, 0),
      death_causes: Object.fromEntries(
        Object.entries(causesRaw).map(([k, v]) => [k, asNumber(v)]),
      ),
      pre_recovery_archive:
        typeof h.pre_recovery_archive === 'string' ? h.pre_recovery_archive : null,
      recovery_tick: asNumber(h.recovery_tick, 0),
      recovery_date: asString(h.recovery_date, 'Y0001-M01-D01'),
      new_agent_ids: asNumberArray(h.new_agent_ids),
      post_recovery_population: asNumber(h.post_recovery_population, 0),
      subsequent_births: asNumber(h.subsequent_births, 0),
      survival_duration_ticks: asNumber(h.survival_duration_ticks, 0),
      outcome: asString(h.outcome, 'active'),
      final_extinction_tick: asNullableNumber(h.final_extinction_tick) ?? undefined,
      final_extinction_date:
        typeof h.final_extinction_date === 'string' ? h.final_extinction_date : undefined,
    };
  });
  return {
    auto_recover_on_extinction:
      typeof obj.auto_recover_on_extinction === 'boolean' ? obj.auto_recover_on_extinction : true,
    recovery_founder_count: asNumber(obj.recovery_founder_count, 4),
    recovery_cycle_count: asNumber(obj.recovery_cycle_count, history.length),
    current_cycle_number: asNumber(obj.current_cycle_number, 1),
    current_cycle_start_tick: asNumber(obj.current_cycle_start_tick, 0),
    population_recovery_history: history,
  };
}

function normalizeLearningTelemetry(raw: unknown, livingCount: number): LearningTelemetryData {
  const obj = isObject(raw) ? raw : {};
  return {
    living_brains_count: asNumber(obj.living_brains_count, livingCount),
    agents_with_updates: asNumber(obj.agents_with_updates, 0),
    avg_updates_per_agent: asNumber(obj.avg_updates_per_agent, 0),
    mean_td_error: asNumber(obj.mean_td_error, 0),
    mean_policy_entropy: asNumber(obj.mean_policy_entropy, 0),
    mean_loss: asNumber(obj.mean_loss, 0),
    mean_recent_reward: asNumber(obj.mean_recent_reward, 0),
  };
}

export function validateAndNormalizeSnapshot(input: unknown): ObservatorySnapshot {
  if (!isObject(input)) {
    throw new SnapshotValidationError('Snapshot JSON must be an object.');
  }
  if (typeof input.world_id !== 'string' || !input.world_id) {
    throw new SnapshotValidationError('Missing required field: world_id');
  }
  if (!isObject(input.clock) || !isObject(input.demographics) || !isObject(input.history_layers)) {
    throw new SnapshotValidationError('Missing core engine sections (clock, demographics, or history_layers).');
  }

  const clockObj = input.clock;
  const isNight = Boolean(clockObj.is_night);

  const genealogyNodes: GenealogyNodeItem[] = Array.isArray(input.genealogy_nodes)
    ? input.genealogy_nodes.filter(isObject).map((g) => ({
        agent_id: asNumber(g.agent_id),
        birth_tick: asNumber(g.birth_tick),
        death_tick: asNullableNumber(g.death_tick),
        is_alive: Boolean(g.is_alive),
        cause_of_death: typeof g.cause_of_death === 'string' ? g.cause_of_death : null,
        parent_a_id: asNullableNumber(g.parent_a_id),
        parent_b_id: asNullableNumber(g.parent_b_id),
        children_ids: asNumberArray(g.children_ids),
      }))
    : [];
  const genealogyMap = new Map<number, GenealogyNodeItem>(genealogyNodes.map((g) => [g.agent_id, g]));

  const livingRaw = Array.isArray(input.living_agents_full)
    ? input.living_agents_full.filter(isObject)
    : Array.isArray(input.living_agents_summary)
      ? input.living_agents_summary.filter(isObject)
      : [];

  const livingAgentsFull = livingRaw.map((ag) =>
    normalizeLivingAgent(ag, genealogyMap, livingRaw, isNight),
  );

  let deceasedArchive: DeceasedAgentArchive[];
  if (Array.isArray(input.deceased_agents_archive)) {
    deceasedArchive = input.deceased_agents_archive.filter(isObject).map((d) => {
      const skillsObj = isObject(d.skills) ? d.skills : {};
      return {
        agent_id: asNumber(d.agent_id),
        sex: asString(d.sex, 'F'),
        x: asNumber(d.x),
        y: asNumber(d.y),
        birth_tick: asNumber(d.birth_tick),
        death_tick: asNullableNumber(d.death_tick),
        cause_of_death: typeof d.cause_of_death === 'string' ? d.cause_of_death : null,
        age_ticks: asNumber(d.age_ticks),
        age_years: asNumber(d.age_years),
        life_stage: asString(d.life_stage, 'adult'),
        generation: asNumber(d.generation),
        parent_a_id: asNullableNumber(d.parent_a_id),
        parent_b_id: asNullableNumber(d.parent_b_id),
        children_ids: asNumberArray(d.children_ids),
        is_alive: false,
        last_action: asString(d.last_action, 'rest'),
        rebirth_count: asNumber(d.rebirth_count, 0),
        rebirth_tick: asNullableNumber(d.rebirth_tick),
        original_death_tick: asNullableNumber(d.original_death_tick),
        original_death_date:
          typeof d.original_death_date === 'string' ? d.original_death_date : null,
        original_cause_of_death:
          typeof d.original_cause_of_death === 'string' ? d.original_cause_of_death : null,
        death_penalty_record: normalizeDeathPenalty(d.death_penalty_record),
        brain_fingerprint: typeof d.brain_fingerprint === 'string' ? d.brain_fingerprint : null,
        traits: normalizeTraits(d.traits),
        skills: Object.fromEntries(Object.entries(skillsObj).map(([k, v]) => [k, asNumber(v)])),
        lexicon_size: asNumber(d.lexicon_size),
        episodic_memories: normalizeEpisodicList(d.episodic_memories),
        social_ties: Array.isArray(d.social_ties)
          ? d.social_ties.filter(isObject).map((t) => ({
              agent_id: asNumber(t.agent_id),
              familiarity: asNumber(t.familiarity),
              trust: asNumber(t.trust),
            }))
          : [],
      };
    });
  } else {
    // v1.0.0 fallback: reconstruct minimal deceased records from genealogy_nodes
    deceasedArchive = genealogyNodes
      .filter((g) => !g.is_alive)
      .map((g) => ({
        agent_id: g.agent_id,
        sex: 'F',
        x: 1250,
        y: 1000,
        birth_tick: g.birth_tick,
        death_tick: g.death_tick,
        cause_of_death: g.cause_of_death,
        age_ticks: Math.max(0, (g.death_tick ?? 0) - g.birth_tick),
        age_years: Number((Math.max(0, (g.death_tick ?? 0) - g.birth_tick) / 360).toFixed(2)),
        life_stage: 'adult',
        generation: 0,
        parent_a_id: g.parent_a_id,
        parent_b_id: g.parent_b_id,
        children_ids: g.children_ids,
        is_alive: false,
        last_action: 'rest',
        rebirth_count: 0,
        rebirth_tick: null,
        original_death_tick: null,
        original_death_date: null,
        original_cause_of_death: null,
        death_penalty_record: null,
        brain_fingerprint: null,
        traits: {
          boldness: 0.5,
          empathy: 0.5,
          curiosity: 0.5,
          aggression: 0.3,
          cooperation: 0.5,
        },
        skills: {},
        lexicon_size: 0,
        episodic_memories: [],
        social_ties: [],
      }));
  }

  const ecoObj = isObject(input.ecosystem) ? input.ecosystem : {};
  const weatherObj = isObject(ecoObj.weather) ? ecoObj.weather : {};
  const langObj = isObject(input.emergent_language) ? input.emergent_language : {};
  const crimeObj = isObject(input.crime_and_stability) ? input.crime_and_stability : {};
  const demoObj = input.demographics;
  const histObj = input.history_layers;
  const capObj = isObject(input.engine_capabilities) ? input.engine_capabilities : {};

  const discoveredTechs: Record<string, number> = isObject(demoObj.discovered_techs)
    ? Object.fromEntries(Object.entries(demoObj.discovered_techs).map(([k, v]) => [k, asNumber(v)]))
    : {};

  const exchangeHubs = Array.isArray(crimeObj.exchange_hubs)
    ? (crimeObj.exchange_hubs.filter(isObject) as unknown as ObservatorySnapshot['crime_and_stability']['exchange_hubs'])
    : [];

  return {
    export_schema_version: asString(input.export_schema_version, '1.0.0'),
    exported_at_utc: asString(input.exported_at_utc, new Date().toISOString()),
    world_id: input.world_id,
    timeline_id: asString(input.timeline_id, input.world_id),
    parent_timeline_id:
      typeof input.parent_timeline_id === 'string' ? input.parent_timeline_id : null,
    timeline_kind: asString(input.timeline_kind, 'original'),
    branch_point_tick: asNullableNumber(input.branch_point_tick),
    rebirth_records: normalizeRebirthRecords(input.rebirth_records),
    recovery_state: normalizeRecoveryState(input.recovery_state),
    learning_telemetry: normalizeLearningTelemetry(input.learning_telemetry, livingAgentsFull.length),
    backend: asString(input.backend, 'unknown'),
    clock: {
      tick: asNumber(clockObj.tick),
      year: asNumber(clockObj.year, 1),
      month: asNumber(clockObj.month, 1),
      day: asNumber(clockObj.day, 1),
      season: asString(clockObj.season, 'spring'),
      is_night: isNight,
      sim_date: asString(clockObj.sim_date, 'Y0001-M01-D01'),
      real_elapsed_seconds: asNumber(clockObj.real_elapsed_seconds),
      real_seconds_per_sim_month: asNumber(clockObj.real_seconds_per_sim_month, 60),
    },
    engine_capabilities: {
      has_buildings_grid: Boolean(capObj.has_buildings_grid),
      has_roads_grid: Boolean(capObj.has_roads_grid),
      has_farms_grid: Boolean(capObj.has_farms_grid),
      has_shelter_tech_milestone:
        typeof capObj.has_shelter_tech_milestone === 'boolean'
          ? capObj.has_shelter_tech_milestone
          : 'simple_shelter' in discoveredTechs,
      has_market_hubs:
        typeof capObj.has_market_hubs === 'boolean' ? capObj.has_market_hubs : exchangeHubs.length > 0,
    },
    world_terrain: normalizeTerrain(input.world_terrain),
    demographics: {
      living_count: asNumber(demoObj.living_count, livingAgentsFull.length),
      deceased_count: asNumber(demoObj.deceased_count, deceasedArchive.length),
      total_ever_born: asNumber(demoObj.total_ever_born, livingAgentsFull.length + deceasedArchive.length),
      births_total: asNumber(demoObj.births_total),
      deaths_total: asNumber(demoObj.deaths_total, deceasedArchive.length),
      max_generation: asNumber(demoObj.max_generation),
      avg_age_years: asNumber(demoObj.avg_age_years),
      age_distribution: isObject(demoObj.age_distribution)
        ? Object.fromEntries(Object.entries(demoObj.age_distribution).map(([k, v]) => [k, asNumber(v)]))
        : {},
      discovered_techs: discoveredTechs,
    },
    ecosystem: {
      total_food_biomass: asNumber(ecoObj.total_food_biomass),
      total_wood_biomass: asNumber(ecoObj.total_wood_biomass),
      total_herb_biomass: asNumber(ecoObj.total_herb_biomass),
      total_stone_mineral: asNumber(ecoObj.total_stone_mineral),
      avg_soil_moisture: asNumber(ecoObj.avg_soil_moisture),
      herbivores_alive: asNumber(ecoObj.herbivores_alive),
      predators_alive: asNumber(ecoObj.predators_alive),
      weather: {
        condition: asString(weatherObj.condition, 'clear'),
        temperature_c: asNumber(weatherObj.temperature_c, 18),
        rainfall_mm: asNumber(weatherObj.rainfall_mm, 0),
        wind_mps: asNumber(weatherObj.wind_mps, 3),
        drought_streak_days: asNumber(weatherObj.drought_streak_days, 0),
        flood_severity: asNumber(weatherObj.flood_severity, 0),
        disease_pressure: asNumber(weatherObj.disease_pressure, 0.015),
      },
      fauna: Array.isArray(ecoObj.fauna)
        ? (ecoObj.fauna.filter(isObject) as unknown as ObservatorySnapshot['ecosystem']['fauna'])
        : [],
    },
    emergent_language: {
      first_communication_tick: asNullableNumber(langObj.first_communication_tick),
      first_repeated_signal_tick: asNullableNumber(langObj.first_repeated_signal_tick),
      first_shared_symbol_tick: asNullableNumber(langObj.first_shared_symbol_tick),
      first_stable_protoword_tick: asNullableNumber(langObj.first_stable_protoword_tick),
      first_grammar_sequence_tick: asNullableNumber(langObj.first_grammar_sequence_tick),
      first_dialect_divergence_tick: asNullableNumber(langObj.first_dialect_divergence_tick),
      stable_protowords_count: asNumber(langObj.stable_protowords_count),
      stable_protowords: isObject(langObj.stable_protowords)
        ? (langObj.stable_protowords as Record<string, string>)
        : {},
      top_bigrams: Array.isArray(langObj.top_bigrams)
        ? (langObj.top_bigrams as Array<[string, number]>)
        : [],
      dialect_clusters: isObject(langObj.dialect_clusters)
        ? (langObj.dialect_clusters as Record<string, Record<string, number>>)
        : {},
      semantic_drift_events: asNumber(langObj.semantic_drift_events),
      intergenerational_transmissions: asNumber(langObj.intergenerational_transmissions),
      extinct_tokens_count: asNumber(langObj.extinct_tokens_count),
    },
    crime_and_stability: {
      total_crimes: asNumber(crimeObj.total_crimes),
      crimes_by_type: isObject(crimeObj.crimes_by_type)
        ? Object.fromEntries(Object.entries(crimeObj.crimes_by_type).map(([k, v]) => [k, asNumber(v)]))
        : {},
      crimes_per_1000_pop: asNumber(crimeObj.crimes_per_1000_pop),
      recent_180d_crimes_per_1000: asNumber(crimeObj.recent_180d_crimes_per_1000),
      murder_rate_per_1000: asNumber(crimeObj.murder_rate_per_1000),
      assault_rate_per_1000: asNumber(crimeObj.assault_rate_per_1000),
      theft_rate_per_1000: asNumber(crimeObj.theft_rate_per_1000),
      repeat_offenders_count: asNumber(crimeObj.repeat_offenders_count),
      known_crimes_sample: asNumber(crimeObj.known_crimes_sample),
      disputes_resolved: asNumber(crimeObj.disputes_resolved),
      dispute_resolution_rate: asNumber(crimeObj.dispute_resolution_rate),
      social_trust_index: asNumber(crimeObj.social_trust_index),
      stability_index: asNullableNumber(crimeObj.stability_index),
      sufficient_observation_window: Boolean(crimeObj.sufficient_observation_window),
      last_crime_tick: asNullableNumber(crimeObj.last_crime_tick),
      ticks_since_last_crime: asNullableNumber(crimeObj.ticks_since_last_crime),
      active_groups: asNumber(crimeObj.active_groups),
      total_barters: asNumber(crimeObj.total_barters),
      emergent_markets: asNumber(crimeObj.emergent_markets),
      collapsed_institutions: asNumber(crimeObj.collapsed_institutions),
      recent_crimes: normalizeCrimeRecords(crimeObj.recent_crimes),
      exchange_hubs: exchangeHubs,
    },
    groups: Array.isArray(input.groups)
      ? input.groups.filter(isObject).map((g) => {
          const rawNorms = Array.isArray(g.norm_rules)
            ? g.norm_rules
            : Array.isArray(g.norms)
              ? g.norms
              : [];
          return {
            group_id: asNumber(g.group_id),
            founded_tick: asNumber(g.founded_tick),
            member_ids: Array.from(new Set(asNumberArray(g.member_ids))),
            leader_id: asNullableNumber(g.leader_id),
            governance_type: asString(g.governance_type, 'informal'),
            norm_rules: rawNorms.filter((n): n is string => typeof n === 'string'),
            has_currency_token: Boolean(g.has_currency_token),
            last_election_tick: asNullableNumber(g.last_election_tick),
            next_election_tick: asNullableNumber(g.next_election_tick),
            active: typeof g.active === 'boolean' ? g.active : true,
          };
        })
      : [],
    history_layers: {
      milestones: isObject(histObj.milestones)
        ? Object.fromEntries(
            Object.entries(histObj.milestones).map(([k, v]) => [k, asNullableNumber(v)]),
          )
        : {},
      layer_1_ground_truth_tail: Array.isArray(histObj.layer_1_ground_truth_tail)
        ? histObj.layer_1_ground_truth_tail.filter(isObject).map((ev) => ({
            event_id: asNumber(ev.event_id),
            tick: asNumber(ev.tick),
            sim_date: asString(ev.sim_date),
            event_type: asString(ev.event_type),
            agent_ids: Array.from(new Set(asNumberArray(ev.agent_ids))),
            x: asNumber(ev.x),
            y: asNumber(ev.y),
            description: asString(ev.description),
            source: typeof ev.source === 'string' ? ev.source : undefined,
            certainty: typeof ev.certainty === 'number' ? ev.certainty : undefined,
            metadata: isObject(ev.metadata) ? ev.metadata : undefined,
          }))
        : [],
      layer_2_witness_accounts_tail: normalizeWitnessAccounts(histObj.layer_2_witness_accounts_tail),
      layer_2_surface_artifacts_count: asNumber(histObj.layer_2_surface_artifacts_count),
      layer_2_surface_artifacts: normalizeSurfaceArtifacts(histObj.layer_2_surface_artifacts),
      layer_3_interpretations_tail: normalizeGenerationalInterpretations(
        histObj.layer_3_interpretations_tail,
      ),
    },
    living_agents_full: livingAgentsFull,
    deceased_agents_archive: deceasedArchive,
    genealogy_nodes: genealogyNodes,
    timeline_series: Array.isArray(input.timeline_series)
      ? (input.timeline_series.filter(isObject) as unknown as ObservatorySnapshot['timeline_series'])
      : [],
  };
}

export function buildAgentLookupMap(snapshot: ObservatorySnapshot | null): Map<number, AnyAgentRecord> {
  const map = new Map<number, AnyAgentRecord>();
  if (!snapshot) return map;
  for (const ag of snapshot.living_agents_full) {
    map.set(ag.agent_id, ag);
  }
  for (const ag of snapshot.deceased_agents_archive) {
    if (!map.has(ag.agent_id)) {
      map.set(ag.agent_id, ag);
    }
  }
  return map;
}

export function formatDurationSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export interface AgentDiffSummary {
  bornIds: number[];
  newlyDeceasedIds: number[];
  persistedIds: number[];
}

export function computePopulationDiff(
  prev: ObservatorySnapshot | null,
  next: ObservatorySnapshot,
): AgentDiffSummary {
  const prevLiving = new Set((prev?.living_agents_full ?? []).map((a) => a.agent_id));
  const nextLiving = new Set(next.living_agents_full.map((a) => a.agent_id));

  const bornIds: number[] = [];
  const persistedIds: number[] = [];
  const newlyDeceasedIds: number[] = [];

  for (const id of nextLiving) {
    if (prevLiving.has(id)) persistedIds.push(id);
    else bornIds.push(id);
  }
  for (const id of prevLiving) {
    if (!nextLiving.has(id)) newlyDeceasedIds.push(id);
  }
  return {bornIds, newlyDeceasedIds, persistedIds};
}
