# البداية إلى الحضارة — From Beginning to Civilization

محرك محاكاة تطورية وبحثية مستقل يحاكي نشأة مجتمع بشري وتطوره انطلاقاً من **100 فرد مستقل** داخل بيئة طبيعية مساحتها **5 كيلومترات مربعة** (`2500m × 2000m`) دون أي لغة جاهزة، أو كتابة، أو قوانين، أو حكومة، أو سوق، أو تاريخ مسبق.

An autonomous evolutionary simulation engine modeling the emergence of society from **100 independent individuals** in a **5 km²** natural world (`2500m × 2000m`) with zero pre-seeded human languages, writing systems, laws, governments, markets, or historical priors.

---

## المبادئ الصارمة للمشروع / Core Scientific & Engineering Rules

1. **استقلال العقول (No LLM APIs)**: كل فرد يمتلك شبكة عصبية مستقلة (`GRUCell` + Actor/Signal/Value MLP على **PyTorch CPU**) وأوزاناً وذاكرة وتجارب خاصة به، دون أي استدعاء لنماذج لغوية أو APIs مدفوعة.
2. **لا تطور مفروضاً (Zero Hardcoded Stages)**: لا توجد مراحل زمنية مبرمجة (مثل: صيد ← زراعة ← تجارة ← حكومة). قد تنشأ اللغة أو التبادل أو القوانين أو تنهار أو لا تظهر مطلقاً تبعاً للبيئة وسلوك السكان.
3. **إدراك محلي صارم (Strict Sensory Locality)**: لا يعرف الفرد إلا ما يقع ضمن نطاق الرؤية والسمع الفعليين وما يتذكره شخصياً.
4. **موت نهائي وهويات خالدة (Permanent Mortality)**: لكل فرد معرّف فريد `agent_id` لا يتكرر، ولا تُنسخ ذاكرة المتوفى إلى المواليد الجدد، ولا يعود المتوفى للحياة.
5. **ثلاث طبقات للتاريخ (3-Layer History)**:
   - **الطبقة 1 (الحقيقة الفعلية)**: سجل موضوعي للمحرك والمراقب فقط، محجوب كلياً عن السكان.
   - **الطبقة 2 (روايات الشهود والنقوش)**: روايات شخصية قد تكون ناقصة أو متحيزة، وآثار مادية على الأرض والحجر.
   - **الطبقة 3 (تفسيرات الأجيال اللاحقة)**: قراءات الأجيال الجديدة للآثار والروايات، وقد تصيب أو تخطئ أو تنقّح الماضي.
6. **تشغيل يدوي حصري في GitHub Actions**: يعتمد التشغيل على `workflow_dispatch` فقط دون أي مشغلات تلقائية أو إعادة تشغيل ذاتية.

---

## التثبيت المحلي / Local Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
```

> **ملاحظة بيئية مهمة / Environment Note**:
> يعتمد المحرك أساساً على `PyTorch CPU` (`--require-torch`). في البيئات المصغّرة التي لا يتوفر فيها `torch`، يوفّر المحرك طبقة بديلة نقية بـ Python (`pure_python_fallback`) لتشغيل الاختبارات البنيوية، مع التصريح بالمحرك الفعّال بوضوح في السجلات والتقارير. في GitHub Actions يتم فرض `--require-torch`.

---

## تشغيل الاختبارات وقياس الأداء / Running Tests & Benchmarks

```bash
# تشغيل جميع اختبارات الوحدات والتكامل والاستئناف والامتثال
python3 -m unittest discover -s tests -p "test_*.py" -v

# تشغيل اختبار الأداء الفعلي على المعالج (CPU Benchmark)
python3 -m benchmarks.benchmark_cpu --ticks 120
# ومع فرض PyTorch CPU:
python3 -m benchmarks.benchmark_cpu --ticks 120 --require-torch
```

---

## بدء عالم جديد واستكماله محلياً / Starting & Resuming Locally

```bash
# 1. بدء عالم جديد (New World)
python3 -m sim.cli new-world \
  --checkpoint-dir runs/world_01 \
  --seed 42 \
  --initial-population 100 \
  --max-ticks 360 \
  --speed-mode max_cpu_research

# 2. استكمال عالم محفوظ (Resume World — يتوقف برسالة خطأ واضحة إذا كان الحفظ مفقوداً أو تالفاً)
python3 -m sim.cli resume-world \
  --checkpoint-dir runs/world_01 \
  --max-ticks 360

# 3. فحص سلامة نقطة الحفظ وعرض الإحصائيات (Inspect Checkpoint)
python3 -m sim.cli inspect-world --checkpoint-dir runs/world_01
```

---

## الوثائق التفصيلية / Detailed Documentation

- `docs/ARCHITECTURE_AND_DATA.md`: بنية المحركات الـ 15، صيغ ملفات الحفظ (`SQLite`، `JSONL.gz`، أوزان الشبكات، `manifest.json`)، وعقد تصدير JSON لمرحلة موقع المراقبة (Phase 2).
- `docs/OPERATIONS_GITHUB_ACTIONS.md`: دليل التشغيل اليدوي عبر GitHub Actions، استرجاع نقاط الحفظ عبر `Run ID`، وحدود GitHub-hosted Runners.
- `ENGINE_STATUS.md`: الحالة الفعلية لكل محرك (مكتمل / جزئي / مؤجل) بشفافية تامة.
