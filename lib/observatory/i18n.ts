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
  qualityLow: string;
  qualityMedium: string;
  qualityHigh: string;
  qualityUltra: string;
  fpsLabel: string;
  softwareGlBanner: string;
  zenEnter: string;
  zenExit: string;
  resetCamera: string;
  followAgent: string;
  followingAgent: string;
  stopFollow: string;
  enterFpv: string;
  exitFpv: string;
  fpvTitle: string;
  fpvSubtitle: string;
  fpvVisionRadius: string;
  fpvHearingRadius: string;
  fpvVisibleAgents: string;
  fpvVisibleFauna: string;
  fpvVisibleArtifacts: string;
  fpvLocalResources: string;
  fpvHeardSignals: string;
  fpvNoSignals: string;
  fpvBlindNotice: string;
  simClockLabel: string;
  realClockLabel: string;
  clockRatioNote: string;
  snapshotTimeLabel: string;
  worldIdLabel: string;
  timelineOriginal: string;
  timelineExperimental: string;
  timelineBranchTick: string;
  livingLabel: string;
  deceasedLabel: string;
  generationLabel: string;
  seasonLabel: string;
  weatherLabel: string;
  tempLabel: string;
  tabInspector: string;
  tabPopulation: string;
  tabCivilization: string;
  tabHistory: string;
  tabTelemetry: string;
  tabComparison: string;
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
  replayEventBtn: string;
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
  // Comparison Drawer
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
  appTitle: 'مرصد الحضارة',
  appSubtitle: 'البداية إلى الحضارة — المحاكاة الحضارية والخطوط الزمنية',
  sourceEmpty: 'بانتظار لقطة محاكاة',
  sourcePublished: 'لقطة حقيقية منشورة',
  sourceUploaded: 'ملف/حزمة محلية مستوردة',
  sourceTestFixture: 'بيانات اختبارية تجريبية (معزولة)',
  sourceLiveRunner: 'محاكاة حية عبر المحرك',
  testFixtureWarning: 'تنبيه: هذه اللقطة اختبارية معزولة وليست عالماً حياً مستمراً.',
  uploadSnapshotBtn: 'رفع ملف JSON',
  multiImportBtn: 'استيراد ملفات / مجلدات',
  loadTestFixtureBtn: 'معاينة بيانات اختبارية معزولة',
  refreshPublishedBtn: 'تحديث اللقطة المنشورة',
  newWorldBtn: 'عالم جديد حي',
  emptyHeadline: 'لا توجد لقطة عالم حقيقية محمّلة بعد',
  emptyBody:
    'يعرض هذا المرصد الحالة الفعلية لمحرك البداية إلى الحضارة فقط دون اصطناع تاريخ أو مبانٍ غير موجودة. يمكنك تشغيل عالم حي محلي، أو استيراد ملف أو مجلد كامل من مخرجات المحرك، أو معاينة البيئة الاختبارية.',
  emptyDropHint: 'اسحب وأفلت ملف observatory_export.json أو مجلد الخطوات هنا',
  emptyStepsTitle: 'مسارات التشغيل والاستيراد الحقيقية',
  emptyStep1: '1. أنشئ عالماً حياً عبر الخادم المحلي، أو شغّل Workflow المحاكاة يدوياً على GitHub.',
  emptyStep2: '2. استورد ملفاً واحداً أو مئات ملفات الخطوات مع التحقق التسلسلي والطوبولوجي.',
  emptyStep3: '3. أنشئ فرعاً زمنياً تجريبياً لإحياء المتوفين ومقارنة النتائج بين الخطين.',
  uploadErrorTitle: 'تعذّر قراءة ملف اللقطة',
  qualityLow: 'منخفضة',
  qualityMedium: 'متوسطة',
  qualityHigh: 'عالية',
  qualityUltra: 'فائقة',
  fpsLabel: 'إطار/ث',
  softwareGlBanner: 'تم رصد مُصيّر رسومي برمجي — ضُبطت الوتيرة تلقائياً لحماية السلاسة.',
  zenEnter: 'وضع السينما',
  zenExit: 'إظهار الواجهة',
  resetCamera: 'نظرة عامة للعالم',
  followAgent: 'تتبّع الفرد',
  followingAgent: 'جارٍ تتبّع الفرد',
  stopFollow: 'إيقاف التتبّع',
  enterFpv: 'مشاهدة من عينيه (FPV)',
  exitFpv: 'الخروج من المنظور الشخصي',
  fpvTitle: 'الإدراك الحسي المقيّد للفرد',
  fpvSubtitle: 'رؤية وسمع محليان بالكامل — بدون معرفة غيبية بالعالم أو بنوايا المتحدثين',
  fpvVisionRadius: 'نطاق الرؤية',
  fpvHearingRadius: 'نطاق السمع',
  fpvVisibleAgents: 'أفراد ضمن البصر',
  fpvVisibleFauna: 'حيوانات مرئية',
  fpvVisibleArtifacts: 'آثار ونقوش مرئية',
  fpvLocalResources: 'تقدير الموارد الموضعية',
  fpvHeardSignals: 'إشارات صوتية وإيماءات مسموعة',
  fpvNoSignals: 'لم يلتقط أي إشارات صوتية في النطاق القريب.',
  fpvBlindNotice: 'المعنى المقصود للمتحدث مخفي عمداً — الفرد يسمع الرمز والإيماءة فقط.',
  simClockLabel: 'الزمن المحاكى',
  realClockLabel: 'الزمن الفعلي التراكمي',
  clockRatioNote: '1 دقيقة فعلية = 1 شهر محاكى (في الوضع الزمني الحقيقي)',
  snapshotTimeLabel: 'توقيت اللقطة',
  worldIdLabel: 'معرّف العالم',
  timelineOriginal: 'الخط الأصلي',
  timelineExperimental: 'فرع الإحياء التجريبي',
  timelineBranchTick: 'نقطة التفرّع',
  livingLabel: 'أحياء',
  deceasedLabel: 'متوفون',
  generationLabel: 'أعلى جيل',
  seasonLabel: 'الفصل',
  weatherLabel: 'الطقس',
  tempLabel: 'الحرارة',
  tabInspector: 'الفرد',
  tabPopulation: 'السكان والأنساب',
  tabCivilization: 'الأنظمة الحضارية',
  tabHistory: 'التاريخ والأحداث',
  tabTelemetry: 'المؤشرات والزمن',
  tabComparison: 'مقارنة الخطوط',
  searchAgentPlaceholder: 'ابحث برقم الفرد (مثال: 14)',
  searchButton: 'انتقال',
  selectAgentPrompt: 'انقر على أي فرد في العالم ثلاثي الأبعاد أو ابحث برقمه لمعاينة عقله وذاكرته.',
  agentNotFound: 'لم يُعثر على فرد بهذا المعرّف في اللقطة الحالية.',
  statusAlive: 'حي',
  statusDeceased: 'متوفى نهائياً',
  sexF: 'أنثى',
  sexM: 'ذكر',
  ageYears: 'سنة',
  tickUnit: 'خطوة',
  genShort: 'جيل',
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
  originalDeathLabel: 'الوفاة الأصلية',
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
  selectRootForTree: 'اختر فرداً من السجل أو العالم لعرض شجرة والديه وأحفاده.',
  civLangTitle: 'اللغة الناشئة والتواصل',
  civEconTitle: 'الاقتصاد والتبادل',
  civSocietyTitle: 'المجتمع والحكم والمعايير',
  civKnowledgeTitle: 'المعرفة والتقنيات المكتشفة',
  civCrimeTitle: 'الجريمة والعدالة والاستقرار',
  notYetInvented: 'لم ينشأ بعد في هذا العالم',
  engineScopeNoteTitle: 'نطاق تمثيل البيئة الفيزيائية في المحرك',
  engineScopeNoteBody:
    'المحرك الحالي لا يخزن شبكة مبانٍ أو طرق معبدة أو مزارع مزروعة. تظهر في المشهد فقط الآثار والنقوش السطحية ومراكز التبادل الفعلية ومؤشر تقنية المأوى البدائي عند اكتشافها.',
  activeTokens: 'الرموز النشطة',
  stableProtowords: 'كلمات أولية مستقرة',
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
  replayEventBtn: 'إعادة عرض موقع الحدث',
  clearReplayBtn: 'إنهاء معاينة الحدث',
  replayingBanner: 'معاينة موقع الحدث التاريخي',
  replayFrameHonesty: 'يعرض المرصد الموقع الدقيق والأفراد المشاركين من السجل الفعلي دون تلفيق إطارات وسيطة مفقودة.',
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
  appTitle: 'Civilization Observatory',
  appSubtitle: 'From Beginning to Civilization — Interactive Simulation & Experimental Timelines',
  sourceEmpty: 'Awaiting real snapshot',
  sourcePublished: 'Published World Snapshot',
  sourceUploaded: 'Imported Local Snapshot/Batch',
  sourceTestFixture: 'Isolated Test Fixture (Preview Only)',
  sourceLiveRunner: 'Live Simulation Engine',
  testFixtureWarning: 'Notice: Viewing an isolated test fixture, not a live persistent world.',
  uploadSnapshotBtn: 'Load JSON',
  multiImportBtn: 'Multi-File / Folder Import',
  loadTestFixtureBtn: 'Preview Isolated Test Fixture',
  refreshPublishedBtn: 'Reload Published Snapshot',
  newWorldBtn: 'New Live World',
  emptyHeadline: 'No Real World Snapshot Loaded Yet',
  emptyBody:
    'This observatory strictly renders authentic engine outputs from From Beginning to Civilization without inventing buildings, history, or outcomes. Launch a live local world, import multi-file JSON sequences/folders, or preview the isolated test fixture.',
  emptyDropHint: 'Drag & drop observatory_export.json or step files here',
  emptyStepsTitle: 'Authentic Simulation & Import Workflows',
  emptyStep1: '1. Launch a live world via the local runner or run the manual GitHub Actions workflow.',
  emptyStep2: '2. Import single snapshots or unlimited step JSON folders with topological validation.',
  emptyStep3: '3. Branch experimental Rebirth timelines to revive deceased agents and compare outcomes.',
  uploadErrorTitle: 'Could Not Parse Snapshot File',
  qualityLow: 'Low',
  qualityMedium: 'Medium',
  qualityHigh: 'High',
  qualityUltra: 'Ultra',
  fpsLabel: 'FPS',
  softwareGlBanner: 'Software WebGL detected — frame pacing adjusted automatically for responsiveness.',
  zenEnter: 'Cinema Mode',
  zenExit: 'Show Controls',
  resetCamera: 'World Overview',
  followAgent: 'Follow Agent',
  followingAgent: 'Following Agent',
  stopFollow: 'Stop Follow',
  enterFpv: 'First-Person View (FPV)',
  exitFpv: 'Exit FPV',
  fpvTitle: 'Bounded Individual Sensory View',
  fpvSubtitle: 'Strictly local vision & hearing — zero global omniscience or speaker intent leakage',
  fpvVisionRadius: 'Vision Radius',
  fpvHearingRadius: 'Hearing Radius',
  fpvVisibleAgents: 'Visible Agents',
  fpvVisibleFauna: 'Visible Fauna',
  fpvVisibleArtifacts: 'Visible Artifacts',
  fpvLocalResources: 'Local Resource Readings',
  fpvHeardSignals: 'Heard Vocal Tokens & Gestures',
  fpvNoSignals: 'No vocal signals heard within local range.',
  fpvBlindNotice: 'Speaker internal intent is intentionally hidden — the observer hears only raw token & gesture.',
  simClockLabel: 'Simulated Time',
  realClockLabel: 'Cumulative Real Runtime',
  clockRatioNote: '1 real minute = 1 simulated month (in realtime pacing mode)',
  snapshotTimeLabel: 'Snapshot Exported',
  worldIdLabel: 'World ID',
  timelineOriginal: 'Original Timeline',
  timelineExperimental: 'Experimental Rebirth Branch',
  timelineBranchTick: 'Branch Tick',
  livingLabel: 'Living',
  deceasedLabel: 'Deceased',
  generationLabel: 'Max Gen',
  seasonLabel: 'Season',
  weatherLabel: 'Weather',
  tempLabel: 'Temp',
  tabInspector: 'Agent',
  tabPopulation: 'Population & Tree',
  tabCivilization: 'Systems',
  tabHistory: 'History & Replay',
  tabTelemetry: 'Telemetry',
  tabComparison: 'Compare Timelines',
  searchAgentPlaceholder: 'Jump to Agent ID (e.g. 14)',
  searchButton: 'Go',
  selectAgentPrompt: 'Click any individual in the 3D world or search by ID to inspect brain state and memories.',
  agentNotFound: 'No individual with that ID exists in this snapshot.',
  statusAlive: 'Living',
  statusDeceased: 'Permanently Deceased',
  sexF: 'Female',
  sexM: 'Male',
  ageYears: 'yrs',
  tickUnit: 'tick',
  genShort: 'Gen',
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
  selectRootForTree: 'Select an individual from the registry or 3D scene to inspect ancestors and descendants.',
  civLangTitle: 'Emergent Language & Communication',
  civEconTitle: 'Economy & Exchange',
  civSocietyTitle: 'Society, Norms & Governance',
  civKnowledgeTitle: 'Knowledge & Discovered Tech',
  civCrimeTitle: 'Crime, Justice & Stability',
  notYetInvented: 'Not yet invented in this world',
  engineScopeNoteTitle: 'Engine Physical Representation Scope',
  engineScopeNoteBody:
    'The current engine does not store constructed buildings, paved roads, or tilled farm grids. Only authentic surface artifacts, active exchange hubs, and the simple_shelter tech milestone (when discovered) are represented.',
  activeTokens: 'Active Tokens',
  stableProtowords: 'Stable Proto-Words',
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
  replayEventBtn: 'Replay Event Location',
  clearReplayBtn: 'Exit Replay',
  replayingBanner: 'Replaying Historical Event Location',
  replayFrameHonesty: 'Flies camera to exact recorded coordinates and highlights participating agents without fabricating missing ticks.',
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
