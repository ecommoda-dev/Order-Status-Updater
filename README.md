<div dir="rtl" style="text-align: right;">

# Order Status Updater — Worker

![version](https://img.shields.io/badge/version-v2.0.0-blue)

أداة داخلية لـ **EcomModa** — موظف العمليات بيحدّث مرحلة الأوردر: دورة S1
(`custom.manual_status`) ودورة الإرجاع/الاستبدال S2 (`custom.status_2_r_e`)،
مع المندوب وتاريخ الاستلام وسبب الإلغاء/الإرجاع.

> 🔴 **الريبو ده Worker وبس (18-11-2026 — قرار أحمد).** واجهة الأداة
> (`index.html`) اتحذفت، والواجهة الوحيدة هي صفحة `Order-Status-Updater.html`
> جوّه مركز عمليات الشحن والتحصيل. الرابط القديم
> `https://ecommoda-dev.github.io/Order-Status-Updater/` بقى 404 بلا تحويل.

## البنية

| الملف | إيه |
|---|---|
| `index.js` | كود الـ Worker — بينشر على Cloudflare عبر Workers Builds |
| `wrangler.toml` | اسم الـ Worker + D1 binding + الـ vars |
| `log-filters-check.mjs` | فحص فلاتر السجل (v4.8.0) على SQLite حقيقي — `node --no-warnings log-filters-check.mjs` |
| `check-log-values.mjs` · `log-values.json` | الحارس الديناميكي لقيم اللوج (الطبقة ٥) |
| `CLAUDE.md` | قواعد الأداة وفخاخها — بيتحمّل تلقائي في كل جلسة Claude |
| `order-status-updater-review.md` | مراجعة عميقة 08-09-2026 — ٤٢ بند بدليل من الإنتاج + حالة كل واحد |
| `skills-updates-2026-09-08.md` · `skills-updates-2026-09-15.md` | التعديلات المطلوبة في المهارات (اتنفّذت في جلسات منفصلة) |

## الروابط

```
الواجهة    : https://ecommoda-dev.github.io/Delivery-COD-Operations-Center/Order-Status-Updater.html   (في ريبو المركز)
الـ Worker : https://order-status-updater-worker.ecommoda-dev.workers.dev
```

## النشر

`git push` على `main` بيبني وينشر الـ Worker تلقائيًا عبر Cloudflare Workers Builds.

> ⛔ **ممنوع** نسخ/لصق كود في داشبورد Cloudflare بعد ربط الريبو — أول push
> جاي بيمسحه. الريبو هو المصدر الوحيد.
> 🔴 **انشر الـ Worker قبل صفحة المركز** — الصفحة بتعتمد على `v4.8.0` (`ECO_WORKERS.orderStatus.min`).

## النسخ القديمة

ملفات النسخ المرقّمة (`3.4.0` · `3.4.1` · `3.4.2` · `3.5.0`) اتشالت من الجذر
وهي محفوظة في git:

```
git show b1e37b4:3.5.0.html
```

آخر تحديث: 18-11-2026 — 15:12

</div>
