# البداية إلى الحضارة — From Beginning to Civilization

محرك محاكاة تطورية وبحثية مستقل يحاكي نشأة مجتمع بشري وتطوره انطلاقاً من **100 فرد مستقل جديد** داخل بيئة طبيعية مساحتها **5 كيلومترات مربعة** (`2500m × 2000m`) دون أي لغة جاهزة، أو كتابة، أو قوانين، أو حكومة، أو سوق، أو نقل لذاكرات/أوزان التجربة الأولى المؤرشفة (112 وفاة).

An autonomous evolutionary simulation engine modeling the emergence of society from **100 fresh independent individuals** in a **5 km²** natural world (`2500m × 2000m`) with zero pre-seeded human languages, writing systems, laws, governments, markets, or weight/memory transfers from the archived first experiment (112 deaths).

---

## المبادئ والأنظمة الأساسية / Core Principles & Subsystems

1. **استقلال العقول (Independent Brains & No LLM APIs)**: كل فرد يمتلك شبكة عصبية مستقلة (`GRUCell` + Actor/Signal/Value + Adam مستقل) مع **GAE(λ)** وتنظيم الإنتروبيا ومخزن خبرة انزلاقي و**GRU BPTT** كامل على **PyTorch CPU** (مع محرك Python نقي متكافئ للاختبارات المحلية)، دون أي استدعاء لنماذج لغوية أو APIs مدفوعة.
2. **لا تطور مفروضاً ودوافع طبيعية غير جامدة (Non-Scripted Drives & Zero Hardcoded Stages)**: يمتلك الأفراد دوافع داخلية متدرجة للبقاء (الطعام، الماء، التعافي، تجنب الخطر، ذاكرة العواقب الخاصة) والتكاثر ورعاية الوالدين للأبناء (`< 14 سنة`)، مع بقاء الجرائم (`theft`, `deception`, `assault`, `murder`) والانهيار والانقراض غير محظورة.
3. **إدراك محلي صارم (Strict Sensory Locality)**: لا يعرف الفرد إلا ما يقع ضمن نطاق الرؤية والسمع الفعليين وما يتذكره شخصياً.
4. **بداية نظيفة واستعادة تلقائية بعد الانقراض الكلي فقط (Fresh Start & Atomic Post-Extinction Recovery)**:
   - تُحفظ التجربة الأولى (112 وفاة) كأرشيف مستقل نهائي لا يُعاد إحياؤه ولا يُنقل إلى الجيل الجديد.
   - تبدأ التجربة الجديدة بـ 100 فرد مستقل (`IDs 1..100`) بذاكرة ومعجم وعلاقات صفرية.
   - إذا انقرض جميع الأحياء (`living == 0`) فقط، يحفظ النظام أرشيف ما قبل الاستعادة ذرياً تحت `extinction_archives/cycle_NNN_tick_TTTTTT` ثم يُدخل **4 مؤسسين جدد (2 إناث، 2 ذكور)** بذاكرات وعقول فارغة ودون تصفير للطقس أو الجفاف أو الموارد أو الآثار.
5. **مرصد الحضارة وحماية الواجهة (Resilient Observatory)**: مرصد تفاعلي بـ Three.js مزود بطبقات حماية من الأخطاء (`ErrorBoundary`، بديل تفاعلي `FallbackCanvas2D` عند تعذر WebGL، نافذة تشخيص JSON، ودعم تلقائي للجذر `*.github.io` أو المسارات الفرعية في GitHub Pages).
6. **تشغيل يدوي حصري في GitHub Actions**: يعتمد `simulation.yml` و`pages.yml` على `workflow_dispatch` فقط دون أي مشغلات تلقائية.

---

## التثبيت المحلي / Local Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
npm install
```

> **ملاحظة بيئية / Environment Note**:
> يعتمد المحرك أساساً على `PyTorch CPU` (`--require-torch`). في البيئات المصغّرة التي لا يتوفر فيها `torch`، يوفّر المحرك طبقة بديلة نقية بـ Python (`pure_python_fallback`) لتشغيل الاختبارات، مع التصريح بالمحرك الفعّال بوضوح في السجلات والتقارير. في GitHub Actions يتم فرض `--require-torch`.

---

## تشغيل الاختبارات وقياس الأداء / Running Tests & Benchmarks

```bash
# تشغيل جميع اختبارات المحرك والامتثال والاستعادة التلقائية
python3 -m unittest discover -s tests -p "test_*.py" -v

# تشغيل اختبارات محول المرصد ومستورد JSON وفحص TypeScript
npx tsc --noEmit
npx tsx tests/verify_observatory_adapter.ts
npx tsx tests/verify_json_importer.ts

# تشغيل اختبار الأداء الفعلي على المعالج (CPU Benchmark)
python3 -m benchmarks.benchmark_cpu --ticks 120
# ومع فرض PyTorch CPU:
python3 -m benchmarks.benchmark_cpu --ticks 120 --require-torch
```

---

## بدء عالم جديد واستكماله محلياً / Starting & Resuming Locally

```bash
# 1. بدء عالم جديد (100 فرد جديد، مع استعادة تلقائية بعد الانقراض الكلي مفعلة افتراضياً)
python3 -m sim.cli new-world \
  --checkpoint-dir runs/world_01 \
  --seed 42 \
  --initial-population 100 \
  --max-ticks 360 \
  --speed-mode max_cpu_research

# 2. استكمال عالم محفوظ (يتوقف برسالة خطأ واضحة إذا كان الحفظ مفقوداً أو تالفاً)
python3 -m sim.cli resume-world \
  --checkpoint-dir runs/world_01 \
  --max-ticks 360

# 3. فحص سلامة نقطة الحفظ وعرض الإحصائيات
python3 -m sim.cli inspect-world --checkpoint-dir runs/world_01
```

---

## الوثائق التفصيلية / Detailed Documentation

- `docs/ARCHITECTURE_AND_DATA.md`: بنية المحركات، صيغ الحفظ الذري، دورات الاستعادة التلقائية، وتشغيل المرصد التفاعلي.
- `docs/OPERATIONS_GITHUB_ACTIONS.md`: دليل التشغيل اليدوي عبر GitHub Actions ونشر GitHub Pages (جذر `*.github.io` أو مسار فرعي).
- `ENGINE_STATUS.md`: الحالة الفعلية لكل محرك وواجهة بشفافية تامة.
