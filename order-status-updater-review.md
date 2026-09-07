<div dir="rtl" style="text-align: right;">

# مراجعة عميقة — Order Status Updater

![version](https://img.shields.io/badge/version-v1.0.0-blue)

مراجعة شاملة للأداة على النسخة المنشورة `index.js v4.4.0` + `index.html v4.4.0`
(commit `ddf4fc9`) — كود، عقود، منطق تجاري، تشغيل فعلي، وواجهة/تجربة استخدام.

**الفرق عن المراجعات السابقة:** المراجعة دي **مش قراءة كود بس**. كل بند 🔴 و🟠
تحته **دليل من الإنتاج** — استعلامات فعلية على `ecommoda-dev-logs` (D1) وعلى
تعريفات الميتافيلد وحالة الأوردرات الحقيقية على شوبيفاي، بتاريخ 07-09-2026.
اللي مالوش دليل مقاس مكتوب صراحةً إنه **كامن** (ما وقعش لسه) مش مثبت.

---

## ملخص تنفيذي

| | العدد |
|---|---|
| 🔴 كاسر / فشل صامت **مثبت في الإنتاج** | 7 |
| 🟠 خطر عالي / تناقض في العقود | 6 |
| 🟡 متوسط — تشغيلي و UX | 13 |
| 🔵 تصليب وتنظيف | 16 |
| ✅ بنود سليمة اتأكدت بالفحص | 12 |

**أخطر تلات حاجات، بالترتيب:**

1. **٤ أوردرات مرتجعة مقفولة في الأداة دلوقتي** — كل أوردر بوسطة بيوصل
   `In-Return` مستحيل يتقفل من الأداة، والمخزون بتاعه مابيرجعش. أقدم واحد
   من 28-08 (١٠ أيام). (بند 🔴-1)
2. **أوردر اتلغى على شوبيفاي وحالته ما اتكتبتش** — `#52732` في 03-09،
   واتصلّح باليد بعدها بـ ٢١ ثانية، والسبب الإلزامي **ضاع نهائي**. والأداة
   نفسها **مش قادرة** تصلّح الحالة دي لو حصلت تاني. (بند 🔴-2)
3. **حارس نسخة الـ Worker مضبوط على رقم أقدم من اللازم** — يعني الحماية
   الوحيدة ضد «علامة صح خضرا على ملف تصدير ناقص» **مطفية عمليًا**. (بند 🔴-5)

**ملاحظة تشغيلية بتغيّر ترتيب الأولويات:** الأداة عمليًا بيستخدمها **موظف
واحد** (`Fady_Mostafa` — ١٥٠٥ أوردر في **٤٣٨ دفعة** خلال ١٦ يوم ≈ **٢٧ دفعة
في اليوم، متوسط ٣.٤ أوردر للدفعة**). يعني الوجع الحقيقي **مش** حجم الدفعة —
هو **احتكاك الدفعة الواحدة**: ٣ ضغطات ماوس إجبارية × ٢٧ مرة في اليوم، وأول
سكانة بعد كل دفعة بتضيع. راجع بند 🟡-14 و🟡-15.

---

## منهج المراجعة (عشان تقدر تكررها)

```
① قراءة كاملة: index.js (2077 سطر) · index.html (4219 سطر) · wrangler.toml · CLAUDE.md
② مقارنة بالمهارات الحاكمة: worker-builder v2.1.0 · html-builder v6.6.0
   · order-lifecycle v1.3.0 · constants v1.4.0
③ تنفيذ فحص Step 9 الإلزامي (grep) + Step 9A (فحص CSS بـ parser)
④ node --check على الملفين
⑤ استعلامات D1 على السجل الحقيقي (12,148 صف update)
⑥ استعلامات شوبيفاي: تعريفات الميتافيلد + حالة أوردرات حقيقية
```

**نتيجة ③ و④ (اتنفذوا فعليًا):**

```
Step 9  : عدّى — z-index 500/600/9999 مظبوط · settingsModal=0 · main-seg=0
          · document.contains(e.target)=1 · ar-EG=0 · container wrapper موجود
          (إنذارات IBM Plex=2 و :root=2 كلها نص داخل الـ changelog/About — مش CSS)
Step 9A : ✅ عدّى — 47 توكن معرّف · 631 استخدام · صفر مشكلة
node    : index.js OK · بلوك JS الوحيد في index.html OK
```

---

## 🔴 كاسر / فشل صامت مثبت

### 🔴-1 — أوردرات `In-Return` مقفولة نهائيًا في الأداة (المخزون مابيرجعش)

**الدليل — ٤ أوردرات حية دلوقتي:**

| الأوردر | S1 | S2 | Zone | من |
|---|---|---|---|---|
| #52457 | Delivered | In-Return | Other_Regions | 28-08 |
| #52704 | Delivered | In-Return | Other_Regions | 30-08 |
| #53027 | Delivered | In-Return | Other_Regions | 01-09 |
| #53517 | Delivered | In-Return | Other_Regions | 04-09 |

**السبب في الكود:**

```js
Returned_S2: { s1From: ['Delivered'], s2In: ['Shipped'] },   // ← 'In-Return' ناقصة
Returned:    { s1From: ['Shipped'],   s2Blank: true },        // ← 'In-Return' ناقصة
'S2:Returned': { s1Constraint: ['Delivered'], s2Sources: ['Shipped'] },
```

**والجدول المعتمد بيقول العكس** (`ecommoda-order-lifecycle` →
`state-machines.md` §1.4 و§2.2):

```
S1:  Shipped → Delivered · Returned · In-Return · Ready
     In-Return → Returned        ← الانتقال ده مش موجود في الأداة
S2:  Ready → Shipped → [In-Return] → Returned
```

وقاعدة **Rule 12** في نفس المهارة بتقول حرفيًا: «`In-Return` يتعامل زي
`Shipped` بالظبط — في **الماكينتين**». الأداة بتتعامل معاها كأنها حالة مش
موجودة أصلاً.

**الأثر التشغيلي — ده مش مجرد رسالة خطأ:**

- الموظف بيمسح الأوردر ويشوف **«⚠️ انتقال غير مسموح»** ومش فاهم ليه، لأن
  الأوردر ده **بالظبط** اللي المفروض يقفله.
- المسار `Returned_S2` هو **الوحيد** اللي بينادي `disposeReturns` → يعني
  **القطع الراجعة ما بترجعش للمخزن آليًا** على أي أوردر بوسطة.
- «البحث عن أوردرات مندوب» كمان مش هيلاقيهم (`TRANSITION_SOURCES` بنفس النقص).
- كله بيقع على `Other_Regions` **بس** — يعني على **كل** مرتجعات بوسطة، ومفيش
  على أوردرات القاهرة/الجيزة (المندوب بيحدّث في نفس اليوم فبيعدّي من `Shipped`
  على طول). المشكلة **مخفية بالتصميم** عن اللي بيشتغل على القاهرة.

**الإصلاح المقترح (في الملفين مع بعض):**

```js
// index.js + index.html — TRANSITION_RULES
Returned:    { s1From: [S1_STATUS.SHIPPED, S1_STATUS.IN_RETURN], s2Blank: true },
Returned_S2: { s1From: [S1_STATUS.DELIVERED], s2In: [S2_STATUS.SHIPPED, S2_STATUS.IN_RETURN] },

// index.js — TRANSITION_SOURCES
'S1:Returned': { s1Sources: [S1_STATUS.SHIPPED, S1_STATUS.IN_RETURN] },
'S2:Returned': { s1Constraint: [S1_STATUS.DELIVERED],
                 s2Sources:    [S2_STATUS.SHIPPED, S2_STATUS.IN_RETURN] },
```

❓ **محتاج قرار من أحمد قبل التنفيذ:** هل `S2 = In-Return` ينفع يرجع لـ
`Ready_S2` كمان (محاولة تسليم بديل تانية)؟ الجدول المعتمد **مابيسمحش** بيها
(`In-Return → Returned` بس)، فسايبها زي ما هي في المقترح فوق.

---

### 🔴-2 — أوردر بيتلغي على شوبيفاي وحالته ما بتتكتبش، والأداة مش قادرة تصلّحه

**الدليل — `#52732`، 03-09-2026، صف حقيقي من D1:**

```
timestamp : 2026-09-03T08:40:18.160Z          employee: Fady_Mostafa
notes     : فشل: metafieldsSet: Value does not exist in provided choices: [...]
            — (تم فعليًا: orderCancel)
extra     : { result:"error", actions:["orderCancel"], s1Before:"Ready",
              targetLabel:"Cancelled", reason:"لا يوجد سبب", reasonSource:null }
```

**اللي حصل بالترتيب:**

1. `applyDirect` نادت `cancelOrder` **الأول** → الأوردر **اتلغى فعلاً على
   شوبيفاي** (فعل لا رجعة فيه).
2. `setMetafields` بعدها اترفضت لأن السبب `"لا يوجد سبب"` **مش** في قايمة
   الاختيارات الحالية للميتافيلد.
3. النتيجة: أوردر **ملغي** على شوبيفاي و`manual_status` لسه **`Ready`**.
4. الموظف شاف «❌ فشل» والأوردر فضل في القايمة.
5. **إعادة المحاولة مستحيلة:** `resolveSpecifier` هيقرا S1 = `Ready` (لسه)
   → الانتقال صالح → `cancelOrder` هتتنادى تاني على أوردر ملغي → شوبيفاي
   بترفض → «فشل» تاني، **إلى الأبد**.

**التأكيد من شوبيفاي (حالة `#52732` النهارده):**

```
cancelledAt: 2026-09-03T08:40:19Z   manual_status: "Cancelled"
cancel_manual_reason: null          ← السبب الإلزامي ضاع نهائي
```

يعني الحالة اتكتبت **باليد في داشبورد شوبيفاي بعدها بـ ٢١ ثانية**
(صف `metafields_change` عند 11:40:39 بتوقيت القاهرة). الأداة ما صلّحتش نفسها،
والسبب — اللي **الأداة كلها اتبنت عشان تفرضه** — اتفقد.

**تلات إصلاحات مطلوبة مع بعض:**

**(أ) تحقق من السبب قبل الفعل اللي مالوش رجعة.**

```js
// في update_status، قبل حلقة المعالجة — نداء واحد لكل الدفعة
const choices = await fetchReasonChoices(env, token);   // نفس منطق reason_values
// وبعدين لكل أوردر محتاج سبب جديد:
if (reasonIsNew && !choices[key].includes(pickedReason))
  throw new Error(`سبب غير معرّف في شوبيفاي: "${pickedReason}" — حدّث الصفحة`);
// ← بيترمي **قبل** cancelOrder، فالأوردر مابيتلغيش أصلاً
```

**(ب) `cancelOrder` تبقى idempotent.**

```js
let cancelStartedAt = null, cancelJobId = null;
if (specifier === 'Cancelled' || specifier === 'Returned') {
  if (order.isCancelled) {
    actions.push('orderCancel:skipped-already-cancelled');   // اتلغى قبل كده
    warnings.push('الأوردر كان ملغي على شوبيفاي أصلاً — اتكتبت الحالة بس');
  } else {
    cancelStartedAt = new Date().toISOString();
    ({ jobId: cancelJobId } = await cancelOrder(env, token, order.gid));
    actions.push('orderCancel');
  }
}
```

بالتعديل ده، الأوردر العالق ينفع **يتصلّح من الأداة نفسها** بإعادة المحاولة
بدل التدخل اليدوي.

**(ج) فشل بعد فعل لا رجعة فيه = `warning` برسالة إصلاح، مش `error` صامت.**
راجع بند 🟠-9.

---

### 🔴-3 — قايمة الأسباب بتتعتّق للأبد في تاب مفتوح

**السبب الجذري لبند 🔴-2.**

```js
async function ensureReasonValues() {
  if (reasonValuesCache) return reasonValuesCache;   // ← مرة واحدة لكل تحميل صفحة، خلاص
  ...
}
```

نفس النمط في `ensureCourierList()`.

**الدليل إن القوايم دي بتتغيّر فعلاً وبسرعة:**

| المصدر | القيم |
|---|---|
| رسالة الخطأ في 03-09 | ١٤ قيمة |
| التعريف الحي النهارده 07-09 | **١٦ قيمة** (`العميل عاوز شوز سيفتي` · `تأخير خروج الاوردر` اتضافوا) |
| مستخدمة فعليًا في D1 | `لا يوجد سبب` × **٢٩** — و**مش موجودة** في القايمة الحالية |

يعني القايمة اتعدّلت **مرتين على الأقل في ٤ أيام**، والموظف اللي فاتح التاب
من الصبح شايل نسخة قديمة. أي قيمة اتشالت من التعريف **لسه معروضة عنده**،
واختيارها = بند 🔴-2 بالظبط.

**الإصلاح:**

```js
let reasonValuesAt = 0;
const REASON_TTL_MS = 10 * 60 * 1000;
async function ensureReasonValues(force = false) {
  if (!force && reasonValuesCache && Date.now() - reasonValuesAt < REASON_TTL_MS)
    return reasonValuesCache;
  ...
  reasonValuesAt = Date.now();
}
// ونادِها بـ force=true من selectTargetLabel() — نداء واحد كل مرة الموظف
// يختار حالة، وده مرة واحدة قبل كل دفعة تقريبًا.
```

---

### 🔴-4 — «لا يوجد سبب» اتشالت من قايمة الإلغاء — مخالفة صريحة لقاعدة الدورة

`ecommoda-order-lifecycle` → `state-machines.md` §1.5، بند **بالأحمر**:

> «**«لا يوجد سبب» قيمة حقيقية.** 🔴 عكس البديهة، وأسهل حاجة تتصلّح بالغلط.
> الموظف اللي بيختار *مفيش سبب* صراحةً ده **إجابة مسجّلة** — مش حقل ناقص، ولا
> `null`، ولا فشل تحقق. ممنوع تطبيعها أو التعامل معاها كغياب.»

**الوضع الفعلي:** القيمة **مش موجودة** في تعريف `custom.cancel_manual_reason`
النهارده، ومش موجودة أصلاً في `custom.return_manual_reason`. ومع ذلك **٢٩ أوردر
تاريخي شايلينها**.

**نتيجتان لازم تتحسم:**

1. **قرار تجاري (أحمد):** ترجع القيمة للقايمتين؟ لو أيوه، الأداة تشتغل صح
   فورًا. لو لأ، القاعدة في المهارة لازم تتعدّل — دلوقتي المهارة والداتا
   بيقولوا حاجتين مختلفين.
2. **دَين بيانات:** الـ٢٩ أوردر دول شايلين قيمة **خارج قايمة الاختيار** →
   ده بالظبط صنف **Rule 13** («قيمة مش في القايمة تتوسم، وماتتحركش»). وأي
   `metafieldsSet` مستقبلي بيلمس الحقل ده على الأوردرات دي **هيفشل** بنفس
   خطأ 🔴-2.

**استعلام الجرد:**

```sql
SELECT order_name, timestamp, json_extract(extra,'$.reason') r
FROM logs WHERE tool='order_status' AND type='update'
  AND json_extract(extra,'$.reason') = 'لا يوجد سبب' ORDER BY timestamp;
```

---

### 🔴-5 — حارس نسخة الـ Worker مضبوط على رقم أقدم من اللي الواجهة محتاجاه

```js
const TOOL_VERSION       = '4.4.0';
const MIN_WORKER_VERSION = '4.3.0';   // ← غلط
```

الواجهة v4.4.0 بتقرا `data.cap` · `data.total` · `data.truncated` من
`get_logs_export` — **والتلاتة اتضافوا في الـ Worker v4.4.0**، مش 4.3.0.

**الأثر لو الـ Worker رجع لـ 4.3.x (rollback / بناء فاشل / Promote ناقص):**

```js
const truncated = data && (data.truncated === true || (data.cap && entries.length >= data.cap));
// undefined && ... → false → يروح لفرع else:
showToast(`✅ تم تصدير ${n} صف`, 'success');
```

يعني **علامة صح خضرا على ملف مقصوص** — وده بالحرف الفشل اللي
`Standards #30` اتكتب عشانه، والحارس (`Standards #29`) اتحط عشان يمسكه.
الاتنين موجودين في الأداة، والرقم الغلط بيعطّلهم مع بعض.

وتعليق الأداة نفسها بيقول القاعدة:

> ⚠️ صيانة: أي endpoint/حقل جديد الصفحة تعتمد عليه → ارفع الرقم ده لنسخة
> الـ Worker اللي ضافته، **في نفس التسليم**.

**الإصلاح:** `const MIN_WORKER_VERSION = '4.4.0';`

---

### 🔴-6 — قايمة الأوردرات بتتعدّل **أثناء** التحديث (كامن — ماوقعش لسه)

```js
for (let i = 0; i < orders.length; i += UPDATE_CHUNK) {
  const chunk = orders.slice(i, i + UPDATE_CHUNK);   // ← بيقرا orders الحية كل لفة
  ...
}
```

و`orders` بتتغيّر من **أربع** نقط شغّالة أثناء التحديث:

| النقطة | الحارس الحالي |
|---|---|
| `handleScan()` (السكانر) | مفيش حارس `isUpdating` |
| `addManualOrder()` | مفيش |
| `removeOrder()` (زرار ✕) | مفيش |
| `clearOrders()` (مسح الكل) | مفيش |

`addOrders` بتعمل `orders = fresh.concat(orders)` — يعني **بتزحزح كل العناصر
مكان واحد قدام**. لو ده حصل بين دفعتين:

- الأوردر اللي على حدود التقسيم **بيتبعت مرتين** → التانية بترجع «انتقال غير
  مسموح» (لأنه اتحدّث خلاص) → بيتحسب **فشل** وهو ناجح.
- والأوردر اللي بعده **بيتخطّى خالص** — بيفضل في القايمة من غير تحديث ومن
  غير أي رسالة.
- وشريط التقدم بيرجع لورا (`done / orders.length` والمقام بيكبر).

**السيناريو واقعي جدًا:** موظف بيضغط «تحديث الكل» وبيبدأ يمسح دفعة الشحنة
اللي بعدها وهو مستني — و٢٧ دفعة في اليوم بتخلّي الاحتمال ده يتكرر.

**الفحص في الإنتاج:** ما لقيتش أثر لحد دلوقتي —

```sql
SELECT json_extract(extra,'$.batchId') b, COUNT(*) n, COUNT(DISTINCT order_id) d
FROM logs WHERE tool='order_status' AND type='update' AND timestamp>='2026-08-01'
GROUP BY b HAVING n > 20 OR n <> d;
-- رجّع صف واحد بس، وهو legacy من 15-08 (قبل الكود ده)
```

فالبند **كامن**، بس ثمن الإصلاح سطرين:

```js
async function doStartUpdate() {
  isUpdating = true;
  const batch = orders.slice();                 // ① لقطة ثابتة
  document.getElementById('scanInput').disabled = true;   // ② قفل الإدخال
  for (let i = 0; i < batch.length; i += UPDATE_CHUNK) {
    const chunk = batch.slice(i, i + UPDATE_CHUNK);
    ...
  }
  // ... وفي الآخر: scanInput.disabled = false;
}
```

+ حارس `if (isUpdating) return;` في أول `handleScan` · `addManualOrder` ·
`removeOrder` · `clearOrders`.

---

### 🔴-7 — سر غايب = `Bearer undefined` مقبول

```js
const auth = request.headers.get('Authorization');
if (!auth || auth !== `Bearer ${env.WORKER_SECRET}`)
  return json({ error: 'Unauthorized' }, 401, request);
```

لو `WORKER_SECRET` مش موجود (سر اتمسح · نسخة اتعمل لها Promote من غير الأسرار ·
Worker شبح اتنشر باسم مختلف)، القالب بينتج السلسلة الحرفية `"Bearer undefined"`
— يعني الـ Worker **بيقبل** أي طلب معاه الهيدر ده. وده Worker **كتابة**: بيلغي
أوردرات ويحرّك مخزون.

الاحتمال منخفض (السر مضبوط دلوقتي)، بس ده بالظبط صنف الفشل اللي الأداة كلها
متبنية ضده: الحالة اللي المفروض تبقى «كل حاجة 401» بتتحول لـ «الحماية اتشالت»،
**من غير أي إشارة**. والقالب الرسمي في `ecommoda-constants` §6 عامل الحارس ده
صراحةً.

**الإصلاح (٣ أسطر، قبل فحص الـ auth):**

```js
if (typeof env.WORKER_SECRET !== 'string' || !env.WORKER_SECRET.trim())
  return json({ ok:false, error:'WORKER_SECRET غير مضبوط على الـ Worker', step:'env' }, 500, request);
```

---

## 🟠 خطر عالي / تناقض في العقود

### 🟠-8 — الأداة بتلغي الـ Fulfillment عند `Shipped → Ready`، والقاعدة المعتمدة بتقول العكس

**الكود:**

```js
if (specifier === 'Ready' || specifier === 'Ready_S2') {
  if (order.fulfillments.length) await cancelFulfillments(env, token, order.fulfillments);
}
```

**`ecommoda-order-lifecycle` Rule 5 + `state-machines.md` §1.3 و§4:**

> ⚠️ **الـ Fulfillment مابيتلغيش على شوبيفاي أثناء لوب إعادة التسليم.**
> يعني `S1 = Ready` **مع** شوبيفاي `Fulfilled` تركيبة **صالحة ومتوقعة** —
> معناها *محاولة مكررة* مش *أوردر جديد*. وأي عدّاد «جاهز للشحن» بيتجاهل ده
> بيبالغ في عدد الشحنات الأولى.

**القياس الفعلي (07-09-2026):**

| القياس | النتيجة |
|---|---|
| انتقالات `Shipped → Ready` ناجحة في السجل | **٦٩** (آخرها النهارده 13:38) |
| أوردرات عليها `manual_status = Ready` دلوقتي | ٤٠+ |
| منهم `displayFulfillmentStatus = FULFILLED` | **صفر** |

يعني الحالة اللي القاعدة بتوصفها **مش موجودة في الداتا خالص** — الأداة بتمسحها
مع كل محاولة إعادة تسليم. والتمييز «محاولة مكررة ولا شحنة أولى» **مش قابل
للاسترجاع** من شوبيفاي.

**والتعقيد إن للسلوك ده سبب وجيه:** §1.2 بتقول `Cancelled` لازم تحصل **قبل**
ما الأوردر يبقى Fulfilled — وقاعدة `Cancelled` في الأداة مصدرها `Ready`. لو
سبنا الـ fulfillment قايم، `Ready → Cancelled` هتبقى مخالفة للقاعدة دي.
فالسلوكين متشابكين.

❓ **قرار مطلوب من أحمد — واحد من اتنين:**

- **(أ)** السلوك ده مقصود ومعتمد → **المهارة** لازم تتحدّث (Rule 5 و§1.3 و§4)،
  وأي داشبورد بيعدّ «محاولات التسليم» يستخدم **سجل D1** (`s1Before='Shipped'`
  + `targetLabel='Ready'`) بدل حالة الـ fulfillment.
- **(ب)** القاعدة هي الصح → الأداة تبطّل `cancelFulfillments`، ولازم مسار
  بديل لـ `Ready → Cancelled` (غالبًا `cancelOrder` بيلغي الـ fulfillment
  ضمنيًا وقتها).

**دلوقتي مفيش أي مكان مكتوب فيه إن الاتنين مختلفين** — وده الخطر الحقيقي.

---

### 🟠-9 — فشل بعد كتابة الحالة = `error` + أوردر مش قابل لإعادة المحاولة

جوّه `applyDirect`، بعد ما `setMetafields` تنجح، فيه **٤ أفعال**. واحد بس منهم
متعامل معاه صح:

| الفعل | لو فشل | صح؟ |
|---|---|---|
| `deleteMetafields` (مسح المندوب) | `try/catch` → **`warning`** + رسالة واضحة | ✅ |
| `cancelFulfillments` | **بيرمي** → `error` | ❌ |
| `createFulfillment` | **بيرمي** → `error` | ❌ |
| `disposeReturns` | **بيرمي** → `error` | ❌ |

**ليه ده مهم:** الحالة **اتكتبت خلاص**. فالصف بيقول «فشل»، والأوردر بيفضل في
القايمة، والموظف بيعيد المحاولة → `isTransitionValid` بترفض لأن S1/S2 اتحركوا
خلاص → **«انتقال غير مسموح» للأبد**. نفس الحفرة بتاعة 🔴-2، بس من ٣ أبواب تانية.

**والدليل إن الأبواب دي بتتفتح فعلاً:**

```
reverseDispose: Invalid disposition quantity.                        — 18-08-2026
fulfillmentCreate: The api_client does not have access to the        — 14-08-2026
                   fulfillment order.
```

الاتنين حصلوا **بعد** ما الحالة اتكتبت. يعني أوردرين على الأقل خرجوا من الأداة
بحالة «فشل» وهُمّ متحدّثين فعلاً — والتاني (`createFulfillment`) أخطر: الأوردر
مكتوب عليه `Shipped`، اتطبع في المانفيست، المندوب مشي بيه، **وشوبيفاي لسه شايفه
Unfulfilled**.

`worker-builder` Step 5A ④ بيقول بالحرف: `warning` = «الفعل الأساسي تم بس فيه
حاجة ما اتأكدتش».

**الإصلاح — نفس نمط `deleteMetafields` بالظبط على التلاتة:**

```js
if (specifier === 'Ready' || specifier === 'Ready_S2') {
  if (order.fulfillments.length) {
    try {
      const n = await cancelFulfillments(env, token, order.fulfillments);
      actions.push(`fulfillmentCancel×${n}`);
    } catch (e) {
      warnings.push(`الحالة اتكتبت، لكن إلغاء الـ fulfillment فشل (${e.message}) — الأوردر لسه Fulfilled على شوبيفاي`);
    }
  }
}
// ونفس الشكل لـ createFulfillment و disposeReturns
```

النتيجة: الصف بيبقى **أصفر** بدل أحمر، الأوردر **بيخرج من القايمة** (مش
هيتعاد إرساله ويقع في «انتقال غير مسموح»)، والتحذير بيقول للموظف **إيه**
المطلوب يراجعه بالظبط.

---

### 🟠-10 — أي باركود غلط بيتقبل بصوت نجاح

```js
function handleScan() {
  const val = scanInput.value.trim();
  ...
  if (!val || val.length < 3) return;
  ...
  addOrders([val]);
  showToast('✓ تمت الإضافة', 'success');
  playBeep('scan');
}
```

الأداة بتقبل **أي نص ≥ ٣ حروف** كـ Order ID. وبعدين:

```js
async function hydrateOrders(ids) {
  const data = await apiPost('order_statuses', { orderIds: ids });
  for (const [id, st] of Object.entries(data.statuses || {})) { ... }
  // ← الـ IDs اللي شوبيفاي ما رجّعتهاش مابيحصلهاش أي حاجة
}
```

**النتيجة:** الصف بيظهر برقم `#—` ولا بادج تحذير ولا لون — و`orderIsBlocked`
بترجع `false` لأن `st.s1 === undefined` — فبيعدّي على «تحديث الكل» عادي، والموظف
بيعرف إنه غلط **بعد** الدفعة.

**الدليل:** `الأوردر غير موجود على Shopify` × **٧** في السجل، آخرها 01-09-2026.

في مخزن، مسح لاصقة غلط (AWB بوسطة · باركود منتج · لاصقة قديمة) حاجة يومية.
والأداة بتديله **صوت نجاح** عليها.

**الإصلاح:**

```js
async function hydrateOrders(ids) {
  try {
    const data = await apiPost('order_statuses', { orderIds: ids });
    const got  = new Set(Object.keys(data.statuses || {}));
    const miss = ids.filter(id => !got.has(id));
    if (miss.length) {
      orders = orders.filter(id => !miss.includes(id));   // شيلهم من القايمة
      showToast(`⚠️ ${miss.length} كود مش أوردر معروف واتشال: ${miss.join('، ')}`, 'warning', 6000);
      playBeep('warn');
    }
    ...
```

---

### 🟠-11 — مفيش أي سقف على عدد الـ IDs في نداء واحد

| الـ endpoint | سقف في الواجهة | سقف في الـ Worker |
|---|---|---|
| `update_status` | ٢٠ (`UPDATE_CHUNK`) | **مفيش** |
| `order_statuses` | **مفيش** | **مفيش** |
| `order_details` | **مفيش** | **مفيش** |
| `resolve_orders` | **مفيش** | **مفيش** |

**السيناريو الواقعي:** «البحث عن أوردرات مندوب» بيرجّع لحد ١٠٠٠ أوردر لكل
استعلام فرعي (S1 + S2 = ٢٠٠٠)، وفيه checkbox **«تحديد الكل»**. الموظف بيضغطه →
`csmAddSelected` → `addOrders(picked)` → `hydrateOrders(fresh)` بكل الـ IDs في
**نداء `nodes(ids:)` واحد**.

شوبيفاي بتحطّ سقف على عدد الـ `ids` في `nodes` (٢٥٠)، وسقف تكلفة الاستعلام
بيضرب قبل كده. النتيجة: نداء فاشل → **توست واحد** → كل الصفوف بلا حالة → كلها
**بتعدّي** فحص العميل (المجهول مش محظور) → دفعة كاملة بتتبعت وترجع فشل.

**الإصلاح:**

```js
// الواجهة — تقسيم الترطيب
const HYDRATE_CHUNK = 50;
async function hydrateOrders(ids) {
  for (let i = 0; i < ids.length; i += HYDRATE_CHUNK)
    await hydrateChunk(ids.slice(i, i + HYDRATE_CHUNK));
}

// الـ Worker — حارس صريح على كل endpoint بياخد orderIds
const MAX_IDS = 50;
if (orderIds.length > MAX_IDS)
  return json({ ok:false, error:`عدد كبير: ${orderIds.length} — الحد ${MAX_IDS} لكل نداء` }, 400, request);
```

---

### 🟠-12 — تكلفة استعلام `fetchOrderStates(withReturns)` غير محدودة

تعليق الأداة نفسها:

```js
// `withReturns` adds the reverse-fulfillment block (expensive, ~108 request points/order)
```

ودي بتتنادى **للدفعة كلها مرة واحدة** لما `targetLabel === 'Returned'`.
٢٠ أوردر × ١٠٨ ≈ **٢١٦٠ نقطة** — فوق سقف تكلفة الاستعلام الواحد عند شوبيفاي.
والنتيجة مش throttle بيتعاد، دي **رفض للاستعلام كله** → الدفعة كلها بتفشل.

**ما وقعش في الإنتاج لحد دلوقتي** — أكبر دفعة حقيقية من 01-08 كانت **٢٤ صف**
(وواحدة legacy)، ودفعات `Returned` أصغر من كده. فالبند **كامن**، بس مفيش أي
حارس.

**إصلاحان:**

1. قسّم `fetchOrderStates` لما `withReturns === true` (٥–١٠ أوردر للنداء).
2. **خلي التكلفة مرئية** — `shopifyGQL` دلوقتي بترمي `extensions` كلها:

```js
if (data.extensions?.cost) {
  const c = data.extensions.cost;
  // مرّرها للمنادي أو سجّلها — من غيرها الاقتراب من السقف مش هيبان غير بالانفجار
}
```

---

### 🟠-13 — التوقيت الصيفي بيخلص **29-10-2026** والإزاحة مكتوبة بالإيد في الملفين

```js
// index.js  (سطر ٢٧٤)               // index.html (سطر ١٩٠٦)
const CAIRO_OFFSET_HOURS = 3;        const CAIRO_OFFSET_HOURS = 3;
// ⚠️ Egypt DST ends 29-10-2026 → change to 2.
```

القيمة صح **النهارده** (اتأكدت: القاهرة `EEST +0300`). وبعد 29-10 بـ ٧ أسابيع
تقريبًا، **من غير ما يتغيّر سطر واحد في الكود**:

- كل وقت معروض في تاب السجل بيبقى **+ساعة** عن الحقيقة.
- فلتر «اليوم» بيقصّ الساعة الأولى ويضيف ساعة من اليوم اللي قبله
  (`cairoDayBoundsUTC`).
- **الأخطر:** `cairoDate()` بتكتب `custom.pickup_date`. أي أوردر بيتشحن بين
  ٢٣:٠٠ و٠٠:٠٠ بتوقيت القاهرة **هيتسجّل بتاريخ اليوم اللي بعده** — وده تاريخ
  بيتكتب على الأوردر ومش بيترجع منه.
- الملفين بيتحدّثوا **مستقلين**، فوارد إن واحد يتغيّر والتاني لأ.

**الإصلاح — الإزاحة تتحسب مش تتكتب** (مدعومة في Workers وفي المتصفحات):

```js
// نفس الدالة في الملفين
const CAIRO_TZ = 'Africa/Cairo';
function cairoFields(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAIRO_TZ, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false,
  }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  return p;                            // { year, month, day, hour, minute }
}
function cairoDate() { const p = cairoFields(new Date()); return `${p.year}-${p.month}-${p.day}`; }
```

وبعدها **يتشال** `CAIRO_OFFSET_HOURS` نهائيًا عشان مايفضلش مصدر تاني بيتعتّق.
`cairoDayBoundsUTC` تتحوّل لنفس المبدأ (تحويل بداية/نهاية اليوم بالمنطقة الزمنية).

⚠️ **البند ده على مستوى الستاك كله مش الأداة دي بس** — أي أداة فيها
`CAIRO_OFFSET_HOURS` معرّضة لنفس اليوم.

---

## 🟡 متوسط — تشغيلي و UX

> القسم ده مكتوب من زاوية **اللي بيستخدم الأداة ٢٧ مرة في اليوم**، مش من زاوية
> الكود. الأرقام كلها مقاسة من السجل.

### 🟡-14 — نافذة الملخص بتبلع أول سكانة بعد كل دفعة

بعد ما الدفعة تخلص، `showUpdateSummary` بتفتح overlay بيغطي الصفحة:

- **مفيش `focusScan()`** — التركيز ضاع من ساعة ما الموظف ضغط زرار التأكيد.
- **مفيش Esc ولا Enter** — مستمع الكيبورد الوحيد في الأداة شغّال على شاشة
  الدخول بس.
- **مفيش ✕ ولا إغلاق بالخلفية** (مقصود بالتصميم).

يعني لو الموظف مسح الأوردر اللي بعده والنافذة مفتوحة، **الحروف بتروح على
`document.body` وتضيع** — من غير صوت ولا رسالة. لازم ياخد الماوس ويضغط
«🆕 تسجيل أوردرات جديدة» الأول.

**× ٢٧ مرة في اليوم.**

**الإصلاح:** ركّز الزرار الأساسي في `showUpdateSummary`، وضيف مستمع Esc/Enter
مربوط بالنافذة، ونادِ `focusScan()` في `summaryStartFresh`. أحسن من كده: لو
النتيجة **نجاح كامل** (`errCount === 0 && warnCount === 0`)، النافذة تتقفل
لوحدها بعد ٢–٣ ثواني وترجّع التركيز للسكانر — الفشل والتحذير بس هما اللي
يوقّفوا الموظف.

### 🟡-15 — صفر اختصارات كيبورد في مسار التشغيل

الدفعة الواحدة = **٣ ضغطات ماوس إجبارية**:

```
تأكيد المندوب  →  تأكيد «تحديث ... أوردر؟»  →  إغلاق نافذة الملخص
```

في أداة مبنية حوالين **مسدس سكانر**، ده معناه إن اليد بتسيب السكانر ٣ مرات في
كل دفعة، ٢٧ دفعة في اليوم ≈ **٨١ نقلة يد/يوم**. أرخص إصلاح: `Enter` يأكّد
النافذة المفتوحة، `Esc` يلغيها.

### 🟡-16 — زرار الخروج هو اسم الموظف نفسه، وبـ `confirm()` أصلي

```html
<button class="hbtn active-user" id="activeUserBtn" onclick="doLogout()">👤 —</button>
```

```js
if (!confirm('تسجيل الخروج؟')) return;   // سطر 2233
```

**بندان مع بعض:**

1. **اكتشافية:** الضغط على اسمك = خروج. مفيش أي إشارة. والدليل من السجل:
   **١٣٨ دخول مقابل ٢ خروج** — يعني الزرار عمليًا مش بيتستخدم، وبيانات نهاية
   الجلسة مالهاش أي قيمة.
2. **مخالفة معيار:** ده آخر `confirm()` أصلي في الأداة — وسجل التحديثات بتاع
   الأداة **نفسه** بيقول: «نوافذ تأكيد بدل `confirm()`/`alert()` الأصلية
   للمتصفح». يتحوّل لـ `showConfirm`.

**اقتراح:** الاسم يفضل بادج، وزرار خروج صغير 🚪 منفصل جنبه.

### 🟡-17 — قايمة أسباب الإرجاع ٣ قيم بس، والتوزيع بيقول إنها مش كفاية

**التوزيع الفعلي (كل صفوف `Returned` / S1 الناجحة):**

| السبب | العدد |
|---|---|
| الجودة / الخامة | ٥٢ |
| مقاس غير مظبوط | ٥٠ |
| يتهرب من الاستلام | ٤٠ |

**التوزيع شبه متساوي على ٣ خيارات = بصمة قايمة أصغر من الواقع.** قارنها بقايمة
الإلغاء (١٦ قيمة) اللي توزيعها طبيعي وله ذيل: `لا يرد نهائي على المندوب` ٤٠ ·
`لا يوجد سبب` ٢٩ · `العميل سافر` ١٢ · `العميل رفض ذكر السبب` ١٢ · وبعدين ذيل
من ١ و٢ و٣.

**والأهم — القايمتين مبنيتين لحدثين مختلفين:**

`S1 = Returned` معناه (state-machines §1.1) **«التسليم فشل / العميل رفض»** —
يعني RTO. وقايمة الإلغاء فيها عيلة أسباب RTO كاملة (`لا يرد نهائي على المندوب` ·
`تأجيل غير محدد` · `رقم غير صحيح` · `العميل سافر`)، وقايمة الإرجاع **مفيهاش
ولا واحدة منهم** غير `يتهرب من الاستلام`. فالموظف اللي أوردره رجع لأن العنوان
غلط **لازم** يختار «الجودة / الخامة» أو «مقاس غير مظبوط».

❓ **قرار مطلوب:** توسيع `custom.return_manual_reason` بأسباب الـ RTO، أو
فصلها لقايمتين (سبب RTO لـ S1 · سبب إرجاع لـ S2). لحد ما ده يحصل، **ممنوع**
بناء أي KPI على أسباب الإرجاع.

### 🟡-18 — اختيار سبب واحد بيعيد بناء الجدول كله

```js
function setOrderReason(id, value) {
  ...
  updateActionState();
  renderOrders();          // ← innerHTML كامل لكل الصفوف
}
```

الأثر: الـ `<select>` بيضيع تركيزه، وأي قايمة مفتوحة بتتقفل، وعلى قايمة كبيرة
فيه تهنيج محسوس. الإصلاح: حدّث الصف بتاعه بس (أو على الأقل الـ `class` بتاع
`reason-missing` + الشارة).

### 🟡-19 — التوست الأصفر مش موجود أصلاً في الأداة

```
showToast(..., 'error')   × 27
showToast(..., 'success') × 7
showToast(..., 'neutral') × 2
showToast(..., 'warning') × 0        و .toast-warning غير معرّفة في الـ CSS
```

**نتيجتان:**

1. حاجات مش أخطاء بتظهر **حمرا**: «⚠️ موجود بالفعل» · «كل الأوردرات المحددة
   موجودة بالفعل» · «لا توجد أوردرات ناجحة للطباعة». الأحمر لكل حاجة =
   الموظف بيتعوّد يتجاهل الأحمر، وساعتها الأحمر الحقيقي بيضيع.
2. `.toast-warning` **مش معرّفة** — يعني أول واحد يستخدم النوع الرسمي ده
   (`Standards #41`) هيطلّع **توست بلا خلفية**: نص أبيض على شفاف، فشل صامت
   والموظف مش هيبلّغ عنه.

**الإصلاح:** `.toast-warning { background: var(--amber); }` + تحويل التوستات
اللي فوق من `'error'` لـ `'warning'`.

### 🟡-20 — طباعة المانفيست بتفشل بصمت لو الـ popup متمنوع

```js
const win = window.open('', '_blank');
win.document.write(html);     // ← win = null لو المتصفح منع النافذة
```

المتصفح بيرجّع `null`، والسطر اللي بعده بيرمي `TypeError` مش متمسك في أي
`try/catch` → **مفيش أي حاجة بتحصل ولا أي رسالة**. الموظف بيفتكر إن الطباعة
اشتغلت والمندوب بيمشي من غير مانفيست.

```js
const win = window.open('', '_blank');
if (!win) { showToast('المتصفح منع نافذة الطباعة — اسمح بالنوافذ المنبثقة للموقع ده', 'error', 7000); return; }
```

### 🟡-21 — متغيرات CSS في نافذة المانفيست غير معرّفة

```js
<td style="...color:var(--accent);...">${d.orderName}</td>
<div style="font-size:13px;color:var(--text-secondary)">إجمالي التحصيل</div>
```

نافذة المانفيست **مستند منفصل** ليه `<style>` بتاعه، ومفيش فيه `:root` — يعني
المتغيرين دول **فاضيين**، ورقم الأوردر بيفقد لونه الأزرار المميّز والليبل بيفقد
الرمادي. نفس عيلة `Standards #36`، وفحص `css-check.js` **مابيمسكهاش** لأنه
بيقارن كل الملف مع بعض.

الإصلاح: قيم صريحة في نافذة الطباعة (`#2563eb` · `#6b7280`) — النافذة دي بره
نظام التوكنز أصلاً وبتتطبع أبيض وأسود.

### 🟡-22 — `revokeObjectURL` فوري بعد `a.click()`

```js
a.click();
URL.revokeObjectURL(url);   // ← ممكن يلغي التنزيل نفسه في بعض المتصفحات
```

الإصلاح: `setTimeout(() => URL.revokeObjectURL(url), 1000);`

### 🟡-23 — تجميع الدفعات في السجل بينكسر على حدود الصفحة

`renderLog` بتجمّع الصفوف المتجاورة بـ `batchId`، والصفحة ١٠٠ صف. دفعة واقعة
على الحد بتظهر **مجموعتين** في صفحتين، بعدادات `✓/⚠/✗` مقسومة، وزرار «طباعة»
بيطبع **نص** الدفعة بس — من غير أي إشارة إنها ناقصة.

بمتوسط ٣.٤ أوردر للدفعة الاحتمال قليل، بس لما يحصل بيبقى صامت تمامًا.

اقتراح: الـ Worker يرجّع عدد صفوف الدفعة الكامل جنب كل صف (`batchSize`)،
والواجهة تقارن وتوسم المجموعة الناقصة.

### 🟡-24 — تحديد الدفعات في السجل بيضيع مع تغيير الصفحة

```js
const knownKeys = new Set(groups.map(g => g.key));
[...selectedLogBatches].forEach(k => { if (!knownKeys.has(k)) selectedLogBatches.delete(k); });
```

اختيار دفعات في صفحة ١ → الانتقال لصفحة ٢ → الاختيار **بيتمسح**. من غير أي
رسالة. لو المقصود إن الاختيار للصفحة الحالية بس، ده لازم يتقال للموظف.

### 🟡-25 — مسار الـ `warning` ما اشتغلش ولا مرة في الإنتاج

```sql
SELECT json_extract(extra,'$.result'), COUNT(*) FROM logs
WHERE tool='order_status' AND type='update' GROUP BY 1;
-- success: 11,973   error: 175   warning: 0
```

**قراءتان، الاتنين صح:**

- ✅ **إيجابي:** `verifyCancels` بالانتظار المتصاعد نجحت في تأكيد **٢٦٦** عملية
  إلغاء ناجحة منذ 23-08 (١١٣ `Cancelled` + ١٥٣ `Returned`/S1) من غير حالة
  «ما اتأكدناش» واحدة. ده بالظبط عكس عطل
  `Order-Cancel` الموثّق في `worker-builder` Step 5A ③ (اللي كان الأصفر فيه هو
  الحالة الافتراضية).
- ⚠️ **سلبي:** يعني **الشاشة الصفرا ماحدش شافها في الواقع أبدًا**. المسار
  (لون الهيدر، البلاطة، البانر، نص التحذير) **غير مختبر ميدانيًا**، وأول مرة
  هيشتغل فيها هتكون في أزمة حقيقية. يستاهل اختبار مقصود مرة واحدة على أوردر
  تجريبي.

### 🟡-26 — ميزة v4.3.0 الرئيسية بتشتغل في ٢٪ من الحالات

```sql
SELECT json_extract(extra,'$.reasonSource'), COUNT(*) FROM logs
WHERE tool='order_status' AND type='update' AND timestamp>='2026-08-24' GROUP BY 1;
-- operator: 223   existing: 5   null: 1190
```

`reasonSource='existing'` = **٥ من ٢٢٨** (٢.٢٪). يعني الافتراض اللي الميزة
اتبنت عليه — «خدمة العملاء بتكتب السبب على شوبيفاي قبل ما الأوردر يوصل لموظف
العمليات» — **مش بيحصل عمليًا**.

مش عيب في الكود؛ ده **قياس** يستاهل قرار: إمّا خدمة العملاء تلتزم بكتابة السبب،
أو الميزة تتقفل كحالة نادرة ومايتبنيش عليها أكتر من كده.

---

## 🔵 تصليب وتنظيف

| # | البند | المكان |
|---|---|---|
| 🔵-27 | **GraphQL بالتضفير النصي** — `courier` و`orderName` و`createdAfter` بيتحطوا جوّه نص الاستعلام. الـ escaping بيغطي `"` بس، فأي `\` أو سطر جديد بيكسر المستند. استخدم GraphQL variables. | `runCourierSearch` · `resolveOrderByName` |
| 🔵-28 | `runCourierSearch` مش بتمرّر `opName` لـ `shopifyGQL` → كل أخطاءها بتقول `shopify:` بدل اسم العملية | `index.js:1440` |
| 🔵-29 | `parseInt` على `limit`/`offset` من غير حارس `NaN` — `?offset=abc` بيبعت `NaN` للـ SQL ويرجّع خطأ D1 خام | `get_logs` |
| 🔵-30 | `search` بيدخل `LIKE ?` من غير escape لـ `%` و`_` — بحث بـ `_` بيرجّع نتايج غريبة | `buildLogFilterSQL` |
| 🔵-31 | **تناقض في الـ escaping**: `renderChips` بتعمل `val.replace(/'/g,"\\'")` و`msRenderList` **لأ** — مندوب أو موظف اسمه فيه `'` بيكسر الـ `onclick` بتاعه | `msRenderList` |
| 🔵-32 | **صفر escaping للـ HTML** في `statusPill` · بادج المندوب · `notes` في السجل · جدول تأكيد المندوب. `escAttr()` موجودة ومستخدمة في مكان **واحد** بس | متفرق |
| 🔵-33 | `.c-del` و`.pr-arrow` كلاسات مستخدمة وغير معرّفة في الـ CSS (سهم الفترة السريعة مالوش أي ستايل) | `index.html` |
| 🔵-34 | `.btn-red` غير موجودة (`Standards #38`) — زرار «تم» في نافذتي «أوردرات غير مطابقة» و«أسباب ناقصة» حالة نهائية سلبية | `index.html` |
| 🔵-35 | **حدود السيرفر مكتوبة في الواجهة**: «تصدير XLSX حتى **2000** صف» في About، و«الحد الأقصى (**1000** أوردر)» في نافذة البحث. `Standards #30` بيقول الحقيقة تيجي من الـ Worker | `index.html:1130` · `csmWarn` |
| 🔵-36 | `lastBatch` بتتكتب ومابتتقريش في أي مكان — حالة ميتة | `index.html` |
| 🔵-37 | `createFulfillment` بترجّع `openFulfillmentOrders.length` (عدد المدخلات) مش عدد مؤكَّد من الرد — مخالفة حرفية لـ Step 5A ② حتى لو النتيجة صح عمليًا | `index.js:1057` |
| 🔵-38 | `apiGet/apiPost` بيفترضوا إن الرد JSON. صفحة خطأ HTML من كلاودفلير (502/524) بتدّي `Unexpected token '<'` بدل رسالة مفيدة — وارد جدًا مع الدفعات الطويلة | `index.html:1694` |
| 🔵-39 | `assertEnv` مابتتنادش في مسارات D1-only (`get_logs*` · `get_employees` · `check_employee`) — binding ناقص بيدّي خطأ خام | `index.js §HANDLER` |
| 🔵-40 | **البصمة متأخرة:** `order-lifecycle` الحالي **v1.3.0** والأداة مختومة **v1.2.0**. الفرق فيه Rule 15 (دورة R/E واحدة مفتوحة) و**Rule 16** (`custom.zone` قناة شحن مش جغرافيا) | `CLAUDE.md` + رأس الملفين |
| 🔵-41 | `diag.checks` لسه بالشكل القديم (مفاتيح top-level بدل `[{ok,label,detail}]`) — موثّق كبند مفتوح، والتسليم الجاي فرصة «التعديل المقصود» | `index.js` |
| 🔵-42 | **بند مغلق يستاهل يتكتب:** الشرط الملزم في `state-machines.md` §2.3 (رفض `Confirmed + RETURN/EXCHANGE` لو فيه دورة مفتوحة) **لا ينطبق** على الأداة دي — هي بتكتب `Ready`/`Shipped`/`Returned` في S2 بس، وعمرها ما كتبت القيمتين دول. المهارة بتقول «binding requirement for the next piece of work on that Worker» — يتسجّل في `CLAUDE.md` عشان يبطّل يتفتح كل مراجعة | `CLAUDE.md` |

**ملاحظة على المهارة نفسها:** `state-machines.md` §1.5 لسه مكتوب فيه إن الأداة
«**has no repo yet** — it is one of the tools still deployed by hand» وإن أسماء
`reasonIsNew`/`extra.reasonSource` هتنتقل لـ `CLAUDE.md` **عند النقل**. النقل
**تم** والملف موجود — القسم ده في المهارة محتاج يتحدّث.

---

## ✅ اللي اتأكد إنه سليم (مش افتراض — اتفحص)

| البند | الدليل |
|---|---|
| `shopifyGQL` نسخة عقد Step 5A كاملة | فحص شبكة + status + JSON + `data.errors` + `data` فاضية + backoff على THROTTLED ✓ |
| النتيجة ٣ حالات في الرد وفي `extra.result` | ✓ |
| `actions` بتتمرر من بره وبتتملي أول بأول | ✓ — والدليل الحي: `#52732` سجّل `["orderCancel"]` رغم إنه رمى بعدها |
| `writeLog` بترجّع `logged:false` مش `.catch(()=>{})` | ✓ في `verify_employee` و`log_logout` و`update_status` |
| `assertEnv` + `requireLocationId` قبل الكتابة | ✓ |
| `?action=diag` و`?action=get_config` موجودين، و`diag` مابيرجّعش قيمة أي سر | ✓ |
| `order_status` / `update`·`login`·`logout` مسجّلين في `constants` §7 | ✓ |
| CORS Option B صارمة، ومفيش `ecommoda24.github.io` | ✓ |
| قيم S1 و S2 مطابقة **حرفيًا** لتعريف شوبيفاي الحي | ✓ — اتقارنت مع `metafieldDefinitions` النهارده: ١٢ قيمة S1 · ٦ قيم S2، مطابقة بالحرف |
| أنواع الميتافيلد مطابقة للتعريف الحي | ✓ — `pickup_date` = `date` · `courier`/`cancel_manual_reason`/`return_manual_reason` = `single_line_text_field` |
| إصلاح v3.6.0 (`Value can't be blank`) اشتغل فعلاً | ✓ — ٢٨ حالة، **آخرها 23-08-2026 14:49** ومفيش ولا واحدة بعد كده |
| Step 9 + Step 9A + `node --check` | ✓ — 47 توكن · 631 استخدام · صفر مشكلة |

**معدل النجاح منذ v3.3.0 (23-08 → 07-09):** ١٥٣٠ نجاح · ١٥ فشل =
**٩٩.٠٪**. الأداة **سليمة تشغيليًا** — كل اللي فوق شغل تصليب على أساس شغّال،
مش إنقاذ.

---

## خطة تنفيذ مقترحة

**دفعة ١ — إصلاحات لا تحتاج قرار (تنفذ فورًا):**

```
🔴-5  MIN_WORKER_VERSION → 4.4.0                          سطر واحد
🔴-7  حارس WORKER_SECRET الغايب                            ٣ أسطر
🔴-6  لقطة orders + قفل الإدخال أثناء التحديث              ~١٠ أسطر
🔴-2ب cancelOrder idempotent لو الأوردر ملغي أصلاً           ~٨ أسطر
🟠-9  الأفعال التلاتة بعد الكتابة → warning مش error        ~١٥ سطر
🟠-10 كشف الـ IDs اللي شوبيفاي ما رجّعتهاش                  ~٨ أسطر
🟡-20 حارس window.open للمانفيست                           سطر
🟡-19 .toast-warning + تحويل التوستات المناسبة              ~٥ أسطر
🟡-14 تركيز + Esc/Enter على نافذة الملخص                   ~١٠ أسطر
🟡-16 doLogout بـ showConfirm بدل confirm()                 سطر
```

**دفعة ٢ — إصلاحات محتاجة قرار من أحمد:**

```
🔴-1  In-Return في جداول الانتقال     ← ٤ أوردرات معلّقة دلوقتي، أعلى أولوية
🔴-4  «لا يوجد سبب» ترجع للقايمتين؟
🟠-8  إلغاء الـ Fulfillment: الأداة تتغيّر ولا المهارة؟
🟡-17 توسيع/فصل قايمة أسباب الإرجاع
```

**دفعة ٣ — تصليب:**

```
🔴-3  TTL على قوايم الأسباب والمناديب + تحقق سيرفري قبل الفعل
🟠-13 حساب توقيت القاهرة بـ Intl بدل الثابت    ← قبل 29-10-2026
🟠-11 سقف IDs (٥٠) في الواجهة والـ Worker
🟠-12 تقسيم fetchOrderStates لما withReturns + إظهار extensions.cost
🔵-27 → 🔵-42
```

**بعد أي تعديل — إلزامي:** Step 9 + `css-check.js` + `node --check` + تحديث
بصمة المهارات في رأس الملفين وفي `CLAUDE.md`، ورفع `TOOL_VERSION` و`VERSION`
مع بعض.

---

## استعلامات المتابعة (احفظها)

```sql
-- ① صحة عامة: توزيع النتايج آخر ٧ أيام
SELECT json_extract(extra,'$.result') r, COUNT(*) n FROM logs
WHERE tool='order_status' AND type='update' AND timestamp >= date('now','-7 day') GROUP BY r;

-- ② كل فشل بسببه — أول مكان تبص فيه
SELECT substr(json_extract(extra,'$.error'),1,120) e, COUNT(*) n, MAX(timestamp) last
FROM logs WHERE tool='order_status' AND type='update'
  AND json_extract(extra,'$.result')='error' GROUP BY e ORDER BY n DESC;

-- ③ 🔴 الأخطر: أوردر اتلغى وحالته ما اتكتبتش (بند 🔴-2)
SELECT timestamp, order_name, employee, notes FROM logs
WHERE tool='order_status' AND type='update' AND json_extract(extra,'$.result')='error'
  AND json_extract(extra,'$.actions') LIKE '%orderCancel%' ORDER BY timestamp DESC;

-- ④ محاولات إعادة التسليم (البديل الوحيد بعد بند 🟠-8)
SELECT date(timestamp) d, COUNT(*) n FROM logs
WHERE tool='order_status' AND type='update' AND json_extract(extra,'$.targetLabel')='Ready'
  AND json_extract(extra,'$.s1Before')='Shipped' AND json_extract(extra,'$.result')='success'
GROUP BY d ORDER BY d DESC;

-- ⑤ أسباب خارج قايمة الاختيار الحالية (دَين بيانات — بند 🔴-4)
SELECT json_extract(extra,'$.reason') r, COUNT(*) n FROM logs
WHERE tool='order_status' AND type='update' AND json_extract(extra,'$.reason') IS NOT NULL
GROUP BY r ORDER BY n DESC;
```

```graphql
# ⑥ أوردرات معلّقة في In-Return (بند 🔴-1) — لازم ترجع فاضية بعد الإصلاح
{ orders(first: 50, query: "metafields.custom.status_2_r_e:'In-Return'") {
    nodes { name s1: metafield(namespace:"custom", key:"manual_status"){ value } } } }
```

---

آخر تحديث: 07-09-2026 — 22:50

</div>
