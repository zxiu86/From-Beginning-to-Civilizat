# تقرير الأداء الفعلي على المعالج — Empirical CPU Benchmark Report

تم قياس هذه الأرقام فعلياً عبر تشغيل:
```bash
python3 -m benchmarks.benchmark_cpu --ticks 120
```

## نتائج القياس الفعلي / Measured Results

- **البيئة المقاسة / Measured Host**: 4 vCPU, 12288 MB RAM (`~10312 MB` متاحة)
- **المحرك العصبي الفعّال أثناء القياس المحلي / Active Backend in Local Container**: `pure_python_fallback` (نظراً لعدم تثبيت `torch` داخل حاوية التشغيل المحلية؛ بينما يفرض GitHub Actions على `ubuntu-24.04` استخدام `PyTorch CPU` عبر `--require-torch`).
- **عدد الخطوات المحاكاة / Ticks Executed**: `120 ticks` (`4.0` أشهر محاكاة)
- **زمن تهيئة العالم و100 فرد / Initialization Time**: `0.8979 s`
- **زمن تنفيذ 120 خطوة / Simulation Time**: `66.3278 s` (يشمل الآن حسابات **GAE(λ)** ومكافأة الإنتروبيا و**GRU Gate BPTT** الكامل على Python النقي)
- **معدل التنفيذ / Throughput**: `1.81 ticks/sec` (ما يعادل `3.62` شهراً محاكياً في الدقيقة الواحدة على النمط البحثي الأقصى `max_cpu_research` — أي أسرع بـ `3.62×` من الزمن الحقيقي المستهدف `1 دقيقة حقيقية = 1 شهر محاكى` حتى على المترجم البديل بدون PyTorch).
- **تحديثات الشبكات العصبية المنفذة / Brain Gradient Updates**: `1,775` تحديثاً خلال 120 خطوة
- **زمن حفظ نقطة الحفظ الذرية / Checkpoint Save Time**: `1.927 s`
- **زمن استعادة نقطة الحفظ والتحقق / Checkpoint Restore Time**: `0.6664 s`
- **حجم نقطة الحفظ الكلي / Total Checkpoint Size**: `8,403.00 KB` (`~8.21 MB`)
- **ذروة استهلاك الذاكرة / Peak RSS Memory**: `117.25 MB`
- **الأحياء في نهاية 4 أشهر / Living Population at End**: `95 / 100` (بيئة محدودة غير متسامحة؛ يتعافى السكان بفضل دوافع البقاء الفردية والتعلم التجريبي مع بقاء الوفيات الطبيعية والجرائم غير المحظورة).

## التحقق في GitHub Actions مع PyTorch CPU

لاختبار الأداء مع `PyTorch CPU` فعلياً على `ubuntu-24.04`، اختر `mode: verify_only` في تشغيل `workflow_dispatch` اليدوي ليتم تشغيل `benchmarks.benchmark_cpu --require-torch --ticks 120` وإرفاق التقرير ضمن Artifacts.
