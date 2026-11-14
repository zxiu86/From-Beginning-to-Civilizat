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
| 12 | Orchestrator & CLI | `sim/orchestrator.py`, `sim/cli.py` | ربط الأنظمة، إدارة الميزانية الزمنية، معالجة الإشارات `SIGTERM/SIGINT`، عزل الأخطاء |

---

## 2. صيغة ملفات نقطة الحفظ / Checkpoint Data Format

يحتوي كل مجلد Checkpoint على 6 ملفات مترابطة ومحمية بالبصمة التشفيرية `SHA-256`:

1. **`world_state.db` (SQLite)**:
   - جدول `meta`: رقم العالم `world_id`، نسخة المخطط، `tick` الحالي، المعرّف القادم `next_agent_id`، معالم الاكتشافات.
   - جدول `agents`: سجل جميع الأفراد الأحياء والمتوفين (`is_alive`, `birth_tick`, `death_tick`, السجل الكامل JSON بما في ذلك شجرة النسب والذاكرة).
   - جدول `subsystems`: حالة الإعدادات، الساعة، خريطة العالم والحيوانات، اللغة، المجتمع، والطبقات التاريخية 2 و3.
2. **`brains_state.bin.gz`**:
   - حزمة مضغوطة تحتوي على أوزان الشبكة العصبية (`state_dict`) وحالة المُحسّن (`optimizer.state_dict`) والحالة المخفية `hidden_state` ومخزن التجارب لكل فرد حيّ فقط.
3. **`events_truth.jsonl.gz`**:
   - سجل مضغوط بصيغة JSON Lines للطبقة الأولى (الحقيقة الفعلية) لتتبع كل حدث تاريخي بدقة للمراقب الخارجي.
4. **`rng_state.json.gz`**:
   - الحالة الدقيقة لمولدات الأرقام العشوائية (`random.Random` و`torch` CPU RNG) لضمان استمرارية متطابقة عند الاستئناف.
5. **`observatory_export.json`**:
   - عقد بيانات JSON جاهز للقراءة فقط لمرحلة موقع المراقبة المستقبلية (**Phase 2: Civilization Observatory**)، دون أي اقتران بمنطق المحاكاة.
6. **`manifest.json`**:
   - يحتوي على `world_id`, `schema_version`, `sim_tick`, `sim_date`, `saved_at_utc`, `backend`, `living_population`, `total_agents_ever`, و`checksums` (SHA-256 لكل ملف).

---

## 3. التحقق من سلامة العالم / Verifying World Integrity

```bash
python3 -m sim.cli inspect-world --checkpoint-dir <path_to_checkpoint>
```

يتحقق الأمر من وجود جميع الملفات الستة ومطابقة بصمة `SHA-256` لكل ملف مع `manifest.json` قبل قراءة قاعدة البيانات. عند أي تلف أو نقص، يتوقف النظام فوراً برمز خروج `2` دون إنشاء عالم بديل.

---

## 4. إضافة ميزات جديدة / Extending the Engine

- لإضافة فعل جديد: أضف اسمه في `ACTION_NAMES` في `sim/agent.py`، وحدّث `num_actions` في `SimulationConfig`، ونفّذ تكلفته البيولوجية والزمنية في `AgentEngine.execute_action`.
- لإضافة متغير بيئي أو محصول جديد: أضف مصفوفته في `WorldEngine` داخل `sim/world.py` وسجله في `to_snapshot()` و`from_snapshot()` دون كسر التوافق.
- يجب أن يمر أي تعديل بجميع اختبارات `tests/` (بما فيها استقلال الأوزان، الإدراك المحلي، وبقاء الموت نهائياً).
