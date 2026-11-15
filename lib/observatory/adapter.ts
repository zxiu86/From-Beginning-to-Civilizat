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
  RegionalResourceSlice,
  ResourceFunnel,
  SimulationAnalyticsPayload,
  SpatialMemoryItem,
  StableProtowordEntry,
  SurfaceArtifactItem,
  TrainingAgentRow,
  TrainingAnalyticsPayload,
  TrainingAttemptRecord,
  TrainingStatsOnAgent,
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

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is string => typeof x === 'string');
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

function normalizeAgentTrainingStats(raw: unknown): TrainingStatsOnAgent | null {
  if (!isObject(raw)) return null;
  return {
    training_attempts: asNumber(raw.training_attempts ?? raw.attempts, 1),
    training_deaths: asNumber(raw.training_deaths ?? raw.deaths, 0),
    longest_survival_ticks: asNumber(raw.longest_survival_ticks, 0),
    avg_survival_ticks: asNumber(raw.avg_survival_ticks, 0),
    last_survival_ticks: asNumber(raw.last_survival_ticks ?? raw.current_survival_ticks, 0),
    last_cause_of_death:
      typeof raw.last_cause_of_death === 'string' ? raw.last_cause_of_death : null,
    food_discovered_count: asNumber(raw.food_discovered_count ?? raw.food_discovered, 0),
    food_reach_decisions_count: asNumber(raw.food_reach_decisions_count ?? raw.food_reach_decisions, 0),
    food_reached_count: asNumber(raw.food_reached_count ?? raw.food_physical_reaches_count ?? raw.food_reached, 0),
    food_consumed_count: asNumber(raw.food_consumed_count ?? raw.food_consumed, 0),
    water_discovered_count: asNumber(raw.water_discovered_count ?? raw.water_discovered, 0),
    water_reach_decisions_count: asNumber(raw.water_reach_decisions_count ?? raw.water_reach_decisions, 0),
    water_reached_count: asNumber(raw.water_reached_count ?? raw.water_physical_reaches_count ?? raw.water_reached, 0),
    water_consumed_count: asNumber(raw.water_consumed_count ?? raw.water_consumed, 0),
    learning_level_score: asNumber(raw.learning_level_score ?? raw.learning_level, 0),
    status: asString(raw.status, 'trained'),
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
  return raw.filter(isObject).map((item) => ({
    speaker_id: asNumber(item.speaker_id),
    token: asNumber(item.token),
    gesture: asNumber(item.gesture),
    x: asNumber(item.x),
    y: asNumber(item.y),
    tick: asNumber(item.tick),
    distance_m: asNumber(item.distance_m),
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
  const visionRadius = rawLp
    ? Math.max(10, asNumber(rawLp.vision_radius_m, isNight ? 54 : 120))
    : isNight
      ? 54
      : 120;
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
    parent_a_id:
      raw.parent_a_id !== undefined ? asNullableNumber(raw.parent_a_id) : gNode?.parent_a_id ?? null,
    parent_b_id:
      raw.parent_b_id !== undefined ? asNullableNumber(raw.parent_b_id) : gNode?.parent_b_id ?? null,
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
    training_stats: normalizeAgentTrainingStats(raw.training_stats),
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

function normalizeStableProtowords(raw: unknown): Record<string, StableProtowordEntry> {
  if (!isObject(raw)) return {};
  const result: Record<string, StableProtowordEntry> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (isObject(val)) {
      const tokVal =
        typeof val.token === 'number' || typeof val.token === 'string'
          ? val.token
          : key.startsWith('tok_')
            ? key.slice(4)
            : key;
      result[key] = {
        key,
        token: tokVal,
        context: asString(val.context, key),
        first_stabilized_tick: asNullableNumber(val.first_stabilized_tick),
        adopter_count: asNullableNumber(val.adopter_count),
        extinct: Boolean(val.extinct),
      };
    } else if (typeof val === 'string' || typeof val === 'number') {
      const isTokKey = key.startsWith('tok_');
      result[key] = {
        key,
        token: isTokKey ? key.slice(4) : String(val),
        context: isTokKey ? String(val) : key,
        first_stabilized_tick: null,
        adopter_count: null,
        extinct: false,
      };
    } else {
      result[key] = {
        key,
        token: key,
        context: key,
        first_stabilized_tick: null,
        adopter_count: null,
        extinct: false,
      };
    }
  }
  return result;
}

function normalizeDialectClusters(raw: unknown): Record<string, Record<string, number>> {
  if (!isObject(raw)) return {};
  const out: Record<string, Record<string, number>> = {};
  for (const [quad, mapVal] of Object.entries(raw)) {
    if (isObject(mapVal)) {
      const clean: Record<string, number> = {};
      for (const [ctx, tokVal] of Object.entries(mapVal)) {
        if (typeof tokVal === 'number' && Number.isFinite(tokVal)) {
          clean[ctx] = tokVal;
        }
      }
      out[quad] = clean;
    }
  }
  return out;
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

function normalizeFunnel(raw: unknown): ResourceFunnel {
  const obj = isObject(raw) ? raw : {};
  return {
    absent: asNumber(obj.absent, 0),
    present_undiscovered: asNumber(obj.present_undiscovered, 0),
    discovered_no_decision: asNumber(obj.discovered_no_decision, 0),
    decision_move_failed: asNumber(obj.decision_move_failed, 0),
    reached_consume_failed: asNumber(obj.reached_consume_failed, 0),
    consumed_success: asNumber(obj.consumed_success, 0),
  };
}

function categorizeDeathCauseClient(cause: string | null): string {
  if (!cause) return 'other';
  const c = cause.toLowerCase();
  if (c.includes('starv')) return 'starvation';
  if (c.includes('dehydrat')) return 'dehydration';
  if (c.includes('murder') || c.includes('assault') || c.includes('attack')) return 'murder';
  if (c.includes('predator')) return 'predator';
  if (c.includes('expos') || c.includes('frost') || c.includes('heat') || c.includes('weather')) return 'exposure';
  if (c.includes('old_age')) return 'old_age';
  if (c.includes('disease') || c.includes('illness')) return 'disease';
  if (c.includes('injury')) return 'injury';
  return 'other';
}

function normalizeNumberDict(raw: unknown): Record<string, number> {
  if (!isObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, asNumber(v, 0)]));
}

function normalizeAnalytics(
  raw: unknown,
  living: LivingAgentFull[],
  deceased: DeceasedAgentArchive[],
  demographics: ObservatorySnapshot['demographics'],
  eco: ObservatorySnapshot['ecosystem'],
  crime: ObservatorySnapshot['crime_and_stability'],
  lang: ObservatorySnapshot['emergent_language'],
  groups: ObservatorySnapshot['groups'],
  artifactsCount: number,
  terrain: WorldTerrainGrid | null,
  learningTelemetry: LearningTelemetryData,
): SimulationAnalyticsPayload {
  const hasEnginePayload = isObject(raw) && isObject(raw.population) && isObject(raw.survival);
  const rObj = isObject(raw) ? raw : {};

  // Always compute honest fallback strictly from real snapshot fields if raw.analytics is absent (e.g. legacy fixture)
  const allAgents: AnyAgentRecord[] = [...living, ...deceased];
  const maleCount = living.filter((a) => a.sex === 'M').length;
  const femaleCount = living.filter((a) => a.sex === 'F').length;
  const livingAges = living.map((a) => a.age_years);
  const genBreakdown: Record<string, number> = {};
  for (const ag of allAgents) {
    const gk = String(ag.generation);
    genBreakdown[gk] = (genBreakdown[gk] ?? 0) + 1;
  }

  const deadSpans = deceased.map((d) => Math.max(0, (d.death_tick ?? d.age_ticks) - d.birth_tick));
  const avgLifeTicks =
    deadSpans.length > 0
      ? Number((deadSpans.reduce((a, b) => a + b, 0) / deadSpans.length).toFixed(1))
      : 0;
  const maxLifeTicks =
    deadSpans.length > 0
      ? Math.max(...deadSpans)
      : living.length > 0
        ? Math.max(...living.map((a) => a.age_ticks))
        : 0;
  const minLifeTicks =
    deadSpans.length > 0
      ? Math.min(...deadSpans)
      : living.length > 0
        ? Math.min(...living.map((a) => a.age_ticks))
        : 0;

  const fallbackCauses: Record<string, number> = {
    starvation: 0,
    dehydration: 0,
    disease: 0,
    injury: 0,
    murder: 0,
    exposure: 0,
    predator: 0,
    old_age: 0,
    other: 0,
  };
  let premature = 0;
  for (const d of deceased) {
    const cat = categorizeDeathCauseClient(d.cause_of_death);
    fallbackCauses[cat] = (fallbackCauses[cat] ?? 0) + 1;
    if (cat !== 'old_age') premature += 1;
  }

  const fallbackRegional: Record<string, RegionalResourceSlice> = {
    NW: {food_biomass: 0, water_volume: 0, living_agents: 0},
    NE: {food_biomass: 0, water_volume: 0, living_agents: 0},
    SW: {food_biomass: 0, water_volume: 0, living_agents: 0},
    SE: {food_biomass: 0, water_volume: 0, living_agents: 0},
  };
  if (terrain) {
    const halfW = terrain.width_m * 0.5;
    const halfH = terrain.height_m * 0.5;
    for (let r = 0; r < terrain.rows; r++) {
      const wy = (r + 0.5) * terrain.cell_size_m;
      const ns = wy < halfH ? 'N' : 'S';
      for (let c = 0; c < terrain.cols; c++) {
        const wx = (c + 0.5) * terrain.cell_size_m;
        const ew = wx < halfW ? 'W' : 'E';
        const idx = r * terrain.cols + c;
        const slice = fallbackRegional[ns + ew];
        slice.food_biomass += terrain.food_flora[idx] ?? 0;
        slice.water_volume += terrain.water[idx] ?? 0;
      }
    }
    for (const a of living) {
      const ns = a.y < halfH ? 'N' : 'S';
      const ew = a.x < halfW ? 'W' : 'E';
      fallbackRegional[ns + ew].living_agents += 1;
    }
    for (const k of Object.keys(fallbackRegional)) {
      fallbackRegional[k].food_biomass = Number(fallbackRegional[k].food_biomass.toFixed(1));
      fallbackRegional[k].water_volume = Number(fallbackRegional[k].water_volume.toFixed(1));
    }
  }

  const popRaw = isObject(rObj.population) ? rObj.population : {};
  const survRaw = isObject(rObj.survival) ? rObj.survival : {};
  const fwRaw = isObject(rObj.food_water) ? rObj.food_water : {};
  const socRaw = isObject(rObj.social_civilization) ? rObj.social_civilization : {};
  const econRaw = isObject(rObj.economy) ? rObj.economy : {};
  const learnRaw = isObject(rObj.learning_intelligence) ? rObj.learning_intelligence : {};

  const denomPop = Math.max(1, (allAgents.length + living.length) * 0.5);
  const birthRate = Number(((demographics.births_total / denomPop) * 1000).toFixed(2));
  const deathRate = Number(((deceased.length / denomPop) * 1000).toFixed(2));

  const regOut: Record<string, RegionalResourceSlice> = {};
  if (isObject(fwRaw.regional_resources)) {
    for (const [k, v] of Object.entries(fwRaw.regional_resources)) {
      if (isObject(v)) {
        regOut[k] = {
          food_biomass: asNumber(v.food_biomass, 0),
          water_volume: asNumber(v.water_volume, 0),
          living_agents: asNumber(v.living_agents, 0),
        };
      }
    }
  }

  const storedFood = Number(
    living.reduce((acc, a) => acc + (a.inventory.food ?? 0), 0).toFixed(2),
  );
  const storedWood = Number(
    living.reduce((acc, a) => acc + (a.inventory.wood ?? 0), 0).toFixed(2),
  );
  const storedStone = Number(
    living.reduce((acc, a) => acc + (a.inventory.stone ?? 0), 0).toFixed(2),
  );
  const storedHerb = Number(
    living.reduce((acc, a) => acc + (a.inventory.herb ?? 0), 0).toFixed(2),
  );
  const storedTool = Number(
    living.reduce((acc, a) => acc + (a.inventory.tool ?? 0), 0).toFixed(2),
  );

  const econProdRaw = isObject(econRaw.resource_produced) ? econRaw.resource_produced : {};
  const econConsRaw = isObject(econRaw.resource_consumed) ? econRaw.resource_consumed : {};
  const econStorRaw = isObject(econRaw.resource_stored_inventories)
    ? econRaw.resource_stored_inventories
    : {};
  const wealthRaw = isObject(econRaw.wealth_distribution) ? econRaw.wealth_distribution : {};

  return {
    available_from_engine: hasEnginePayload,
    population: {
      total_ever_lived: asNumber(popRaw.total_ever_lived, allAgents.length || demographics.total_ever_born),
      living_count: asNumber(popRaw.living_count, living.length),
      deceased_count: asNumber(popRaw.deceased_count, deceased.length),
      births_total: asNumber(popRaw.births_total, demographics.births_total),
      male_count: asNumber(popRaw.male_count, maleCount),
      female_count: asNumber(popRaw.female_count, femaleCount),
      avg_age_years: asNumber(popRaw.avg_age_years, demographics.avg_age_years),
      youngest_living_age_years:
        popRaw.youngest_living_age_years !== undefined
          ? asNullableNumber(popRaw.youngest_living_age_years)
          : livingAges.length > 0
            ? Number(Math.min(...livingAges).toFixed(2))
            : null,
      oldest_living_age_years:
        popRaw.oldest_living_age_years !== undefined
          ? asNullableNumber(popRaw.oldest_living_age_years)
          : livingAges.length > 0
            ? Number(Math.max(...livingAges).toFixed(2))
            : null,
      birth_rate_per_1000: asNumber(popRaw.birth_rate_per_1000, birthRate),
      death_rate_per_1000: asNumber(popRaw.death_rate_per_1000, deathRate),
      net_growth_rate_per_1000: asNumber(
        popRaw.net_growth_rate_per_1000,
        Number((birthRate - deathRate).toFixed(2)),
      ),
      max_generation: asNumber(popRaw.max_generation, demographics.max_generation),
      generations_breakdown: isObject(popRaw.generations_breakdown)
        ? normalizeNumberDict(popRaw.generations_breakdown)
        : genBreakdown,
      family_units_count: asNumber(
        popRaw.family_units_count,
        living.filter((a) => a.children_ids.length > 0).length,
      ),
      avg_family_size: asNumber(popRaw.avg_family_size, 0),
      independent_adults_count: asNumber(
        popRaw.independent_adults_count,
        living.filter((a) => a.life_stage === 'adult' || a.life_stage === 'elder').length,
      ),
      dependents_count: asNumber(
        popRaw.dependents_count,
        living.filter((a) => a.life_stage === 'infant' || a.life_stage === 'child').length,
      ),
    },
    survival: {
      avg_lifespan_ticks: asNumber(survRaw.avg_lifespan_ticks, avgLifeTicks),
      avg_lifespan_years: asNumber(survRaw.avg_lifespan_years, Number((avgLifeTicks / 360).toFixed(2))),
      longest_lifespan_ticks: asNumber(survRaw.longest_lifespan_ticks, maxLifeTicks),
      longest_lifespan_years: asNumber(
        survRaw.longest_lifespan_years,
        Number((maxLifeTicks / 360).toFixed(2)),
      ),
      shortest_lifespan_ticks: asNumber(survRaw.shortest_lifespan_ticks, minLifeTicks),
      shortest_lifespan_years: asNumber(
        survRaw.shortest_lifespan_years,
        Number((minLifeTicks / 360).toFixed(2)),
      ),
      premature_deaths_count: asNumber(survRaw.premature_deaths_count, premature),
      premature_death_rate_pct: asNumber(
        survRaw.premature_death_rate_pct,
        deceased.length > 0 ? Number(((premature / deceased.length) * 100).toFixed(1)) : 0,
      ),
      deaths_by_cause: isObject(survRaw.deaths_by_cause)
        ? normalizeNumberDict(survRaw.deaths_by_cause)
        : fallbackCauses,
      natural_deaths_count: asNumber(
        survRaw.natural_deaths_count,
        fallbackCauses.old_age +
          fallbackCauses.disease +
          fallbackCauses.exposure +
          fallbackCauses.starvation +
          fallbackCauses.dehydration,
      ),
      violent_deaths_count: asNumber(
        survRaw.violent_deaths_count,
        fallbackCauses.murder + fallbackCauses.predator + fallbackCauses.injury,
      ),
      avg_survival_by_generation_ticks: normalizeNumberDict(survRaw.avg_survival_by_generation_ticks),
    },
    food_water: {
      total_food_biomass: asNumber(fwRaw.total_food_biomass, eco.total_food_biomass),
      available_consumable_food: asNumber(fwRaw.available_consumable_food, eco.total_food_biomass),
      food_consumed_total: asNumber(fwRaw.food_consumed_total, 0),
      food_consumption_rate_per_tick: asNumber(fwRaw.food_consumption_rate_per_tick, 0),
      total_water_volume: asNumber(
        fwRaw.total_water_volume,
        terrain ? Number(terrain.water.reduce((a, b) => a + b, 0).toFixed(2)) : 0,
      ),
      available_water_sources: asNumber(
        fwRaw.available_water_sources,
        terrain ? terrain.water.filter((w) => w > 0.25).length : 0,
      ),
      water_consumed_total: asNumber(fwRaw.water_consumed_total, 0),
      water_consumption_rate_per_tick: asNumber(fwRaw.water_consumption_rate_per_tick, 0),
      agents_experienced_hunger: asNumber(
        fwRaw.agents_experienced_hunger,
        living.filter((a) => a.hunger >= 0.5).length,
      ),
      agents_experienced_thirst: asNumber(
        fwRaw.agents_experienced_thirst,
        living.filter((a) => a.thirst >= 0.5).length,
      ),
      avg_hunger_duration_ticks: asNumber(fwRaw.avg_hunger_duration_ticks, 0),
      avg_thirst_duration_ticks: asNumber(fwRaw.avg_thirst_duration_ticks, 0),
      starvation_deaths: asNumber(fwRaw.starvation_deaths, fallbackCauses.starvation),
      dehydration_deaths: asNumber(fwRaw.dehydration_deaths, fallbackCauses.dehydration),
      nearby_food_reach_failures: asNumber(fwRaw.nearby_food_reach_failures, 0),
      nearby_water_reach_failures: asNumber(fwRaw.nearby_water_reach_failures, 0),
      food_funnel: normalizeFunnel(fwRaw.food_funnel),
      water_funnel: normalizeFunnel(fwRaw.water_funnel),
      regional_resources:
        Object.keys(regOut).length > 0 ? regOut : fallbackRegional,
    },
    social_civilization: {
      social_ties_count: asNumber(
        socRaw.social_ties_count,
        Math.floor(allAgents.reduce((acc, a) => acc + a.social_ties.length, 0) / 2),
      ),
      active_groups_count: asNumber(
        socRaw.active_groups_count,
        groups.filter((g) => g.active).length,
      ),
      cooperation_events: asNumber(socRaw.cooperation_events, 0),
      mutual_aid_events: asNumber(socRaw.mutual_aid_events, 0),
      teaching_events: asNumber(socRaw.teaching_events, 0),
      knowledge_transfer_events: asNumber(
        socRaw.knowledge_transfer_events,
        lang.intergenerational_transmissions,
      ),
      conflicts_count: asNumber(
        socRaw.conflicts_count,
        (crime.crimes_by_type.assault ?? 0) + (crime.crimes_by_type.murder ?? 0),
      ),
      crimes_total: asNumber(socRaw.crimes_total, crime.total_crimes),
      crimes_by_type: isObject(socRaw.crimes_by_type)
        ? normalizeNumberDict(socRaw.crimes_by_type)
        : crime.crimes_by_type,
      active_language_tokens: asNumber(
        socRaw.active_language_tokens,
        new Set(living.flatMap((a) => Object.keys(a.lexicon))).size,
      ),
      stable_protowords_count: asNumber(
        socRaw.stable_protowords_count,
        lang.stable_protowords_count,
      ),
      surface_artifacts_count: asNumber(socRaw.surface_artifacts_count, artifactsCount),
      cultivation_events: asNumber(socRaw.cultivation_events, 0),
      barters_count: asNumber(socRaw.barters_count, crime.total_barters),
      emergent_markets_count: asNumber(socRaw.emergent_markets_count, crime.emergent_markets),
      norms_count: asNumber(
        socRaw.norms_count,
        groups.filter((g) => g.active).reduce((acc, g) => acc + g.norm_rules.length, 0),
      ),
      governance_structures_count: asNumber(
        socRaw.governance_structures_count,
        groups.filter((g) => g.active && g.governance_type !== 'informal').length,
      ),
    },
    economy: {
      resource_produced: {
        food_cultivated: asNumber(econProdRaw.food_cultivated, 0),
        wood_gathered: asNumber(econProdRaw.wood_gathered, 0),
        stone_gathered: asNumber(econProdRaw.stone_gathered, 0),
        herb_gathered: asNumber(econProdRaw.herb_gathered, 0),
        tools_crafted: asNumber(econProdRaw.tools_crafted, 0),
      },
      resource_consumed: {
        food: asNumber(econConsRaw.food, 0),
        water: asNumber(econConsRaw.water, 0),
      },
      resource_stored_inventories: {
        food: asNumber(econStorRaw.food, storedFood),
        wood: asNumber(econStorRaw.wood, storedWood),
        stone: asNumber(econStorRaw.stone, storedStone),
        herb: asNumber(econStorRaw.herb, storedHerb),
        tool: asNumber(econStorRaw.tool, storedTool),
      },
      scarce_resources: asStringArray(econRaw.scarce_resources),
      wealth_distribution: {
        gini_inventory: asNumber(wealthRaw.gini_inventory, 0),
        median_inventory: asNumber(wealthRaw.median_inventory, 0),
        max_inventory: asNumber(wealthRaw.max_inventory, 0),
        top10_share_pct: asNumber(wealthRaw.top10_share_pct, 0),
      },
    },
    learning_intelligence: {
      total_experiences_stored: asNumber(learnRaw.total_experiences_stored, 0),
      total_brain_updates: asNumber(
        learnRaw.total_brain_updates,
        Math.round(learningTelemetry.avg_updates_per_agent * learningTelemetry.agents_with_updates),
      ),
      total_skills_acquired: asNumber(
        learnRaw.total_skills_acquired,
        allAgents.reduce((acc, a) => acc + Object.keys(a.skills).length, 0),
      ),
      avg_skills_per_agent: asNumber(
        learnRaw.avg_skills_per_agent,
        allAgents.length > 0
          ? Number(
              (
                allAgents.reduce((acc, a) => acc + Object.keys(a.skills).length, 0) /
                allAgents.length
              ).toFixed(2),
            )
          : 0,
      ),
      food_discovery_events: asNumber(learnRaw.food_discovery_events, 0),
      food_reach_events: asNumber(learnRaw.food_reach_events, 0),
      water_discovery_events: asNumber(learnRaw.water_discovery_events, 0),
      water_reach_events: asNumber(learnRaw.water_reach_events, 0),
      episodic_memories_total: asNumber(
        learnRaw.episodic_memories_total,
        allAgents.reduce((acc, a) => acc + a.episodic_memories.length, 0),
      ),
      spatial_memories_total: asNumber(
        learnRaw.spatial_memories_total,
        living.reduce((acc, a) => acc + a.spatial_memories.length, 0),
      ),
      intergenerational_transfers: asNumber(
        learnRaw.intergenerational_transfers,
        lang.intergenerational_transmissions,
      ),
      individual_updates_std_dev: asNumber(learnRaw.individual_updates_std_dev, 0),
      individual_reward_std_dev: asNumber(learnRaw.individual_reward_std_dev, 0),
      repeated_failed_actions: asNumber(learnRaw.repeated_failed_actions, 0),
      post_negative_decision_switches: asNumber(learnRaw.post_negative_decision_switches, 0),
      telemetry_scope_note: asString(
        learnRaw.telemetry_scope_note,
        'Statistical RL optimization metrics only — not general consciousness.',
      ),
    },
  };
}

function normalizeTrainingAnalytics(raw: unknown): TrainingAnalyticsPayload | null {
  if (!isObject(raw)) return null;
  const stageTotalsRaw = isObject(raw.stage_totals) ? raw.stage_totals : {};
  const agentsRaw = Array.isArray(raw.agents) ? raw.agents.filter(isObject) : [];

  const agents: TrainingAgentRow[] = agentsRaw.map((ag) => {
    const rawHist = Array.isArray(ag.attempt_history)
      ? ag.attempt_history
      : Array.isArray(ag.recent_attempts)
        ? ag.recent_attempts
        : [];
    const histRaw = rawHist.filter(isObject);
    const attemptHistory: TrainingAttemptRecord[] = histRaw.map((h) => ({
      attempt: asNumber(h.attempt, 1),
      death_tick: asNumber(h.death_tick ?? h.death_global_tick, 0),
      survival_ticks: asNumber(h.survival_ticks, 0),
      cause: asString(h.cause ?? h.cause_of_death, 'unknown'),
      perceived_cues: asStringArray(h.perceived_cues),
      last_action: asString(h.last_action, 'rest'),
    }));

    return {
      agent_id: asNumber(ag.agent_id, 0),
      sex: asString(ag.sex, 'F'),
      attempts: asNumber(ag.attempts ?? ag.training_attempts, 1),
      deaths: asNumber(ag.deaths ?? ag.training_deaths, 0),
      longest_survival_ticks: asNumber(ag.longest_survival_ticks, 0),
      avg_survival_ticks: asNumber(ag.avg_survival_ticks, 0),
      last_survival_ticks: asNumber(ag.last_survival_ticks ?? ag.current_survival_ticks, 0),
      last_cause_of_death:
        typeof ag.last_cause_of_death === 'string' ? ag.last_cause_of_death : null,
      food_discovered: asNumber(ag.food_discovered ?? ag.food_discovered_count, 0),
      food_reach_decisions: asNumber(ag.food_reach_decisions ?? ag.food_reach_decisions_count, 0),
      food_reached: asNumber(ag.food_reached ?? ag.food_physical_reaches_count ?? ag.food_reached_count, 0),
      food_consumed: asNumber(ag.food_consumed ?? ag.food_consumed_count, 0),
      water_discovered: asNumber(ag.water_discovered ?? ag.water_discovered_count, 0),
      water_reach_decisions: asNumber(ag.water_reach_decisions ?? ag.water_reach_decisions_count, 0),
      water_reached: asNumber(ag.water_reached ?? ag.water_physical_reaches_count ?? ag.water_reached_count, 0),
      water_consumed: asNumber(ag.water_consumed ?? ag.water_consumed_count, 0),
      skills_count: asNumber(ag.skills_count, 0),
      episodic_memories_count: asNumber(ag.episodic_memories_count, 0),
      spatial_memories_count: asNumber(ag.spatial_memories_count, 0),
      brain_updates: asNumber(ag.brain_updates, 0),
      learning_level_score: asNumber(ag.learning_level_score ?? ag.learning_level, 0),
      mean_recent_reward: asNumber(ag.mean_recent_reward, 0),
      status: asString(ag.status, 'alive'),
      attempt_history: attemptHistory,
    };
  });

  const progRaw = Array.isArray(raw.attempt_progression)
    ? raw.attempt_progression.filter(isObject)
    : [];

  return {
    system_name: asString(raw.system_name, 'Isolated Survival Training System'),
    phase: asString(raw.phase, 'training'),
    agent_count: asNumber(raw.agent_count, agents.length),
    training_ticks_executed: asNumber(raw.training_ticks_executed ?? raw.training_tick, 0),
    total_attempts: asNumber(raw.total_attempts, 0),
    total_deaths: asNumber(raw.total_deaths, 0),
    survival_avg_ticks: asNumber(raw.survival_avg_ticks ?? raw.avg_survival_ticks, 0),
    longest_survival_ticks: asNumber(raw.longest_survival_ticks ?? raw.max_longest_survival_ticks, 0),
    stage_totals: {
      food_discovered: asNumber(stageTotalsRaw.food_discovered, 0),
      food_reach_decisions: asNumber(stageTotalsRaw.food_reach_decisions, 0),
      food_reached: asNumber(stageTotalsRaw.food_reached ?? stageTotalsRaw.food_physical_reaches, 0),
      food_consumed: asNumber(stageTotalsRaw.food_consumed, 0),
      water_discovered: asNumber(stageTotalsRaw.water_discovered, 0),
      water_reach_decisions: asNumber(stageTotalsRaw.water_reach_decisions, 0),
      water_reached: asNumber(stageTotalsRaw.water_reached ?? stageTotalsRaw.water_physical_reaches, 0),
      water_consumed: asNumber(stageTotalsRaw.water_consumed, 0),
    },
    death_causes_breakdown: normalizeNumberDict(raw.death_causes_breakdown),
    attempt_progression: progRaw.map((p) => ({
      tick: asNumber(p.tick, 0),
      total_deaths: asNumber(p.total_deaths, 0),
      avg_survival_ticks: asNumber(p.avg_survival_ticks ?? p.avg_longest_survival_ticks ?? p.avg_current_survival_ticks, 0),
      food_consumed_total: asNumber(p.food_consumed_total ?? p.food_consumed_events, 0),
      water_consumed_total: asNumber(p.water_consumed_total ?? p.water_consumed_events, 0),
      total_brain_updates: asNumber(p.total_brain_updates, 0),
    })),
    agents,
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
    throw new SnapshotValidationError(
      'Missing core engine sections (clock, demographics, or history_layers).',
    );
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
  const genealogyMap = new Map<number, GenealogyNodeItem>(
    genealogyNodes.map((g) => [g.agent_id, g]),
  );

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
        training_stats: normalizeAgentTrainingStats(d.training_stats),
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
        training_stats: null,
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
    ? (crimeObj.exchange_hubs.filter(
        isObject,
      ) as unknown as ObservatorySnapshot['crime_and_stability']['exchange_hubs'])
    : [];

  const normalizedTerrain = normalizeTerrain(input.world_terrain);

  const normalizedDemographics: ObservatorySnapshot['demographics'] = {
    living_count: asNumber(demoObj.living_count, livingAgentsFull.length),
    deceased_count: asNumber(demoObj.deceased_count, deceasedArchive.length),
    total_ever_born: asNumber(
      demoObj.total_ever_born,
      livingAgentsFull.length + deceasedArchive.length,
    ),
    births_total: asNumber(demoObj.births_total),
    deaths_total: asNumber(demoObj.deaths_total, deceasedArchive.length),
    max_generation: asNumber(demoObj.max_generation),
    avg_age_years: asNumber(demoObj.avg_age_years),
    age_distribution: isObject(demoObj.age_distribution)
      ? Object.fromEntries(
          Object.entries(demoObj.age_distribution).map(([k, v]) => [k, asNumber(v)]),
        )
      : {},
    discovered_techs: discoveredTechs,
  };

  const normalizedEcosystem: ObservatorySnapshot['ecosystem'] = {
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
  };

  const normalizedLang: ObservatorySnapshot['emergent_language'] = {
    first_communication_tick: asNullableNumber(langObj.first_communication_tick),
    first_repeated_signal_tick: asNullableNumber(langObj.first_repeated_signal_tick),
    first_shared_symbol_tick: asNullableNumber(langObj.first_shared_symbol_tick),
    first_stable_protoword_tick: asNullableNumber(langObj.first_stable_protoword_tick),
    first_grammar_sequence_tick: asNullableNumber(langObj.first_grammar_sequence_tick),
    first_dialect_divergence_tick: asNullableNumber(langObj.first_dialect_divergence_tick),
    stable_protowords_count: asNumber(langObj.stable_protowords_count),
    stable_protowords: normalizeStableProtowords(langObj.stable_protowords),
    top_bigrams: Array.isArray(langObj.top_bigrams)
      ? langObj.top_bigrams
          .filter((item): item is [unknown, unknown] => Array.isArray(item) && item.length >= 2)
          .map(([seq, cnt]) => [String(seq), asNumber(cnt)])
      : [],
    dialect_clusters: normalizeDialectClusters(langObj.dialect_clusters),
    semantic_drift_events: asNumber(langObj.semantic_drift_events),
    intergenerational_transmissions: asNumber(langObj.intergenerational_transmissions),
    extinct_tokens_count: asNumber(langObj.extinct_tokens_count),
  };

  const normalizedCrime: ObservatorySnapshot['crime_and_stability'] = {
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
  };

  const normalizedGroups: ObservatorySnapshot['groups'] = Array.isArray(input.groups)
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
    : [];

  const artifactsCount = asNumber(histObj.layer_2_surface_artifacts_count);
  const normalizedLearningTelemetry = normalizeLearningTelemetry(
    input.learning_telemetry,
    livingAgentsFull.length,
  );
  const normalizedAnalytics = normalizeAnalytics(
    input.analytics,
    livingAgentsFull,
    deceasedArchive,
    normalizedDemographics,
    normalizedEcosystem,
    normalizedCrime,
    normalizedLang,
    normalizedGroups,
    artifactsCount,
    normalizedTerrain,
    normalizedLearningTelemetry,
  );

  const normalizedTraining = normalizeTrainingAnalytics(input.training_analytics);
  const simPhase = asString(
    input.simulation_phase,
    normalizedTraining && input.timeline_kind === 'isolated_training' ? 'training' : 'civilization',
  );

  return {
    export_schema_version: asString(input.export_schema_version, '1.0.0'),
    exported_at_utc: asString(input.exported_at_utc, new Date().toISOString()),
    simulation_phase: simPhase,
    world_id: input.world_id,
    timeline_id: asString(input.timeline_id, input.world_id),
    parent_timeline_id:
      typeof input.parent_timeline_id === 'string' ? input.parent_timeline_id : null,
    timeline_kind: asString(input.timeline_kind, 'original'),
    branch_point_tick: asNullableNumber(input.branch_point_tick),
    rebirth_records: normalizeRebirthRecords(input.rebirth_records),
    recovery_state: normalizeRecoveryState(input.recovery_state),
    learning_telemetry: normalizedLearningTelemetry,
    analytics: normalizedAnalytics,
    training_analytics: normalizedTraining,
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
        typeof capObj.has_market_hubs === 'boolean'
          ? capObj.has_market_hubs
          : exchangeHubs.length > 0,
    },
    world_terrain: normalizedTerrain,
    demographics: normalizedDemographics,
    ecosystem: normalizedEcosystem,
    emergent_language: normalizedLang,
    crime_and_stability: normalizedCrime,
    groups: normalizedGroups,
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
      layer_2_witness_accounts_tail: normalizeWitnessAccounts(
        histObj.layer_2_witness_accounts_tail,
      ),
      layer_2_surface_artifacts_count: artifactsCount,
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
