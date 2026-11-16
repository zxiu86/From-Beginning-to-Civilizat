export type Locale = 'ar' | 'en';
export type SnapshotSourceMode = 'empty' | 'published' | 'uploaded' | 'test_fixture' | 'live_runner';
export type ObservatorySection =
  | 'overview'
  | 'population'
  | 'survival'
  | 'resources'
  | 'civilization'
  | 'learning'
  | 'training'
  | 'history';

export type ActiveDrawer = ObservatorySection | null;

export interface SimClockData {
  tick: number;
  year: number;
  month: number;
  day: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter' | string;
  is_night: boolean;
  sim_date: string;
  real_elapsed_seconds: number;
  real_seconds_per_sim_month: number;
}

export interface EngineCapabilities {
  has_buildings_grid: boolean;
  has_roads_grid: boolean;
  has_farms_grid: boolean;
  has_shelter_tech_milestone: boolean;
  has_market_hubs: boolean;
}

export interface WorldTerrainGrid {
  width_m: number;
  height_m: number;
  cell_size_m: number;
  cols: number;
  rows: number;
  elevation: number[];
  water: number[];
  moisture: number[];
  fertility: number[];
  food_flora: number[];
  wood_flora: number[];
  herb_flora: number[];
  stone_mineral: number[];
}

export interface WeatherStateData {
  condition: string;
  temperature_c: number;
  rainfall_mm: number;
  wind_mps: number;
  drought_streak_days: number;
  flood_severity: number;
  disease_pressure: number;
}

export interface FaunaData {
  fauna_id: number;
  species: 'herbivore' | 'predator' | string;
  x: number;
  y: number;
  energy: number;
  health: number;
  age_ticks: number;
}

export interface EcosystemSummary {
  total_food_biomass: number;
  total_wood_biomass: number;
  total_herb_biomass: number;
  total_stone_mineral: number;
  avg_soil_moisture: number;
  herbivores_alive: number;
  predators_alive: number;
  weather: WeatherStateData;
  fauna: FaunaData[];
}

export interface AgentTraits {
  boldness: number;
  empathy: number;
  curiosity: number;
  aggression: number;
  cooperation: number;
}

export interface EpisodicMemoryItem {
  tick: number;
  event_type: string;
  other_agent_id: number | null;
  x: number;
  y: number;
  valence: number;
  note: string;
}

export interface SpatialMemoryItem {
  x: number;
  y: number;
  resource_kind: string;
  estimated_amount: number;
  last_seen_tick: number;
}

export interface SocialTieItem {
  agent_id: number;
  familiarity: number;
  trust: number;
}

export interface HeardEmissionItem {
  speaker_id: number;
  token: number;
  gesture: number;
  x: number;
  y: number;
  tick: number;
  distance_m: number;
}

export interface LocalPerceptionData {
  vision_radius_m: number;
  hearing_radius_m: number;
  visible_agent_ids: number[];
  visible_artifact_ids: number[];
  visible_fauna_ids: number[];
  local_water: number;
  local_food: number;
  local_wood: number;
  local_stone: number;
  local_herb: number;
  heard_emissions: HeardEmissionItem[];
}

export interface DeathPenaltyRecord {
  applied: boolean;
  cause?: string;
  death_tick?: number;
  perceived_cues?: string[];
  evidence_count?: number;
  mean_advantage?: number;
  loss_value?: number;
  pre_weight_fingerprint?: string;
  post_weight_fingerprint?: string;
  note?: string;
  medical_knowledge_added?: boolean;
}

export interface RebirthRecordItem {
  agent_id: number;
  generation: number;
  birth_tick: number;
  original_death_tick: number | null;
  original_cause_of_death: string | null;
  rebirth_tick: number;
  rebirth_date: string;
  rebirth_count: number;
  preserved_age_ticks: number;
  brain_fingerprint: string;
  episodic_memories_kept: number;
  spatial_memories_kept: number;
  death_penalty_applied: boolean;
  death_penalty_record: DeathPenaltyRecord | null;
}

export interface TrainingStatsOnAgent {
  training_attempts: number;
  training_deaths: number;
  longest_survival_ticks: number;
  avg_survival_ticks: number;
  last_survival_ticks: number;
  last_cause_of_death: string | null;
  food_discovered_count: number;
  food_reach_decisions_count: number;
  food_reached_count: number;
  food_consumed_count: number;
  water_discovered_count: number;
  water_reach_decisions_count: number;
  water_reached_count: number;
  water_consumed_count: number;
  learning_level_score: number;
  status: string;
}

export interface ActionOutcomeStat {
  count: number;
  ema_reward: number;
}

export interface AgentNeuralNetworkInfo {
  architecture: string;
  obs_dim: number;
  hidden_dim: number;
  num_actions: number;
  num_signals: number;
  learning_rate: number;
  backend: string;
  optimizer: string;
  parameter_count: number;
  total_updates: number;
  experience_buffer_len: number;
  experience_buffer_capacity: number;
  last_loss: number;
  value_loss: number;
  mean_td_error: number;
  policy_entropy: number;
  mean_recent_reward: number;
  weight_l2_norm: number;
  hidden_state_l2_norm: number;
  hidden_state_mean_abs: number;
  weight_fingerprint: string;
  recent_contexts: Record<string, number>;
  death_penalty_count: number;
  death_penalty_history?: Array<Record<string, unknown>>;
}

export interface LivingAgentFull {
  agent_id: number;
  sex: 'F' | 'M' | string;
  x: number;
  y: number;
  birth_tick: number;
  generation: number;
  parent_a_id: number | null;
  parent_b_id: number | null;
  children_ids: number[];
  is_alive: true;
  age_ticks: number;
  age_years: number;
  life_stage: 'infant' | 'child' | 'adult' | 'elder' | string;
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  injury: number;
  disease_load: number;
  is_pregnant: boolean;
  gestation_ticks: number;
  last_action: string;
  last_emitted_token: number | null;
  carried_item: string | null;
  last_partner_id: number | null;
  rebirth_count: number;
  rebirth_tick: number | null;
  original_death_tick: number | null;
  original_death_date: string | null;
  original_cause_of_death: string | null;
  death_penalty_record: DeathPenaltyRecord | null;
  brain_fingerprint: string | null;
  neural_network: AgentNeuralNetworkInfo | null;
  training_stats?: TrainingStatsOnAgent | null;
  traits: AgentTraits;
  inventory: Record<string, number>;
  skills: Record<string, number>;
  action_outcomes: Record<string, ActionOutcomeStat>;
  lexicon_size: number;
  lexicon: Record<string, Record<string, number>>;
  episodic_memories: EpisodicMemoryItem[];
  spatial_memories: SpatialMemoryItem[];
  spatial_summary: Record<string, number>;
  social_ties: SocialTieItem[];
  local_perception: LocalPerceptionData;
}

export interface DeceasedAgentArchive {
  agent_id: number;
  sex: 'F' | 'M' | string;
  x: number;
  y: number;
  birth_tick: number;
  death_tick: number | null;
  cause_of_death: string | null;
  age_ticks: number;
  age_years: number;
  life_stage: string;
  generation: number;
  parent_a_id: number | null;
  parent_b_id: number | null;
  children_ids: number[];
  is_alive: false;
  last_action: string;
  rebirth_count: number;
  rebirth_tick: number | null;
  original_death_tick: number | null;
  original_death_date: string | null;
  original_cause_of_death: string | null;
  death_penalty_record: DeathPenaltyRecord | null;
  brain_fingerprint: string | null;
  neural_network: AgentNeuralNetworkInfo | null;
  training_stats?: TrainingStatsOnAgent | null;
  traits: AgentTraits;
  skills: Record<string, number>;
  action_outcomes: Record<string, ActionOutcomeStat>;
  lexicon_size: number;
  episodic_memories: EpisodicMemoryItem[];
  social_ties: SocialTieItem[];
}

export type AnyAgentRecord = LivingAgentFull | DeceasedAgentArchive;

export interface StableProtowordEntry {
  key: string;
  token: number | string;
  context: string;
  first_stabilized_tick: number | null;
  adopter_count: number | null;
  extinct: boolean;
}

export interface EmergentLanguageData {
  first_communication_tick: number | null;
  first_repeated_signal_tick: number | null;
  first_shared_symbol_tick: number | null;
  first_stable_protoword_tick: number | null;
  first_grammar_sequence_tick: number | null;
  first_dialect_divergence_tick: number | null;
  stable_protowords_count: number;
  stable_protowords: Record<string, StableProtowordEntry>;
  top_bigrams: Array<[string, number]>;
  dialect_clusters: Record<string, Record<string, number>>;
  semantic_drift_events: number;
  intergenerational_transmissions: number;
  extinct_tokens_count: number;
}

export interface CrimeRecordItem {
  crime_id: number;
  tick: number;
  crime_type: string;
  perpetrator_id: number;
  victim_id: number | null;
  x: number;
  y: number;
  known_to_society: boolean;
  punished: boolean;
  resolution_type?: string | null;
}

export interface ExchangeHubItem {
  x: number;
  y: number;
  count: number;
  is_market: boolean;
}

export interface CrimeAndStabilityData {
  total_crimes: number;
  crimes_by_type: Record<string, number>;
  crimes_per_1000_pop: number;
  recent_180d_crimes_per_1000: number;
  murder_rate_per_1000: number;
  assault_rate_per_1000: number;
  theft_rate_per_1000: number;
  repeat_offenders_count: number;
  known_crimes_sample: number;
  disputes_resolved: number;
  dispute_resolution_rate: number;
  social_trust_index: number;
  stability_index: number | null;
  sufficient_observation_window: boolean;
  last_crime_tick: number | null;
  ticks_since_last_crime: number | null;
  active_groups: number;
  total_barters: number;
  emergent_markets: number;
  collapsed_institutions: number;
  recent_crimes: CrimeRecordItem[];
  exchange_hubs: ExchangeHubItem[];
}

export interface SocialGroupItem {
  group_id: number;
  founded_tick: number;
  member_ids: number[];
  leader_id: number | null;
  governance_type: string;
  norm_rules: string[];
  has_currency_token: boolean;
  last_election_tick: number | null;
  next_election_tick: number | null;
  active: boolean;
}

export interface TruthEventItem {
  event_id: number;
  tick: number;
  sim_date: string;
  event_type: string;
  agent_ids: number[];
  x: number;
  y: number;
  description: string;
  source?: string;
  certainty?: number;
  metadata?: Record<string, unknown>;
}

export interface WitnessAccountItem {
  account_id: number;
  tick: number;
  witness_agent_id: number;
  subject_agent_ids: number[];
  perceived_type: string;
  x: number;
  y: number;
  confidence: number;
  distorted: boolean;
  distortion_score: number;
  artifact_id: number | null;
  summary: string;
}

export interface SurfaceArtifactItem {
  artifact_id: number;
  created_tick: number;
  author_agent_id: number;
  x: number;
  y: number;
  artifact_kind: 'earth_mark' | 'stone_carving' | 'tablet' | string;
  symbol_tokens: number[];
  topic: string;
  integrity: number;
}

export interface GenerationalInterpretationItem {
  interpretation_id: number;
  tick: number;
  generation: number;
  interpreter_agent_id: number;
  source_artifact_id: number | null;
  inferred_topic: string;
  belief_narrative: string;
  accuracy_estimate: number;
  belief_confidence: number;
  is_revisionist: boolean;
}

export interface HistoryLayersData {
  milestones: Record<string, number | null>;
  layer_1_ground_truth_tail: TruthEventItem[];
  layer_2_witness_accounts_tail: WitnessAccountItem[];
  layer_2_surface_artifacts_count: number;
  layer_2_surface_artifacts: SurfaceArtifactItem[];
  layer_3_interpretations_tail: GenerationalInterpretationItem[];
}

export interface GenealogyNodeItem {
  agent_id: number;
  birth_tick: number;
  death_tick: number | null;
  is_alive: boolean;
  cause_of_death: string | null;
  parent_a_id: number | null;
  parent_b_id: number | null;
  children_ids: number[];
}

export interface TimelinePoint {
  tick: number;
  sim_date: string;
  sim_year: number;
  season: string;
  living_count: number;
  deceased_count: number;
  births_total: number;
  food_total: number;
  water_total: number;
  wood_total: number;
  herbivores: number;
  predators: number;
  active_tokens: number;
  protowords: number;
  groups_count: number;
  crime_rate_per_1000: number;
  crimes_per_1000_pop?: number;
  barters: number;
}

export interface DemographicsData {
  living_count: number;
  deceased_count: number;
  total_ever_born: number;
  births_total: number;
  deaths_total: number;
  max_generation: number;
  avg_age_years: number;
  age_distribution: Record<string, number>;
  discovered_techs: Record<string, number>;
}

export interface PopulationRecoveryCycleItem {
  cycle_number: number;
  previous_cycle_number: number;
  extinction_tick: number;
  extinction_date: string;
  deaths_in_previous_cycle: number;
  death_causes: Record<string, number>;
  pre_recovery_archive: string | null;
  recovery_tick: number;
  recovery_date: string;
  new_agent_ids: number[];
  post_recovery_population: number;
  subsequent_births: number;
  survival_duration_ticks: number;
  outcome: 'active' | 'grew' | 're_extinct' | string;
  final_extinction_tick?: number;
  final_extinction_date?: string;
}

export interface RecoveryStateData {
  auto_recover_on_extinction: boolean;
  recovery_founder_count: number;
  recovery_cycle_count: number;
  current_cycle_number: number;
  current_cycle_start_tick: number;
  population_recovery_history: PopulationRecoveryCycleItem[];
}

export interface AggregatedActionOutcomeItem {
  action: string;
  total_trials: number;
  weighted_avg_reward: number;
  agents_count: number;
}

export interface SkillSummaryItem {
  skill: string;
  avg: number;
  max: number;
  trained_agents_count: number;
  top_agent_id: number | null;
}

export interface TrustNetworkAgentStat {
  agent_id: number;
  incoming_trusted_count?: number;
  incoming_distrusted_count?: number;
  avg_incoming_trust: number;
}

export interface TrustNetworkSummary {
  total_ties: number;
  trusted_ties: number;
  distrusted_ties: number;
  neutral_ties: number;
  avg_trust: number;
  avg_familiarity: number;
  top_trusted_agents: TrustNetworkAgentStat[];
  top_distrusted_agents: TrustNetworkAgentStat[];
}

export interface SpatialHazardSummaryItem {
  x: number;
  y: number;
  mentions: number;
  max_severity: number;
}

export interface SpatialKnowledgeSummary {
  totals_by_kind: Record<string, number>;
  hazard_zones_sample: SpatialHazardSummaryItem[];
}

export interface NeuralArchitectureSpec {
  architecture: string;
  obs_dim: number;
  hidden_dim: number;
  num_actions: number;
  num_signals: number;
  learning_rate: number;
  backend: string;
  optimizer: string;
  parameter_count: number;
  experience_capacity: number;
}

export interface NeuralAgentRankItem extends AgentNeuralNetworkInfo {
  agent_id: number;
}

export interface VitalsAverages {
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  injury: number;
  disease_load: number;
}

export interface LearningTelemetryData {
  living_brains_count: number;
  agents_with_updates: number;
  avg_updates_per_agent: number;
  mean_td_error: number;
  mean_policy_entropy: number;
  mean_loss: number;
  mean_recent_reward: number;
  mean_value_loss: number;
  min_policy_entropy: number;
  max_policy_entropy: number;
  avg_weight_l2_norm: number;
  avg_hidden_l2_norm: number;
  total_experience_items: number;
  architecture: NeuralArchitectureSpec | null;
  learned_action_outcomes: AggregatedActionOutcomeItem[];
  population_skills_summary: SkillSummaryItem[];
  trust_network_summary: TrustNetworkSummary;
  spatial_knowledge_summary: SpatialKnowledgeSummary;
  action_distribution: Record<string, number>;
  trait_averages: AgentTraits;
  vitals_averages: VitalsAverages;
  top_neural_agents: NeuralAgentRankItem[];
}

export interface ResourceFunnel {
  absent: number;
  present_undiscovered: number;
  discovered_no_decision: number;
  decision_move_failed: number;
  reached_consume_failed: number;
  consumed_success: number;
}

export interface RegionalResourceSlice {
  food_biomass: number;
  water_volume: number;
  living_agents: number;
}

export interface PopulationAnalyticsData {
  total_ever_lived: number;
  living_count: number;
  deceased_count: number;
  births_total: number;
  male_count: number;
  female_count: number;
  avg_age_years: number;
  youngest_living_age_years: number | null;
  oldest_living_age_years: number | null;
  birth_rate_per_1000: number;
  death_rate_per_1000: number;
  net_growth_rate_per_1000: number;
  max_generation: number;
  generations_breakdown: Record<string, number>;
  family_units_count: number;
  avg_family_size: number;
  independent_adults_count: number;
  dependents_count: number;
}

export interface SurvivalAnalyticsData {
  avg_lifespan_ticks: number;
  avg_lifespan_years: number;
  longest_lifespan_ticks: number;
  longest_lifespan_years: number;
  shortest_lifespan_ticks: number;
  shortest_lifespan_years: number;
  premature_deaths_count: number;
  premature_death_rate_pct: number;
  deaths_by_cause: Record<string, number>;
  natural_deaths_count: number;
  violent_deaths_count: number;
  avg_survival_by_generation_ticks: Record<string, number>;
}

export interface FoodWaterAnalyticsData {
  total_food_biomass: number;
  available_consumable_food: number;
  food_consumed_total: number;
  food_consumption_rate_per_tick: number;
  total_water_volume: number;
  available_water_sources: number;
  water_consumed_total: number;
  water_consumption_rate_per_tick: number;
  agents_experienced_hunger: number;
  agents_experienced_thirst: number;
  avg_hunger_duration_ticks: number;
  avg_thirst_duration_ticks: number;
  starvation_deaths: number;
  dehydration_deaths: number;
  nearby_food_reach_failures: number;
  nearby_water_reach_failures: number;
  food_funnel: ResourceFunnel;
  water_funnel: ResourceFunnel;
  regional_resources: Record<string, RegionalResourceSlice>;
}

export interface SocialCivilizationAnalyticsData {
  social_ties_count: number;
  active_groups_count: number;
  cooperation_events: number;
  mutual_aid_events: number;
  teaching_events: number;
  knowledge_transfer_events: number;
  conflicts_count: number;
  crimes_total: number;
  crimes_by_type: Record<string, number>;
  active_language_tokens: number;
  stable_protowords_count: number;
  surface_artifacts_count: number;
  cultivation_events: number;
  barters_count: number;
  emergent_markets_count: number;
  norms_count: number;
  governance_structures_count: number;
}

export interface EconomyAnalyticsData {
  resource_produced: {
    food_cultivated: number;
    wood_gathered: number;
    stone_gathered: number;
    herb_gathered: number;
    tools_crafted: number;
  };
  resource_consumed: {
    food: number;
    water: number;
  };
  resource_stored_inventories: {
    food: number;
    wood: number;
    stone: number;
    herb: number;
    tool: number;
  };
  scarce_resources: string[];
  wealth_distribution: {
    gini_inventory: number;
    median_inventory: number;
    max_inventory: number;
    top10_share_pct: number;
  };
}

export interface LearningIntelligenceAnalyticsData {
  total_experiences_stored: number;
  total_brain_updates: number;
  total_skills_acquired: number;
  avg_skills_per_agent: number;
  food_discovery_events: number;
  food_reach_events: number;
  water_discovery_events: number;
  water_reach_events: number;
  episodic_memories_total: number;
  spatial_memories_total: number;
  intergenerational_transfers: number;
  individual_updates_std_dev: number;
  individual_reward_std_dev: number;
  repeated_failed_actions: number;
  post_negative_decision_switches: number;
  telemetry_scope_note: string;
}

export interface SimulationAnalyticsPayload {
  available_from_engine: boolean;
  population: PopulationAnalyticsData;
  survival: SurvivalAnalyticsData;
  food_water: FoodWaterAnalyticsData;
  social_civilization: SocialCivilizationAnalyticsData;
  economy: EconomyAnalyticsData;
  learning_intelligence: LearningIntelligenceAnalyticsData;
}

export interface TrainingAttemptRecord {
  attempt: number;
  death_tick: number;
  survival_ticks: number;
  cause: string;
  perceived_cues: string[];
  last_action: string;
}

export interface TrainingAgentRow {
  agent_id: number;
  sex: string;
  attempts: number;
  deaths: number;
  longest_survival_ticks: number;
  avg_survival_ticks: number;
  last_survival_ticks: number;
  last_cause_of_death: string | null;
  food_discovered: number;
  food_reach_decisions: number;
  food_reached: number;
  food_consumed: number;
  water_discovered: number;
  water_reach_decisions: number;
  water_reached: number;
  water_consumed: number;
  skills_count: number;
  episodic_memories_count: number;
  spatial_memories_count: number;
  brain_updates: number;
  learning_level_score: number;
  mean_recent_reward: number;
  status: string;
  attempt_history: TrainingAttemptRecord[];
}

export interface TrainingAttemptProgressionPoint {
  tick: number;
  total_deaths: number;
  avg_survival_ticks: number;
  food_consumed_total: number;
  water_consumed_total: number;
  total_brain_updates: number;
}

export interface TrainingAnalyticsPayload {
  system_name: string;
  phase: string;
  agent_count: number;
  training_ticks_executed: number;
  total_attempts: number;
  total_deaths: number;
  survival_avg_ticks: number;
  longest_survival_ticks: number;
  stage_totals: {
    food_discovered: number;
    food_reach_decisions: number;
    food_reached: number;
    food_consumed: number;
    water_discovered: number;
    water_reach_decisions: number;
    water_reached: number;
    water_consumed: number;
  };
  death_causes_breakdown: Record<string, number>;
  attempt_progression: TrainingAttemptProgressionPoint[];
  agents: TrainingAgentRow[];
}

export interface ObservatorySnapshot {
  export_schema_version: string;
  exported_at_utc: string;
  simulation_phase: 'training' | 'civilization' | string;
  world_id: string;
  timeline_id: string;
  parent_timeline_id: string | null;
  timeline_kind: 'original' | 'experimental_rebirth' | 'isolated_training' | string;
  branch_point_tick: number | null;
  rebirth_records: RebirthRecordItem[];
  recovery_state?: RecoveryStateData;
  learning_telemetry?: LearningTelemetryData;
  analytics: SimulationAnalyticsPayload;
  training_analytics: TrainingAnalyticsPayload | null;
  backend: string;
  clock: SimClockData;
  engine_capabilities: EngineCapabilities;
  world_terrain: WorldTerrainGrid | null;
  demographics: DemographicsData;
  ecosystem: EcosystemSummary;
  emergent_language: EmergentLanguageData;
  crime_and_stability: CrimeAndStabilityData;
  groups: SocialGroupItem[];
  history_layers: HistoryLayersData;
  living_agents_full: LivingAgentFull[];
  deceased_agents_archive: DeceasedAgentArchive[];
  genealogy_nodes: GenealogyNodeItem[];
  timeline_series: TimelinePoint[];
}

export interface ReplayEventTarget {
  event_id: number;
  tick: number;
  sim_date: string;
  event_type: string;
  x: number;
  y: number;
  agent_ids: number[];
  description: string;
}

export interface LiveTimelineSummary {
  id: string;
  world_id: string;
  timeline_id: string;
  parent_timeline_id: string | null;
  timeline_kind: 'original' | 'experimental_rebirth' | 'isolated_training' | string;
  branch_point_tick: number | null;
  tick: number;
  sim_date: string;
  living_count: number;
  deceased_count: number;
  recovery_cycle_count?: number;
  current_cycle_number?: number;
  frame_ticks: number[];
}

export interface TimelineComparisonReport {
  original: Record<string, unknown> & {
    world_id?: string;
    timeline_id?: string;
    timeline_kind?: string;
    tick: number;
    sim_date?: string;
    living_count: number;
    deceased_count: number;
    total_agents_ever: number;
    survival_rate_pct: number;
    births_total: number;
    causes_of_death: Record<string, number>;
    total_crimes: number;
    crimes_per_1000_pop: number;
    total_barters: number;
    social_trust_index: number;
    stability_index: number | null;
    active_groups: number;
  };
  experimental: Record<string, unknown> & {
    world_id?: string;
    timeline_id?: string;
    parent_timeline_id?: string | null;
    timeline_kind?: string;
    branch_point_tick?: number | null;
    tick: number;
    sim_date?: string;
    living_count: number;
    deceased_count: number;
    total_agents_ever: number;
    survival_rate_pct: number;
    births_total: number;
    causes_of_death: Record<string, number>;
    total_crimes: number;
    crimes_per_1000_pop: number;
    total_barters: number;
    social_trust_index: number;
    stability_index: number | null;
    active_groups: number;
  };
  deltas: {
    living_count_delta: number;
    survival_rate_pct_delta: number;
    births_delta: number;
    crimes_delta: number;
    barters_delta: number;
  };
  rebirth_agents_count: number;
  rebirth_agents_still_alive: number;
  rebirth_audit: Array<{
    agent_id: number;
    generation: number;
    original_death_tick: number | null;
    original_cause_of_death: string | null;
    rebirth_tick: number | null;
    death_penalty_applied: boolean;
    death_penalty_record: DeathPenaltyRecord | null;
    currently_alive: boolean;
    current_last_action: string | null;
    post_rebirth_death_tick: number | null;
    post_rebirth_cause_of_death: string | null;
    brain_fingerprint: string | null;
  }>;
}
