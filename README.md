# Order Status Updater

أداة داخلية لـ **EcomModa** — موظف العمليات بيحدّث مرحلة الأوردر: دورة S1
(`custom.manual_status`) ودورة الإرجاع/الاستبدال S2 (`custom.status_2_r_e`)،
مع المندوب وتاريخ الاستلام وسبب الإلغاء/الإرجاع.

## البنية

| الملف | إيه |
|---|---|
| `index.js` | كود الـ Worker — بينشر على Cloudflare عبر Workers Builds |
| `wrangler.toml` | اسم الـ Worker + D1 binding + الـ vars |
| `index.html` | الواجهة — بتتنشر على GitHub Pages |
| `Index.html` | صفحة تحويل للرابط القديم (بحرف كبير) |
| `CLAUDE.md` | قواعد الأداة وفخاخها — بيتحمّل تلقائي في كل جلسة Claude |

## الروابط

```
الواجهة    : https://ecommoda-dev.github.io/Order-Status-Updater/
الـ Worker : https://order-status-updater-worker.ecommoda-dev.workers.dev
```

## النشر

`git push` على `main` بيبني وينشر الاتنين تلقائيًا — الـ Worker عبر
Cloudflare Workers Builds، والواجهة عبر GitHub Pages.

> ⛔ **ممنوع** نسخ/لصق كود في داشبورد Cloudflare بعد ربط الريبو — أول push
> جاي بيمسحه. الريبو هو المصدر الوحيد.

## النسخ القديمة

ملفات النسخ المرقّمة (`3.4.0` · `3.4.1` · `3.4.2` · `3.5.0`) اتشالت من
الجذر لأن GitHub Pages كان بينشرها كصفحات لايف. محفوظة في git:

```
git show b1e37b4:3.5.0.html
```
