# تقرير الأداء الفعلي على المعالج — Empirical CPU Benchmark Report

تم قياس هذه الأرقام فعلياً عبر تشغيل:
```bash
python3 -m benchmarks.benchmark_cpu --ticks 120
```

## نتائج القياس الفعلي / Measured Results

- **البيئة المقاسة / Measured Host**: 2 vCPU, 4096 MB RAM (`~2521 MB` متاحة)
- **المحرك العصبي الفعّال أثناء القياس المحلي / Active Backend in Local Container**: `pure_python_fallback` (نظراً لعدم تثبيت `pip` أو `torch` داخل حاوية التشغيل المحلية؛ بينما يفرض GitHub Actions على `ubuntu-24.04` استخدام `PyTorch CPU` عبر `--require-torch`).
- **عدد الخطوات المحاكاة / Ticks Executed**: `120 ticks` (`4.0` أشهر محاكاة)
- **زمن تهيئة العالم و100 فرد / Initialization Time**: `0.9782 s`
- **زمن تنفيذ 120 خطوة / Simulation Time**: `28.0674 s`
- **معدل التنفيذ / Throughput**: `4.28 ticks/sec` (ما يعادل `8.55` شهراً محاكياً في الدقيقة الواحدة على النمط البحثي الأقصى `max_cpu_research` — أي أسرع بـ `8.5×` من الزمن الحقيقي المستهدف `1 دقيقة حقيقية = 1 شهر محاكى`).
- **تحديثات الشبكات العصبية المنفذة / Brain Gradient Updates**: `661` تحديثاً خلال 120 خطوة
- **زمن حفظ نقطة الحفظ الذرية / Checkpoint Save Time**: `0.4190 s`
- **زمن استعادة نقطة الحفظ والتحقق / Checkpoint Restore Time**: `0.3244 s`
- **حجم نقطة الحفظ الكلي / Total Checkpoint Size**: `3,109.47 KB` (`~3.04 MB`)
- **ذروة استهلاك الذاكرة / Peak RSS Memory**: `68.65 MB`
- **الأحياء في نهاية 4 أشهر / Living Population at End**: `34 / 100` (بيئة محدودة غير متسامحة حيث يؤدي الفشل في إيجاد الماء والغذاء إلى الوفاة الفعلية).

## التحقق في GitHub Actions مع PyTorch CPU

لاختبار الأداء مع `PyTorch CPU` فعلياً على `ubuntu-24.04`، اختر `mode: verify_only` في تشغيل `workflow_dispatch` اليدوي ليتم تشغيل `benchmarks.benchmark_cpu --require-torch --ticks 120` وإرفاق التقرير ضمن Artifacts.
