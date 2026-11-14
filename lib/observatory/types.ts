export type Locale = 'ar' | 'en';
export type SnapshotSourceMode = 'empty' | 'published' | 'uploaded' | 'test_fixture';
export type QualityPreset = 'high' | 'low';
export type ActiveDrawer =
  | null
  | 'inspector'
  | 'population'
  | 'civilization'
  | 'history'
  | 'telemetry';

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
  aggression: number;
  curiosity: number;
  sociability: number;
  risk_tolerance: number;
  empathy: number;
  endurance: number;
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
  traits: AgentTraits;
  inventory: Record<string, number>;
  skills: Record<string, number>;
  lexicon_size: number;
  lexicon: Record<string, Record<string, number>>;
  episodic_memories: EpisodicMemoryItem[];
  spatial_memories: SpatialMemoryItem[];
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
  traits: AgentTraits;
  skills: Record<string, number>;
  lexicon_size: number;
  episodic_memories: EpisodicMemoryItem[];
  social_ties: SocialTieItem[];
}

export type AnyAgentRecord = LivingAgentFull | DeceasedAgentArchive;

export interface EmergentLanguageData {
  first_communication_tick: number | null;
  first_repeated_signal_tick: number | null;
  first_shared_symbol_tick: number | null;
  first_stable_protoword_tick: number | null;
  first_grammar_sequence_tick: number | null;
  first_dialect_divergence_tick: number | null;
  stable_protowords_count: number;
  stable_protowords: Record<string, string>;
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
  belief_narrative: string;
  accuracy_estimate: number;
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

export interface ObservatorySnapshot {
  export_schema_version: string;
  exported_at_utc: string;
  world_id: string;
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
