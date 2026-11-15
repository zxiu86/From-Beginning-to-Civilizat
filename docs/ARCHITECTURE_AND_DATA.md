# البنية الهندسية وصيغ البيانات — Architecture & Data Formats

## 1. خريطة المحركات / Engine Architecture Mapping

| # | المحرك / Engine | الوحدة / Module | المسؤولية الأساسية / Core Responsibility |
|---|---|---|---|
| 1 | Agent Engine | `sim/agent.py` | دورة حياة السكان، الأيض، التكاثر، الموت النهائي، تنفيذ الأفعال، نقل المهارات اجتماعياً |
| 2 | Neural Brain | `sim/brain.py` | شبكة عصبية مستقلة لكل فرد (`GRUCell` + Policy/Signal/Value Heads + Adam) على PyTorch CPU |
| 3 | World & Environment | `sim/world.py` | مساحة 5 كم² (`2500m×2000m`)، تضاريس، تربة، مياه، موارد محدودة متجددة، طقس، كوارث، حيوانات |
| 4 | Perception Engine | `sim/perception.py` | إدراك حسي محلي مقيد بمدى الرؤية والسمع والليل والطقس (دون أي تسرب معرفي عالمي) |
| 5 | Memory Engine | `sim/memory.py` | ذاكرة فردية خاصة (حوادث، خريطة مكانية، ألفة وثقة اجتماعية، مهارات) لا تُورّث عند الموت |
| 6 | Communication Engine | `sim/communication.py` | رموز صوتية وإيماءات مجردة، نشوء الإشارات المشتركة، الكلمات المستقرة، اللهجات، الانزياح الدلالي |
| 7 | Evolution Engine | `sim/evolution.py` | الحمل والولادة، فناء الكلمات واللغات بموت حامليها، تآكل الآثار، تطور المؤسسات |
| 8 | Society, Economy, Governance & Crime | `sim/society.py` | تحالفات، مقايضة وأسواق ناشئة، قواعد وعقوبات، قيادة وانتخابات اختيارية كل 10 سنوات، جرائم ومقاييس استقرار |
| 9 | History & Knowledge Engine | `sim/history.py` | فصل صارم بين الطبقة 1 (الحقيقة)، الطبقة 2 (روايات الشهود والآثار)، الطبقة 3 (تفسيرات الأجيال) |
| 10 | Simulation Clock | `sim/clock.py` | مقياس `1 دقيقة حقيقية = 1 شهر محاكى` (`30 tick/month`) مستقل عن أي واجهة عرض |
| 11 | Persistence & Checkpoint | `sim/persistence.py` | حفظ ذري (Staging + SHA-256 + Swap)، SQLite، أوزان الشبكات، حالة RNG، تصدير JSON للمراقبة |
| 12 | Orchestrator & CLI | `sim/orchestrator.py`, `sim/cli.py` | ربط الأنظمة، إدارة الميزانية الزمنية، تفريع الإحياء والمقارنة، معالجة الإشارات `SIGTERM/SIGINT` |
| 13 | Physics & Navigation | `sim/physics.py` | مسارات `A*` محدودة فوق التضاريس، تجنب المياه العميقة والانحدارات، التصادم والتباعد والالتفاف |
| 14 | Rebirth & Timelines | `sim/rebirth.py` | إنشاء خط زمني تجريبي بـ `UUID` مع عزل الذاكرة والأحداث وإحياء الأفراد بتجربة `Death Penalty Learning` |
| 15 | Live Runner & Observatory | `server.mjs`, `lib/observatory/`, `components/observatory/` | تشغيل حي (`/api/sim/*`)، مستورد JSON غير محدود، محرك Three.js بـ 4 مستويات جودة و3 مستويات LOD، لوحة مقارنة الخطوط |

---

## 2. صيغة ملفات نقطة الحفظ وعزل الخطوط الزمنية / Checkpoint & Timeline Isolation Format

يحتوي كل مجلد Checkpoint على 6 ملفات مترابطة ومحمية بالبصمة التشفيرية `SHA-256`، كما تُخزّن الأفرع المستقلة تحت `timelines/<timeline_uuid>/` مع لقطات تاريخية منفصلة تحت `history_frames/tick_*.json`:

1. **`world_state.db` (SQLite)**:
   - جدول `meta`: رقم العالم `world_id`، معرف الخط الزمني `timeline_id` و`timeline_kind` و`parent_timeline_id`، نسخة المخطط، `tick` الحالي، المعرّف القادم `next_agent_id`، معالم الاكتشافات.
   - جدول `agents`: سجل جميع الأفراد الأحياء والمتوفين (`is_alive`, `birth_tick`, `death_tick`, `rebirth_count`, `original_death_tick`, `death_penalty_record`، السجل الكامل JSON بما في ذلك شجرة النسب والذاكرة).
   - جدول `subsystems`: حالة الإعدادات، الساعة، خريطة العالم والحيوانات، اللغة، المجتمع، وسجلات الإحياء، والطبقات التاريخية 2 و3.
2. **`brains_state.bin.gz`**:
   - حزمة مضغوطة تحتوي على أوزان الشبكة العصبية (`state_dict`) وحالة المُحسّن (`optimizer.state_dict`) والحالة المخفية `hidden_state` ومخزن التجارب لكل فرد (تُحفظ أيضاً للمتوفين ليظل الإحياء بهويتهم وأوزانهم ممكناً بدقة).
3. **`events_truth.jsonl.gz`**:
   - سجل مضغوط بصيغة JSON Lines للطبقة الأولى (الحقيقة الفعلية) لتتبع كل حدث تاريخي بدقة للمراقب الخارجي.
4. **`rng_state.json.gz`**:
   - الحالة الدقيقة لمولدات الأرقام العشوائية (`random.Random` و`torch` CPU RNG) لضمان استمرارية متطابقة عند الاستئناف.
5. **`observatory_export.json`**:
   - عقد بيانات JSON لمرصد الحضارة متضمناً حالة التضاريس والمباني وسلاسل التاريخ وسجلات الإحياء وعقوبة الموت والخطوط الزمنية.
6. **`manifest.json`**:
   - يحتوي على `world_id`, `timeline_id`, `timeline_kind`, `parent_timeline_id`, `schema_version`, `sim_tick`, `sim_date`, `saved_at_utc`, `backend`, `living_population`, `total_agents_ever`, و`checksums` (SHA-256 لكل ملف).

---

## 3. الخادم التفاعلي ومستورد البيانات متعدد الملفات / Live Runner API & Multi-File Importer

- **`server.mjs`**: يخدم واجهة Next.js ويستدعي `python3 -m sim.cli` داخل `.sim_runs/` عبر نقاط النهاية:
  - `GET /api/sim/status` — حالة العوالم والخطوط الزمنية المتاحة.
  - `POST /api/sim/new` — إنشاء عالم جديد ببذرة وعدد سكان أولي محددين.
  - `POST /api/sim/step` — تنفيذ عدد محدد من الخطوات (`ticks`) وتصدير لقطة وملف تاريخي.
  - `POST /api/sim/branch-rebirth` — إنشاء فرع `experimental_rebirth` من Checkpoint الخط الأصلي.
  - `GET /api/sim/snapshot?id=<run>&timeline=<tl>&tick=<n>` — قراءة الحالة الحالية أو لقطة تاريخية مسجلة للقراءة فقط.
  - `GET /api/sim/compare?id=<run>&original=<t1>&experimental=<t2>` — مقارنة إحصائية وسكانية وعصبية بين الخط الأصلي والخط التجريبي.
- **`lib/observatory/importer.ts`**: مستورد دفعات ضخمة غير محدود (`processJsonImportBatch`) يعالج الملفات على دفعات غير متزامنة، يرتّبها رقمياً وطوبولوجياً عبر بيانات `step_id`/`step_number`/`tick`/`dependencies`/`parent_step`، يكشف الدورات (`cycles`)، يعالج التكرارات والفجوات، يعزل الملفات المعطوبة في الحجر الصحي، ويفصل الخطوط الزمنية (`timeline_id`) مع دعم التراجع الكامل (`Rollback`).

---

## 4. التحقق من سلامة العالم / Verifying World Integrity

```bash
python3 -m sim.cli inspect-world --checkpoint-dir <path_to_checkpoint>
python3 -m unittest discover -s tests -p "test_*.py" -v
```

يتحقق الأمر من وجود جميع الملفات الستة ومطابقة بصمة `SHA-256` لكل ملف مع `manifest.json` قبل قراءة قاعدة البيانات. عند أي تلف أو نقص، يتوقف النظام فوراً برمز خروج `2` دون إنشاء عالم بديل.

---

## 5. إضافة ميزات جديدة / Extending the Engine

- لإضافة فعل جديد: أضف اسمه في `ACTION_NAMES` في `sim/agent.py`، وحدّث `num_actions` في `SimulationConfig`، ونفّذ تكلفته البيولوجية والزمنية في `AgentEngine.execute_action` وحركته ثلاثية الأبعاد في `lib/three/actors.ts`.
- لإضافة متغير بيئي أو محصول جديد: أضف مصفوفته في `WorldEngine` داخل `sim/world.py` وسجله في `to_snapshot()` و`from_snapshot()` دون كسر التوافق.
- يجب أن يمر أي تعديل بجميع اختبارات `tests/` (بما فيها استقلال الأوزان، الإدراك المحلي، بقاء الموت نهائياً، وعزل خطوط الإحياء التجريبية).
