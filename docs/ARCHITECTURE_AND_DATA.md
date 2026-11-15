# البنية الهندسية وصيغ البيانات — Architecture & Data Formats

## 1. خريطة المحركات / Engine Architecture Mapping

| # | المحرك / Engine | الوحدة / Module | المسؤولية الأساسية / Core Responsibility |
|---|---|---|---|
| 1 | Agent Engine | `sim/agent.py` | دورة حياة السكان، دوافع البقاء والتكاثر، رعاية الأبوين، الموت النهائي، الأفعال بما فيها `cultivation` و`deception` |
| 2 | Neural Brain | `sim/brain.py` | شبكة مستقلة (`GRUCell` + Actor/Signal/Value + Adam) مع GAE(λ) والإنتروبيا وBPTT لبوابات GRU و`learning_telemetry` |
| 3 | World & Environment | `sim/world.py` | مساحة 5 كم² (`2500m×2000m`)، تضاريس، خصوبة ورطوبة وزراعة تدريجية (`tend_cultivation`)، مياه، موارد محدودة، طقس، حيوانات |
| 4 | Perception Engine | `sim/perception.py` | إدراك حسي محلي مقيد بالرؤية والسمع والليل والطقس مع مؤشرات الشركاء والأبناء والخطر والتربة (دون تسرب عالمي) |
| 5 | Memory Engine | `sim/memory.py` | ذاكرة فردية خاصة (حوادث، مكانية، عواقب الأفعال، ثقة، مهارات) معزولة ولا تُنسخ عند الولادة أو الاستعادة |
| 6 | Communication Engine | `sim/communication.py` | رموز صوتية وإيماءات مجردة، نشوء الإشارات المشتركة، الكلمات المستقرة، اللهجات، الانزياح الدلالي |
| 7 | Evolution Engine | `sim/evolution.py` | كلفة الحمل الأيضية والولادة، فناء الكلمات واللغات بموت حامليها، تآكل الآثار، تطور المؤسسات |
| 8 | Society, Economy, Governance & Crime | `sim/society.py` | تحالفات، مقايضة وأسواق، معايير مبنية على الخبرة الحقيقية، وساطة حقيقية (استرداد/طرد)، جرائم (`theft`/`deception`/`assault`/`murder`) |
| 9 | History & Knowledge Engine | `sim/history.py` | فصل صارم بين الطبقة 1 (الحقيقة)، الطبقة 2 (روايات الشهود والآثار)، الطبقة 3 (تفسيرات الأجيال) |
| 10 | Simulation Clock | `sim/clock.py` | مقياس `1 دقيقة حقيقية = 1 شهر محاكى` (`30 tick/month`) مستقل عن أي واجهة عرض |
| 11 | Persistence & Checkpoint | `sim/persistence.py` | حفظ ذري (Staging + SHA-256 + Swap)، SQLite، أوزان الشبكات، حالة RNG، تصدير JSON وأرشيفات ما قبل الاستعادة |
| 12 | Orchestrator & CLI | `sim/orchestrator.py`, `sim/cli.py` | إدارة الحلقة، استعادة السكان التلقائية بعد الانقراض الكلي فقط (`4` مؤسسين)، تفريع مقارنة اختياري للنشط فقط، `SIGTERM/SIGINT` |
| 13 | Physics & Navigation | `sim/physics.py` | مسارات `A*` محدودة فوق التضاريس، تجنب المياه العميقة والانحدارات، التصادم والتباعد والالتفاف |
| 14 | Rebirth & Timelines | `sim/rebirth.py` | تفريع تجريبي معزول للنشط فقط (`experimental_rebirth`)، محظور على أرشيف التجربة الأولى المنقرضة |
| 15 | Live Runner & Observatory | `server.mjs`, `lib/observatory/`, `components/observatory/` | تشغيل حي (`/api/sim/*` بـ `100` فرد افتراضياً)، مستورد JSON غير محدود، محرك Three.js مع بديل `FallbackCanvas2D`، ونافذة تشخيص |

---

## 2. صيغة ملفات نقطة الحفظ وعزل الخطوط الزمنية / Checkpoint & Timeline Isolation Format

يحتوي كل مجلد Checkpoint على 6 ملفات مترابطة ومحمية بالبصمة التشفيرية `SHA-256`، وتُحفظ أرشيفات الانقراض الكلي تحت `extinction_archives/cycle_NNN_tick_TTTTTT/` قبل إدخال المؤسسين الجدد مباشرة:

1. **`world_state.db` (SQLite)**:
   - جدول `meta`: رقم العالم `world_id`، معرف الخط الزمني، نسخة المخطط، `tick` الحالي، المعرّف القادم `next_agent_id`، معالم الاكتشافات.
   - جدول `agents`: سجل جميع الأفراد الأحياء والمتوفين عبر كافة الدورات دون إعادة تدوير `agent_id`.
   - جدول `subsystems`: حالة الإعدادات، الساعة، خريطة العالم والحيوانات، اللغة، المجتمع، حالة `recovery_state` (`population_recovery_history`, `current_cycle_number`, `recovery_cycle_count`)، والطبقات التاريخية 2 و3.
2. **`brains_state.bin.gz`**:
   - أوزان الشبكة العصبية (`state_dict`) وحالة المُحسّن (`optimizer.state_dict`) والحالة المخفية ومخزن التجارب الانزلاقي وقياسات التعلم لكل فرد.
3. **`events_truth.jsonl.gz`**:
   - سجل الطبقة الأولى متضمناً أحداث `population_extinct` و`population_recovery` و`crime_deception`.
4. **`rng_state.json.gz`**:
   - الحالة الدقيقة لمولدات الأرقام العشوائية (`random.Random` و`torch` CPU RNG).
5. **`observatory_export.json`**:
   - عقد بيانات JSON للمرصد متضمناً التضاريس، المباني، التاريخ، `recovery_state`، و`learning_telemetry`.
6. **`manifest.json`**:
   - البيانات الوصفية وبصمات `SHA-256` لكل ملف مع حالة دورات الاستعادة.

---

## 3. الخادم التفاعلي ومستورد البيانات متعدد الملفات / Live Runner API & Multi-File Importer

- **`server.mjs`**: يخدم واجهة Next.js ويستدعي `python3 -m sim.cli` داخل `.sim_runs/` عبر نقاط النهاية:
  - `GET /api/sim/status` — حالة العوالم، الخطوط الزمنية، وعدد دورات الاستعادة التلقائية.
  - `POST /api/sim/new` — إنشاء عالم جديد ببذرة وعدد سكان أولي افتراضي `100` فرد.
  - `POST /api/sim/step` — تنفيذ عدد محدد من الخطوات (`ticks`) وتصدير لقطة وملف تاريخي.
  - `POST /api/sim/branch-rebirth` — إنشاء فرع `experimental_rebirth` من عالم نشط.
  - `GET /api/sim/snapshot?id=<run>&timeline=<tl>&tick=<n>` — قراءة الحالة الحالية أو لقطة تاريخية مسجلة للقراءة فقط.
  - `GET /api/sim/compare?id=<run>&original=<t1>&experimental=<t2>` — مقارنة إحصائية وسكانية وعصبية.
- **`lib/observatory/importer.ts`**: مستورد دفعات غير محدود (`processJsonImportBatch`) يعالج الملفات بترتيب رقمي وطوبولوجي مع عزل الملفات المعطوبة والتراجع الكامل (`Rollback`).
- **`lib/observatory/diagnostics.ts` و`FallbackCanvas2D.tsx`**: مخزن تشخيص خالٍ من الأسرار يلتقط أخطاء WebGL والعميل مبكراً، مع بديل عرض تفاعلي ثنائي الأبعاد عند تعذر WebGL.

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
