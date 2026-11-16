import type {Locale} from './types';

export interface Translations {
  appTitle: string;
  appSubtitle: string;
  sourceEmpty: string;
  sourcePublished: string;
  sourceUploaded: string;
  sourceTestFixture: string;
  sourceLiveRunner: string;
  testFixtureWarning: string;
  phaseTraining: string;
  phaseCivilization: string;
  legacyAnalyticsNotice: string;
  uploadSnapshotBtn: string;
  multiImportBtn: string;
  loadTestFixtureBtn: string;
  refreshPublishedBtn: string;
  newWorldBtn: string;
  emptyHeadline: string;
  emptyBody: string;
  emptyDropHint: string;
  emptyStepsTitle: string;
  emptyStep1: string;
  emptyStep2: string;
  emptyStep3: string;
  uploadErrorTitle: string;
  simClockLabel: string;
  realClockLabel: string;
  clockRatioNote: string;
  snapshotTimeLabel: string;
  worldIdLabel: string;
  timelineOriginal: string;
  timelineExperimental: string;
  timelineIsolatedTraining: string;
  timelineBranchTick: string;
  livingLabel: string;
  deceasedLabel: string;
  generationLabel: string;
  seasonLabel: string;
  weatherLabel: string;
  tempLabel: string;

  // Navigation Tabs (8 Professional Statistics Views)
  navOverview: string;
  navPopulation: string;
  navSurvival: string;
  navResources: string;
  navCivilization: string;
  navLearning: string;
  navTraining: string;
  navHistory: string;

  // Overview & Population
  totalEverLived: string;
  birthsTotal: string;
  maleCount: string;
  femaleCount: string;
  avgAgeYears: string;
  youngestLiving: string;
  oldestLiving: string;
  birthRate1k: string;
  deathRate1k: string;
  netGrowthRate1k: string;
  genBreakdownTitle: string;
  familyUnitsCount: string;
  avgFamilySize: string;
  independentAdults: string;
  dependentsCount: string;

  // Survival Section
  survTitle: string;
  avgLifespan: string;
  longestLifespan: string;
  shortestLifespan: string;
  prematureDeaths: string;
  prematureRate: string;
  naturalVsViolent: string;
  naturalDeaths: string;
  violentDeaths: string;
  deathsByCauseTitle: string;
  survivalByGenTitle: string;
  noDeathsRecorded: string;

  // Food, Water & 6-Stage Funnel
  resTitle: string;
  availConsumableFood: string;
  foodConsumedTotal: string;
  foodConsRate: string;
  availWaterSources: string;
  waterConsumedTotal: string;
  waterConsRate: string;
  agentsHungry: string;
  agentsThirsty: string;
  avgHungerDur: string;
  avgThirstDur: string;
  starvationDeaths: string;
  dehydrationDeaths: string;
  nearbyFoodFailures: string;
  nearbyWaterFailures: string;
  foodFunnelTitle: string;
  waterFunnelTitle: string;
  regionalResourcesTitle: string;
  regionLabel: string;
  funnelStages: Record<string, string>;

  // Economy & Wealth
  econProdConsTitle: string;
  foodCultivated: string;
  woodGathered: string;
  stoneGathered: string;
  herbGathered: string;
  toolsCrafted: string;
  storedInventoriesTitle: string;
  scarceResourcesTitle: string;
  noScarceResources: string;
  wealthDistTitle: string;
  giniIndex: string;
  medianInventory: string;
  maxInventory: string;
  top10Share: string;

  // Intelligence & Learning
  learnTitle: string;
  expStored: string;
  totalBrainUpdates: string;
  skillsAcquired: string;
  avgSkillsPerAgent: string;
  foodDiscoverReach: string;
  waterDiscoverReach: string;
  episodicTotal: string;
  spatialTotal: string;
  intergenTransfers: string;
  updatesStdDev: string;
  rewardStdDev: string;
  repeatedErrors: string;
  postNegSwitches: string;
  rlScopeBadge: string;

  // Training 100 Agents
  trainTitle: string;
  trainSubtitle: string;
  trainNoData: string;
  trainTicksExec: string;
  trainTotalAttempts: string;
  trainTotalDeaths: string;
  trainAvgSurvival: string;
  trainLongestSurvival: string;
  trainStageMatrixTitle: string;
  trainProgressionChartTitle: string;
  trainTableTitle: string;
  trainSearchPlaceholder: string;
  trainSortBy: string;
  trainColAgent: string;
  trainColAttempts: string;
  trainColDeaths: string;
  trainColLongest: string;
  trainColAvgSurv: string;
  trainColFoodStages: string;
  trainColWaterStages: string;
  trainColSkillsMem: string;
  trainColLearnScore: string;
  trainColLastCause: string;
  trainColStatus: string;
  trainAttemptHistoryTitle: string;

  // Agent Inspector & Registry
  searchAgentPlaceholder: string;
  searchButton: string;
  selectAgentPrompt: string;
  agentNotFound: string;
  statusAlive: string;
  statusDeceased: string;
  sexF: string;
  sexM: string;
  ageYears: string;
  tickUnit: string;
  genShort: string;
  coordsLabel: string;
  vitalsSection: string;
  health: string;
  hunger: string;
  thirst: string;
  energy: string;
  injury: string;
  disease: string;
  pregnant: string;
  currentAction: string;
  lastSignal: string;
  causeOfDeath: string;
  deathTick: string;
  rebirthSection: string;
  rebirthCountLabel: string;
  originalDeathLabel: string;
  rebirthTickLabel: string;
  deathPenaltyLabel: string;
  brainFingerprintLabel: string;
  evidenceCuesLabel: string;
  traitsSection: string;
  skillsSection: string;
  inventorySection: string;
  lexiconSection: string;
  episodicMemorySection: string;
  spatialMemorySection: string;
  socialTiesSection: string;
  familySection: string;
  parentsLabel: string;
  childrenLabel: string;
  noParentsFounders: string;
  noChildrenYet: string;
  noMemoriesYet: string;
  noLexiconYet: string;
  noTiesYet: string;
  emptyInventory: string;
  popFilterAll: string;
  popFilterLiving: string;
  popFilterDeceased: string;
  ageDistTitle: string;
  familyTreeTitle: string;
  selectRootForTree: string;

  // Civilization Systems
  civLangTitle: string;
  civEconTitle: string;
  civSocietyTitle: string;
  civKnowledgeTitle: string;
  civCrimeTitle: string;
  notYetInvented: string;
  engineScopeNoteTitle: string;
  engineScopeNoteBody: string;
  activeTokens: string;
  stableProtowords: string;
  adoptersLabel: string;
  extinctWordLabel: string;
  topBigrams: string;
  dialects: string;
  semanticDrift: string;
  intergenTransmission: string;
  extinctTokens: string;
  totalBarters: string;
  emergentMarkets: string;
  exchangeHubsCount: string;
  currencyTokens: string;
  activeGroups: string;
  collapsedInstitutions: string;
  governanceType: string;
  normsLabel: string;
  leaderLabel: string;
  membersLabel: string;
  nextElectionLabel: string;
  discoveredTechs: string;
  surfaceArtifacts: string;
  totalCrimes: string;
  crimeRate1k: string;
  recentCrimeRate1k: string;
  murderRate: string;
  assaultRate: string;
  theftRate: string;
  disputeResolution: string;
  socialTrust: string;
  stabilityIndex: string;
  insufficientWindow: string;
  repeatOffenders: string;
  lastCrimeLabel: string;
  cooperationLabel: string;
  mutualAidLabel: string;
  teachingLabel: string;
  cultivationLabel: string;

  // History & Replay
  historyFilterAll: string;
  historyFilterYearPlaceholder: string;
  historyFilterAgentPlaceholder: string;
  historySortNewest: string;
  historySortOldest: string;
  historyPhaseAll: string;
  historyPhasePreRebirth: string;
  historyPhasePostRebirth: string;
  eventDetailTitle: string;
  milestonesTitle: string;
  layer1Title: string;
  layer1Subtitle: string;
  layer2Title: string;
  layer2Subtitle: string;
  layer3Title: string;
  layer3Subtitle: string;
  inspectLocationBtn: string;
  clearReplayBtn: string;
  replayingBanner: string;
  replayFrameHonesty: string;
  noEventsMatched: string;
  telemetryPopChart: string;
  telemetryResourceChart: string;
  telemetryCultureCrimeChart: string;
  telemetryNoSeries: string;
  foodBiomass: string;
  waterTotal: string;
  woodBiomass: string;
  herbivores: string;
  predators: string;
  soilMoisture: string;

  // Timeline Bar
  tlPlay: string;
  tlPause: string;
  tlStep: string;
  tlSpeed: string;
  tlBranchRebirth: string;
  tlHistoricalPreview: string;
  tlReturnLive: string;
  tlTimelineSelector: string;

  // Comparison
  cmpTitle: string;
  cmpOriginalLabel: string;
  cmpExperimentalLabel: string;
  cmpNoPairs: string;
  cmpSurvivalRate: string;
  cmpRebirthAuditTitle: string;

  // Multi-file JSON Importer
  impTitle: string;
  impSelectFiles: string;
  impSelectFolder: string;
  impProcessing: string;
  impAccepted: string;
  impQuarantined: string;
  impUnindexed: string;
  impWarnings: string;
  impCycles: string;
  impCommitBtn: string;
  impRollbackBtn: string;
  impCloseBtn: string;

  // Diagnostics & Recovery & Learning Telemetry
  diagButton: string;
  diagTitle: string;
  diagModeLabel: string;
  diagCycleLabel: string;
  diagSchemaLabel: string;
  diagErrorLogLabel: string;
  diagNoErrors: string;
  diagClearBtn: string;
  diagCopyBtn: string;
  diagCopied: string;
  diagDownloadBtn: string;
  recoverySectionTitle: string;
  recoveryCurrentCycle: string;
  recoveryCountLabel: string;
  recoveryNoCycles: string;
  recoveryFoundersLabel: string;
  recoveryBirthsLabel: string;
  recoveryDurationLabel: string;
  recoveryArchiveLabel: string;
  learningSectionTitle: string;
  learningUpdates: string;
  learningTdError: string;
  learningEntropy: string;
  learningLoss: string;
  learningReward: string;
  deceptionRate: string;

  // Learned Outcomes, Trust/Distrust, Skills Leaderboard, Neural Network & Sensory
  whatLearnedSection: string;
  learnedPositiveHabits: string;
  learnedAvoidedActions: string;
  trialsLabel: string;
  avgOutcomeReward: string;
  noLearnedOutcomesYet: string;
  recentCognitiveContexts: string;
  learnedBehaviorsNote: string;
  trustDistrustTitle: string;
  trustedAllies: string;
  distrustedAgents: string;
  neutralAcquaintances: string;
  trustScore: string;
  familiarityScore: string;
  avoidedHazards: string;
  noTrustedYet: string;
  noDistrustedYet: string;
  noHazardsMapped: string;
  trustNetworkSummaryTitle: string;
  mostTrustedTitle: string;
  mostDistrustedTitle: string;
  trustedTiesCount: string;
  distrustedTiesCount: string;
  neutralTiesCount: string;
  avgTrustIndex: string;
  avgFamiliarityIndex: string;
  incomingTiesLabel: string;
  skillLeaderboardTitle: string;
  topMasterLabel: string;
  skilledAgentsCount: string;
  avgProficiency: string;
  peakProficiency: string;
  neuralNetworkTitle: string;
  nnArchitecture: string;
  nnBackend: string;
  nnOptimizer: string;
  nnParameters: string;
  nnLearningRate: string;
  nnUpdatesCount: string;
  nnExpBuffer: string;
  nnPolicyLoss: string;
  nnValueLoss: string;
  nnTdError: string;
  nnEntropy: string;
  nnEntropyRange: string;
  nnWeightNorm: string;
  nnHiddenNorm: string;
  nnWeightFingerprint: string;
  nnRecentReward: string;
  nnDeathPenalties: string;
  nnTopBrainsTitle: string;
  nnLegacyUnavailable: string;
  sensoryPerceptionTitle: string;
  visionRangeLabel: string;
  hearingRangeLabel: string;
  nearbyAgentsVisible: string;
  nearbyFaunaVisible: string;
  nearbyArtifactsVisible: string;
  heardSignalsTitle: string;
  noSignalsHeard: string;
  localResourcesSpot: string;
  actionDistTitle: string;
  traitAveragesTitle: string;
  vitalsAveragesTitle: string;
  spatialCoverageTitle: string;
  hazardsMappedTitle: string;
  hazardZonesTitle: string;
  mentionsLabel: string;
  severityLabel: string;
  showMoreIds: string;
  showLessIds: string;

  actions: Record<string, string>;
  causes: Record<string, string>;
  seasons: Record<string, string>;
  weather: Record<string, string>;
  lifeStages: Record<string, string>;
  traits: Record<string, string>;
  skills: Record<string, string>;
  contexts: Record<string, string>;
  milestones: Record<string, string>;
  techs: Record<string, string>;
  governance: Record<string, string>;
}

const AR: Translations = {
  appTitle: 'مرصد إحصائيات الحضارة',
  appSubtitle: 'البداية إلى الحضارة — التدريب المعزول، التحليلات السكانية، والسجل الحضاري الدقيق',
  sourceEmpty: 'بانتظار لقطة محاكاة',
  sourcePublished: 'لقطة حقيقية منشورة',
  sourceUploaded: 'ملف/حزمة محلية مستوردة',
  sourceTestFixture: 'بيانات اختبارية تجريبية (معزولة)',
  sourceLiveRunner: 'محاكاة حية عبر المحرك',
  testFixtureWarning: 'تنبيه: هذه اللقطة اختبارية معزولة وليست عالماً حياً مستمراً.',
  phaseTraining: 'مرحلة التدريب المعزول (100 فرد)',
  phaseCivilization: 'مرحلة العالم الحضاري الكامل',
  legacyAnalyticsNotice:
    'ملاحظة: هذه اللقطة من إصدار قديم لا يتضمن عدادات قمع الموارد أو بعض مقاييس الخطوات؛ تُعرض فقط الأرقام الحقيقية المشتقة من البيانات الموجودة.',
  uploadSnapshotBtn: 'رفع ملف JSON',
  multiImportBtn: 'استيراد ملفات / مجلدات',
  loadTestFixtureBtn: 'معاينة بيانات اختبارية معزولة',
  refreshPublishedBtn: 'تحديث اللقطة المنشورة',
  newWorldBtn: 'عالم جديد حي',
  emptyHeadline: 'لا توجد لقطة عالم حقيقية محمّلة بعد',
  emptyBody:
    'يعرض هذا المرصد التحليلات الإحصائية الفعلية لمحرك البداية إلى الحضارة فقط دون أي بيانات وهمية أو اصطناعية. يمكنك تشغيل عالم حي محلي، أو استيراد ملف/مجلد مخرجات المحرك (التدريب المعزول أو العالم الحضاري)، أو معاينة العينة الاختبارية.',
  emptyDropHint: 'اسحب وأفلت ملف observatory_export.json أو مجلد الخطوات هنا',
  emptyStepsTitle: 'مسارات التشغيل والاستيراد الحقيقية',
  emptyStep1: '1. نفّذ التدريب المعزول أو انقل السكان إلى العالم الكامل عبر GitHub Actions يدوياً.',
  emptyStep2: '2. استورد ملف observatory_export.json أو مجلد خطوات كاملة مع التحقق الطوبولوجي.',
  emptyStep3: '3. تفحّص مؤشرات البقاء، قمع الغذاء والماء من 6 مراحل، وسجلات الأفراد الـ 100.',
  uploadErrorTitle: 'تعذّر قراءة ملف اللقطة',
  simClockLabel: 'الزمن المحاكى',
  realClockLabel: 'الزمن الفعلي التراكمي',
  clockRatioNote: '1 دقيقة فعلية = 1 شهر محاكى (في الوضع الزمني الحقيقي)',
  snapshotTimeLabel: 'توقيت اللقطة',
  worldIdLabel: 'معرّف العالم',
  timelineOriginal: 'الخط الأصلي',
  timelineExperimental: 'فرع الإحياء التجريبي',
  timelineIsolatedTraining: 'التدريب المعزول',
  timelineBranchTick: 'نقطة التفرّع',
  livingLabel: 'أحياء',
  deceasedLabel: 'متوفون',
  generationLabel: 'أعلى جيل',
  seasonLabel: 'الفصل',
  weatherLabel: 'الطقس',
  tempLabel: 'الحرارة',

  navOverview: 'نظرة عامة',
  navPopulation: 'السكان والأفراد',
  navSurvival: 'البقاء والوفيات',
  navResources: 'الغذاء والماء',
  navCivilization: 'الحضارة والاقتصاد',
  navLearning: 'الذكاء والتعلّم',
  navTraining: 'تدريب الـ100 فرد',
  navHistory: 'التاريخ والمقارنة',

  totalEverLived: 'إجمالي من عاشوا',
  birthsTotal: 'إجمالي المواليد',
  maleCount: 'الذكور (أحياء)',
  femaleCount: 'الإناث (أحياء)',
  avgAgeYears: 'متوسط العمر (أحياء)',
  youngestLiving: 'أصغر فرد حي',
  oldestLiving: 'أكبر فرد حي',
  birthRate1k: 'معدل المواليد / 1000',
  deathRate1k: 'معدل الوفيات / 1000',
  netGrowthRate1k: 'صافي النمو / 1000',
  genBreakdownTitle: 'توزيع الأجيال',
  familyUnitsCount: 'الأسر المتشكلة',
  avgFamilySize: 'متوسط حجم الأسرة',
  independentAdults: 'بالغون مستقلون',
  dependentsCount: 'معالون (رضع/أطفال)',

  survTitle: 'تحليلات البقاء وأسباب الوفاة',
  avgLifespan: 'متوسط مدة البقاء',
  longestLifespan: 'أطول عمر مسجل',
  shortestLifespan: 'أقصر عمر مسجل',
  prematureDeaths: 'الوفيات المبكرة',
  prematureRate: 'نسبة الوفيات المبكرة',
  naturalVsViolent: 'وفيات طبيعية مقابل عنيفة',
  naturalDeaths: 'وفيات طبيعية/بيئية',
  violentDeaths: 'وفيات عنيفة/افتراس',
  deathsByCauseTitle: 'توزيع الوفيات حسب السبب الحقيقي',
  survivalByGenTitle: 'متوسط البقاء حسب الجيل (بالخطوات)',
  noDeathsRecorded: 'لم تُسجّل وفيات بعد في هذه اللقطة.',

  resTitle: 'تحليلات الغذاء والماء وقمع الوصول (6 مراحل)',
  availConsumableFood: 'الغذاء المتاح للاستهلاك',
  foodConsumedTotal: 'إجمالي الغذاء المستهلك',
  foodConsRate: 'معدل استهلاك الغذاء/خطوة',
  availWaterSources: 'نقاط/مصادر المياه النشطة',
  waterConsumedTotal: 'إجمالي المياه المستهلكة',
  waterConsRate: 'معدل استهلاك الماء/خطوة',
  agentsHungry: 'أفراد واجهوا الجوع',
  agentsThirsty: 'أفراد واجهوا العطش',
  avgHungerDur: 'متوسط مدة الجوع (خطوة)',
  avgThirstDur: 'متوسط مدة العطش (خطوة)',
  starvationDeaths: 'وفيات الجوع',
  dehydrationDeaths: 'وفيات العطش',
  nearbyFoodFailures: 'إخفاق الوصول لغذاء قريب',
  nearbyWaterFailures: 'إخفاق الوصول لماء قريب',
  foodFunnelTitle: 'قمع تفاعل الغذاء ذو المراحل الست',
  waterFunnelTitle: 'قمع تفاعل الماء ذو المراحل الست',
  regionalResourcesTitle: 'المقارنة الإقليمية للموارد والسكان (أرباع العالم)',
  regionLabel: 'الربع الجغرافي',
  funnelStages: {
    absent: '1. المورد غير موجود',
    present_undiscovered: '2. موجود لكن لم يُكتشف',
    discovered_no_decision: '3. مُكتشف دون قرار وصول',
    decision_move_failed: '4. قرار وصول فشل حركياً',
    reached_consume_failed: '5. وصل لكن فشل الاستهلاك',
    consumed_success: '6. تم التفاعل والاستهلاك بنجاح',
  },

  econProdConsTitle: 'الإنتاج والاستهلاك التراكمي',
  foodCultivated: 'غذاء مُنتج/مُستنبت',
  woodGathered: 'أخشاب مجموعة',
  stoneGathered: 'حجارة مجموعة',
  herbGathered: 'أعشاب مجموعة',
  toolsCrafted: 'أدوات مصنوعة',
  storedInventoriesTitle: 'المخزون الشخصي الإجمالي لدى الأحياء',
  scarceResourcesTitle: 'الموارد النادرة حالياً',
  noScarceResources: 'لا توجد ندرة حادة مسجلة حالياً.',
  wealthDistTitle: 'توزيع المخزون والثروة بين الأحياء',
  giniIndex: 'معامل جيني (Gini)',
  medianInventory: 'وسيط المخزون',
  maxInventory: 'أعلى مخزون فردي',
  top10Share: 'حصة أغنى 10%',

  learnTitle: 'مؤشرات التعلّم التجريبي والتعزيزي (RL)',
  expStored: 'التجارب المخزنة',
  totalBrainUpdates: 'تحديثات الشبكة العصبية',
  skillsAcquired: 'إجمالي المهارات المكتسبة',
  avgSkillsPerAgent: 'متوسط المهارات/فرد',
  foodDiscoverReach: 'اكتشاف / وصول الغذاء',
  waterDiscoverReach: 'اكتشاف / وصول الماء',
  episodicTotal: 'الذكريات العرضية',
  spatialTotal: 'الخرائط المكانية',
  intergenTransfers: 'نقل المعرفة بين الأجيال',
  updatesStdDev: 'تباين التحديثات (StdDev)',
  rewardStdDev: 'تباين المكافآت (StdDev)',
  repeatedErrors: 'أفعال فاشلة متكررة',
  postNegSwitches: 'تغيير القرار بعد نتيجة سلبية',
  rlScopeBadge: 'مؤشرات إحصائية للتعلم التعزيزي فقط — لا تقيس وعياً عاماً',

  trainTitle: 'نظام التدريب المعزول للبقاء (100 فرد)',
  trainSubtitle:
    'تدريب مستقل لـ 100 فرد في 100 بيئة متطابقة القالب ومعزولة تماماً، مع الإحياء التدريبي المرتبط بعقوبة الموت.',
  trainNoData: 'لا تتوفر بيانات تدريب معزول في هذه اللقطة (ابدأ من مسار start-training أو حمّل عالماً مرقّى من حزمة تدريب).',
  trainTicksExec: 'خطوات التدريب المنفذة',
  trainTotalAttempts: 'إجمالي المحاولات',
  trainTotalDeaths: 'وفيات التدريب',
  trainAvgSurvival: 'متوسط البقاء/محاولة',
  trainLongestSurvival: 'أطول صمود فردي',
  trainStageMatrixTitle: 'مجموع مراحل التعلم الأربعة (اكتشاف ← قرار ← وصول ← استهلاك)',
  trainProgressionChartTitle: 'تطور البقاء والتعلم عبر خطوات التدريب',
  trainTableTitle: 'سجل مقارنة الأفراد الـ 100 في التدريب',
  trainSearchPlaceholder: 'ابحث برقم الفرد أو السبب...',
  trainSortBy: 'ترتيب حسب:',
  trainColAgent: 'الفرد',
  trainColAttempts: 'المحاولات',
  trainColDeaths: 'الوفيات',
  trainColLongest: 'أطول بقاء',
  trainColAvgSurv: 'متوسط البقاء',
  trainColFoodStages: 'غذاء (ك/ق/و/أ)',
  trainColWaterStages: 'ماء (ك/ق/و/ش)',
  trainColSkillsMem: 'مهارات/ذاكرة',
  trainColLearnScore: 'مستوى التعلم',
  trainColLastCause: 'آخر سبب وفاة',
  trainColStatus: 'الحالة',
  trainAttemptHistoryTitle: 'سجل محاولات الفرد في البيئة المعزولة',

  searchAgentPlaceholder: 'ابحث برقم الفرد (مثال: 14)',
  searchButton: 'معاينة',
  selectAgentPrompt: 'اختر أي فرد من الجدول أو ابحث برقمه لمعاينة عقله، مهاراته، ذكرياته وسجله التدريبي.',
  agentNotFound: 'لم يُعثر على فرد بهذا المعرّف في اللقطة الحالية.',
  statusAlive: 'حي',
  statusDeceased: 'متوفى نهائياً',
  sexF: 'أنثى',
  sexM: 'ذكر',
  ageYears: 'سنة',
  tickUnit: 'خطوة',
  genShort: 'جيل',
  coordsLabel: 'الإحداثيات',
  vitalsSection: 'المؤشرات الحيوية والحالة',
  health: 'الصحة',
  hunger: 'الجوع',
  thirst: 'العطش',
  energy: 'الطاقة',
  injury: 'الإصابة',
  disease: 'المرض',
  pregnant: 'حامل',
  currentAction: 'الفعل الحالي',
  lastSignal: 'آخر رمز صوتي',
  causeOfDeath: 'سبب الوفاة',
  deathTick: 'خطوة الوفاة',
  rebirthSection: 'سجل الإحياء والتعلّم من الوفاة',
  rebirthCountLabel: 'مرات الإحياء',
  originalDeathLabel: 'الوفاة السابقة',
  rebirthTickLabel: 'خطوة الإحياء',
  deathPenaltyLabel: 'تحديث عقوبة الموت العصبية',
  brainFingerprintLabel: 'بصمة الأوزان العصبية',
  evidenceCuesLabel: 'الإشارات الحسية المسبقة',
  traitsSection: 'السمات الفردية المستقلة',
  skillsSection: 'المهارات المكتسبة',
  inventorySection: 'المخزون الشخصي',
  lexiconSection: 'المعجم الصوتي الشخصي',
  episodicMemorySection: 'الذاكرة العرضية',
  spatialMemorySection: 'الخريطة الذهنية المكانية',
  socialTiesSection: 'الروابط الاجتماعية والثقة',
  familySection: 'الأسرة والنسل',
  parentsLabel: 'الوالدان',
  childrenLabel: 'الأبناء',
  noParentsFounders: 'جيل مؤسس أول (بدون والدين)',
  noChildrenYet: 'لا يوجد أبناء مسجلون حتى الآن',
  noMemoriesYet: 'لا توجد ذكريات مسجلة في الذاكرة الحالية.',
  noLexiconYet: 'لم يكوّن معجماً لغوياً بعد.',
  noTiesYet: 'لم يكوّن روابط اجتماعية بعد.',
  emptyInventory: 'المخزون فارغ.',
  popFilterAll: 'الكل',
  popFilterLiving: 'الأحياء',
  popFilterDeceased: 'المتوفون',
  ageDistTitle: 'التوزيع العمري للأحياء',
  familyTreeTitle: 'شجرة الأنساب التفاعلية',
  selectRootForTree: 'اختر فرداً من السجل لعرض شجرة والديه وأحفاده.',
  civLangTitle: 'اللغة الناشئة والتواصل',
  civEconTitle: 'الاقتصاد والتبادل',
  civSocietyTitle: 'المجتمع والحكم والمعايير',
  civKnowledgeTitle: 'المعرفة والتقنيات المكتشفة',
  civCrimeTitle: 'الجريمة والعدالة والاستقرار',
  notYetInvented: 'لم ينشأ بعد في هذا العالم',
  engineScopeNoteTitle: 'نطاق تمثيل المحرك الفعلي',
  engineScopeNoteBody:
    'تعرض اللوحة القياسات الإحصائية المباشرة الصادرة عن المحرك (السكان، قمع الغذاء والماء، اللغة الأولية، الاقتصاد، التعلم التعزيزي، والتاريخ ثلاثي الطبقات) دون أي تمثيل ثلاثي أبعاد.',
  activeTokens: 'الرموز النشطة',
  stableProtowords: 'كلمات أولية مستقرة',
  adoptersLabel: 'متبنّون',
  extinctWordLabel: 'منقرضة',
  topBigrams: 'تتابعات ثنائية شائعة',
  dialects: 'تباين اللهجات الجهوية',
  semanticDrift: 'أحداث الانزياح الدلالي',
  intergenTransmission: 'نقل لغوي عبر الأجيال',
  extinctTokens: 'رموز منقرضة',
  totalBarters: 'إجمالي المقايضات',
  emergentMarkets: 'أسواق ناشئة',
  exchangeHubsCount: 'نقاط تجمع التبادل',
  currencyTokens: 'رمز تبادل (عملة بدائية)',
  activeGroups: 'مجموعات نشطة',
  collapsedInstitutions: 'مؤسسات منهارة',
  governanceType: 'النمط التنظيمي',
  normsLabel: 'الأعراف المتشكلة',
  leaderLabel: 'القيادة',
  membersLabel: 'الأعضاء',
  nextElectionLabel: 'التجديد الدوري (كل 10 سنوات)',
  discoveredTechs: 'تقنيات مكتشفة عبر التجربة',
  surfaceArtifacts: 'آثار ونقوش على السطح',
  totalCrimes: 'إجمالي الجرائم المسجلة',
  crimeRate1k: 'المعدل لكل 1000 نسمة',
  recentCrimeRate1k: 'معدل آخر 180 يوماً / 1000',
  murderRate: 'القتل / 1000',
  assaultRate: 'الاعتداء / 1000',
  theftRate: 'السرقة / 1000',
  disputeResolution: 'نسبة حل النزاعات',
  socialTrust: 'مؤشر الثقة الاجتماعية',
  stabilityIndex: 'مؤشر الاستقرار',
  insufficientWindow: 'نافذة رصد غير كافية بعد (< 90 يوماً أو < 20 فرداً)',
  repeatOffenders: 'مكررو المخالفات',
  lastCrimeLabel: 'آخر جريمة',
  cooperationLabel: 'أحداث التعاون',
  mutualAidLabel: 'المساعدة المتبادلة',
  teachingLabel: 'أحداث التعليم',
  cultivationLabel: 'الاستنبات والرعاية',
  historyFilterAll: 'كل الأنواع',
  historyFilterYearPlaceholder: 'تصفية بالسنة...',
  historyFilterAgentPlaceholder: 'رقم فرد مشارك...',
  historySortNewest: 'الأحدث أولاً',
  historySortOldest: 'الأقدم أولاً',
  historyPhaseAll: 'كل المراحل',
  historyPhasePreRebirth: 'قبل الإحياء',
  historyPhasePostRebirth: 'بعد الإحياء التجريبي',
  eventDetailTitle: 'تفاصيل الحدث الموثّق',
  milestonesTitle: 'أول لحظات الظهور الحضاري',
  layer1Title: 'الطبقة 1: الحقيقة الواقعية (للمراقب فقط)',
  layer1Subtitle: 'السجل الدقيق الصادر عن المحرك — غير مرئي للأفراد',
  layer2Title: 'الطبقة 2: شهادات الشهود والآثار المادية',
  layer2Subtitle: 'ما لاحظه شهود محليون (مع احتمال خطأ أو تشوّه) والنقوش الباقية',
  layer3Title: 'الطبقة 3: التفسيرات والأساطير عبر الأجيال',
  layer3Subtitle: 'كيف أعادت الأجيال اللاحقة تفسير الآثار والماضي',
  inspectLocationBtn: 'تثبيت إحداثيات الحدث',
  clearReplayBtn: 'مسح التحديد',
  replayingBanner: 'معاينة سجل الحدث التاريخي',
  replayFrameHonesty: 'يعرض المرصد الإحداثيات الدقيقة والأفراد المشاركين من السجل الفعلي دون تلفيق إطارات مفقودة.',
  noEventsMatched: 'لا توجد أحداث تطابق معايير التصفية الحالية.',
  telemetryPopChart: 'منحنى السكان (الأحياء والوفيات والولادات)',
  telemetryResourceChart: 'الموارد البيئية والحيوانات عبر الزمن',
  telemetryCultureCrimeChart: 'تطور اللغة والتبادل ومعدل الجريمة',
  telemetryNoSeries: 'تتوفر السلسلة الزمنية الكاملة عند تشغيل المحاكاة عبر اللقطات الدورية (>= 30 خطوة).',
  foodBiomass: 'الغذاء النباتي',
  waterTotal: 'المياه السطحية والينابيع',
  woodBiomass: 'الأخشاب',
  herbivores: 'العاشبات',
  predators: 'المفترسات',
  soilMoisture: 'رطوبة التربة',
  tlPlay: 'تشغيل',
  tlPause: 'إيقاف مؤقت',
  tlStep: 'خطوة +1',
  tlSpeed: 'السرعة',
  tlBranchRebirth: 'إنشاء فرع إحياء تجريبي',
  tlHistoricalPreview: 'وضع المعاينة التاريخية (للقراءة فقط)',
  tlReturnLive: 'العودة للحالة الحالية',
  tlTimelineSelector: 'الخط الزمني',
  cmpTitle: 'مقارنة الخط الأصلي بفرع الإحياء التجريبي',
  cmpOriginalLabel: 'الخط الأصلي (الأم)',
  cmpExperimentalLabel: 'الفرع التجريبي المستقل',
  cmpNoPairs: 'يتطلب الأمر خطاً أصلياً وفرعاً تجريبياً متفرعاً منه لإجراء المقارنة المباشرة.',
  cmpSurvivalRate: 'نسبة البقاء',
  cmpRebirthAuditTitle: 'سجل الأفراد المُحيَين وحالتهم بعد الإحياء',
  impTitle: 'مستورد حزم JSON غير المحدود والترتيب الطوبولوجي',
  impSelectFiles: 'اختيار ملفات JSON (عدد غير محدود)',
  impSelectFolder: 'استيراد مجلد كامل',
  impProcessing: 'جارٍ الفحص والترتيب الرقمي والطوبولوجي...',
  impAccepted: 'ملفات سليمة ومرتبة',
  impQuarantined: 'حجر الملفات التالفة',
  impUnindexed: 'بانتظار المراجعة (غير مفهرسة)',
  impWarnings: 'تنبيهات التسلسل والفجوات',
  impCycles: 'تعارضات دورية في الاعتماديات',
  impCommitBtn: 'تطبيق الخط الزمني المحدد ذرياً',
  impRollbackBtn: 'تراجع للحالة السابقة',
  impCloseBtn: 'إغلاق',
  diagButton: 'التشخيص',
  diagTitle: 'تشخيص النظام ومنع الأعطال',
  diagModeLabel: 'وضع اللوحة',
  diagCycleLabel: 'الدورة السكانية',
  diagSchemaLabel: 'نسخة البيانات',
  diagErrorLogLabel: 'سجل الأخطاء التقنية بالمتصفح',
  diagNoErrors: 'لم تُسجّل أي أخطاء برمجية في الجلسة الحالية.',
  diagClearBtn: 'مسح السجل',
  diagCopyBtn: 'نسخ تقرير JSON',
  diagCopied: 'تم النسخ',
  diagDownloadBtn: 'تنزيل التقرير',
  recoverySectionTitle: 'دورات التعافي بعد الانقراض',
  recoveryCurrentCycle: 'الدورة الحالية',
  recoveryCountLabel: 'مرات التعافي',
  recoveryNoCycles: 'التعافي التلقائي معطل بعد الترقية أو لم تحدث دورة تعافٍ بعد.',
  recoveryFoundersLabel: 'المؤسسون الجدد',
  recoveryBirthsLabel: 'مواليد لاحقة',
  recoveryDurationLabel: 'مدة الصمود',
  recoveryArchiveLabel: 'أرشيف ما قبل التعافي',
  learningSectionTitle: 'مؤشرات التعلّم العصبي الفعلي',
  learningUpdates: 'متوسط التحديثات/فرد',
  learningTdError: 'متوسط خطأ TD',
  learningEntropy: 'إنتروبيا السياسة',
  learningLoss: 'متوسط الخسارة',
  learningReward: 'المكافأة الأخيرة',
  deceptionRate: 'الخداع والغش',
  whatLearnedSection: 'ماذا تعلّم السكان؟ (نتائج الأفعال المكتسبة)',
  learnedPositiveHabits: 'سلوكيات معزّزة (مكافأة موجبة)',
  learnedAvoidedActions: 'سلوكيات يتجنّبها (مكافأة سالبة)',
  trialsLabel: 'محاولات',
  avgOutcomeReward: 'متوسط العائد الموزون',
  noLearnedOutcomesYet: 'لم تتراكم نتائج سلوكية كافية في السجل التجريبي بعد.',
  recentCognitiveContexts: 'السياقات الإدراكية الحديثة في المخزن',
  learnedBehaviorsNote: 'مشتقة مباشرة من مصفوفة نتائج التجربة (action_outcomes) ومتوسط المكافأة المتناقص داخل الشبكة العصبية.',
  trustDistrustTitle: 'بماذا يثقون وبماذا لا يثقون؟',
  trustedAllies: 'أفراد يثق بهم',
  distrustedAgents: 'أفراد لا يثق بهم',
  neutralAcquaintances: 'معارف محايدون',
  trustScore: 'الثقة',
  familiarityScore: 'الألفة',
  avoidedHazards: 'مخاطر مكانية مسجّلة للتجنب',
  noTrustedYet: 'لا توجد روابط ثقة موجبة (> 0.15) حتى الآن.',
  noDistrustedYet: 'لا توجد روابط انعدام ثقة (< -0.15) حتى الآن.',
  noHazardsMapped: 'لم تُرصد نقاط خطر في الخريطة الذهنية.',
  trustNetworkSummaryTitle: 'شبكة الثقة والارتياب بين السكان',
  mostTrustedTitle: 'الأفراد الأكثر حصولاً على الثقة',
  mostDistrustedTitle: 'الأفراد الأكثر فقداناً للثقة',
  trustedTiesCount: 'روابط ثقة موجبة',
  distrustedTiesCount: 'روابط عدم ثقة',
  neutralTiesCount: 'روابط محايدة',
  avgTrustIndex: 'متوسط الثقة البينية',
  avgFamiliarityIndex: 'متوسط الألفة البينية',
  incomingTiesLabel: 'روابط واردة',
  skillLeaderboardTitle: 'خريطة إتقان المهارات لدى السكان',
  topMasterLabel: 'الأعلى مهارة',
  skilledAgentsCount: 'المتدرّبون',
  avgProficiency: 'المتوسط',
  peakProficiency: 'الأعلى',
  neuralNetworkTitle: 'معلومات الشبكة العصبية',
  nnArchitecture: 'البنية العصبية',
  nnBackend: 'محرك التنفيذ',
  nnOptimizer: 'المُحسِّن',
  nnParameters: 'عدد المعاملات',
  nnLearningRate: 'معدل التعلّم',
  nnUpdatesCount: 'إجمالي التحديثات',
  nnExpBuffer: 'مخزن التجارب',
  nnPolicyLoss: 'خسارة السياسة (Loss)',
  nnValueLoss: 'خسارة القيمة (Value Loss)',
  nnTdError: 'خطأ TD',
  nnEntropy: 'إنتروبيا السياسة',
  nnEntropyRange: 'نطاق الإنتروبيا (أدنى – متوسط – أعلى)',
  nnWeightNorm: 'معيار الأوزان L2',
  nnHiddenNorm: 'معيار الحالة الخفية L2',
  nnWeightFingerprint: 'بصمة الأوزان',
  nnRecentReward: 'متوسط المكافأة الحديثة',
  nnDeathPenalties: 'عقوبات الموت العصبية',
  nnTopBrainsTitle: 'أكثر العقول العصبية تحديثاً وتعلّماً',
  nnLegacyUnavailable: 'ملاحظة: هذه اللقطة قديمة ولا تحتوي على قياسات الأوزان والحالة الخفية التفصيلية للشبكة.',
  sensoryPerceptionTitle: 'الإدراك الحسي المحلي (بدون تخاطر)',
  visionRangeLabel: 'مدى الرؤية',
  hearingRangeLabel: 'مدى السمع',
  nearbyAgentsVisible: 'أفراد مرئيون بالجوار',
  nearbyFaunaVisible: 'كائنات حيوانية مرئية',
  nearbyArtifactsVisible: 'نقوش مرئية',
  heardSignalsTitle: 'إشارات مسموعة بالجوار',
  noSignalsHeard: 'لا توجد إشارات صوتية في نطاق السمع حالياً.',
  localResourcesSpot: 'الموارد في الخلية الحالية',
  actionDistTitle: 'توزيع الأفعال الحالية للأحياء',
  traitAveragesTitle: 'متوسط السمات الشخصية للسكان',
  vitalsAveragesTitle: 'متوسط المؤشرات الحيوية للأحياء',
  spatialCoverageTitle: 'المعرفة المكانية ونقاط الخطر المرصودة',
  hazardsMappedTitle: 'مواقع الخطر المحفوظة',
  hazardZonesTitle: 'أبرز مناطق الخطر في ذاكرة السكان',
  mentionsLabel: 'رصد',
  severityLabel: 'الشدة',
  showMoreIds: 'عرض الكل',
  showLessIds: 'إخفاء',
  actions: {
    idle: 'سكون / تأمل',
    rest: 'راحة واستشفاء',
    move_random: 'تجول واستكشاف',
    move_to_water: 'التوجه إلى الماء',
    move_to_food: 'التوجه إلى الغذاء',
    move_north: 'التحرك شمالاً',
    move_south: 'التحرك جنوباً',
    move_east: 'التحرك شرقاً',
    move_west: 'التحرك غرباً',
    drink: 'شرب الماء',
    drink_water: 'شرب الماء',
    forage: 'جمع الغذاء',
    forage_food: 'جمع الغذاء',
    gather_wood: 'جمع الخشب',
    gather_stone: 'جمع الحجارة',
    gather_herb: 'جمع الأعشاب الطبية',
    eat_inventory: 'تناول من المخزون',
    communicate: 'إصدار إشارة تواصل',
    communicate_or_teach: 'تواصل أو تعليم',
    cooperate_share: 'تعاون ومشاركة',
    barter: 'مقايضة',
    share_or_barter: 'مشاركة أو مقايضة',
    craft_or_invent: 'صناعة وابتكار',
    craft_or_build: 'صناعة وبناء',
    carve_artifact: 'نقش وتدوين أثر',
    mark_symbol_record: 'نقش وتدوين رمز',
    attack: 'هجوم واشتباك',
    assault_or_kill: 'اعتداء أو قتل',
    steal: 'سرقة',
    flee: 'فرار',
    care_for_other: 'رعاية وعلاج',
    seek_mate: 'تقارب وتكوين أسرة',
    socialize_mate_or_mediate: 'تآلف أو وساطة',
  },
  causes: {
    starvation: 'المجاعة',
    dehydration: 'العطش الشديد',
    disease: 'المرض',
    illness_or_injury: 'المرض أو الإصابة',
    old_age: 'التقدم في العمر',
    predator: 'افتراس حيوان مفترس',
    murder: 'القتل',
    injury: 'إصابة بالغة',
    exposure: 'الطقس القاسي',
    other: 'أسباب أخرى',
    test_injury: 'إصابة اختبارية',
  },
  seasons: {
    spring: 'الربيع',
    summer: 'الصيف',
    autumn: 'الخريف',
    winter: 'الشتاء',
  },
  weather: {
    clear: 'صحو',
    rain: 'مطر',
    storm: 'عاصفة',
    flood: 'فيضان',
    drought: 'جفاف',
    frost: 'صقيع',
  },
  lifeStages: {
    infant: 'رضيع',
    child: 'طفل',
    adult: 'بالغ',
    elder: 'كبير سن',
  },
  traits: {
    boldness: 'الجرأة والمبادرة',
    empathy: 'التعاطف',
    curiosity: 'الفضول والاستكشاف',
    aggression: 'الاندفاع العدواني',
    cooperation: 'التعاون والاجتماعية',
    sociability: 'الاجتماعية',
    risk_tolerance: 'تحمل المخاطرة',
    endurance: 'القدرة على التحمل',
  },
  skills: {
    foraging: 'الجمع والالتقاط',
    tool_shaping: 'تشكيل الأدوات',
    shelter_building: 'بناء المأوى',
    cultivation: 'الاستنبات والرعاية',
    healing: 'المداواة والعلاج',
    symbol_marking: 'النقش والتدوين',
    mediation: 'الوساطة وحل النزاعات',
    crafting: 'الصناعة والأدوات',
    navigation: 'الملاحة والاتجاهات',
    combat: 'الدفاع والقتال',
    documentation: 'التدوين والنقش',
  },
  contexts: {
    water_here: 'ماء قريب',
    food_here: 'غذاء قريب',
    danger_predator: 'خطر مفترس',
    danger_hostile: 'خطر عدائي',
    trade_offer: 'عرض تبادل',
    ally_greet: 'تحية تحالف',
    help_needed: 'طلب مساعدة',
    storm_warning: 'تحذير مناخي',
    starving_for_food: 'جوع حاد (بحث عن غذاء)',
    thirsty_for_water: 'عطش حاد (بحث عن ماء)',
    predator_nearby: 'اقتراب مفترس',
    social_exchange: 'تبادل اجتماعي',
    hurt_seeking_aid: 'إصابة وطلب رعاية',
    general: 'وضع عام',
  },
  milestones: {
    first_movement_tick: 'أول حركة في العالم',
    first_interaction_tick: 'أول تفاعل بين فردين',
    first_birth_tick: 'أول ولادة',
    first_death_tick: 'أول وفاة',
    first_communication_tick: 'أول إشارة تواصل',
    first_repeated_signal_tick: 'أول تكرار مترابط لإشارة',
    first_shared_symbol_tick: 'أول رمز مشترك بين فردين',
    first_stable_protoword_tick: 'أول كلمة أولية مستقرة',
    first_grammar_sequence_tick: 'أول تركيب ثنائي (نحو أولي)',
    first_dialect_divergence_tick: 'أول تباين لهجات جغرافي',
    first_documentation_tick: 'أول نقش أو أثر مادي',
    first_history_written_tick: 'أول تفسير تاريخي متوارث',
    first_alliance_tick: 'أول تحالف / مجموعة اجتماعية',
    first_conflict_tick: 'أول نزاع عنيف',
    first_crime_tick: 'أول جريمة مسجلة',
    first_barter_tick: 'أول عملية مقايضة',
    first_market_tick: 'أول تجمع سوقي',
    first_norm_tick: 'أول قاعدة/عرف جماعي',
    first_governance_tick: 'أول آلية قيادة وانتخاب دوري',
    first_currency_exchange_tick: 'أول استخدام لرمز تبادل',
  },
  techs: {
    stone_toolmaking: 'صناعة الأدوات الحجرية',
    stone_flaking: 'تشظية الحجر',
    crude_spear: 'رمح بدائي',
    herbal_poultice: 'كمادة عشبية',
    water_gourd: 'حفظ الماء',
    simple_shelter: 'مأوى بسيط',
    clay_tablet: 'لوح طيني للتدوين',
    early_cultivation: 'رعاية النبات والزراعة الأولية',
  },
  governance: {
    informal: 'توافق عفوي غير رسمي',
    elder_council: 'مجلس كبار السن',
    single_leader: 'قيادة فردية',
    elective_assembly: 'جمعية انتخابية دورية',
    emergent_council: 'مجلس/توافق ناشئ',
    none: 'بدون بنية حكم',
    elder_consensus: 'توافق ذوي الخبرة',
  },
};

const EN: Translations = {
  appTitle: 'Civilization Statistics Observatory',
  appSubtitle: 'From Beginning to Civilization — Isolated Training Analytics, Population Telemetry & Audit',
  sourceEmpty: 'Awaiting real snapshot',
  sourcePublished: 'Published World Snapshot',
  sourceUploaded: 'Imported Local Snapshot/Batch',
  sourceTestFixture: 'Isolated Test Fixture (Preview Only)',
  sourceLiveRunner: 'Live Simulation Engine',
  testFixtureWarning: 'Notice: Viewing an isolated test fixture, not a live persistent world.',
  phaseTraining: 'Isolated Survival Training Phase (100 Agents)',
  phaseCivilization: 'Full Civilization World Phase',
  legacyAnalyticsNotice:
    'Note: This legacy snapshot predates per-tick funnel counters; only real values derived directly from stored snapshot fields are shown.',
  uploadSnapshotBtn: 'Load JSON',
  multiImportBtn: 'Multi-File / Folder Import',
  loadTestFixtureBtn: 'Preview Isolated Test Fixture',
  refreshPublishedBtn: 'Reload Published Snapshot',
  newWorldBtn: 'New Live World',
  emptyHeadline: 'No Real World Snapshot Loaded Yet',
  emptyBody:
    'This statistics observatory strictly renders authentic engine outputs from From Beginning to Civilization with zero synthetic data. Launch a live local world, import Training/Civilization JSON snapshots, or preview the isolated test fixture.',
  emptyDropHint: 'Drag & drop observatory_export.json or step files here',
  emptyStepsTitle: 'Authentic Simulation & Import Workflows',
  emptyStep1: '1. Run Isolated Training or Promote Population via manual GitHub Actions workflow.',
  emptyStep2: '2. Import single snapshots or unlimited step JSON folders with topological validation.',
  emptyStep3: '3. Inspect survival causes, 6-stage food/water funnels, and 100-agent training tables.',
  uploadErrorTitle: 'Could Not Parse Snapshot File',
  simClockLabel: 'Simulated Time',
  realClockLabel: 'Cumulative Real Runtime',
  clockRatioNote: '1 real minute = 1 simulated month (in realtime pacing mode)',
  snapshotTimeLabel: 'Snapshot Exported',
  worldIdLabel: 'World ID',
  timelineOriginal: 'Original Timeline',
  timelineExperimental: 'Experimental Rebirth Branch',
  timelineIsolatedTraining: 'Isolated Training',
  timelineBranchTick: 'Branch Tick',
  livingLabel: 'Living',
  deceasedLabel: 'Deceased',
  generationLabel: 'Max Gen',
  seasonLabel: 'Season',
  weatherLabel: 'Weather',
  tempLabel: 'Temp',

  navOverview: 'Overview',
  navPopulation: 'Population & Agents',
  navSurvival: 'Survival',
  navResources: 'Food & Water',
  navCivilization: 'Civilization & Economy',
  navLearning: 'Intelligence & RL',
  navTraining: 'Training (100)',
  navHistory: 'History & Compare',

  totalEverLived: 'Total Ever Lived',
  birthsTotal: 'Total Births',
  maleCount: 'Living Males',
  femaleCount: 'Living Females',
  avgAgeYears: 'Avg Living Age',
  youngestLiving: 'Youngest Living',
  oldestLiving: 'Oldest Living',
  birthRate1k: 'Birth Rate / 1,000',
  deathRate1k: 'Death Rate / 1,000',
  netGrowthRate1k: 'Net Growth / 1,000',
  genBreakdownTitle: 'Generations Breakdown',
  familyUnitsCount: 'Family Units',
  avgFamilySize: 'Avg Family Size',
  independentAdults: 'Independent Adults',
  dependentsCount: 'Dependents (Infants/Children)',

  survTitle: 'Survival Analytics & True Mortality Causes',
  avgLifespan: 'Average Lifespan',
  longestLifespan: 'Longest Lifespan',
  shortestLifespan: 'Shortest Lifespan',
  prematureDeaths: 'Premature Deaths',
  prematureRate: 'Premature Death Rate',
  naturalVsViolent: 'Natural vs Violent Deaths',
  naturalDeaths: 'Natural / Environmental',
  violentDeaths: 'Violent / Predation',
  deathsByCauseTitle: 'Mortality Breakdown by True Cause',
  survivalByGenTitle: 'Avg Survival per Generation (ticks)',
  noDeathsRecorded: 'No deaths recorded yet in this snapshot.',

  resTitle: 'Food & Water Analytics + 6-Stage Funnel',
  availConsumableFood: 'Consumable Food Available',
  foodConsumedTotal: 'Total Food Consumed',
  foodConsRate: 'Food Consumption Rate/tick',
  availWaterSources: 'Active Water Cells/Sources',
  waterConsumedTotal: 'Total Water Consumed',
  waterConsRate: 'Water Consumption Rate/tick',
  agentsHungry: 'Agents Experiencing Hunger',
  agentsThirsty: 'Agents Experiencing Thirst',
  avgHungerDur: 'Avg Hunger Duration (ticks)',
  avgThirstDur: 'Avg Thirst Duration (ticks)',
  starvationDeaths: 'Starvation Deaths',
  dehydrationDeaths: 'Dehydration Deaths',
  nearbyFoodFailures: 'Nearby Food Reach Failures',
  nearbyWaterFailures: 'Nearby Water Reach Failures',
  foodFunnelTitle: '6-Stage Food Interaction Funnel',
  waterFunnelTitle: '6-Stage Water Interaction Funnel',
  regionalResourcesTitle: 'Regional Resources & Population Comparison (Quadrants)',
  regionLabel: 'Quadrant',
  funnelStages: {
    absent: '1. Resource Absent',
    present_undiscovered: '2. Present, Undiscovered',
    discovered_no_decision: '3. Discovered, No Move Decision',
    decision_move_failed: '4. Move Decision Failed',
    reached_consume_failed: '5. Reached, Consume Failed',
    consumed_success: '6. Consumed Successfully',
  },

  econProdConsTitle: 'Cumulative Production & Consumption',
  foodCultivated: 'Food Cultivated',
  woodGathered: 'Wood Gathered',
  stoneGathered: 'Stone Gathered',
  herbGathered: 'Herbs Gathered',
  toolsCrafted: 'Tools Crafted',
  storedInventoriesTitle: 'Total Living Agent Inventories',
  scarceResourcesTitle: 'Currently Scarce Resources',
  noScarceResources: 'No acute resource scarcity flagged.',
  wealthDistTitle: 'Inventory Wealth Distribution (Living)',
  giniIndex: 'Gini Coefficient',
  medianInventory: 'Median Inventory',
  maxInventory: 'Max Individual Inventory',
  top10Share: 'Top 10% Share',

  learnTitle: 'Experiential & Reinforcement Learning Telemetry',
  expStored: 'Experiences Recorded',
  totalBrainUpdates: 'Total Brain Updates',
  skillsAcquired: 'Total Skills Acquired',
  avgSkillsPerAgent: 'Avg Skills / Agent',
  foodDiscoverReach: 'Food Discover / Reach Events',
  waterDiscoverReach: 'Water Discover / Reach Events',
  episodicTotal: 'Episodic Memories',
  spatialTotal: 'Spatial Maps',
  intergenTransfers: 'Intergenerational Transfers',
  updatesStdDev: 'Update Variance (StdDev)',
  rewardStdDev: 'Reward Variance (StdDev)',
  repeatedErrors: 'Repeated Failed Actions',
  postNegSwitches: 'Post-Negative Decision Switches',
  rlScopeBadge: 'Statistical RL optimization metrics only — not general consciousness',

  trainTitle: 'Isolated Survival Training System (100 Agents)',
  trainSubtitle:
    '100 independent individuals trained across 100 identically-templated isolated worlds with cause-linked death-penalty rebirth.',
  trainNoData:
    'No isolated training telemetry attached to this snapshot (run start-training or promote a population from trained_population.bundle).',
  trainTicksExec: 'Training Ticks Executed',
  trainTotalAttempts: 'Total Attempts',
  trainTotalDeaths: 'Training Deaths',
  trainAvgSurvival: 'Avg Survival / Attempt',
  trainLongestSurvival: 'Longest Survival Span',
  trainStageMatrixTitle: '4-Stage Learning Totals (Discover -> Decide -> Reach -> Consume)',
  trainProgressionChartTitle: 'Survival & Learning Progression Across Training Ticks',
  trainTableTitle: '100-Agent Training Comparison Table',
  trainSearchPlaceholder: 'Filter by Agent ID or Cause...',
  trainSortBy: 'Sort by:',
  trainColAgent: 'Agent',
  trainColAttempts: 'Attempts',
  trainColDeaths: 'Deaths',
  trainColLongest: 'Longest',
  trainColAvgSurv: 'Avg Surv',
  trainColFoodStages: 'Food (D/Dec/R/C)',
  trainColWaterStages: 'Water (D/Dec/R/C)',
  trainColSkillsMem: 'Skills/Mem',
  trainColLearnScore: 'Learn Score',
  trainColLastCause: 'Last Cause',
  trainColStatus: 'Status',
  trainAttemptHistoryTitle: 'Individual Attempt History in Isolated Env',

  searchAgentPlaceholder: 'Jump to Agent ID (e.g. 14)',
  searchButton: 'Inspect',
  selectAgentPrompt: 'Select an individual from the registry or search by ID to inspect brain state, skills, and memories.',
  agentNotFound: 'No individual with that ID exists in this snapshot.',
  statusAlive: 'Living',
  statusDeceased: 'Permanently Deceased',
  sexF: 'Female',
  sexM: 'Male',
  ageYears: 'yrs',
  tickUnit: 'tick',
  genShort: 'Gen',
  coordsLabel: 'Coordinates',
  vitalsSection: 'Vitals & Status',
  health: 'Health',
  hunger: 'Hunger',
  thirst: 'Thirst',
  energy: 'Energy',
  injury: 'Injury',
  disease: 'Disease',
  pregnant: 'Pregnant',
  currentAction: 'Current Action',
  lastSignal: 'Last Emitted Token',
  causeOfDeath: 'Cause of Death',
  deathTick: 'Death Tick',
  rebirthSection: 'Rebirth & Death-Penalty Learning',
  rebirthCountLabel: 'Rebirths',
  originalDeathLabel: 'Prior Death',
  rebirthTickLabel: 'Rebirth Tick',
  deathPenaltyLabel: 'Neural Death Penalty Update',
  brainFingerprintLabel: 'Brain Weight Fingerprint',
  evidenceCuesLabel: 'Preceding Local Cues',
  traitsSection: 'Independent Traits',
  skillsSection: 'Acquired Skills',
  inventorySection: 'Inventory',
  lexiconSection: 'Personal Lexicon',
  episodicMemorySection: 'Episodic Memories',
  spatialMemorySection: 'Spatial Mental Map',
  socialTiesSection: 'Social Familiarity & Trust',
  familySection: 'Family & Lineage',
  parentsLabel: 'Parents',
  childrenLabel: 'Children',
  noParentsFounders: 'Gen-0 Founder (no parents)',
  noChildrenYet: 'No recorded offspring yet',
  noMemoriesYet: 'No recorded memories in window.',
  noLexiconYet: 'No personal lexicon formed yet.',
  noTiesYet: 'No social ties recorded yet.',
  emptyInventory: 'Inventory empty.',
  popFilterAll: 'All',
  popFilterLiving: 'Living',
  popFilterDeceased: 'Deceased',
  ageDistTitle: 'Living Age Distribution',
  familyTreeTitle: 'Interactive Family Tree',
  selectRootForTree: 'Select an individual from the registry to inspect ancestors and descendants.',
  civLangTitle: 'Emergent Language & Communication',
  civEconTitle: 'Economy & Exchange',
  civSocietyTitle: 'Society, Norms & Governance',
  civKnowledgeTitle: 'Knowledge & Discovered Tech',
  civCrimeTitle: 'Crime, Justice & Stability',
  notYetInvented: 'Not yet invented in this world',
  engineScopeNoteTitle: 'Observatory Analytical Scope',
  engineScopeNoteBody:
    'Displays authentic per-tick statistics directly from the Python simulation engine (population, 6-stage resource funnels, emergent language, economy, RL metrics, and 3-layer history) without synthetic UI data.',
  activeTokens: 'Active Tokens',
  stableProtowords: 'Stable Proto-Words',
  adoptersLabel: 'adopters',
  extinctWordLabel: 'extinct',
  topBigrams: 'Top Bigram Sequences',
  dialects: 'Regional Dialects',
  semanticDrift: 'Semantic Drift Events',
  intergenTransmission: 'Intergenerational Transmissions',
  extinctTokens: 'Extinct Tokens',
  totalBarters: 'Total Barters',
  emergentMarkets: 'Emergent Markets',
  exchangeHubsCount: 'Exchange Hubs',
  currencyTokens: 'Currency Token',
  activeGroups: 'Active Groups',
  collapsedInstitutions: 'Collapsed Institutions',
  governanceType: 'Governance Pattern',
  normsLabel: 'Emergent Norms',
  leaderLabel: 'Leader',
  membersLabel: 'Members',
  nextElectionLabel: '10y Renewal Cycle',
  discoveredTechs: 'Discovered Technologies',
  surfaceArtifacts: 'Surface Artifacts',
  totalCrimes: 'Total Crimes',
  crimeRate1k: 'Rate / 1,000 Pop',
  recentCrimeRate1k: '180d Rate / 1,000',
  murderRate: 'Murder / 1,000',
  assaultRate: 'Assault / 1,000',
  theftRate: 'Theft / 1,000',
  disputeResolution: 'Dispute Resolution',
  socialTrust: 'Social Trust Index',
  stabilityIndex: 'Stability Index',
  insufficientWindow: 'Insufficient observation window (< 90 sim days or < 20 living)',
  repeatOffenders: 'Repeat Offenders',
  lastCrimeLabel: 'Last Crime',
  cooperationLabel: 'Cooperation Events',
  mutualAidLabel: 'Mutual Aid Events',
  teachingLabel: 'Teaching Events',
  cultivationLabel: 'Cultivation Events',
  historyFilterAll: 'All Event Types',
  historyFilterYearPlaceholder: 'Filter by Year...',
  historyFilterAgentPlaceholder: 'Participant ID...',
  historySortNewest: 'Newest First',
  historySortOldest: 'Oldest First',
  historyPhaseAll: 'All Phases',
  historyPhasePreRebirth: 'Pre-Rebirth',
  historyPhasePostRebirth: 'Post-Rebirth Branch',
  eventDetailTitle: 'Documented Event Record',
  milestonesTitle: 'First Emergence Milestones',
  layer1Title: 'Layer 1: Ground Truth (Observer Only)',
  layer1Subtitle: 'Exact engine record — completely hidden from agents',
  layer2Title: 'Layer 2: Witness Accounts & Artifacts',
  layer2Subtitle: 'Local witness perceptions (may be distorted) and physical carvings',
  layer3Title: 'Layer 3: Generational Interpretations',
  layer3Subtitle: 'How descendant generations reinterpreted surviving artifacts',
  inspectLocationBtn: 'Pin Event Coordinates',
  clearReplayBtn: 'Clear Selection',
  replayingBanner: 'Inspecting Historical Event Record',
  replayFrameHonesty: 'Displays exact recorded coordinates and participating agent IDs without fabricating missing ticks.',
  noEventsMatched: 'No recorded events match these filters.',
  telemetryPopChart: 'Population Trajectory (Living, Deceased, Births)',
  telemetryResourceChart: 'Ecosystem Biomass & Fauna Over Time',
  telemetryCultureCrimeChart: 'Language, Barter & Crime Rate Over Time',
  telemetryNoSeries: 'Multi-point time series populates automatically across >= 30 ticks.',
  foodBiomass: 'Food Flora',
  waterTotal: 'Surface & Spring Water',
  woodBiomass: 'Wood Flora',
  herbivores: 'Herbivores',
  predators: 'Predators',
  soilMoisture: 'Avg Soil Moisture',
  tlPlay: 'Play',
  tlPause: 'Pause',
  tlStep: 'Step +1',
  tlSpeed: 'Speed',
  tlBranchRebirth: 'Branch Experimental Rebirth',
  tlHistoricalPreview: 'Historical Preview Mode (Read-Only)',
  tlReturnLive: 'Return to Live Head',
  tlTimelineSelector: 'Timeline',
  cmpTitle: 'Original vs Experimental Rebirth Timeline',
  cmpOriginalLabel: 'Original Timeline (Parent)',
  cmpExperimentalLabel: 'Experimental Rebirth Branch',
  cmpNoPairs: 'Load or branch an Original + Experimental timeline pair to inspect live delta comparison.',
  cmpSurvivalRate: 'Survival Rate',
  cmpRebirthAuditTitle: 'Revived Individuals & Post-Rebirth Audit',
  impTitle: 'Unlimited Multi-File JSON & Topological Sequencer',
  impSelectFiles: 'Select JSON Files (Unlimited)',
  impSelectFolder: 'Import Entire Folder',
  impProcessing: 'Inspecting metadata & solving topological sequence...',
  impAccepted: 'Ordered & Valid Files',
  impQuarantined: 'Corrupted Quarantine',
  impUnindexed: 'Unindexed Review Queue',
  impWarnings: 'Sequence Gaps & Warnings',
  impCycles: 'Dependency Cycles',
  impCommitBtn: 'Atomically Load Selected Timeline',
  impRollbackBtn: 'Rollback Previous State',
  impCloseBtn: 'Close',
  diagButton: 'Diagnostics',
  diagTitle: 'System Diagnostics & Crash Guard',
  diagModeLabel: 'Observatory Mode',
  diagCycleLabel: 'Population Cycle',
  diagSchemaLabel: 'Snapshot Schema',
  diagErrorLogLabel: 'Captured Browser Errors',
  diagNoErrors: 'No client runtime errors recorded in this session.',
  diagClearBtn: 'Clear Log',
  diagCopyBtn: 'Copy JSON Report',
  diagCopied: 'Copied',
  diagDownloadBtn: 'Download Report',
  recoverySectionTitle: 'Post-Extinction Recovery Cycles',
  recoveryCurrentCycle: 'Active Cycle',
  recoveryCountLabel: 'Recovery Cycles',
  recoveryNoCycles: 'Auto-recovery disabled after promotion or no extinction cycles triggered yet.',
  recoveryFoundersLabel: 'New Founders',
  recoveryBirthsLabel: 'Subsequent Births',
  recoveryDurationLabel: 'Survival Span',
  recoveryArchiveLabel: 'Pre-Recovery Archive',
  learningSectionTitle: 'Neural Learning Telemetry',
  learningUpdates: 'Avg Updates/Agent',
  learningTdError: 'Mean TD Error',
  learningEntropy: 'Policy Entropy',
  learningLoss: 'Mean Loss',
  learningReward: 'Recent Reward',
  deceptionRate: 'Deception',
  whatLearnedSection: 'What Agents Learned (Action Outcomes)',
  learnedPositiveHabits: 'Reinforced Habits (Positive EMA)',
  learnedAvoidedActions: 'Avoided / Penalized Actions (Negative EMA)',
  trialsLabel: 'trials',
  avgOutcomeReward: 'Weighted Avg Outcome',
  noLearnedOutcomesYet: 'No experiential action outcome statistics accumulated yet.',
  recentCognitiveContexts: 'Recent Cognitive Contexts in Buffer',
  learnedBehaviorsNote: 'Derived directly from neural action_outcomes EMA rewards and experiential replay buffers.',
  trustDistrustTitle: 'Trust & Distrust Network',
  trustedAllies: 'Trusted Allies',
  distrustedAgents: 'Distrusted Individuals',
  neutralAcquaintances: 'Neutral Acquaintances',
  trustScore: 'Trust',
  familiarityScore: 'Familiarity',
  avoidedHazards: 'Remembered Spatial Hazards',
  noTrustedYet: 'No positive trust ties (> 0.15) formed yet.',
  noDistrustedYet: 'No distrust ties (< -0.15) recorded yet.',
  noHazardsMapped: 'No hazard coordinates stored in mental map.',
  trustNetworkSummaryTitle: 'Population Trust & Distrust Summary',
  mostTrustedTitle: 'Most Trusted Individuals',
  mostDistrustedTitle: 'Most Distrusted Individuals',
  trustedTiesCount: 'Trusted Ties',
  distrustedTiesCount: 'Distrusted Ties',
  neutralTiesCount: 'Neutral Ties',
  avgTrustIndex: 'Mean Pairwise Trust',
  avgFamiliarityIndex: 'Mean Familiarity',
  incomingTiesLabel: 'incoming ties',
  skillLeaderboardTitle: 'Population Skill Mastery',
  topMasterLabel: 'Top Agent',
  skilledAgentsCount: 'Agents > 0',
  avgProficiency: 'Average',
  peakProficiency: 'Peak',
  neuralNetworkTitle: 'Neural Network Telemetry',
  nnArchitecture: 'Architecture',
  nnBackend: 'Execution Backend',
  nnOptimizer: 'Optimizer',
  nnParameters: 'Parameters',
  nnLearningRate: 'Learning Rate',
  nnUpdatesCount: 'Total Updates',
  nnExpBuffer: 'Experience Buffer',
  nnPolicyLoss: 'Policy Loss',
  nnValueLoss: 'Value Loss',
  nnTdError: 'Mean TD Error',
  nnEntropy: 'Policy Entropy',
  nnEntropyRange: 'Entropy Range (Min – Mean – Max)',
  nnWeightNorm: 'Weight L2 Norm',
  nnHiddenNorm: 'Hidden State L2 Norm',
  nnWeightFingerprint: 'Weight Fingerprint',
  nnRecentReward: 'Recent Mean Reward',
  nnDeathPenalties: 'Death Penalty Updates',
  nnTopBrainsTitle: 'Top Trained Neural Brains',
  nnLegacyUnavailable: 'Notice: Legacy snapshot omits per-agent GRU weight norms and loss telemetry.',
  sensoryPerceptionTitle: 'Local Sensory Perception (Non-Telepathic)',
  visionRangeLabel: 'Vision Radius',
  hearingRangeLabel: 'Hearing Radius',
  nearbyAgentsVisible: 'Visible Agents',
  nearbyFaunaVisible: 'Visible Fauna',
  nearbyArtifactsVisible: 'Visible Artifacts',
  heardSignalsTitle: 'Heard Vocal Signals',
  noSignalsHeard: 'No vocal signals heard within hearing radius.',
  localResourcesSpot: 'Local Cell Resources',
  actionDistTitle: 'Living Population Action Distribution',
  traitAveragesTitle: 'Population Trait Averages',
  vitalsAveragesTitle: 'Living Vitals Averages',
  spatialCoverageTitle: 'Spatial Knowledge & Hazard Mapping',
  hazardsMappedTitle: 'Hazards Mapped',
  hazardZonesTitle: 'Top Remembered Hazard Coordinates',
  mentionsLabel: 'mentions',
  severityLabel: 'severity',
  showMoreIds: 'Show all',
  showLessIds: 'Collapse',
  actions: {
    idle: 'Idle',
    rest: 'Rest / Recover',
    move_random: 'Roam / Explore',
    move_to_water: 'Move to Water',
    move_to_food: 'Move to Food',
    move_north: 'Move North',
    move_south: 'Move South',
    move_east: 'Move East',
    move_west: 'Move West',
    drink: 'Drink Water',
    drink_water: 'Drink Water',
    forage: 'Forage Food',
    forage_food: 'Forage Food',
    gather_wood: 'Gather Wood',
    gather_stone: 'Gather Stone',
    gather_herb: 'Gather Herbs',
    eat_inventory: 'Eat from Inventory',
    communicate: 'Emit Vocal Signal',
    communicate_or_teach: 'Communicate / Teach',
    cooperate_share: 'Cooperate & Share',
    barter: 'Barter',
    share_or_barter: 'Share or Barter',
    craft_or_invent: 'Craft / Experiment',
    craft_or_build: 'Craft / Build',
    carve_artifact: 'Carve Surface Artifact',
    mark_symbol_record: 'Mark Symbol / Record',
    attack: 'Attack',
    assault_or_kill: 'Assault / Conflict',
    steal: 'Steal',
    flee: 'Flee',
    care_for_other: 'Care / Heal',
    seek_mate: 'Seek Mate',
    socialize_mate_or_mediate: 'Socialize / Mediate',
  },
  causes: {
    starvation: 'Starvation',
    dehydration: 'Dehydration',
    disease: 'Disease',
    illness_or_injury: 'Illness or Injury',
    old_age: 'Old Age',
    predator: 'Predator Attack',
    murder: 'Homicide',
    injury: 'Severe Injury',
    exposure: 'Exposure',
    other: 'Other',
    test_injury: 'Test Injury',
  },
  seasons: {
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    winter: 'Winter',
  },
  weather: {
    clear: 'Clear',
    rain: 'Rain',
    storm: 'Storm',
    flood: 'Flood',
    drought: 'Drought',
    frost: 'Frost',
  },
  lifeStages: {
    infant: 'Infant',
    child: 'Child',
    adult: 'Adult',
    elder: 'Elder',
  },
  traits: {
    boldness: 'Boldness',
    empathy: 'Empathy',
    curiosity: 'Curiosity',
    aggression: 'Aggression',
    cooperation: 'Cooperation',
    sociability: 'Sociability',
    risk_tolerance: 'Risk Tolerance',
    endurance: 'Endurance',
  },
  skills: {
    foraging: 'Foraging',
    tool_shaping: 'Tool Shaping',
    shelter_building: 'Shelter Building',
    cultivation: 'Cultivation',
    healing: 'Healing',
    symbol_marking: 'Symbol Marking',
    mediation: 'Mediation',
    crafting: 'Crafting',
    navigation: 'Navigation',
    combat: 'Combat',
    documentation: 'Documentation',
  },
  contexts: {
    water_here: 'Water Nearby',
    food_here: 'Food Nearby',
    danger_predator: 'Predator Danger',
    danger_hostile: 'Hostile Danger',
    trade_offer: 'Trade Offer',
    ally_greet: 'Ally Greeting',
    help_needed: 'Help Needed',
    storm_warning: 'Weather Warning',
    starving_for_food: 'Acute Hunger',
    thirsty_for_water: 'Acute Thirst',
    predator_nearby: 'Predator Nearby',
    social_exchange: 'Social Exchange',
    hurt_seeking_aid: 'Injured / Seeking Aid',
    general: 'General State',
  },
  milestones: {
    first_movement_tick: 'First Movement',
    first_interaction_tick: 'First Interaction',
    first_birth_tick: 'First Birth',
    first_death_tick: 'First Death',
    first_communication_tick: 'First Communication Signal',
    first_repeated_signal_tick: 'First Repeated Signal',
    first_shared_symbol_tick: 'First Shared Symbol',
    first_stable_protoword_tick: 'First Stable Proto-Word',
    first_grammar_sequence_tick: 'First Grammar Bigram',
    first_dialect_divergence_tick: 'First Dialect Divergence',
    first_documentation_tick: 'First Surface Artifact',
    first_history_written_tick: 'First Generational History',
    first_alliance_tick: 'First Alliance / Group',
    first_conflict_tick: 'First Conflict',
    first_crime_tick: 'First Crime',
    first_barter_tick: 'First Barter',
    first_market_tick: 'First Emergent Market',
    first_norm_tick: 'First Collective Norm',
    first_governance_tick: 'First Governance & Election',
    first_currency_exchange_tick: 'First Currency Token Exchange',
  },
  techs: {
    stone_toolmaking: 'Stone Toolmaking',
    stone_flaking: 'Stone Flaking',
    crude_spear: 'Crude Spear',
    herbal_poultice: 'Herbal Poultice',
    water_gourd: 'Water Gourd',
    simple_shelter: 'Simple Shelter',
    clay_tablet: 'Clay Tablet',
    early_cultivation: 'Early Plant Tending',
  },
  governance: {
    informal: 'Informal Association',
    elder_council: 'Elder Council',
    single_leader: 'Single Leader',
    elective_assembly: 'Elective Assembly',
    emergent_council: 'Emergent Council',
    none: 'None',
    elder_consensus: 'Elder Consensus',
  },
};

export function getTranslations(locale: Locale): Translations {
  return locale === 'ar' ? AR : EN;
}
