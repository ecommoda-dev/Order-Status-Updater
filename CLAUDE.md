<div dir="rtl" style="text-align: right;">

# محدّث حالة الأوردر (`Order-Status-Updater`)

![version](https://img.shields.io/badge/version-v1.2.0-blue)

**بتعمل إيه:** موظف العمليات بيدوّر على أوردرات (رقم · مندوب · اسم) وبيحدّث
مرحلة الأوردر — دورة S1 (`custom.manual_status`) ودورة الإرجاع/الاستبدال S2
(`custom.status_2_r_e`) — مع المندوب وتاريخ الاستلام وسبب الإلغاء/الإرجاع.
**مين بيستخدمها:** مخزن · عمليات
**الإصدار:** Worker `v4.5.0` · الواجهة `v4.5.0`   ← الاتنين مستقلين، طبيعي يختلفوا

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

### `extra.cancelVerify` وقيم `actions` المضافة (v4.5.0)

`actions` ممكن تحتوي دلوقتي على `orderCancel:skipped-already-cancelled` —
معناها إن الأوردر كان **ملغي على شوبيفاي قبل النداء**، فالأداة كتبت الحالة بس.
✅ مالهاش أثر على العقد العابر للأدوات: `cod-payment-center-worker` بيقرا
`result` · `courier` · `targetLabel` · `specifier` بس.

## قواعد الانتقال — قرارات محلية

> الجدول المرجعي في `ecommoda-order-lifecycle` → `state-machines.md` §1.4/§2.2.
> اللي هنا **إضافات أو استثناءات** خاصة بالأداة دي، متسجّلة عشان ما تتفتحش تاني.

| القاعدة | القرار | المصدر |
|---|---|---|
| `S1: In-Return → Returned` | ✅ مسموح (v4.5.0) | جدول `state-machines` §1.4 |
| `S2: In-Return → Returned` | ✅ مسموح (v4.5.0) | جدول `state-machines` §2.2 |
| `S2: In-Return → Ready` | ✅ مسموح (v4.5.0) — **قرار أحمد 08-09-2026**: القطعة بترجع للمكتب وممكن تطلع في دورة تسليم جديدة، أو العميل يلغي أصلاً | 🔴 **مش في المهارة لسه** |
| `S1: In-Return → Ready` | ⛔ **مش مسموح** — مش في الجدول المعتمد ولا اتقرر. سؤال مفتوح | — |
| `S1: Shipped → Cancelled` | ⛔ ممنوع من v3.6.0 | §1.2 (نافذتا الإلغاء) |

🔒 **قفل بند مفتوح:** الشرط الملزم في `state-machines.md` §2.3 (رفض
`Confirmed + RETURN` / `Confirmed + EXCHANGE` طول ما فيه دورة R/E مفتوحة)
**لا ينطبق على الأداة دي** — هي بتكتب في S2 القيم `Ready` · `Shipped` ·
`Returned` بس، وعمرها ما كتبت القيمتين دول. المهارة بتقول عنه «binding
requirement for the next piece of work on that Worker» — البند اتفحص في
مراجعة 08-09-2026 وطلع **غير منطبق**. متفتحوش تاني.

## إلغاء الـ Fulfillment عند `Shipped → Ready` — سلوك مقصود

الأداة **بتلغي** الـ fulfillment على شوبيفاي لما الأوردر يرجع من `Shipped`
لـ `Ready`. **ده مقصود ومعتمد (أحمد، 08-09-2026):** الأوردر بيرجع للمكتب
لحد ما تتعمل دورة تسليم جديدة، وممكن العميل يلغيه أصلاً — فلازم يرجع
Unfulfilled عشان `Ready → Cancelled` تفضل صالحة (§1.2: الإلغاء لازم يحصل
قبل ما الأوردر يبقى Fulfilled).

🔴 **`ecommoda-order-lifecycle` Rule 5 و §1.3 و §4 بيقولوا العكس** («الـ
fulfillment مابيتلغيش أبدًا في لوب إعادة التسليم»، و`Ready` + `Fulfilled`
تركيبة صالحة ومتوقعة). القياس في 08-09-2026: **٦٩** انتقال `Shipped → Ready`
ناجح، و**صفر** أوردر عليه `Ready` + `FULFILLED` في المتجر — يعني الحالة اللي
المهارة بتوصفها مش موجودة في الداتا خالص.

**النتيجة العملية:** أي عدّاد بيفرّق بين «شحنة أولى» و«محاولة مكررة**
**مايقدرش** يستخدم حالة الـ fulfillment — المصدر الوحيد هو **سجل D1**:

```sql
SELECT date(timestamp) d, COUNT(*) n FROM logs
WHERE tool='order_status' AND type='update'
  AND json_extract(extra,'$.targetLabel')='Ready'
  AND json_extract(extra,'$.s1Before')='Shipped'
  AND json_extract(extra,'$.result')='success'
GROUP BY d ORDER BY d DESC;
```

المهارة محتاجة تعديل — مسجّل في `skills-updates-2026-09-08.md`.

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

- 🔴 **قايمة الأسباب بتتغيّر من داشبورد شوبيفاي، والأداة بتكاشها.** التعديل
  حصل مرتين في ٤ أيام (03→07-09-2026). من v4.5.0 فيه TTL ١٠ دقايق + تحديث
  إجباري مع كل اختيار حالة، **و** تحقق سيرفري قبل أي فعل لا رجعة فيه. قبل
  كده: `#52732` اتلغى على شوبيفاي وحالته ما اتكتبتش واتصلّح باليد.
  ⚠️ **٢٩ أوردر تاريخي شايلين `cancel_manual_reason = "لا يوجد سبب"`** —
  قيمة **خارج** قايمة الاختيارات الحالية. أي `metafieldsSet` مستقبلي بيلمس
  الحقل ده عليهم هيفشل. (أحمد بيصلّحهم بنفسه — 08-09-2026.)
- 🔴 **`In-Return` كانت ناقصة من جداول الانتقال بالكامل لحد v4.5.0** — والفخ
  إن العطل **مخفي بالتصميم**: `In-Return` بتتكتب من مزامنة بوسطة بس، يعني
  على أوردرات `Other_Regions` بس. اللي بيشتغل على القاهرة/الجيزة عمره ما
  هيشوفه. أي قاعدة انتقال جديدة تتفحص على **الزونين**.
- ⚠️ **الجداول متكرّرة في ملفين** (`TRANSITION_RULES` في `index.js` و
  `index.html`). فحص المطابقة مش تلقائي — نفّذه بعد أي تعديل:
  ```bash
  node -e "…"   # المقارنة الكاملة في order-status-updater-review.md
  ```
- ✅ **(اتقفل في v4.5.0)** الثابت `CAIRO_OFFSET_HOURS = 3` كان في الملفين
  وكان هيغلط بساعة من **29-10-2026** — في الوقت المعروض، وفي فلاتر التاريخ،
  و**في `custom.pickup_date` اللي بيتكتب على الأوردر**. بقى محسوب بـ
  `Intl` / `Africa/Cairo`. ⚠️ الفخ ده **موجود في أدوات تانية في الستاك**.
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
| ecommoda-order-lifecycle | v1.3.0 |

آخر مطابقة: 08-09-2026 · `index.js` v4.5.0 · `index.html` v4.5.0
🔴 معلّقة: **٣ تعديلات مطلوبة في المهارات** — التفاصيل والصياغة الجاهزة في
`skills-updates-2026-09-08.md` (تتنفّذ في جلسة منفصلة):
1. `order-lifecycle` §2.2 — `S2: In-Return → Ready` (قرار جديد، مطبَّق هنا)
2. `order-lifecycle` Rule 5 · §1.3 · §4 — إلغاء الـ Fulfillment في لوب إعادة التسليم
3. `order-lifecycle` §1.5 — «لا يوجد سبب» اتشالت واتستبدلت بـ «العميل رفض ذكر السبب»

> بصمة الـ Worker منقولة **زي ما هي** من بلوك الرأس في الكود المنشور — النقل
> ماغيّرش سطر واحد في `index.js`، فالبصمة تفضل على تاريخها الحقيقي.
> `index.html` اتختم في النقل نفسه (Step 6 بيعتبر «النقل لـ git» سبب حقيقي).
> و`v1.0.0` معناها **«ما قبل النظام»** (Step 5) — **مش** شهادة إن الواجهة
> اتراجعت على html-builder v1.0.0. الواجهة ما اتفتحتش للمراجعة في النقل ده.

## مسائل مفتوحة

- **`S1: In-Return → Ready` — سؤال مفتوح.** النظير في S2 اتفتح في v4.5.0
  بقرار صريح؛ نظيره في S1 (أوردر راجع من بوسطة يرجع لدورة تسليم جديدة بدل
  ما يتقفل Returned) **مش** في الجدول المعتمد ولا اتقرر. لو الرد أيوه،
  التعديل سطر واحد في `Ready.s1From` + `TRANSITION_SOURCES['S1:Ready']`
  في الملفين.
- **قايمة `custom.return_manual_reason` فيها ٣ قيم بس** والتوزيع الفعلي
  ٥٢/٥٠/٤٠ — بصمة قايمة أصغر من الواقع، ومفيهاش عيلة أسباب الـ RTO
  (لا يرد · العنوان غلط · تأجيل) اللي موجودة في قايمة الإلغاء. أحمد بيفكّر
  فيها (08-09-2026) — **ممنوع** بناء أي KPI على أسباب الإرجاع لحد ما تتحسم.
- **زرار الخروج هو اسم الموظف نفسه** (١٣٨ دخول مقابل ٢ خروج) ولسه بـ
  `confirm()` أصلي. أحمد هيعيد تصميم الجزء ده بالكامل في المهارة لاحقًا —
  متلمسوش قبل كده (قرار 08-09-2026).
- **صفر اختصارات كيبورد في مسار التشغيل الأساسي** — **مقصود** (قرار أحمد
  08-09-2026). الاستثناء الوحيد المضاف في v4.5.0: `Enter`/`Esc` على نافذة
  ملخص التحديث، عشان أول سكانة بعد الدفعة ماتضيعش.
- ✅ **(اتعمل في v4.5.0)** شكل `checks` في `?action=diag` بقى مصفوفة
  `[{ ok, label, detail }]` — **مع الإبقاء على المفاتيح القديمة** فترة
  انتقالية عشان أي واجهة متكاشة في متصفح موظف ما تكسرش.
- **`Build watch paths` لسه `*` (الافتراضي).** يعني أي تعديل واجهة بينشر الـ
  Worker تاني بنفس الكود. التضييق لـ `index.js` + `wrangler.toml` مستحسن
  (§13-ب في `ecommoda-tool-migration-playbook`) — ولو اتعمل، **لازم**
  الاختبارين الاتنين (سلبي وإيجابي)، وأي ملف جديد يعتمد عليه الـ Worker
  لازم يتضاف للقايمة.
- ✅ **(اتعمل في v4.4.0)** معيار #28 — `WORKER URL` و`ADMIN WORKER URL` بقوا
  constants في `§CONFIG`. قيمة `ADMIN_WORKER_URL` من `ecommoda-constants` §5b
  (`employees-admin-panel-worker`).
آخر تحديث: 08-09-2026 — 01:20

</div>
