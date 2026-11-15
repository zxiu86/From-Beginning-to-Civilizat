# دليل التشغيل عبر GitHub Actions — GitHub Actions Operations Guide

## 1. سياسة التشغيل اليدوي الصارمة / Strict Manual Trigger Policy

تم ضبط `.github/workflows/simulation.yml` ليعمل **يدوياً فقط** عبر `workflow_dispatch`:
- ممنوع تماماً وجود `push` أو `pull_request` أو `schedule` أو `release` أو `workflow_run`.
- لا يقوم Workflow بإعادة تشغيل نفسه تلقائياً بعد انتهاء المهلة أو بعد الحفظ.
- أنت وحدك من يقرر متى تبدأ المحاكاة ومتى تُستأنف.
- صلاحيات التشغيل مضبوطة بالحد الأدنى المطلوب فقط: `contents: read` و`actions: read` (كافية تماماً لقراءة سجل التشغيلات وتنزيل Artifacts من التشغيلات السابقة ورفع Artifact التشغيل الحالي دون الحاجة لأي `actions: write`).

---

## 2. المسار المبسط والمضمون من التدريب إلى العالم الكامل / Seamless Transfer Flow

لم تعد بحاجة إلى نسخ أو إدخال `source_run_id` يدوياً أو البحث عن Artifacts وتنزيلها يدوياً:

1. **شغّل التدريب المعزول (`start_training`)**:
   - يدرّب 100 فرد مستقل في 100 نسخة متطابقة ومعزولة من القالب البيئي.
   - عند انتهاء التدريب **بنجاح فقط** (`success()`), يقوم `scripts/ci_artifact_transfer.py package-training` بتجميع وحفظ كل ما يلزم داخل **Artifact واحد منظم**:
     `isolated-training-artifact-<RUN_ID>`
     ويحتوي داخله على:
     - `checkpoint/` (نقطة حفظ التدريب الكاملة مع بصمات SHA-256)
     - `trained_population.bundle` (ملف مضغوط واحد يضم العقول والأوزان وحالة Adam والذكريات والمهارات والسمات و`discovered_techs`)
     - `transfer_metadata.json` (بيانات التحقق، رقم التشغيل، الإصدار، وبصمات التكامل)
   - *ملاحظة*: إذا فشل التدريب أو لم يكتمل بنجاح، **لا يُرفع** `isolated-training-artifact-*` مطلقاً.

2. **اختر تشغيل العالم الكامل (`promote_to_civilization`)**:
   - اترك `source_run_id` **فارغاً**.
   - يقوم الـ Workflow تلقائياً بالبحث عن **أحدث تشغيل تدريب معزول مكتمل وناجح غير منتهي الصلاحية** (`conclusion == "success"` و`expired == false`)، متجاهلاً تلقائياً التشغيلات الفاشلة أو الجارية أو المنتهية أو تشغيلات `verify_only`.
   - ينزّل Artifact الصحيح تلقائياً عبر `actions/download-artifact@v4`.
   - يتحقق عبر `scripts/ci_artifact_transfer.py verify-downloaded` من اكتمال الملفات وبصمات SHA-256 وتطابق `run_id` والإصدارات وبصمات الأوزان العصبية قبل أي ترحيل.
   - يستورد الأفراد المئة وعقولهم وذكرياتهم **ويبدأ محاكاة العالم الحضاري الكامل (5 كم²) مباشرة** (`--run-simulation`) مع تعطيل دائم لإحياء التدريب وحلقة المؤسسين الأربعة.
   - لا يُستبدل أي عالم كامل موجود إلا بعد نجاح كامل خطوات التحقق والتجهيز المرحلي.

> **خيار متقدم**: إذا أردت استيراد تشغيل قديم محدد بالاسم، يمكنك اختيارياً إدخال رقمه في `source_run_id`، وسيتم أيضاً التحقق من أنه تشغيل ناجح ومكتمل وغير منتهي الصلاحية.

---

## 3. الأوضاع الستة المتاحة في `workflow_dispatch`

1. **`start_training`** — بدء تدريب معزول جديد لـ 100 فرد وحفظ الناتج تلقائياً في `isolated-training-artifact-<RUN_ID>`.
2. **`resume_training`** — استئناف التدريب المعزول تلقائياً من أحدث `isolated-training-artifact-*` ناجح (أو `source_run_id` محدد) وإنتاج Artifact موحد محدّث.
3. **`promote_to_civilization`** — استيراد أحدث تدريب معزول ناجح تلقائياً، التحقق الكامل منه، نقل العقول والذكريات، وبدء المحاكاة في العالم الحضاري الكامل (`sim-checkpoint-<RUN_ID>`).
4. **`run_civilization`** — مواصلة محاكاة العالم الحضاري الكامل تلقائياً من أحدث `sim-checkpoint-*` ناجح (أو `source_run_id` محدد).
5. **`export_trained_population`** — وضع متوافق لتصدير حزمة `trained-population-bundle-<RUN_ID>` منفردة عند الحاجة.
6. **`verify_only`** — تشغيل كامل اختبارات Python وقياس أداء المعالج `--require-torch`.

---

## 4. حماية السلامة ومعالجة الأخطاء / Strict Safety & Error Handling

يرفض النظام الاستيراد برسالة خطأ صريحة وواضحة دون المساس بأي بيانات حالية في الحالات التالية:
- عدم وجود أي تشغيل تدريب/حضارة ناجح أو عدم العثور على Artifact متوافق.
- محاولة الإشارة إلى تشغيل فاشل أو غير مكتمل (`status != completed` أو `conclusion != success` أو `completion_status != completed_success`).
- انتهاء صلاحية الـ Artifact (`expired == true`).
- فشل التنزيل أو فراغ مجلد الاستيراد.
- عدم تطابق `run_id` بين الطلب و`transfer_metadata.json` / `bundle_manifest.json`.
- نقص أو تلف أي ملف أو فشل بصمة `SHA-256` أو عدم تطابق بصمة أوزان الشبكة العصبية.
- عدم توافق إصدار `metadata_version` أو `bundle_format_version` أو `training_schema_version` أو البنية العصبية (`obs_dim=36, hidden_dim=24, num_actions=18, num_signals=24`).

---

## 5. حدود GitHub-Hosted Runners ونشر لوحة الإحصائيات

- **حد وقت المهمة**: `timeout-minutes: 360` مع ميزانية داخلية افتراضية `300 دقيقة` وهامش أمان `12 دقيقة`.
- **صلاحية Artifacts**: `retention-days: 90`، ولا تُرفع حزم التدريب أو الحضارة إلا عند `success()` (بينما تُرفع السجلات في `sim-logs-<RUN_ID>` دائماً لتشخيص الأخطاء).
- **لوحة الإحصائيات والنشر**: افتح `observatory_export.json` من `sim-logs-<RUN_ID>` داخل موقع Civilization Observatory، أو شغّل `.github/workflows/pages.yml` يدوياً عبر `workflow_dispatch`.
