<div dir="rtl" style="text-align: right;">

# محدّث حالة الأوردر (`Order-Status-Updater`)

![version](https://img.shields.io/badge/version-v1.1.0-blue)

**بتعمل إيه:** موظف العمليات بيدوّر على أوردرات (رقم · مندوب · اسم) وبيحدّث
مرحلة الأوردر — دورة S1 (`custom.manual_status`) ودورة الإرجاع/الاستبدال S2
(`custom.status_2_r_e`) — مع المندوب وتاريخ الاستلام وسبب الإلغاء/الإرجاع.
**مين بيستخدمها:** مخزن · عمليات
**الإصدار:** Worker `v4.4.0` · الواجهة `v4.4.0`   ← الاتنين مستقلين، طبيعي يختلفوا

## الروابط

```
الواجهة    : https://ecommoda-dev.github.io/Order-Status-Updater/
الـ Worker : https://order-status-updater-worker.ecommoda-dev.workers.dev
اسم الـ Worker في الداشبورد: order-status-updater-worker   ← لازم يطابق name في wrangler.toml
```

## الـ Endpoints

| `?action=` | بيعمل إيه |
|---|---|
| `check_employee` · `register_pin` · `verify_employee` · `log_logout` | دورة دخول الموظف |
| `get_employees` · `get_config` | بيانات مساعدة للواجهة |
| `resolve_orders` · `resolve_by_name` · `search_courier_orders` | البحث عن أوردرات |
| `order_details` · `order_statuses` · `courier_values` · `reason_values` | قراءة حالة وقيم |
| `update_status` | **الكتابة** — تحديث S1/S2 + المندوب + التاريخ + السبب |
| `diag` | فحص ذاتي بدون أي كتابة — ممنوع يرجّع قيمة أي سر |
| `get_logs` · `get_logs_count` · `get_logs_export` | سجل العمليات (بفلاتر) |

## D1

```
tool  : order_status
type  : update · login · logout
```

مسجّلة في `ecommoda-constants` §7 ✅ — مفيش قيمة جديدة اتضافت في النقل ده.
الأداة بتستخدم `logs` و`employees` المشتركين بس — مفيش جداول إضافية.

### 🔗 عقد عابر للأدوات — `extra` مقروء من أداة تانية

من 31-08-2026، **`cod-payment-center-worker`** بيقرا صفوف الأداة دي من D1
**مباشرة** (مش نداء Worker-to-Worker) وبيعتمد حرفيًا على:
`tool='order_status'` · `type ≠ login/logout` · `order_id` ·
`extra.result ∈ ('success','warning')` · `extra.courier` · `extra.targetLabel`
(مع fallback على `extra.specifier`) · `timestamp`.

🔴 تغيير اسم أو قيمة أي مفتاح من دول — أو قيمة `TOOL_NAME` — **بيكسر أداة
التحصيل في صمت تام** (ليستة فاضية بلا خطأ، والموظف بيقفل من غير ما يحصّل).
قبل أي تعديل في `§CONTRACT::extra` أو `TOOL_NAME`: افتح `§TODAY-IMPORT` في
`cod-payment-center-worker` وعدّله في **نفس التسليم**.

### حقول السبب (v4.3.0)

| الحقل | معناه |
|---|---|
| `reasonIsNew` (داخلي) | الموظف اختار سبب **جديد** مختلف عن المسجّل على الأوردر — الكتابة على الميتافيلد مشروطة بيه |
| `extra.reasonSource` | `'operator'` = الموظف اختاره من الأداة · `'existing'` = كان مسجّل على شوبيفاي (خدمة العملاء) والأداة ماكتبتش فوقه · `null` = مفيش سبب |

### `extra.cancelVerify` (v4.4.0)

مفتاح **مضاف** بيتكتب على الصفوف اللي الإلغاء فيها ما اتأكدش بس
(`{ jobDone, attempts, waitedMs }`) — تشخيص انتظار الـ `orderCancel` job.

✅ **مالوش أي أثر على العقد العابر للأدوات:** مفيش مفتاح قديم اتغيّر أو اتشال،
و`cod-payment-center-worker` بيقرا `result` · `courier` · `targetLabel` ·
`specifier` بس — كلهم زي ما هم بالحرف. `§TODAY-IMPORT` **ما اتلمسش** ومش
محتاج يتعدّل مع التسليم ده.

القواعد التجارية لسبب تغيير الحالة → `ecommoda-order-lifecycle` §1.5.
أسماء الحقول دي مكانها هنا (قرار 26-08-2026).

## المضبوط فعليًا في الداشبورد

> اللي **متظبط بالفعل** — مش اللي المفروض يكون.

```
Bindings : DB → ecommoda-dev-logs
Secrets  : WORKER_SECRET · CLIENT_ID · CLIENT_SECRET
Vars     : SHOP_DOMAIN · LOCATION_ID        ← من [vars] في wrangler.toml
Build watch paths : * (الافتراضي) — التضييق لسه ما اتعملش (راجع "مسائل مفتوحة")
```

**تصنيف الـ `env.*` (إجراء §4-أ-٢ في `ecommoda-tool-migration-playbook`):**

| النوع | المتغيرات | إزاي تتأكد |
|---|---|---|
| **Secret** | `WORKER_SECRET` · `CLIENT_ID` · `CLIENT_SECRET` | مستحيلة القراءة — من مصدر أحمد |
| **Var بيرمي لو غاب** | `SHOP_DOMAIN` · `LOCATION_ID` | محروسين بـ `assertEnv` / `requireLocationId` — بيرموا خطأ **باسم المتغير**، و`?action=diag` بيكشفهم |
| **Var ليه fallback** | **لا شيء** ✅ | مفيش أي `env.X \|\| default` في الكود — يعني الأداة دي **مالهاش** سيناريو "أرقام غلط بصمت" من متغير ضايع |

## CORS

`ALLOWED_ORIGINS` صارمة (`https://ecommoda-dev.github.io` بس) — لأن الأداة
**أداة كتابة** بتعدّل حالة أوردرات حقيقية. مفيش wildcard.
✅ الدومين المهجور `ecommoda24.github.io` **مش موجود** في الكود ده (اتنضّف في v3.3.0).

## خط الأساس بعد النقل

خط الأساس هنا **مشتق من D1** (الأداة مالهاش زرار "تحديث" بيرجّع عدّاد ثابت —
مخرجها عملية كتابة). الاستعلام ده هو المرجع، وبيتقارن قبل/بعد:

```sql
SELECT type, COUNT(*) AS n, MAX(timestamp) AS last_row FROM logs WHERE tool = 'order_status' GROUP BY type;
```

القراءة قبل النقل — **31-08-2026**:

```
update : 11,455 صف   (أول صف 15-03-2026 · آخر صف 31-08-2026 13:50Z)
login  :    124 صف   (آخر صف 31-08-2026 13:48Z)
logout :      2 صف
```

✅ **الإثبات بعد النقل = صف `update` جديد بتوقيت بعد الربط.** أي صف جديد معناه
إن الشوبيفاي والـ D1 والأسرار كلهم شغالين على النسخة المنشورة من git.

## فخاخ الأداة دي

- ✅ **(اتقفل في v4.4.0)** بلوك الرأس في `index.js` كان مكتوب `v4.3.1` والثابت
  `VERSION` مكتوب `4.3.0`. الاتنين بقوا `4.4.0`.
- ✅ **(اتقفل في v4.4.0)** الواجهة كانت بتقرا رابط الـ Worker من `localStorage`،
  فالموظف اللي بيفتح الرابط أول مرة كان لازم يدخل الإعدادات. دلوقتي
  `WORKER_URL` و`ADMIN_WORKER_URL` **constants في `§CONFIG`** (Standards #28)،
  و`order_status_worker_secret` هو مفتاح الـ `localStorage` الوحيد الباقي.
  ⚠️ المفتاحين القدام (`order_status_worker_url` · `admin_worker_url`) **ما
  اتمسحوش** من متصفحات الموظفين — بقوا مهملين بس، والأداة مابتقراهمش.

## استرجاع النسخ القديمة

> ده بديل الـ tags — دفع الـ tags ممنوع من جلسات Claude Code السحابية.

```
النسخ المرقّمة القديمة (3.4.0 · 3.4.1 · 3.4.2 · 3.5.0) محفوظة في commit: b1e37b4
git show b1e37b4:3.5.0.html
```

`Index.html` القديم و`index.html` الجديد ليهم **نفس الـ blob SHA**
(`65e4b2a850a083ed94bd73a9c1d92518de496381`) — إثبات إن مفيش بايت اتغيّر في
الواجهة أثناء النقل.

## بصمة المهارات

| المهارة | الإصدار وقت آخر تعديل |
|---|---|
| ecommoda-worker-builder | v2.1.0 |
| ecommoda-html-builder | v6.6.0 |
| ecommoda-constants | v1.4.0 |
| ecommoda-order-lifecycle | v1.2.0 |

آخر مطابقة: 06-09-2026 · `index.js` v4.4.0 · `index.html` v4.4.0
🔴 معلّقة: — لا شيء

> بصمة الـ Worker منقولة **زي ما هي** من بلوك الرأس في الكود المنشور — النقل
> ماغيّرش سطر واحد في `index.js`، فالبصمة تفضل على تاريخها الحقيقي.
> `index.html` اتختم في النقل نفسه (Step 6 بيعتبر «النقل لـ git» سبب حقيقي).
> و`v1.0.0` معناها **«ما قبل النظام»** (Step 5) — **مش** شهادة إن الواجهة
> اتراجعت على html-builder v1.0.0. الواجهة ما اتفتحتش للمراجعة في النقل ده.

## مسائل مفتوحة

- **`Build watch paths` لسه `*` (الافتراضي).** يعني أي تعديل واجهة بينشر الـ
  Worker تاني بنفس الكود. التضييق لـ `index.js` + `wrangler.toml` مستحسن
  (§13-ب في `ecommoda-tool-migration-playbook`) — ولو اتعمل، **لازم**
  الاختبارين الاتنين (سلبي وإيجابي)، وأي ملف جديد يعتمد عليه الـ Worker
  لازم يتضاف للقايمة.
- ✅ **(اتعمل في v4.4.0)** معيار #28 — `WORKER URL` و`ADMIN WORKER URL` بقوا
  constants في `§CONFIG`. قيمة `ADMIN_WORKER_URL` من `ecommoda-constants` §5b
  (`employees-admin-panel-worker`).
- **`checks` في `?action=diag` لسه بالشكل القديم** — الأداة بترجّع مفاتيح
  top-level (`d1` · `shopifyAuth` · `locationCheck`) مش مصفوفة
  `[{ ok, label, detail }]`. `worker-builder` v2.1.0 بيقول الشكل الجديد لأي
  Worker **جديد**، والقديم يتوحّد مع أول تعديل مقصود. **ماتغيّرش في v4.4.0
  عن قصد**: ده تغيير عقد، وواجهة الأداة بتقرا الشكل الحالي صح، ومفيش هب
  بينادي الأداة دي مع غيرها. يتعمل لما يبقى فيه سبب.

آخر تحديث: 06-09-2026 — 14:30

</div>
