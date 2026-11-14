# دليل التشغيل عبر GitHub Actions — GitHub Actions Operations Guide

## 1. سياسة التشغيل اليدوي الصارمة / Strict Manual Trigger Policy

تم ضبط `.github/workflows/simulation.yml` ليعمل **يدوياً فقط** عبر `workflow_dispatch`:
- ممنوع تماماً وجود `push` أو `pull_request` أو `schedule` أو `release` أو `workflow_run`.
- لا يقوم Workflow بإعادة تشغيل نفسه تلقائياً بعد انتهاء المهلة أو بعد الحفظ.
- أنت وحدك من يقرر متى تبدأ المحاكاة ومتى تُستأنف.

---

## 2. خطوات بدء عالم جديد / Starting a New World on GitHub

1. افتح مستودع GitHub وانتقل إلى تبويب **Actions**.
2. اختر **From Beginning to Civilization (Manual Run)**.
3. اضغط **Run workflow** وحدد:
   - `mode`: `new_world`
   - `runtime_budget_minutes`: `300` (الافتراضي: 5 ساعات داخل حد 360 دقيقة)
   - `checkpoint_interval_minutes`: `25`
   - `world_seed`: اختياري (رقم صحيح للبذرة أو اتركه فارغاً لبذرة عشوائية)
   - `speed_mode`: `max_cpu_research` (أقصى سرعة بحثية) أو `realtime_1m_1mo` (دقيقة حقيقية = شهر محاكى)
4. عند انتهاء التشغيل، ستجد في صفحة التشغيل ملفين تحت **Artifacts**:
   - `sim-checkpoint-<RUN_ID>`: نقطة الحفظ الكاملة والمفحوصة بـ SHA-256.
   - `sim-logs-<RUN_ID>`: سجلات التشغيل و`observatory_export.json` و`manifest.json`.
5. **احتفظ برقم التشغيل (`RUN_ID`)** الظاهر في رابط التشغيل لاستخدامه عند الاستئناف.

---

## 3. خطوات استكمال عالم محفوظ / Resuming a Saved World

1. اضغط **Run workflow** يدوياً.
2. حدد:
   - `mode`: `resume_world`
   - `resume_run_id`: أدخل رقم التشغيل السابق (`RUN_ID`) الذي يحتوي على `sim-checkpoint-<RUN_ID>`.
3. يتحقق Workflow من رقم التشغيل ويحمّل Artifact الحفظ ويفحص جميع بصمات `SHA-256` قبل متابعة المحاكاة.
4. **حماية البيانات**: إذا كان `resume_run_id` فارغاً أو غير موجود أو انتهت صلاحية Artifact أو تضررت بصمة ملف، **يتوقف التشغيل فوراً برسالة خطأ واضحة ولن ينشئ عالماً جديداً بدلاً منه**.

---

## 4. حدود GitHub-Hosted Runners / Runner Constraints & Safeguards

- **حد وقت المهمة**: الحد الأقصى لمهام `ubuntu-24.04` القياسية هو **360 دقيقة (6 ساعات)**. لذلك تم ضبط `timeout-minutes: 360` مع ميزانية داخلية افتراضية `300 دقيقة` وهامش أمان `12 دقيقة` لضمان إغلاق الحلقة وكتابة نقطة الحفظ النهائية ورفع Artifacts قبل انتهاء المهلة.
- **الموارد (CPU / RAM)**: تعمل Runners القياسية عادة على 2–4 أنوية CPU و7–16 GB RAM دون GPU. يفحص المحرك الموارد تلقائياً عند البدء (`detect_hardware_budget`) ويضبط خيوط PyTorch CPU ويُجري تحديثات التعلم على دفعات دورية لتجنب اختناق المعالج.
- **صلاحية Artifacts**: مدة الاحتفاظ الافتراضية مضبوطة على `90 يوماً` (`retention-days: 90`). للاستمرار طويل الأمد لأكثر من 90 يوماً، نفّذ تشغيل استئناف دوري قبل انتهاء 90 يوماً أو حمّل نسخة محلية من Artifact.
- **المستودع العام**: لا توجد أي مفاتيح API أو كلمات مرور في المستودع، ولا تُرفع ملفات Checkpoints إلى سجل Git مباشرة (محظورة عبر `.gitignore`).

---

## 5. موقع المراقبة (Civilization Observatory) والنشر عبر GitHub Pages

- **تصفح اللقطات محلياً**: بعد تنزيل Artifact `sim-logs-<RUN_ID>` من GitHub Actions، افتح موقع Civilization Observatory واضغط **رفع `observatory_export.json`** لعرض العالم ثلاثي الأبعاد والذاكرة والأنساب والتاريخ ثلاثي الطبقات والمنظور الشخصي (FPV).
- **النشر اليدوي على GitHub Pages**: يتضمن المستودع `.github/workflows/pages.yml` الذي يعمل **يدوياً فقط (`workflow_dispatch`)**. يمكنك إدخال `sim_run_id` اختيارياً أثناء النشر لجلب أحدث `observatory_export.json` إلى `public/data/latest_snapshot.json` وتضمينه كـ Snapshot منشور في الموقع الساكن.

