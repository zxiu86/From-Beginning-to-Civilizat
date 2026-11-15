# دليل التشغيل عبر GitHub Actions — GitHub Actions Operations Guide

## 1. سياسة التشغيل اليدوي الصارمة / Strict Manual Trigger Policy

تم ضبط `.github/workflows/simulation.yml` ليعمل **يدوياً فقط** عبر `workflow_dispatch`:
- ممنوع تماماً وجود `push` أو `pull_request` أو `schedule` أو `release` أو `workflow_run`.
- لا يقوم Workflow بإعادة تشغيل نفسه تلقائياً بعد انتهاء المهلة أو بعد الحفظ.
- أنت وحدك من يقرر متى تبدأ المحاكاة ومتى تُستأنف.

---

## 2. مسار التدريب المعزول ونقل العقول وتشغيل الحضارة / Two-Stage Pipeline via `workflow_dispatch`

افتح مستودع GitHub وانتقل إلى **Actions ← From Beginning to Civilization (Manual Run) ← Run workflow** واختر أحد الأوضاع الستة:

1. **`start_training`** — يبدأ تدريباً معزولاً لـ **100 فرد** في 100 نسخة تشغيلية مستقلة من نفس القالب البيئي، مع الموت والإحياء التدريبي المرتبط بعقوبة التعلم.
   - الإدخالات: `runtime_budget_minutes` (افتراضي `300`)، `checkpoint_interval_minutes` (`25`)، `max_ticks` (اختياري)، `world_seed` (اختياري)، `speed_mode` (`max_cpu_research` أو `realtime_1m_1mo`).
   - المخرجات: `training-checkpoint-<RUN_ID>` و`sim-logs-<RUN_ID>`.
2. **`resume_training`** — يستأنف التدريب المعزول من آخر نقطة حفظ باستخدام `source_run_id` لرقم تشغيل يحتوي على `training-checkpoint-<RUN_ID>`.
3. **`export_trained_population`** — يصدّر جميع الأفراد المئة وأوزان الشبكات العصبية وحالة Adam والذكريات والمهارات والسمات وإحصائيات التدريب إلى **ملف مضغوط واحد فقط** (`trained_population.bundle`) مع استبعاد بيئات التدريب الـ 100، ويتحقق من سلامته وبصمات SHA-256.
   - يتطلب: `source_run_id` من خطوة `start_training` أو `resume_training`.
   - المخرجات: `trained-population-bundle-<RUN_ID>` و`sim-logs-<RUN_ID>`.
4. **`promote_to_civilization`** — يفحص الحزمة المضغوطة (`trained-population-bundle-<RUN_ID>`) وينقل الأفراد المئة وعقولهم وذكرياتهم دفعة واحدة إلى عالم حضاري كامل (5 كم²)، مع **تعطيل دائم** لإحياء التدريب (`training_rebirth_enabled=False`) وتعطيل حلقة الاسترداد القديمة ذات المؤسسين الأربعة (`auto_recover_on_extinction=False`).
   - يتطلب: `source_run_id` من خطوة `export_trained_population`.
   - المخرجات: `sim-checkpoint-<RUN_ID>` و`sim-logs-<RUN_ID>`.
5. **`run_civilization`** — يواصل محاكاة العالم الحضاري الكامل من آخر نقطة حفظ حضارية عبر `source_run_id` (`sim-checkpoint-<RUN_ID>`).
6. **`verify_only`** — يشغّل كامل اختبارات Python وقياس أداء المعالج `--require-torch` على بيئة التشغيل.

> **ملاحظة مهمة**: احتفظ برقم التشغيل (`RUN_ID`) الظاهر في رابط كل مهمة لاستخدامه في `source_run_id` بالخطوة التالية.

---

## 3. حماية السلامة وعدم الت fallback الصامت / Integrity & Strict Failure Policy

- إذا كان `source_run_id` فارغاً أو غير رقمي أو مفقوداً في أي من الأوضاع (`resume_training`, `export_trained_population`, `promote_to_civilization`, `run_civilization`)، يتوقف الـ Workflow فوراً برمز خروج غير صفري.
- تتحقق خطوات الاستئناف والتغليف والترحيل من بصمات `SHA-256` وتطابق البنية العصبية (`obs_dim=36, hidden_dim=24, num_actions=18, num_signals=24`) وبصمة الأوزان لكل فرد (`weight_fingerprints`) قبل تشغيل أي خطوة.

---

## 4. حدود GitHub-Hosted Runners / Runner Constraints & Safeguards

- **حد وقت المهمة**: الحد الأقصى لمهام `ubuntu-24.04` القياسية هو **360 دقيقة (6 ساعات)**. تم ضبط `timeout-minutes: 360` مع ميزانية داخلية افتراضية `300 دقيقة` وهامش أمان `12 دقيقة` لحفظ الحالة ورفع Artifacts قبل انتهاء المهلة.
- **الموارد (CPU / RAM)**: تعمل Runners القياسية عادة على 2–4 أنوية CPU و7–16 GB RAM دون GPU. يفحص المحرك الموارد تلقائياً (`detect_hardware_budget`) ويضبط خيوط PyTorch CPU وفترات التحديث الدفعي.
- **صلاحية Artifacts**: مدة الاحتفاظ الافتراضية `90 يوماً` (`retention-days: 90`).
- **تثبيت PyTorch CPU**: يتم تثبيت `requirements.txt` من فهرس PyTorch CPU الرسمي مع فرض `--require-torch` في أوامر المحرك على GitHub Actions.

---

## 5. لوحة الإحصائيات (Statistics Observatory) والنشر عبر GitHub Pages

- **تصفح اللقطات محلياً**: بعد تنزيل Artifact `sim-logs-<RUN_ID>` من GitHub Actions، افتح موقع Civilization Observatory وارفع `observatory_export.json` (للتدريب أو للعالم الحضاري) لعرض لوحة الإحصائيات الاحترافية ذات الأقسام الثمانية (النظرة العامة، السكان ومفتش الفرد، البقاء والوفيات، الموارد والقمع ذو المراحل الست، الحضارة والاجتماع، التعلم والتجربة، التدريب المعزول لـ 100 فرد، والتاريخ والأحداث) بدون أي محرك ثلاثي أو ثنائي الأبعاد في الموقع.
- **النشر اليدوي على GitHub Pages**: يتضمن المستودع `.github/workflows/pages.yml` الذي يعمل **يدوياً فقط (`workflow_dispatch`)** مع `NODE_ENV=production` و`GITHUB_PAGES=true` لضبط `NEXT_PUBLIC_BASE_PATH` تلقائياً وإتاحة تمرير `sim_run_id` اختيارياً لتضمين أحدث `observatory_export.json` في `public/data/latest_snapshot.json`.


