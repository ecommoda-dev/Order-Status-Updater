// ═══════════════════════════════════════════════════════════════════════════
// Order Status Updater — Worker  v4.3.1
// skills: worker-builder v1.1.0 · constants v1.2.0 — 31-08-2026
// Account : ecommoda-dev   |   D1: ecommoda-dev-logs (binding: DB)
// ---------------------------------------------------------------------------
// 🔗🔗 قارئ خارجي لسجل الأداة دي — اقرا قبل أي تعديل على شكل `extra`
// ---------------------------------------------------------------------------
// من 31-08-2026، **cod-payment-center-worker** (COD Payment Center · أداة
// مالية) بيقرا صفوف الأداة دي من D1 **مباشرة** — مش عبر نداء Worker-to-Worker.
// بيستعلم على: tool='order_status' · type ≠ login/logout · order_id ·
// extra.result ∈ ('success','warning') · extra.courier · extra.targetLabel
// (مع fallback على extra.specifier) · timestamp — عشان يجيب أوردرات المندوب
// اللي اتسجّلت Delivered النهارده ويعرضها لموظف التحصيل.
//
// 🔴 أي تغيير في أسماء أو قيم مفاتيح `extra` دي — أو في قيمة TOOL_NAME —
// **بيكسر أداة التحصيل في صمت تام**: هترجّع ليستة فاضية من غير أي رسالة خطأ،
// والموظف هيشوف "مفيش أوردرات النهاردة" ويقفل من غير ما يحصّل فلوس.
// مفيش أي حماية تلقائية ضد ده — التحذير ده هو الحماية.
//
// ✅ قبل ما تعدّل أي حاجة في بلوك الـ `extra` تحت (دوّر على §CONTRACT::extra)
// أو في TOOL_NAME: افتح §TODAY-IMPORT في cod-payment-center-worker وعدّله
// معاه في نفس التسليم. الأداتين على نفس قاعدة D1 (ecommoda-dev-logs).
// ---------------------------------------------------------------------------
// v4.3.1 — توثيق العقد العابر للأدوات (31-08-2026):
//   - 🔗 تحذير في الرأس وعند بناء `extra` بإن cod-payment-center-worker بقى
//     بيقرا صفوف الأداة دي من D1 مباشرة (بدل Service Binding اللي اتشال).
//   - ⚪ صفر تغيير في السلوك أو في أي استعلام — تعليقات بس.
//
// v4.3.0 — احترام سبب الإلغاء/الإرجاع المسجّل مسبقًا (24-08-2026):
//   السياق: خدمة العملاء بتكتب custom.cancel_manual_reason /
//   custom.return_manual_reason على الأوردر وقت ما العميل يبلّغ بالسبب — قبل
//   ما الأوردر يوصل لموظف العمليات خالص. لحد v4.2.0 الأداة ماكانتش بتشوف
//   القيمة دي أصلاً، فكانت بتطلب من الموظف يختار سبب لأوردر السبب بتاعه
//   متسجّل قدامه في شوبيفاي — يعني بتجبره يخمّن، وأول خيار في القايمة بيبقى
//   أسهل حاجة يضغطها، والنتيجة سبب غلط بيتكتب فوق سبب صح.
//
//   - 🆕 fetchOrderStates بقت تجيب الميتافيلدين دول (cancelReason/returnReason،
//     مع .trim() — ميتافيلد فيه مسافات بس مايتحسبش سبب موجود).
//   - 🆕 order_statuses بترجّعهم للواجهة (statuses[id].cancelReason/.returnReason)
//     — الواجهة بتعرض السبب مختار سلفًا وبتشيل الإلزام عن الصف.
//   - 🔧 فحص "السبب مطلوب" في update_status: الأوردر بيترفض بس لو مفيش سبب
//     من الواجهة **ولا** على شوبيفاي. قبل كده كان بيبص على reasons{} بس.
//   - 🔧 applyDirect: كتابة الميتافيلد بقت مشروطة بـ reasonIsNew (الموظف اختار
//     قيمة **مختلفة** عن الموجودة) مش بمجرد وجود reason. لو ساب السبب زي ما
//     هو، البند مابيتضافش لـ mfs خالص — قيمة خدمة العملاء بتفضل حرفيًا زي ما
//     هي، والنداء بيفضل أصغر (كل بند زيادة في metafieldsSet = مساحة فشل زيادة
//     ممكن تسقّط النداء كله بما فيه كتابة الحالة نفسها — نفس فئة عطل v3.6.0).
//   - 🆕 extra.reasonSource في D1: 'operator' (الموظف اختاره من الأداة) |
//     'existing' (كان مسجّل على شوبيفاي والأداة ما كتبتش فوقه) | null.
//     extra.reason بقى بيحمل السبب **الفعلي** للأوردر مهما كان مصدره، مش بس
//     اللي موظف العمليات لمسه — ونص السجل بيوسمه بـ "(مسجّل مسبقًا)".
//   - ⚠️ الواجهة v4.3.0 بتعتمد على cancelReason/returnReason في رد
//     order_statuses — لازم الملفين يترفعوا مع بعض. واجهة أقدم مع Worker
//     v4.3.0 هتشتغل بس من غير الميزة (هتفضل تطلب السبب زي v4.2.0)؛ واجهة
//     v4.3.0 مع Worker أقدم هتفضل تطلب السبب برضه (القيم هتيجي undefined)
//     — الاتنين آمنين، بس الميزة مش هتشتغل غير بالملفين مع بعض.
//
// v4.2.0 — مزامنة رقم النسخة بس (23-08-2026):
//   - 🔧 لا يوجد تغيير في منطق الـ Worker. رقم النسخة اتزوّد بس عشان يفضل
//     مطابق لـ TOOL_VERSION في الواجهة — التعديل الفعلي HTML-only: جدول
//     الأوردرات بقى بيتفتح تلقائي لو فيه أوردر ناقصه سبب إلغاء/إرجاع، وزرار
//     "تحديث الكل" بقى بيعرض نافذة تأكيد صريحة بأسماء الأوردرات الناقصة
//     بدل توست بس. راجع HTML v4.2.0 changelog للتفاصيل.
//
// v4.1.0 — سبب الإلغاء/الإرجاع إلزامي بس لـ S1 (23-08-2026):
//   - 🔧 تعديل على v4.0.0: سبب الإلغاء/الإرجاع بقى بيتسجّل وبقى إلزامي **بس**
//     لما التحديث يتحل لـ S1 (specifier === 'Cancelled' أو specifier ===
//     'Returned'). لما "Returned" يتحل لـ S2 (specifier === 'Returned_S2')
//     السبب مش بيتكتب على الأوردر وبقى مش إلزامي خالص — السبب: في حالة S2
//     غالبًا فريق خدمة العملاء يكون سجّل سبب الاسترجاع/الاستبدال وقت إنشاء
//     طلب الاسترجاع، قبل ما نوصل لتحديث الحالة في الأداة دي أصلاً.
//   - 🔧 applyDirect(): شيلنا specifier === 'Returned_S2' من شرط كتابة
//     MF.RETURN_REASON — دلوقتي بس specifier === 'Returned' (S1) بيكتب السبب.
//   - 🔧 update_status: فحص "السبب مطلوب" بقى بعد ما نجيب حالة كل أوردر
//     (fetchOrderStates) ونحل specifier بتاعه (resolveSpecifier) — الفحص
//     بقى لكل أوردر لوحده حسب الـ specifier المتحل له، مش فحص عام على مستوى
//     targetLabel زي ما كان في v4.0.0. لسه فحص دفعي (كل الدفعة بترفض 400 لو
//     أي أوردر من اللي هيتحل لـ S1 جاله من غير سبب) — مجرد أدق في تحديد مين
//     محتاج سبب فعلاً.
//
// v4.0.0 — سبب الإلغاء/الإرجاع إلزامي (23-08-2026):
//   - 🆕 عمود جديد "سبب الإلغاء/الإرجاع" في جدول الأوردرات (الواجهة) — يظهر
//     فقط لما الحالة المستهدفة تكون Cancelled أو Returned. القيم مسحوبة من
//     قوائم الاختيار (choices) في تعريفي الميتافيلد custom.cancel_manual_reason
//     و custom.return_manual_reason عن طريق endpoint جديد: reason_values.
//   - 🆕 السبب إلزامي — الـ Worker بيرفض الدفعة كلها (400) لو أي أوردر من
//     المطلوب تحديثهم بالحالتين دول جاله من غير سبب في reasons{}. الواجهة
//     بتمنع الضغط على "تحديث الكل" أصلاً قبل ما تبعت، فالفحص هنا خط دفاع تاني.
//   - 🆕 MF.CANCEL_REASON / MF.RETURN_REASON — نفس نوع S1/S2 بالظبط
//     (single_line_text_field، Choice list). بيتكتبوا في **نفس** نداء
//     metafieldsSet اللي بيكتب الحالة (applyDirect) — كتابة ذرية واحدة؛ لو
//     شوبيفاي رفضت القيمة (خارج الـ choices المعرّفة) الأوردر كله يترفض
//     بدل ما تتكتب الحالة والسبب ينفصل عنها.
//   - 🆕 Returned بيكتب السبب في الحالتين S1 (Returned) و S2 (Returned_S2) —
//     نفس الحدث الحقيقي (العميل رجّع الأوردر) بغض النظر عن مين المسار اللي
//     resolveSpecifier قرره لكل أوردر.
//   - 🆕 السبب بيتسجّل في D1 كمان (extra.reason) لأي صف تحديث Cancelled/Returned.
//
// v3.7.0 — مواءمة مع ecommoda-worker-builder (Step 5 + Step 5A) (23-08-2026):
//   - 🆕 orderId رقمي جوّه كل response فيه بيانات أوردر (worker-builder Step 5،
//     قاعدة إلزامية مضافة حديثًا) — عشان orderLink() في الواجهة يقدر يبني
//     هايبر لينك لشوبيفاي فعليًا بدل ما يرجع لـ fallback بدون لينك:
//       • order_statuses  → statuses[id].orderId اتضاف (كان الرقم مفتاح الـ dict بس)
//       • order_details   → details[id].orderId اتضاف
//       • search_courier_orders (runCourierSearch) → الحقل كان اسمه `id` غلط،
//         بقى `orderId` — الاسم الموحّد المقروء في كل الأدوات.
//   - 🐛 3 نداءات ميوتيشن كانت بتفوّت الفحص التالت من عقد Step 5A (تأكيد الـ
//     payload من رد شوبيفاي، مش مجرد userErrors فاضية):
//       • cancelOrder — بقت تتحقق إن `job.id` رجع فعلاً قبل ما ترجّع true.
//       • cancelFulfillments — بقت تتحقق إن `fulfillment` مش فاضي لكل نداء،
//         وترجّع عدد مؤكَّد من الرد مش `fulfillments.length` (عدد المدخلات).
//       • createFulfillment — نفس الفحص على `fulfillment`، قبل ما ترجّع العدد.
//     الفشل الصامت المحتمل هنا هو نفس فئة عطل bosta-orders-returned-scanner
//     (userErrors:[] مع payload فاضي بيتحسب نجاح) — ماكانش وقع فعليًا لحد
//     دلوقتي على الحالات دي، بس العقد بيقول "تلات فحوصات دايمًا" من غير استثناء.
//   - 🐛 trailing-slash fix (`.replace(/\/$/,'')`) كان بيتطبق على الـ URL
//     الكامل بعد التجميع (بينتهي بـ `/access_token` أو `/graphql.json` — الشرطة
//     مش هتتلاقي هناك أبدًا، فالفحص كان no-op فعليًا). اتنقل لـ
//     `env.SHOP_DOMAIN.replace(/\/$/,'')` قبل التجميع — نفس مكانه في باقي أدوات الستاك.
//   - 🆕 verify_employee / log_logout: فشل writeLog بقى `logged:false` في الرد
//     بدل ما يسقط على الـ catch العام ويرجّع 500 لدخول/خروج تم فعليًا (الـ PIN
//     كان اتأكد قبل الكتابة). ⚠️ نفس النمط (writeLog من غير try/catch) موجود
//     في auth-endpoints.md نفسه — يستاهل مراجعة على مستوى الستاك، مش بس هنا.
//   - 🆕 get_logs بقت تقبل sortKey/sortDir (timestamp/employee/courier/status،
//     allow-list صريحة — html-builder data-table-standard.md § 8). عمود
//     `result` عمداً مش في القائمة: بيختلف من صف لصف جوه نفس الـ batch، وترتيبه
//     هيكسر تجميع الصفوف بالـ batchId اللي الواجهة مبنية عليه. الترتيب
//     server-side لازم لأن تاب السجل مقسّم صفحات (100/صفحة)، ترتيب client-side
//     كان هيرتّب صفحة واحدة بس. get_logs_count/get_logs_export زي ما هم.
//   - ⚠️ الواجهة v3.7.0 بتستهلك orderId الجديد في جدول تجميع المندوب (Step 3)
//     وبتبعت sortKey/sortDir لتاب السجل — لازم الملفين يترفعوا مع بعض.
//
// v3.6.0 — إصلاح Ready + تضييق قاعدة Cancelled (23-08-2026):
//   - 🐛 عطل Ready (كان بيفشّل كل أوردر عليه مندوب فعلي): applyDirect كانت
//     بتمسح المندوب بكتابة سلسلة فاضية `value: ''` جوه نفس نداء metafieldsSet.
//     شوبيفاي **بترفض** القيمة الفاضية وبترجّع
//     `userErrors: [{ message: "Value can't be blank" }]` — فـ setMetafields
//     بترمي. والأخطر إن metafieldsSet نداء واحد مجمّع، فرفض البند الواحد
//     بيرفض النداء كله: يعني حتى `manual_status = Ready` ما كانش بيتكتب
//     والأوردر بيفضل زي ما هو. لما custom.courier يبقى فاضي أصلاً كان الشرط
//     `&& order.courier` بيمنع إضافة البند فالتحديث بيعدّي عادي — ده بالظبط
//     سبب إن العطل كان بيظهر على الأوردرات اللي عليها مندوب بس.
//     الإصلاح: مسح ميتافيلد بيعدّي على `metafieldsDelete` (نداء منفصل بعد ما
//     setMetafields تنجح) — مش كتابة سلسلة فاضية.
//   - 🆕 المسح ده **مقاوم للفشل الجزئي**: لو الحالة اتكتبت وفشل مسح المندوب،
//     النتيجة بتبقى `warning` (مش `error`) لأن الفعل الأساسي تم فعلاً —
//     والتحذير بيقول بالنص إن المندوب لسه مسجّل على الأوردر.
//   - 🔒 ممنوع الانتقال من S1=Shipped إلى Cancelled. القاعدة دي بترجّع الأداة
//     لجدول الانتقالات المعتمد في ecommoda-order-lifecycle: بعد ما الأوردر
//     يبقى Fulfilled الحالة النهائية الصح هي `Returned` مش `Cancelled`.
//     اتغيّرت في TRANSITION_RULES.Cancelled و TRANSITION_SOURCES['S1:Cancelled'].
//   - ⚠️ الواجهة v3.6.0 بتنسخ نفس القاعدتين — لازم الملفين يترفعوا مع بعض.
//
// v3.3.0 — إصلاحات التدقيق (23-08-2026) — راجع order-status-updater-audit.md:
//   - 🐛 عطل A: disposeReturns كانت بترجّع الكمية الكاملة (totalQuantity) بدل
//     المتبقية وبترمي "Invalid disposition quantity" على أي مرتجع اتسترجع
//     جزء منه قبل كده (الـ RFO بيفضل OPEN حتى بعد الاسترجاع الكامل — الحارس
//     الحقيقي هو الكمية المتبقية مش الـ status، متحقَّق على #50469·#48383·
//     #49231·#48465·#50243). دلوقتي بتحسب rest = total - Σ(dispositions) لكل
//     بند، وتعتبر "مسترجَع بالكامل قبل كده" حالة طبيعية (تحذير مش خطأ).
//     fetchOrderStates بقت تجيب dispositions{id type quantity location{id}}.
//   - 🐛 عطل B (الأخطر): applyDirect كانت بترجّع actions في الآخر — لو رمت
//     استثناء في النص (زي فشل reverseDispose بعد ما orderCancel/setMetafields
//     نجحوا فعلاً — #50243) الإسناد ما بيحصلش والسجل بيقول "actions: []" رغم
//     إن أفعال حقيقية ولا رجعة فيها (إلغاء أوردر) اتنفذت. actions بقت بتتمرر
//     من بره كمصفوفة وبتتملي أول بأول.
//   - 🆕 عطل C: verifyCancels — تحقق مجمّع بعد الدفعة لكل orderCancel (بترجّع
//     job غير متزامن) عن طريق cancelledAt + دليل استرجاع مخزون من
//     refundLineItems. الأوردر اللي ما اتأكدش إلغاؤه بيتحول لحالة "warning".
//   - 🆕 النتيجة بقت 3 حالات مش 2: success | warning | error (extra.result).
//     الكتابة في D1 بقت مرحلة منفصلة بعد معالجة كل أوردرات الدفعة (بعد
//     verifyCancels)، مش جوه نفس لوب المعالجة — عشان النتيجة النهائية تتحسم
//     الأول.
//   - 🐛 عطل E: getAccessToken كانت بترجّع null بصمت، وshopifyGQL ما كانتش
//     بتفحص resp.ok ولا data.errors العليا (نفس عطل النجاح الكاذب اللي كلّف
//     bosta-orders-returned-scanner ٤ أيام). shopifyGQL بقت نسخة العقد
//     الإلزامي (worker-builder Step 5A) — بترمي على فشل شبكة/HTTP status/رد
//     مش JSON/أخطاء GraphQL عليا/data فاضية + إعادة محاولة على THROTTLED.
//   - 🆕 assertEnv + requireLocationId قبل أي كتابة — متغير ناقص بيوقف
//     العملية برسالة باسمه بدل فشل صامت (LOCATION_ID الناقص كان بيتحوّل لـ
//     gid://shopify/Location/undefined).
//   - 🆕 ?action=diag — فحص ذاتي بدون كتابة (متغيرات env بأطوالها، صلاحيات
//     تطبيق Logistics-App، هل LOCATION_ID بيتحل لموقع حقيقي، D1، Origin).
//   - 🐛 writeLog على مستوى الأوردر بقى بيرجّع logged:false بدل
//     .catch(()=>{}) الصامت.
//   - 🧹 ALLOWED_ORIGINS: شيل الدومين المهجور ecommoda24.github.io.
//   - 🆕 get_logs / get_logs_count / get_logs_export بقوا يقبلوا فلتر
//     `result` (success/warning/error، comma-separated) — عمود "النتيجة"
//     الجديد في فلاتر تاب السجل بالواجهة.
//   - ⚠️ متلمسش: resolveSpecifier · TRANSITION_RULES · isTransitionValid ·
//     شكل buildLogFilterSQL الحالي (غير إضافة فلتر result) — زي ما نص عليه
//     التقرير بالظبط.
//
// v3.2.0 — إصلاحات وتحسينات (16-08-2026):
//   - 🐛 إصلاح: فلتر "الحالة" في get_logs/get_logs_count/get_logs_export كان
//     بيقارن على extra.targetLabel بس — أي صف قديم مسجَّل بـ extra.specifier
//     فقط (من غير targetLabel) كان بيختفي من نتائج الفلتر لأي حالة غير اللي
//     اتسجّلت logs جديدة ليها بعد v3.1.0. دلوقتي buildLogFilterSQL() بيقارن
//     على targetLabel أو specifier (بعد شيل لاحقة _S2) مع بعض.
//   - 🆕 search_courier_orders بقت تدعم noCourier:true — بحث عن الأوردرات
//     اللي مفيش عليها أي مندوب مسجَّل خالص (custom.courier فاضي)، عن طريق
//     صيغة النفي -metafields.custom.courier:* بدل قيمة مندوب محددة.
//
// v3.1.0 — دعم فلاتر تاب السجل الجديدة في الـ HTML (16-08-2026):
//   - get_logs / get_logs_count / get_logs_export بقوا يقبلوا status/courier
//     (اختيار متعدد، comma-separated) + dateFrom/dateTo (تاريخ القاهرة
//     YYYY-MM-DD)، وemployee بقى برضو بيقبل قايمة comma-separated مش قيمة
//     واحدة بس. status/courier بيتفلتروا بـ json_extract على عمود extra
//     (targetLabel/courier) لأنهم مش أعمدة مستقلة في جدول logs.
//   - buildLogFilterSQL() دالة مشتركة جديدة بتبني الـ WHERE clause لتلات
//     الدوال مع بعض (getLogs/getLogsCount/getLogsExport) عشان يفضلوا متطابقين.
//
// v3.0.0 — إعادة تصميم كاملة لدورة التحديث:
//   - اتلغى اختيار S1/S2 اليدوي كخطوة منفصلة. الموظف بيختار "الحالة المستهدفة"
//     فقط (Ready/Shipped/Delivered/Cancelled/Returned) والـ Worker هو اللي بيقرر
//     لكل أوردر لوحده هل ده S1 ولا S2 (resolveSpecifier) اعتماداً على القيمة
//     الحالية لـ S2 — نفس القاعدة اللي كانت مطبّقة يدوياً قبل كده، بس بقت تلقائية
//     وبتتقيّم لكل أوردر على حدة، فممكن يتسكان أوردرات S1 وS2 مع بعض في نفس الدفعة.
//   - search_courier_orders بقت بتبحث في الاتنين (S1 و S2) مع بعض في نفس النداء
//     لما تكون الحالة المستهدفة عندها نظير S2 (Ready/Shipped/Returned)، وتدمج
//     النتائج (مفيش تكرار).
//   - order_statuses بترجّع الآن قيمة custom.courier الحالية لكل أوردر — ده اللي
//     بيسمح للواجهة تكتشف المندوب تلقائياً من الأوردرات المضافة بدل ما يتختار يدوي.
//   - applyDirect: أي انتقال لحالة Ready (S1 أو S2) بيمسح أي مندوب مسجّل مسبقاً على
//     الأوردر (لو موجود) — الأوردر ده هيخرج تاني يوم غالباً مع مندوب مختلف.
//
// Writes metafields directly (Shopify Flow / Flow Companion is no longer used).
//
// SECRETS  (Dashboard → Settings → Variables, encrypted):
//   WORKER_SECRET · CLIENT_ID · CLIENT_SECRET
// PLAIN VARS (must be added MANUALLY in Dashboard — [vars] are ignored on upload):
//   SHOP_DOMAIN = 6c7e1a-53.myshopify.com
//   LOCATION_ID = 98849620290
// ═══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
// §CONSTANTS
// ══════════════════════════════════════════════════════════════════════════

const TOOL_NAME   = 'order_status';
const API_VERSION = '2026-01';
const VERSION     = '4.3.0';

// Cairo = UTC+3 (DST active since late April 2026).
// ⚠️ Egypt DST ends 29-10-2026 → change to 2. Treat as a stack-wide change.
const CAIRO_OFFSET_HOURS = 3;

// §CONSTANTS::metafields
const MF = {
  S1:      { namespace: 'custom', key: 'manual_status', type: 'single_line_text_field' },
  S2:      { namespace: 'custom', key: 'status_2_r_e',  type: 'single_line_text_field' },
  COURIER: { namespace: 'custom', key: 'courier',       type: 'single_line_text_field' },
  PICKUP:  { namespace: 'custom', key: 'pickup_date',   type: 'date' },
  // v4.0.0 — سبب الإلغاء/الإرجاع، إلزامي في الواجهة لحالتي Cancelled/Returned فقط
  CANCEL_REASON: { namespace: 'custom', key: 'cancel_manual_reason', type: 'single_line_text_field' },
  RETURN_REASON: { namespace: 'custom', key: 'return_manual_reason', type: 'single_line_text_field' },
};

// §CONSTANTS::status — verbatim strings, casing is load-bearing
const S1_STATUS = {
  NEW_ORDER:      'New Order',
  CONFIRMED:      'Confirmed',
  WA_CONFIRMED:   'WhatsApp-Confirmed',
  WA_CANCELLED:   'WhatsApp-CANCELLED',
  CONFIRMED_EDIT: 'Confirmed + Edit',
  PENDING_EDIT:   'Pending Edit',
  READY:          'Ready',
  SHIPPED:        'Shipped',
  IN_RETURN:      'In-Return',
  DELIVERED:      'Delivered',
  RETURNED:       'Returned',
  CANCELLED:      'Cancelled',
};

const S2_STATUS = {
  CONFIRMED_RETURN:   'Confirmed + RETURN',
  CONFIRMED_EXCHANGE: 'Confirmed + EXCHANGE',
  READY:              'Ready',
  SHIPPED:            'Shipped',
  IN_RETURN:          'In-Return',
  RETURNED:           'Returned',
};

// §CONSTANTS::specifiers
// The 8 actual write-paths the tool can perform. `label` is the value stored
// in the metafield — never the raw specifier (Ready_S2 stores "Ready", not
// "Ready_S2"). These are internal — the frontend never sends a specifier
// directly anymore, only a targetLabel (see §CONSTANTS::targetLabels below).
const SPECIFIERS = {
  Ready:       { field: 'S1', label: S1_STATUS.READY,     needsCourier: false },
  Shipped:     { field: 'S1', label: S1_STATUS.SHIPPED,   needsCourier: true  },
  Delivered:   { field: 'S1', label: S1_STATUS.DELIVERED, needsCourier: true  },
  Returned:    { field: 'S1', label: S1_STATUS.RETURNED,  needsCourier: true  },
  Cancelled:   { field: 'S1', label: S1_STATUS.CANCELLED, needsCourier: false },
  Ready_S2:    { field: 'S2', label: S2_STATUS.READY,     needsCourier: false },
  Shipped_S2:  { field: 'S2', label: S2_STATUS.SHIPPED,   needsCourier: true  },
  Returned_S2: { field: 'S2', label: S2_STATUS.RETURNED,  needsCourier: true  },
};

// §CONSTANTS::targetLabels
// The 5 buttons the employee actually sees. `hasS2` marks the 3 labels that
// have an S2 sibling (Ready/Shipped/Returned) — for those, resolveSpecifier()
// decides S1 vs S2 per order automatically. Delivered/Cancelled have no S2
// sibling and always resolve to their S1 specifier.
const TARGET_LABELS = {
  Ready:     { icon: '📦', needsCourier: false, hasS2: true  },
  Shipped:   { icon: '🚚', needsCourier: true,  hasS2: true  },
  Delivered: { icon: '✅', needsCourier: true,  hasS2: false },
  Returned:  { icon: '↩️', needsCourier: true,  hasS2: true  },
  Cancelled: { icon: '❌', needsCourier: false, hasS2: false },
};

// §CONSTANTS::transitions
// Source states an order may currently be in to legally reach each specifier.
// `s2Blank: true` → S2 must be empty. This is the authoritative copy — the
// frontend runs the same rules for instant feedback only.
const TRANSITION_RULES = {
  Ready: {
    s1From: [S1_STATUS.CONFIRMED, S1_STATUS.CONFIRMED_EDIT, S1_STATUS.SHIPPED],
    s2Blank: true,
  },
  Shipped: {
    s1From: [S1_STATUS.READY],
    s2Blank: true,
  },
  Delivered: {
    s1From: [S1_STATUS.SHIPPED],
    s2In: ['', S2_STATUS.CONFIRMED_RETURN, S2_STATUS.CONFIRMED_EXCHANGE, S2_STATUS.READY],
  },
  // v3.6.0 🔒 — Shipped اتشالت من مصادر Cancelled. بعد ما الأوردر يبقى
  // Fulfilled (أي بعد Shipped) الحالة النهائية الصح هي Returned مش Cancelled —
  // نافذتا الإلغاء الوحيدتان هما بعد New Order وبعد Ready قبل الخروج فعلاً
  // (ecommoda-order-lifecycle §1.2). الأداة كانت بتسمح بـ Shipped → Cancelled
  // بالمخالفة لجدول الانتقالات المعتمد.
  Cancelled: {
    s1From: [S1_STATUS.READY],
    s2Blank: true,
  },
  Returned: {
    s1From: [S1_STATUS.SHIPPED],
    s2Blank: true,
  },
  Ready_S2: {
    s1From: [S1_STATUS.SHIPPED, S1_STATUS.DELIVERED],
    s2In:   [S2_STATUS.CONFIRMED_RETURN, S2_STATUS.CONFIRMED_EXCHANGE, S2_STATUS.SHIPPED],
  },
  Shipped_S2: {
    s1From: [S1_STATUS.DELIVERED],
    s2In:   [S2_STATUS.READY],
  },
  Returned_S2: {
    s1From: [S1_STATUS.DELIVERED],
    s2In:   [S2_STATUS.SHIPPED],
  },
};

// §CONSTANTS::searchSources
// Used by search_courier_orders — queries orders by their CURRENT state.
// "blank S2" cannot be queried server-side (Shopify has no blank-metafield
// search); the frontend catches those and flags the row invalid.
const TRANSITION_SOURCES = {
  'S1:Ready':     { s1Sources: [S1_STATUS.CONFIRMED, S1_STATUS.CONFIRMED_EDIT, S1_STATUS.SHIPPED] },
  'S1:Shipped':   { s1Sources: [S1_STATUS.READY] },
  'S1:Delivered': { s1Sources: [S1_STATUS.SHIPPED] },
  'S1:Cancelled': { s1Sources: [S1_STATUS.READY] },   // v3.6.0 🔒 — Shipped اتشالت
  'S1:Returned':  { s1Sources: [S1_STATUS.SHIPPED] },
  'S2:Ready':     { s1Constraint: [S1_STATUS.SHIPPED, S1_STATUS.DELIVERED],
                    s2Sources: [S2_STATUS.CONFIRMED_RETURN, S2_STATUS.CONFIRMED_EXCHANGE, S2_STATUS.SHIPPED] },
  'S2:Shipped':   { s1Constraint: [S1_STATUS.DELIVERED], s2Sources: [S2_STATUS.READY] },
  'S2:Returned':  { s1Constraint: [S1_STATUS.DELIVERED], s2Sources: [S2_STATUS.SHIPPED] },
};

const SEARCH_MAX_PAGES = 10;   // 10 × 100 = 1000 orders ceiling، لكل استعلام فرعي (S1 أو S2)


// ══════════════════════════════════════════════════════════════════════════
// §CORS — Option B (strict allow-list) — أداة كتابة/مالية
// ══════════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = [
  'https://ecommoda-dev.github.io',
];

function getCORS(request) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}


// ══════════════════════════════════════════════════════════════════════════
// §HELPERS
// ══════════════════════════════════════════════════════════════════════════

function json(data, status = 200, request = null) {
  const headers = { 'Content-Type': 'application/json' };
  Object.assign(headers, request ? getCORS(request) : { 'Access-Control-Allow-Origin': '*' });
  return new Response(JSON.stringify(data), { status, headers });
}

// ─── §HELPERS::assertEnv — v3.3.0 (عطل F) ───
// متغير ناقص لازم يوقف العملية برسالة باسمه. LOCATION_ID الناقص مثلاً كان
// بيتحوّل بصمت لـ "gid://shopify/Location/undefined" ويفشل جوه الميوتيشن.
const ENV_REQUIRED = {
  shopify: ['SHOP_DOMAIN', 'CLIENT_ID', 'CLIENT_SECRET'],
  stock:   ['LOCATION_ID'],
};

function assertEnv(env, ...groups) {
  const missing = [];
  for (const g of groups) {
    for (const key of (ENV_REQUIRED[g] || [])) {
      if (env[key] === undefined || env[key] === null || String(env[key]).trim() === '') missing.push(key);
    }
  }
  if (!env.DB) missing.push('DB (D1 binding)');
  if (missing.length) {
    throw new Error(
      `متغيرات ناقصة في الـ Worker: ${missing.join('، ')} — ضِفها من ` +
      `Dashboard → Settings → Variables ثم Promote النسخة. (شغّل ?action=diag)`
    );
  }
}

// ─── §HELPERS::requireLocationId ───
function requireLocationId(env) {
  if (env.LOCATION_ID === undefined || env.LOCATION_ID === null || String(env.LOCATION_ID).trim() === '') {
    throw new Error('LOCATION_ID ناقص من متغيرات الـ Worker — أضِفه ثم Promote النسخة. (شغّل ?action=diag)');
  }
}

// §HELPERS::toCairo — display timestamp, UTC+3
function toCairo(iso) {
  const d = new Date(new Date(iso).getTime() + CAIRO_OFFSET_HOURS * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ` +
         `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// §HELPERS::cairoDate — YYYY-MM-DD in Cairo, for the pickup_date metafield
function cairoDate() {
  const d = new Date(Date.now() + CAIRO_OFFSET_HOURS * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

const gid       = id => `gid://shopify/Order/${id}`;
const numericId = g  => String(g || '').replace('gid://shopify/Order/', '');


// ══════════════════════════════════════════════════════════════════════════
// §SHARED — copy verbatim — never modify
// ⚠️ EXCEPTION (16-08-2026): getLogs / getLogsCount / getLogsExport في الأداة
// دي بالذات اتعدّلوا عن قصد لدعم فلاتر الحالة/المندوب/فترة التاريخ في تاب
// السجل (طلب صريح من صاحب الأداة). لو الفلاتر دي هتتعمم على أدوات تانية في
// المستقبل، حدّث الـ shared template المركزي بنفس المنطق بدل ما تتكرر يدوي.
// ══════════════════════════════════════════════════════════════════════════

async function verifyEmployee(db, username, pin) {
  const row = await db.prepare(
    'SELECT display_name, is_active FROM employees WHERE username = ? AND pin = ?'
  ).bind(username, pin).first();

  if (!row) return null;

  if (!row.is_active) {
    throw new Error('الحساب موقوف — تواصل مع المسؤول');
  }

  db.prepare('UPDATE employees SET last_login = ? WHERE username = ?')
    .bind(new Date().toISOString(), username)
    .run()
    .catch(() => {});

  return row.display_name;
}

async function checkEmployee(db, username) {
  const row = await db.prepare(
    'SELECT is_active, pin FROM employees WHERE username = ?'
  ).bind(username).first();

  if (!row) return { exists: false, hasPin: false, isActive: false };
  return {
    exists:   true,
    hasPin:   !!row.pin,
    isActive: !!row.is_active,
  };
}

async function registerPin(db, username, pin) {
  const row = await db.prepare(
    'SELECT pin, is_active FROM employees WHERE username = ?'
  ).bind(username).first();

  if (!row)           throw new Error('اسم المستخدم غير موجود');
  if (!row.is_active) throw new Error('الحساب موقوف — تواصل مع المسؤول');
  if (row.pin)        throw new Error('هذا المستخدم مسجّل بالفعل — تواصل مع المسؤول لإعادة الضبط');

  await db.prepare('UPDATE employees SET pin = ? WHERE username = ?')
    .bind(pin, username)
    .run();

  return true;
}

async function writeLog(db, entry) {
  await db.prepare(`
    INSERT INTO logs
      (timestamp, tool, type, employee, order_id, order_name,
       sku, product_title, delta, value_before, value_after, notes, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    entry.timestamp    ?? new Date().toISOString(),
    entry.tool,
    entry.type,
    entry.employee     ?? null,
    entry.orderId      ?? null,
    entry.orderName    ?? null,
    entry.sku          ?? null,
    entry.productTitle ?? null,
    entry.delta        ?? null,
    entry.valueBefore  ?? null,
    entry.valueAfter   ?? null,
    entry.notes        ?? null,
    entry.extra ? JSON.stringify(entry.extra) : null
  ).run();
}

// ─── §SHARED::logFilters — shared WHERE-clause builder ───
// Powers getLogs / getLogsCount / getLogsExport together so the three stay
// in lock-step. employee/status/courier all accept either a single string or
// an array (comma-separated strings from the HTML are split here) → SQL IN().
// status/courier live inside the `extra` JSON blob (per-order write result),
// not as their own columns, hence json_extract. dateFrom/dateTo are Cairo
// calendar dates (YYYY-MM-DD) — converted to UTC timestamp bounds before
// comparing against the UTC `timestamp` column.
function parseListParam(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

// Cairo calendar day (YYYY-MM-DD) → UTC ISO bounds for that day
function cairoDayBoundsUTC(dateStr) {
  const startUTCms = new Date(`${dateStr}T00:00:00.000Z`).getTime() - CAIRO_OFFSET_HOURS * 3600 * 1000;
  const endUTCms   = new Date(`${dateStr}T23:59:59.999Z`).getTime() - CAIRO_OFFSET_HOURS * 3600 * 1000;
  return { start: new Date(startUTCms).toISOString(), end: new Date(endUTCms).toISOString() };
}

// §SHARED::logFilters::status — بند 6 (v3.2.0، 16-08-2026): fallback لسجلات
// قديمة كانت بتخزّن extra.specifier (مثلاً "Ready_S2") من غير extra.targetLabel
// ("Ready"). قبل الإصلاح ده الفلتر كان بيقارن على targetLabel بس، فأي صف قديم
// من غير الحقل ده كان بيختفي من نتائج الفلتر لكل الحالات ما عدا الحالات اللي
// اتسجلت logs جديدة ليها بعد v3.1.0 (زي Shipped وقت الاختبار) — رغم إنه كان
// ظاهر عادي في التاب لأن renderLog() في الـ HTML عندها نفس الـ fallback من
// الأساس للعرض بس، مش للفلترة. دلوقتي الفلتر بيقارن على الاتنين مع بعض.
// §SHARED::logFilters::result — v3.3.0 (طلب صريح: فلتر عمود "النتيجة" في
// تاب السجل). extra.result بيتكتب على كل صف منذ الأساس (success/error، ودلوقتي
// كمان warning) — فلا حاجة لأي fallback زي فلتر الحالة، القيمة موجودة دايمًا.
function buildLogFilterSQL({ tool = null, employee = null, status = null, courier = null, result = null, search = null, dateFrom = null, dateTo = null } = {}) {
  let sql = "FROM logs WHERE type NOT IN ('login','logout')";
  const b = [];

  if (tool) { sql += ' AND tool = ?'; b.push(tool); }

  const employees = parseListParam(employee);
  if (employees.length) {
    sql += ` AND employee IN (${employees.map(() => '?').join(',')})`;
    b.push(...employees);
  }

  const statuses = parseListParam(status);
  if (statuses.length) {
    const ph = statuses.map(() => '?').join(',');
    sql += ` AND (
      json_extract(extra, '$.targetLabel') IN (${ph})
      OR REPLACE(json_extract(extra, '$.specifier'), '_S2', '') IN (${ph})
    )`;
    b.push(...statuses, ...statuses);
  }

  const couriers = parseListParam(courier);
  if (couriers.length) {
    sql += ` AND json_extract(extra, '$.courier') IN (${couriers.map(() => '?').join(',')})`;
    b.push(...couriers);
  }

  const results = parseListParam(result);
  if (results.length) {
    sql += ` AND json_extract(extra, '$.result') IN (${results.map(() => '?').join(',')})`;
    b.push(...results);
  }

  if (search) {
    sql += ' AND (order_name LIKE ? OR notes LIKE ?)';
    b.push(`%${search}%`, `%${search}%`);
  }

  if (dateFrom) {
    const { start } = cairoDayBoundsUTC(dateFrom);
    sql += ' AND timestamp >= ?';
    b.push(start);
  }
  if (dateTo) {
    const { end } = cairoDayBoundsUTC(dateTo);
    sql += ' AND timestamp <= ?';
    b.push(end);
  }

  return { sql, binds: b };
}

// ─── §SHARED::logSort — v3.7.0 (data-table-standard.md § 8) ───
// الجدول ده server-paginated (100/صفحة) — الترتيب لازم يكون server-side وإلا
// بيرتّب صفحة واحدة بس والباقي يفضل زي ما هو. allow-list صريحة عشان مفيش
// إدخال خام لاسم عمود جوه ORDER BY (SQL injection surface).
// ⚠️ `result` عمداً مش مضاف هنا: النتيجة (success/warning/error) بتتفرّق
// *جوّه* الدفعة الواحدة (لكل أوردر نتيجته)، فترتيب بيها كان هيفرّق صفوف نفس
// الـ batchId عن بعض ويكسر تجميع renderLog() في الواجهة (اللي بيعتمد على إن
// صفوف نفس batchId متجاورة في النتيجة). timestamp/employee/courier/status
// كلهم ثابتين على مستوى الدفعة كلها — ترتيب بيهم آمن.
const LOG_SORT_COLUMNS = {
  timestamp: 'timestamp',
  employee:  'employee',
  courier:   "json_extract(extra, '$.courier')",
  status:    "COALESCE(NULLIF(json_extract(extra, '$.targetLabel'), ''), REPLACE(json_extract(extra, '$.specifier'), '_S2', ''))",
};

function buildLogSortSQL(sortKey, sortDir) {
  const col = LOG_SORT_COLUMNS[sortKey] || LOG_SORT_COLUMNS.timestamp;
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  // ترتيب ثانوي بالتاريخ دايمًا — عشان صفوف متساوية القيمة (زي كل النتايج success)
  // يفضل ترتيبها ثابت بدل ما يتلخبط بين الصفحات.
  return sortKey && LOG_SORT_COLUMNS[sortKey]
    ? `ORDER BY ${col} ${dir}, timestamp DESC`
    : `ORDER BY timestamp DESC`;
}

async function getLogs(db, {
  tool     = null,
  employee = null,
  status   = null,
  courier  = null,
  result   = null,
  type     = null,
  search   = null,
  dateFrom = null,
  dateTo   = null,
  sortKey  = null,
  sortDir  = null,
  limit    = 100,
  offset   = 0,
} = {}) {
  const { sql: whereSql, binds } = buildLogFilterSQL({ tool, employee, status, courier, result, search, dateFrom, dateTo });
  let sql = `SELECT * ${whereSql}`;
  const b = binds.slice();
  if (type) { sql += ' AND type = ?'; b.push(type); }
  sql += ` ${buildLogSortSQL(sortKey, sortDir)} LIMIT ? OFFSET ?`;
  b.push(Math.min(limit, 100), offset);

  return (await db.prepare(sql).bind(...b).all()).results;
}

async function getLogsCount(db, {
  tool     = null,
  employee = null,
  status   = null,
  courier  = null,
  result   = null,
  search   = null,
  dateFrom = null,
  dateTo   = null,
} = {}) {
  const { sql: whereSql, binds } = buildLogFilterSQL({ tool, employee, status, courier, result, search, dateFrom, dateTo });
  const sql = `SELECT COUNT(*) as total ${whereSql}`;

  const row = await db.prepare(sql).bind(...binds).first();
  return row?.total ?? 0;
}

async function getLogsExport(db, {
  tool     = null,
  employee = null,
  status   = null,
  courier  = null,
  result   = null,
  search   = null,
  dateFrom = null,
  dateTo   = null,
} = {}) {
  const { sql: whereSql, binds } = buildLogFilterSQL({ tool, employee, status, courier, result, search, dateFrom, dateTo });
  const sql = `SELECT * ${whereSql} ORDER BY timestamp DESC LIMIT 2000`;

  return (await db.prepare(sql).bind(...binds).all()).results;
}

// ══════════════════════════════════════════════════════════════════════════
// END SHARED BLOCK
// ══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
// §SHOPIFY
// ══════════════════════════════════════════════════════════════════════════

// ─── §SHOPIFY::getAccessToken — v3.3.0 (عطل E) ───
// كانت بترجّع null بصمت لو فشل — أي endpoint مش بيفحص التوكن كان بيكمّل
// بتوكن null → 401 من شوبيفاي → قايمة فاضية من غير أي رسالة خطأ (عطل E).
// دلوقتي بترمي دايمًا بدل ما ترجّع null.
async function getAccessToken(env) {
  let resp;
  try {
    resp = await fetch(`https://${env.SHOP_DOMAIN.replace(/\/$/, '')}/admin/oauth/access_token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
      }),
    });
  } catch (e) {
    throw new Error(`OAuth: فشل الاتصال بشوبيفاي — ${e.message}`);
  }
  if (!resp.ok) throw new Error(`OAuth failed: HTTP ${resp.status}`);
  const data = await resp.json().catch(() => null);
  if (!data?.access_token) throw new Error('OAuth: مفيش access_token في الرد — تحقق من CLIENT_ID/CLIENT_SECRET/SHOP_DOMAIN');
  return data.access_token;
}

// ─── §SHOPIFY::shopifyGQL — العقد الإلزامي v3.3.0 (عطل E)، انسخها كما هي ───
// أي فشل بيترمي. مفيش رد بيعدّي وهو فاشل:
//   ① فشل شبكة  ② HTTP status  ③ رد مش JSON  ④ data.errors  ⑤ data فاضية
// ⚠️ ④ هو الخطير: لما ميوتيشن تترفض على مستوى الحقل (صلاحية ناقصة مثلاً)
// شوبيفاي بترد {"errors":[…],"data":null} — والـ userErrors بتبقى [] لأن مفيش
// payload أصلاً. كود بيفحص userErrors بس بيقرا ده **نجاح**. (نفس عطل
// bosta-orders-returned-scanner اللي كلّف ٤ أيام استرجاع مخزون وهمي.)
async function shopifyGQL(env, token, query, variables = {}, opName = 'shopify') {
  const MAX_ATTEMPTS = 3;
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let resp, text;
    try {
      resp = await fetch(
        `https://${env.SHOP_DOMAIN.replace(/\/$/, '')}/admin/api/${API_VERSION}/graphql.json`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
          body:    JSON.stringify(variables ? { query, variables } : { query }),
        }
      );
      text = await resp.text();
    } catch (e) {
      lastErr = new Error(`${opName}: فشل الاتصال بشوبيفاي — ${e.message}`);
      if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 400 * attempt)); continue; }
      throw lastErr;
    }

    if (!resp.ok) {
      const retriable = resp.status === 429 || resp.status >= 500;
      lastErr = new Error(`${opName}: شوبيفاي ردّت HTTP ${resp.status} — ${text.slice(0, 180)}`);
      if (retriable && attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 700 * attempt)); continue; }
      throw lastErr;
    }

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`${opName}: رد شوبيفاي مش JSON صالح — ${text.slice(0, 180)}`); }

    if (Array.isArray(data.errors) && data.errors.length) {
      const codes = data.errors.map(e => e?.extensions?.code).filter(Boolean);
      lastErr = new Error(
        `${opName}: ${data.errors.map(e => e.message).join(' | ')}` +
        (codes.length ? ` [${codes.join(',')}]` : '')
      );
      if (codes.includes('THROTTLED') && attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1200 * attempt)); continue;
      }
      throw lastErr;
    }

    if (!data.data) throw new Error(`${opName}: رد شوبيفاي بدون data — ${text.slice(0, 180)}`);
    return data;
  }
  throw lastErr || new Error(`${opName}: فشل غير معروف`);
}

// ─── §SHOPIFY::resolveOrderNames ───
async function resolveOrderNames(env, token, orderIds) {
  const gids = orderIds.map(gid);
  const data = await shopifyGQL(env, token, `
    { nodes(ids: ${JSON.stringify(gids)}) { ... on Order { id name } } }
  `, {}, 'resolveOrderNames');
  const map = {};
  for (const n of (data?.data?.nodes || [])) {
    if (n?.id && n?.name) map[numericId(n.id)] = n.name;
  }
  return map;
}

// ─── §SHOPIFY::resolveOrderByName ───
async function resolveOrderByName(env, token, orderName) {
  const normalized = orderName.startsWith('#') ? orderName : `#${orderName}`;
  const data = await shopifyGQL(env, token, `
    { orders(first: 1, query: "name:${normalized}") { edges { node { id name } } } }
  `, {}, 'resolveOrderByName');
  const node = data?.data?.orders?.edges?.[0]?.node;
  if (!node) return null;
  return { orderId: numericId(node.id), orderName: node.name };
}

// ─── §SHOPIFY::fetchOrderStates ───
// One bulk call. `withReturns` adds the reverse-fulfillment block (expensive,
// ~108 request points/order) — requested whenever the batch's targetLabel is
// "Returned" (we don't yet know per-order whether it'll resolve to S1 or S2,
// so the block is fetched defensively for the whole batch; harmless if unused).
async function fetchOrderStates(env, token, orderIds, withReturns = false) {
  // dispositions{quantity} أُضيفت v3.3.0 (عطل A) — لازمة عشان disposeReturns
  // تحسب الكمية المتبقية الفعلية بدل ما تفترض إن totalQuantity كله لسه محتاج
  // استرجاع (الـ RFO بيفضل OPEN حتى بعد الاسترجاع الكامل).
  const returnsBlock = withReturns ? `
      returns(first: 10) {
        nodes {
          id
          status
          reverseFulfillmentOrders(first: 10) {
            nodes {
              id
              status
              lineItems(first: 50) {
                nodes {
                  id
                  totalQuantity
                  dispositions { id type quantity location { id } }
                }
              }
            }
          }
        }
      }` : '';

  const data = await shopifyGQL(env, token, `
    { nodes(ids: ${JSON.stringify(orderIds.map(gid))}) {
        ... on Order {
          id
          name
          cancelledAt
          displayFulfillmentStatus
          fulfillments(first: 20) { id status }
          fulfillmentOrders(first: 20) { nodes { id status } }
          s1:      metafield(namespace: "custom", key: "manual_status") { value }
          s2:      metafield(namespace: "custom", key: "status_2_r_e")  { value }
          courier: metafield(namespace: "custom", key: "courier")       { value }
          cancelReason: metafield(namespace: "custom", key: "cancel_manual_reason") { value }
          returnReason: metafield(namespace: "custom", key: "return_manual_reason") { value }
          ${returnsBlock}
        }
      } }
  `, {}, 'fetchOrderStates');

  const out = {};
  for (const n of (data?.data?.nodes || [])) {
    if (!n?.id) continue;
    out[numericId(n.id)] = {
      id:          numericId(n.id),
      gid:         n.id,
      name:        n.name,
      isCancelled: !!n.cancelledAt,
      fulfillmentStatus: n.displayFulfillmentStatus,
      s1:          n.s1?.value || null,
      s2:          n.s2?.value || null,
      courier:     n.courier?.value || null,
      // v4.3.0 — الأسباب المسجّلة أصلاً على الأوردر (غالبًا خدمة العملاء كتبتها
      // قبل ما الأوردر يوصل لموظف العمليات). `.trim()` مقصود: ميتافيلد فيه
      // مسافات بس مايتحسبش سبب موجود.
      cancelReason: (n.cancelReason?.value || '').trim() || null,
      returnReason: (n.returnReason?.value || '').trim() || null,
      fulfillments:      (n.fulfillments || []).filter(f => f.status !== 'CANCELLED'),
      fulfillmentOrders: (n.fulfillmentOrders?.nodes || []),
      returns:           (n.returns?.nodes || []),
    };
  }
  return out;
}

// ─── §SHOPIFY::setMetafields ───
async function setMetafields(env, token, entries) {
  const data = await shopifyGQL(env, token, `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key value }
        userErrors { field message }
      }
    }
  `, { metafields: entries }, 'metafieldsSet');

  const result = data?.data?.metafieldsSet;
  const errs   = result?.userErrors || [];
  if (errs.length) throw new Error('metafieldsSet: ' + errs.map(e => e.message).join(' | '));
  // §HELPERS::confirm-payload (Step 5A ③) — userErrors:[] يعني "مفيش اعتراض"،
  // مش "اتكتبت فعلاً". اتأكد إن شوبيفاي رجّعت نفس عدد الحقول اللي طلبناها.
  if ((result?.metafields || []).length !== entries.length) {
    throw new Error(`metafieldsSet: شوبيفاي أكدت ${result?.metafields?.length || 0} حقل من ${entries.length} — الكتابة غير مكتملة`);
  }
  return true;
}

// ─── §SHOPIFY::deleteMetafields — v3.6.0 (عطل Ready) ───
// مسح ميتافيلد **بيعدّي على metafieldsDelete**، مش على metafieldsSet بقيمة
// فاضية. شوبيفاي بترفض `value: ''` بـ "Value can't be blank"، ولأن
// metafieldsSet نداء واحد مجمّع فالرفض بيسقّط كل البنود اللي معاه في نفس
// النداء — بما فيهم كتابة الحالة نفسها. ده كان سبب فشل كل أوردر عليه مندوب
// فعلي وقت الانتقال لـ Ready قبل v3.6.0.
// identifiers: [{ ownerId, namespace, key }]
// بترجّع عدد الحقول اللي شوبيفاي **أكدت** مسحها (Step 5A ③ — العدّ من الرد مش
// من عدد المدخلات). بترمي على أي userErrors.
async function deleteMetafields(env, token, identifiers) {
  if (!identifiers.length) return 0;

  const data = await shopifyGQL(env, token, `
    mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $metafields) {
        deletedMetafields { key namespace ownerId }
        userErrors { field message }
      }
    }
  `, { metafields: identifiers }, 'metafieldsDelete');

  const result = data?.data?.metafieldsDelete;
  const errs   = result?.userErrors || [];
  if (errs.length) throw new Error('metafieldsDelete: ' + errs.map(e => e.message).join(' | '));

  // ⚠️ مش خطأ لو رجّعت أقل: الحقل ممكن يكون اتمسح قبل كده أو مش موجود أصلاً.
  // المُنادي هو اللي بيقرر هل النقص ده يستاهل تحذير ولا لأ.
  return (result?.deletedMetafields || []).filter(Boolean).length;
}

// ─── §SHOPIFY::cancelOrder ───
// ⚠️ IRREVERSIBLE — no mutation undoes an order cancellation.
async function cancelOrder(env, token, orderGid) {
  const data = await shopifyGQL(env, token, `
    mutation OrderCancel($orderId: ID!, $reason: OrderCancelReason!,
                         $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
      orderCancel(orderId: $orderId, reason: $reason, refund: $refund,
                  restock: $restock, notifyCustomer: $notifyCustomer) {
        job { id }
        orderCancelUserErrors { field message code }
      }
    }
  `, {
    orderId: orderGid,
    reason: 'CUSTOMER',
    refund: false,
    restock: true,
    notifyCustomer: false,
  }, 'orderCancel');

  const errs = data?.data?.orderCancel?.orderCancelUserErrors || [];
  if (errs.length) throw new Error('orderCancel: ' + errs.map(e => e.message).join(' | '));
  // §HELPERS::confirm-payload (Step 5A ③) — userErrors:[] مش دليل. لازم job.id
  // يكون موجود فعلاً، وإلا orderCancel اتقبلت شكلياً بس مفيش job اتفتح خالص.
  if (!data?.data?.orderCancel?.job?.id) {
    throw new Error('orderCancel: شوبيفاي ما رجّعتش job — الإلغاء لم يبدأ فعليًا');
  }
  return true;
}

// ─── §SHOPIFY::cancelFulfillments ───
// Returns the order to Unfulfilled — used when a courier brings it back
// to the warehouse before delivery (re-scheduled attempt).
// v3.7.0 (Step 5A ③) — العدّ من رد شوبيفاي (fulfillment غير null) مش من عدد
// المدخلات؛ userErrors:[] مع fulfillment:null كان بيتحسب نجاح قبل كده.
async function cancelFulfillments(env, token, fulfillments) {
  let confirmed = 0;
  for (const f of fulfillments) {
    const data = await shopifyGQL(env, token, `
      mutation FulfillmentCancel($id: ID!) {
        fulfillmentCancel(id: $id) {
          fulfillment { id status }
          userErrors { field message }
        }
      }
    `, { id: f.id }, 'fulfillmentCancel');
    const errs = data?.data?.fulfillmentCancel?.userErrors || [];
    if (errs.length) throw new Error('fulfillmentCancel: ' + errs.map(e => e.message).join(' | '));
    if (!data?.data?.fulfillmentCancel?.fulfillment) {
      throw new Error('fulfillmentCancel: شوبيفاي ما أكدتش الإلغاء — fulfillment فاضي في الرد');
    }
    confirmed++;
  }
  return confirmed;
}

// ─── §SHOPIFY::createFulfillment ───
// ONE call covering every OPEN fulfillment order. fulfillmentCreate (not the
// deprecated fulfillmentCreateV2).
// v3.7.0 (Step 5A ③) — بترجّع 0 لو الرد ما فيهوش fulfillment مؤكَّد، مش عدد
// الـ fulfillment orders اللي طلبناها.
async function createFulfillment(env, token, openFulfillmentOrders) {
  if (!openFulfillmentOrders.length) return 0;

  const data = await shopifyGQL(env, token, `
    mutation FulfillmentCreate($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id status }
        userErrors { field message }
      }
    }
  `, {
    fulfillment: {
      notifyCustomer: false,
      lineItemsByFulfillmentOrder: openFulfillmentOrders.map(fo => ({ fulfillmentOrderId: fo.id })),
    },
  }, 'fulfillmentCreate');

  const errs = data?.data?.fulfillmentCreate?.userErrors || [];
  if (errs.length) throw new Error('fulfillmentCreate: ' + errs.map(e => e.message).join(' | '));
  if (!data?.data?.fulfillmentCreate?.fulfillment) {
    throw new Error('fulfillmentCreate: شوبيفاي ما أكدتش التنفيذ — fulfillment فاضي في الرد');
  }
  return openFulfillmentOrders.length;
}

// ─── §SHOPIFY::disposeReturns — v3.3.0 (عطل A + D) ───
// Restocks every returned piece back to the primary location.
// ⚠️ الـ reverseFulfillmentOrder بيفضل status: OPEN حتى بعد ما القطع ترجع
// للمخزن بالكامل (متحقَّق فعليًا على #50469·#48383·#49231·#48465·#50243) —
// يعني `status !== 'OPEN'` مش كافي كحارس. الحارس الحقيقي هو الكمية المتبقية:
// rest = totalQuantity - Σ(dispositions.quantity) لكل بند. "مسترجَع بالكامل
// قبل كده" (rest <= 0) حالة طبيعية بتترجع كـ warning، مش استثناء.
// العدّ (confirmed) من رد شوبيفاي (reverseFulfillmentOrderLineItems) مش من
// عدد المدخلات (عطل D) — لو شوبيفاي أكدت بنود أقل من المطلوب، ده خطأ.
async function disposeReturns(env, token, locationId, returns) {
  const locGid = `gid://shopify/Location/${locationId}`;
  const stats = { requested: 0, confirmed: 0, alreadyDone: 0, skippedNotOpen: 0, calls: 0 };
  const warnings = [];

  for (const ret of (returns || [])) {
    for (const rfo of (ret.reverseFulfillmentOrders?.nodes || [])) {
      if (rfo.status !== 'OPEN') { stats.skippedNotOpen++; continue; }

      const inputs = [];
      for (const li of (rfo.lineItems?.nodes || [])) {
        const total = li.totalQuantity || 0;
        const done  = (li.dispositions || []).reduce((s, d) => s + (d.quantity || 0), 0);
        const rest  = total - done;
        if (rest <= 0) { stats.alreadyDone += total; continue; }   // ← مسترجَع خلاص، مش خطأ
        inputs.push({
          reverseFulfillmentOrderLineItemId: li.id,
          quantity:        rest,
          locationId:      locGid,
          dispositionType: 'RESTOCKED',
        });
        stats.requested += rest;
      }
      if (!inputs.length) continue;

      const data = await shopifyGQL(env, token, `
        mutation ReverseDispose($dispositionInputs: [ReverseFulfillmentOrderDisposeInput!]!) {
          reverseFulfillmentOrderDispose(dispositionInputs: $dispositionInputs) {
            reverseFulfillmentOrderLineItems { id }
            userErrors { field message }
          }
        }
      `, { dispositionInputs: inputs }, 'reverseFulfillmentOrderDispose');
      stats.calls++;

      const result = data?.data?.reverseFulfillmentOrderDispose;
      const errs   = result?.userErrors || [];
      if (errs.length) throw new Error('reverseDispose: ' + errs.map(e => e.message).join(' | '));

      const acked    = result?.reverseFulfillmentOrderLineItems || [];
      const ackedIds = new Set(acked.map(li => li.id));
      const missing  = inputs.filter(i => !ackedIds.has(i.reverseFulfillmentOrderLineItemId));
      if (missing.length) {
        throw new Error(`reverseDispose: شوبيفاي أكدت ${acked.length} بند من ${inputs.length} — العملية غير مكتملة`);
      }
      stats.confirmed += inputs.reduce((s, i) => s + i.quantity, 0);
    }
  }

  if (stats.alreadyDone > 0 && stats.calls === 0) {
    warnings.push(`المرتجع كان مسترجَع بالكامل قبل كده (${stats.alreadyDone} قطعة) — مفيش استرجاع جديد اتنفذ الآن`);
  }
  return { stats, warnings };
}

// ─── §SHOPIFY::verifyCancels — v3.3.0 (عطل C) ───
// orderCancel بترجّع job { id } — الإلغاء الحقيقي بيحصل بعد الرد. تحقق مجمّع
// بعد الدفعة كلها (نداء واحد لكل مجموعة حتى 20)، مش نداء لكل أوردر. بيتأكد من
// حاجتين: (١) cancelledAt اتسجّل فعلاً، (٢) فيه دليل استرجاع مخزون من
// refundLineItems (orderCancel(restock:true) بيرجّع مخزون الأوردرات
// المُنفَّذة فعلاً — متحقَّق على #44245 و#50781).
// records: [{ orderId, gid, startedAt }] — بتتحدّث في مكانها بـ record.cancel.
async function verifyCancels(env, token, records) {
  if (!records.length) return;
  const DELAYS = [1200, 2000, 3000];

  for (const delay of DELAYS) {
    const left = records.filter(r => !r.cancel?.verified);
    if (!left.length) return;
    await new Promise(r => setTimeout(r, delay));

    for (let i = 0; i < left.length; i += 20) {
      const chunk = left.slice(i, i + 20);
      let data;
      try {
        data = await shopifyGQL(env, token, `
          query VerifyCancel($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on Order {
                id cancelledAt
                refunds(first: 20) {
                  id createdAt
                  refundLineItems(first: 100) { nodes { quantity restockType location { id } } }
                }
              }
            }
          }
        `, { ids: chunk.map(r => r.gid) }, 'verifyCancel');
      } catch {
        continue; // نحاول تاني في الجولة الجاية (delay التالي) — لو خلصت الجولات يفضل verified:false
      }

      const byGid = {};
      for (const n of (data?.data?.nodes || [])) if (n?.id) byGid[n.id] = n;

      for (const r of chunk) {
        const node = byGid[r.gid];
        if (!node) continue;
        const restockedUnits = (node.refunds || [])
          .filter(rf => new Date(rf.createdAt).getTime() >= new Date(r.startedAt).getTime() - 120000)
          .flatMap(rf => rf.refundLineItems?.nodes || [])
          .filter(li => li.restockType && li.restockType !== 'NO_RESTOCK')
          .reduce((s, li) => s + (li.quantity || 0), 0);
        r.cancel = { verified: !!node.cancelledAt, restockedUnits };
      }
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════
// §STATUS — the tool's core logic
// ══════════════════════════════════════════════════════════════════════════

// ─── §STATUS::resolveSpecifier ───
// THE auto-detection rule. Delivered/Cancelled have no S2 sibling — always S1.
// Ready/Shipped/Returned: S1's rule always requires S2 blank, S2's rule always
// requires S2 non-blank (see TRANSITION_RULES) — so "is S2 currently blank?"
// is a complete, order-by-order answer to "does this order belong to S1 or S2
// right now?". Authoritative — mirrors the same read the frontend uses to
// paint the S1/S2 columns, so what the employee sees IS what gets validated.
function resolveSpecifier(targetLabel, currentS1, currentS2) {
  const cfg = TARGET_LABELS[targetLabel];
  if (!cfg) return null;
  if (!cfg.hasS2) return targetLabel;                 // Delivered / Cancelled
  const s2 = (currentS2 || '').trim();
  return s2 === '' ? targetLabel : `${targetLabel}_S2`;
}

// ─── §STATUS::isTransitionValid ───
// Authoritative server-side copy. The frontend runs the same rules for instant
// feedback, but this one decides whether a write actually happens.
function isTransitionValid(specifier, currentS1, currentS2) {
  const rule = TRANSITION_RULES[specifier];
  if (!rule) return false;

  const s1 = (currentS1 || '').trim();
  const s2 = (currentS2 || '').trim();

  if (!rule.s1From.includes(s1)) return false;
  if (rule.s2Blank) return s2 === '';
  if (rule.s2In)    return rule.s2In.includes(s2);
  return true;
}

// ─── §STATUS::applyDirect — v3.3.0 (عطل B، الأخطر) ───
// Executes one resolved specifier's full action plan against Shopify.
// ⚠️ `actions` بتتمرر من بره وبتتملي أول بأول (مش بترجع من الدالة في الآخر).
// لو رمينا استثناء في النص، اللي اتنفّذ فعلاً بيفضل مسجَّل في actions بدل ما
// يختفي (مثال حقيقي #50243: setMetafields نجحت وقطعة رجعت للمخزن، والمرتجع
// التاني فشل — قبل الإصلاح ده كان بيتسجل "actions: []" رغم كده).
async function applyDirect(env, token, order, specifier, courier, reason, actions) {
  const spec     = SPECIFIERS[specifier];
  const warnings = [];

  // ─── v4.3.0 — السبب الموجود أصلاً على الأوردر ───
  // خدمة العملاء بتسجّل سبب الإلغاء/الإرجاع على شوبيفاي قبل ما الأوردر يوصل
  // لموظف العمليات. القاعدة:
  //   • `reason` (اللي جاي من الواجهة) = اختيار موظف العمليات الصريح، مش أكتر.
  //   • لو الموظف ما اختارش حاجة والسبب موجود أصلاً → نستخدم الموجود ونسيبه
  //     على شوبيفاي **من غير ما نكتب فوقه** (مفيش بند ميتافيلد أصلاً).
  //   • لو الموظف اختار نفس القيمة الموجودة → برضه مفيش كتابة (نداء بلا فايدة،
  //     وكل بند زيادة في metafieldsSet = مساحة فشل زيادة تسقّط النداء كله).
  //   • لو اختار قيمة مختلفة → بتتكتب فوق القديمة، وده الـ override المقصود.
  // القيمة المستخدمة فعلياً (مهما كان مصدرها) بترجع في effectiveReason عشان
  // سجل D1 يعكس السبب الحقيقي للأوردر، مش بس اللي موظف العمليات لمسه.
  const existingReason =
    specifier === 'Cancelled' ? (order.cancelReason || null) :
    specifier === 'Returned'  ? (order.returnReason || null) : null;
  const pickedReason    = (reason || '').trim() || null;
  const effectiveReason = pickedReason || existingReason;
  const reasonIsNew     = !!pickedReason && pickedReason !== existingReason;
  const reasonSource    = !effectiveReason ? null : (reasonIsNew ? 'operator' : 'existing');

  // ---- metafield writes (one batched mutation per order) ----
  const target = spec.field === 'S1' ? MF.S1 : MF.S2;
  const mfs = [{
    ownerId:   order.gid,
    namespace: target.namespace,
    key:       target.key,
    type:      target.type,
    value:     spec.label,
  }];

  if (specifier === 'Shipped' || specifier === 'Shipped_S2') {
    mfs.push({
      ownerId: order.gid, namespace: MF.PICKUP.namespace, key: MF.PICKUP.key,
      type: MF.PICKUP.type, value: cairoDate(),
    });
  }
  if (spec.needsCourier && courier && specifier !== 'Returned' && specifier !== 'Returned_S2') {
    mfs.push({
      ownerId: order.gid, namespace: MF.COURIER.namespace, key: MF.COURIER.key,
      type: MF.COURIER.type, value: courier,
    });
  }
  // ─── v4.1.0 — سبب الإلغاء/الإرجاع (بس لـ S1) ───
  // بيتكتب في نفس نداء metafieldsSet اللي بيكتب الحالة (نفس مصفوفة mfs) —
  // كتابة ذرية واحدة. بس لـ S1 (specifier === 'Cancelled' أو 'Returned') —
  // Returned_S2 ماعادش بيكتب سبب (v4.0.0 كانت بتكتبه في الحالتين S1/S2، اتغيّر
  // في v4.1.0: في S2 غالبًا فريق خدمة العملاء يكون سجّل السبب أصلاً وقت إنشاء
  // طلب الاسترجاع/الاستبدال، قبل ما نوصل هنا). الـ Worker مايتحققش من إن
  // القيمة من ضمن الـ choices المعرّفة — شوبيفاي نفسها بترفض القيمة الخارجة
  // عن القائمة على مستوى metafieldsSet (userErrors)، وده بيسقط setMetafields
  // لهذا الأوردر بس.
  //
  // ─── v4.3.0 — الكتابة بقت مشروطة بـ reasonIsNew ───
  // مش بمجرد وجود `reason`. لو السبب موجود أصلاً على الأوردر والموظف ما غيّرهوش،
  // البند ده مابيتضافش خالص — قيمة خدمة العملاء بتفضل زي ما هي حرفياً، والنداء
  // بيفضل أصغر. الكتابة بتحصل بس لما الموظف يختار قيمة **مختلفة** عن الموجودة.
  if (specifier === 'Cancelled' && reasonIsNew) {
    mfs.push({
      ownerId: order.gid, namespace: MF.CANCEL_REASON.namespace, key: MF.CANCEL_REASON.key,
      type: MF.CANCEL_REASON.type, value: pickedReason,
    });
  }
  if (specifier === 'Returned' && reasonIsNew) {
    mfs.push({
      ownerId: order.gid, namespace: MF.RETURN_REASON.namespace, key: MF.RETURN_REASON.key,
      type: MF.RETURN_REASON.type, value: pickedReason,
    });
  }
  // ⚠️ v3.6.0 — مسح المندوب في Ready/Ready_S2 **مش** بيتحط هنا. كان بيتضاف
  // كبند بقيمة `value: ''` جوه نفس النداء ده، وشوبيفاي بترفض القيمة الفاضية
  // فيسقط النداء كله (بما فيه كتابة الحالة). دلوقتي بيتنفّذ بعد setMetafields
  // عن طريق deleteMetafields — شوف الكتلة تحت.

  // ---- Shopify-side actions ----

  // Cancelled / Returned (S1): cancel the order BEFORE writing the metafield.
  // startedAt بيتسجّل عشان verifyCancels تستخدمه بعد كده (عطل C) — orderCancel
  // بترجّع job غير متزامن، فمفيش تأكيد فوري إن الإلغاء اتنفذ فعلاً.
  let cancelStartedAt = null;
  if (specifier === 'Cancelled' || specifier === 'Returned') {
    cancelStartedAt = new Date().toISOString();
    await cancelOrder(env, token, order.gid);
    actions.push('orderCancel');
  }

  await setMetafields(env, token, mfs);
  actions.push(`metafields:${mfs.map(m => m.key).join('+')}`);

  // Ready / Ready_S2: order is going back on the shelf for a fresh dispatch —
  // امسح أي مندوب متسجّل من المحاولة اللي فاتت (لو موجود). الأوردر ده هيخرج
  // تاني يوم غالبًا مع مندوب مختلف.
  // ⚠️ v3.6.0: نداء metafieldsDelete منفصل **بعد** ما الحالة اتكتبت فعلاً.
  // الفشل هنا **ما بيرميش**: كتابة الحالة (الفعل الأساسي) خلصت وما ينفعش
  // نلغيها، فالنتيجة بتبقى warning والموظف بيتقال له إن المندوب لسه على
  // الأوردر — بدل ما الأوردر كله يتحسب فشل وهو فعليًا اتحدّث.
  if ((specifier === 'Ready' || specifier === 'Ready_S2') && order.courier) {
    try {
      const n = await deleteMetafields(env, token, [{
        ownerId: order.gid, namespace: MF.COURIER.namespace, key: MF.COURIER.key,
      }]);
      if (n > 0) {
        actions.push('metafieldsDelete:courier');
      } else {
        warnings.push(`الحالة اتكتبت، لكن شوبيفاي ما أكدتش مسح المندوب "${order.courier}" — راجع الأوردر يدويًا`);
      }
    } catch (e) {
      warnings.push(`الحالة اتكتبت، لكن مسح المندوب "${order.courier}" فشل (${e.message}) — المندوب لسه مسجّل على الأوردر`);
    }
  }

  // Ready / Ready_S2: back to Unfulfilled (courier returned before delivery)
  if (specifier === 'Ready' || specifier === 'Ready_S2') {
    if (order.fulfillments.length) {
      const n = await cancelFulfillments(env, token, order.fulfillments);
      actions.push(`fulfillmentCancel×${n}`);
    }
  }

  // Shipped / Shipped_S2: fulfill everything still open
  if (specifier === 'Shipped' || specifier === 'Shipped_S2') {
    const open = order.fulfillmentOrders.filter(fo => fo.status === 'OPEN');
    if (open.length) {
      const n = await createFulfillment(env, token, open);
      actions.push(`fulfillmentCreate(${n} FO)`);
    }
  }

  // Returned_S2: restock every returned piece
  if (specifier === 'Returned_S2') {
    const { stats, warnings: disposeWarnings } = await disposeReturns(env, token, env.LOCATION_ID, order.returns);
    if (stats.confirmed) actions.push(`reverseDispose×${stats.confirmed}`);
    warnings.push(...disposeWarnings);
  }

  // v4.3.0 — effectiveReason/reasonSource بيرجعوا عشان صف D1 يسجّل السبب
  // الحقيقي للأوردر ومصدره، حتى لو موظف العمليات ما اختارش حاجة بنفسه.
  return { warnings, cancelStartedAt, effectiveReason, reasonSource };
}

// ─── §STATUS::runCourierSearch ───
// One paginated search against a single TRANSITION_SOURCES rule.
// `noCourier` (بند 3، v3.2.0): يبحث عن الأوردرات اللي الميتافيلد custom.courier
// فاضي عندها خالص (مفيش أي مندوب مسجَّل) — بيستخدم صيغة النفي في بحث Shopify
// بدل شرط "= اسم مندوب" العادي.
async function runCourierSearch(env, token, courier, rule, since, noCourier = false) {
  const orClause = (key, values) =>
    values.map(v => `metafields.custom.${key}:${JSON.stringify(v)}`).join(' OR ');

  const parts = [noCourier ? `-metafields.custom.courier:*` : `metafields.custom.courier:"${courier}"`];
  if (rule.s1Sources)    parts.push(`(${orClause('manual_status', rule.s1Sources)})`);
  if (rule.s2Sources)    parts.push(`(${orClause('status_2_r_e',  rule.s2Sources)})`);
  if (rule.s1Constraint) parts.push(`(${orClause('manual_status', rule.s1Constraint)})`);
  parts.push(`created_at:>=${since}`);

  const queryStr = parts.join(' AND ').replace(/"/g, '\\"');

  const orders = [];
  let hasNextPage = true, endCursor = null, pageCount = 0;

  while (hasNextPage && pageCount < SEARCH_MAX_PAGES) {
    const cursorArg = endCursor ? `, after: "${endCursor}"` : '';
    const data = await shopifyGQL(env, token, `
      { orders(first: 100, reverse: true, query: "${queryStr}"${cursorArg}) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            id name cancelledAt
            s1: metafield(namespace: "custom", key: "manual_status") { value }
            s2: metafield(namespace: "custom", key: "status_2_r_e")  { value }
          } }
        } }
    `);

    for (const { node } of (data?.data?.orders?.edges || [])) {
      if (!node?.id) continue;
      orders.push({
        orderId: numericId(node.id),   // v3.7.0 — كانت id: (اسم غلط)؛ orderId هو المفتاح الموحّد
        name: node.name,
        s1:   node.s1?.value || null,
        s2:   node.s2?.value || null,
        isCancelled: !!node.cancelledAt,
      });
    }

    hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage || false;
    endCursor   = data?.data?.orders?.pageInfo?.endCursor   || null;
    pageCount++;
  }

  return { orders, truncated: hasNextPage, pageCount };
}


// ══════════════════════════════════════════════════════════════════════════
// §HANDLER
// ══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    // 1. CORS preflight — always first
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: getCORS(request) });

    // 2. WORKER_SECRET — always second
    const auth = request.headers.get('Authorization');
    if (!auth || auth !== `Bearer ${env.WORKER_SECRET}`)
      return json({ error: 'Unauthorized' }, 401, request);

    const url    = new URL(request.url);
    const action = url.searchParams.get('action') || '';

    try {

      // ─── §AUTH ──────────────────────────────────────────────────────────

      if (action === 'check_employee') {
        const username = url.searchParams.get('username');
        if (!username) return json({ ok: false, error: 'username مطلوب' }, 400, request);
        const result = await checkEmployee(env.DB, username);
        return json({ ok: true, ...result }, 200, request);
      }

      if (action === 'register_pin') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const { username, pin } = await request.json().catch(() => ({}));
        if (!username || !pin) return json({ ok: false, error: 'username و pin مطلوبان' }, 400, request);
        await registerPin(env.DB, username, pin);
        return json({ ok: true }, 200, request);
      }

      if (action === 'verify_employee') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const { username, pin } = await request.json().catch(() => ({}));
        if (!username || !pin) return json({ ok: false, error: 'username و pin مطلوبان' }, 400, request);

        const displayName = await verifyEmployee(env.DB, username, pin);
        if (!displayName) return json({ ok: false, error: 'PIN خطأ أو المستخدم غير موجود' }, 401, request);

        // v3.7.0 (Step 5A ⑦) — الـ PIN اتأكد صح خلاص؛ فشل كتابة سجل الدخول في D1
        // لازم ميحوّلش دخول ناجح فعليًا لخطأ 500 للموظف. logged:false بدل الصمت.
        let logged = true;
        try {
          await writeLog(env.DB, {
            tool: TOOL_NAME, type: 'login', employee: username,
            notes: `دخول: ${displayName}`,
          });
        } catch (e) { logged = false; }
        return json({ ok: true, displayName, logged }, 200, request);
      }

      if (action === 'log_logout') {
        const username = url.searchParams.get('username');
        let logged = true;
        if (username) {
          try {
            await writeLog(env.DB, {
              tool: TOOL_NAME, type: 'logout', employee: username,
              notes: `خروج: ${username.replace(/_/g, ' ')}`,
            });
          } catch (e) { logged = false; }
        }
        return json({ ok: true, logged }, 200, request);
      }

      if (action === 'get_employees') {
        const { results } = await env.DB.prepare(
          'SELECT username, display_name FROM employees WHERE is_active = 1 ORDER BY display_name'
        ).all();
        return json({ ok: true, employees: results }, 200, request);
      }

      // ─── §STATUS ────────────────────────────────────────────────────────

      // §STATUS::config — lets the HTML display version + server time
      if (action === 'get_config') {
        return json({
          ok: true,
          version:    VERSION,
          serverTime: toCairo(new Date().toISOString()),
        }, 200, request);
      }

      // §STATUS::courierValues — choice list from the courier metafield definition
      if (action === 'courier_values') {
        assertEnv(env, 'shopify');
        const token = await getAccessToken(env);

        const data = await shopifyGQL(env, token, `
          { metafieldDefinitions(first: 50, ownerType: ORDER) {
              nodes { namespace key validations { name value } } } }
        `, {}, 'courierValues');
        const defs = data?.data?.metafieldDefinitions?.nodes || [];
        const def  = defs.find(d => d.namespace === 'custom' && d.key === 'courier');
        let values = [];
        const choices = def?.validations?.find(v => v.name === 'choices');
        if (choices?.value) { try { values = JSON.parse(choices.value); } catch {} }
        return json({ ok: true, values }, 200, request);
      }

      // §STATUS::reasonValues — v4.0.0 — choice lists from the cancel/return
      // reason metafield definitions (سبب الإلغاء/الإرجاع، إلزامي في الواجهة).
      // نداء واحد لـ metafieldDefinitions بيرجّع الاتنين مع بعض (نفس شكل
      // courier_values فوق).
      if (action === 'reason_values') {
        assertEnv(env, 'shopify');
        const token = await getAccessToken(env);

        const data = await shopifyGQL(env, token, `
          { metafieldDefinitions(first: 50, ownerType: ORDER) {
              nodes { namespace key validations { name value } } } }
        `, {}, 'reasonValues');
        const defs = data?.data?.metafieldDefinitions?.nodes || [];

        const extractChoices = (key) => {
          const def = defs.find(d => d.namespace === 'custom' && d.key === key);
          const choices = def?.validations?.find(v => v.name === 'choices');
          if (!choices?.value) return [];
          try { return JSON.parse(choices.value); } catch { return []; }
        };

        return json({
          ok: true,
          cancelReasons: extractChoices(MF.CANCEL_REASON.key),
          returnReasons: extractChoices(MF.RETURN_REASON.key),
        }, 200, request);
      }

      // §STATUS::resolveOrders — numeric IDs → order names
      if (action === 'resolve_orders') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const { orderIds = [] } = await request.json().catch(() => ({}));
        if (!orderIds.length) return json({ ok: false, error: 'orderIds مطلوب' }, 400, request);
        const token = await getAccessToken(env);
        return json({ ok: true, names: await resolveOrderNames(env, token, orderIds) }, 200, request);
      }

      // §STATUS::resolveByName — #XXXXX → numeric ID
      if (action === 'resolve_by_name') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const { orderName = '' } = await request.json().catch(() => ({}));
        if (!orderName) return json({ ok: false, error: 'orderName مطلوب' }, 400, request);
        const token  = await getAccessToken(env);
        const result = await resolveOrderByName(env, token, orderName);
        if (!result) return json({ ok: false, notFound: true }, 200, request);
        return json({ ok: true, ...result }, 200, request);
      }

      // §STATUS::orderStatuses — current S1/S2/courier + cancellation state for the table
      if (action === 'order_statuses') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const { orderIds = [] } = await request.json().catch(() => ({}));
        if (!orderIds.length) return json({ ok: false, error: 'orderIds مطلوب' }, 400, request);

        const token  = await getAccessToken(env);
        const states = await fetchOrderStates(env, token, orderIds, false);

        const statuses = {};
        for (const [id, o] of Object.entries(states)) {
          statuses[id] = {
            orderId: id,   // v3.7.0 (worker-builder Step 5) — numeric ID جنب البيانات، مش مفتاح الـ dict بس
            name: o.name, s1: o.s1, s2: o.s2, courier: o.courier,
            isCancelled: o.isCancelled,
            fulfillmentStatus: o.fulfillmentStatus,
            // v4.3.0 — الواجهة بتستخدمهم عشان تعرض السبب المسجّل مسبقًا وتشيل
            // الإلزام عن الصف. اسم الحقل هنا هو نفسه في fetchOrderStates —
            // orderInfo[id] في الواجهة spread مباشر من الرد ده.
            cancelReason: o.cancelReason,
            returnReason: o.returnReason,
          };
        }
        return json({ ok: true, statuses }, 200, request);
      }

      // §STATUS::orderDetails — customer + COD data for manifest printing
      if (action === 'order_details') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const { orderIds = [] } = await request.json().catch(() => ({}));
        if (!orderIds.length) return json({ ok: false, error: 'orderIds مطلوب' }, 400, request);

        const token = await getAccessToken(env);
        const data  = await shopifyGQL(env, token, `
          { nodes(ids: ${JSON.stringify(orderIds.map(gid))}) {
              ... on Order {
                id name
                totalOutstandingSet { shopMoney { amount } }
                currentTotalPriceSet { shopMoney { amount } }
                shippingAddress {
                  firstName lastName phone
                  address1 address2 city province
                }
              }
            } }
        `, {}, 'orderDetails');

        const details = {};
        for (const n of (data?.data?.nodes || [])) {
          if (!n?.id) continue;
          const a = n.shippingAddress;
          const outstanding = parseFloat(n.totalOutstandingSet?.shopMoney?.amount || 0);
          const current     = parseFloat(n.currentTotalPriceSet?.shopMoney?.amount || 0);
          details[numericId(n.id)] = {
            orderId:      numericId(n.id),   // v3.7.0 (worker-builder Step 5) — نفس القاعدة
            orderName:    n.name,
            customerName: a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() || null : null,
            phone:        a?.phone || null,
            address:      a ? [a.address1, a.address2, a.city, a.province].filter(Boolean).join('، ') : null,
            // COD = what is still owed; falls back to the current order total
            cod: Math.abs(outstanding > 0 ? outstanding : current).toFixed(2),
          };
        }
        return json({ ok: true, details }, 200, request);
      }

      // §STATUS::searchCourierOrders — orders of ONE courier eligible for a
      // targetLabel. Runs the S1 rule AND (when the label has an S2 sibling)
      // the S2 rule, then merges — so the picker shows both kinds together,
      // exactly like a scanned batch would.
      // noCourier (بند 3، v3.2.0): بدل "مندوب معيّن"، يدوّر على الأوردرات اللي
      // مفيش عليها أي مندوب مسجَّل خالص (custom.courier فاضي).
      if (action === 'search_courier_orders') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const { courier = '', noCourier = false, targetLabel = '', createdAfter = '' } =
          await request.json().catch(() => ({}));

        if (!courier && !noCourier) return json({ ok: false, error: 'courier مطلوب' }, 400, request);
        const labelCfg = TARGET_LABELS[targetLabel];
        if (!labelCfg)    return json({ ok: false, error: `targetLabel غير معروف: ${targetLabel}` }, 400, request);

        const s1Rule = TRANSITION_SOURCES[`S1:${targetLabel}`];
        const s2Rule = labelCfg.hasS2 ? TRANSITION_SOURCES[`S2:${targetLabel}`] : null;
        if (!s1Rule && !s2Rule)
          return json({ ok: false, error: `لا توجد قاعدة انتقال لـ ${targetLabel}` }, 400, request);

        // Default window: last 180 days
        const since = createdAfter || (() => {
          const d = new Date(Date.now() - 180 * 86400000);
          return d.toISOString().slice(0, 10);
        })();

        const token = await getAccessToken(env);
        const seen  = new Map();
        let truncated = false, scannedPages = 0;

        if (s1Rule) {
          const r = await runCourierSearch(env, token, courier, s1Rule, since, noCourier);
          r.orders.forEach(o => seen.set(o.orderId, o));
          truncated = truncated || r.truncated;
          scannedPages += r.pageCount;
        }
        if (s2Rule) {
          const r = await runCourierSearch(env, token, courier, s2Rule, since, noCourier);
          r.orders.forEach(o => { if (!seen.has(o.orderId)) seen.set(o.orderId, o); });
          truncated = truncated || r.truncated;
          scannedPages += r.pageCount;
        }

        return json({
          ok: true, orders: [...seen.values()], truncated, scannedPages, since,
        }, 200, request);
      }

      // §STATUS::updateStatus — the main write endpoint — v3.3.0 (عطول B/C/٨/٩)
      // Body: { orderIds[], targetLabel, courier?, employee }
      // No specifier from the client anymore — resolveSpecifier() decides
      // S1 vs S2 per order from its own current state.
      //
      // بقت على مرحلتين إلزاميتين:
      //   ١) تنفيذ الأفعال على شوبيفاي لكل أوردر (actions تتملي أول بأول —
      //      عطل B) ثم تحقق مجمّع واحد بعد الدفعة لكل orderCancel (عطل C).
      //   ٢) كتابة D1 بعد ما النتيجة النهائية (success/warning/error) تتحسم —
      //      عشان صف السجل يعكس النتيجة الصح من أول مرة، مش يتكتب "success"
      //      قبل ما نعرف إن الإلغاء اتأكد ولا لأ.
      if (action === 'update_status') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const body = await request.json().catch(() => ({}));
        const {
          orderIds = [], targetLabel = '', courier = '', employee = '', reasons = {},
        } = body;

        if (!orderIds.length)  return json({ ok: false, error: 'orderIds مطلوب' }, 400, request);
        const labelCfg = TARGET_LABELS[targetLabel];
        if (!labelCfg)          return json({ ok: false, error: `targetLabel غير معروف: ${targetLabel}` }, 400, request);
        if (!employee)          return json({ ok: false, error: 'employee مطلوب' }, 400, request);
        if (labelCfg.needsCourier && !courier)
          return json({ ok: false, error: 'المندوب مطلوب لهذه الحالة' }, 400, request);

        // "Returned" can resolve to S1 or S2 per order — the S2 path (Returned_S2)
        // restocks via disposeReturns → LOCATION_ID لازم يكون موجود قبل ما نبدأ.
        if (targetLabel === 'Returned') requireLocationId(env);

        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const token   = await getAccessToken(env);

        // "Returned" can resolve to S1 or S2 per order — fetch the (expensive)
        // returns block for the whole batch defensively; harmless when unused.
        const needsReturns = targetLabel === 'Returned';
        const states = await fetchOrderStates(env, token, orderIds, needsReturns);

        // v4.1.0 — سبب الإلغاء/الإرجاع إلزامي بس للأوردرات اللي هتتحل فعليًا
        // لـ S1 (specifier === 'Cancelled' أو 'Returned'). لازم نجيب حالة كل
        // أوردر (فوق) ونحل specifier بتاعه الأول عشان نعرف ده S1 ولا S2
        // (Returned_S2 مش محتاج سبب). أوردر مش موجود على شوبيفاي (order
        // undefined) بيتسيب من غير فحص سبب — هيفشل في المرحلة ١ بسبب
        // "الأوردر غير موجود" مش بسبب السبب. لسه فحص دفعي (الدفعة كلها بترفض
        // 400 لو أي أوردر من اللي هيتحل لـ S1 جاله من غير سبب) — الواجهة
        // بتمنع الإرسال أصلاً لو فيه أوردر ناقصه سبب، الفحص هنا خط دفاع تاني.
        if (targetLabel === 'Cancelled' || targetLabel === 'Returned') {
          // v4.3.0 — السبب المسجّل أصلاً على الأوردر بيعدّي الفحص ده.
          // خدمة العملاء بتكتب custom.cancel_manual_reason / return_manual_reason
          // وقت ما العميل يبلّغ، قبل ما الأوردر يوصل لموظف العمليات خالص. طلب
          // السبب تاني في الحالة دي = إجبار الموظف يخمّن سبب هو مش شايفه.
          // الأوردر بيترفض بس لو مفيش سبب من الواجهة **ولا** على شوبيفاي.
          const missingReason = orderIds.filter(id => {
            const order = states[id];
            if (!order) return false;
            const specifier = resolveSpecifier(targetLabel, order.s1, order.s2);
            const needsReason = specifier === 'Cancelled' || specifier === 'Returned';
            if (!needsReason) return false;
            const picked   = String(reasons?.[id] || '').trim();
            const existing = specifier === 'Cancelled' ? order.cancelReason : order.returnReason;
            return !picked && !existing;
          });
          if (missingReason.length) {
            return json({
              ok: false,
              error: `سبب الإلغاء/الإرجاع مطلوب لكل الأوردرات (S1) — ${missingReason.length} أوردر بدون سبب`,
            }, 400, request);
          }
        }

        const results      = [];
        const cancelRecords = []; // §STATUS::verifyCancels — {orderId, gid, startedAt, row}

        // ── المرحلة ١: تنفيذ الأفعال على شوبيفاي ──
        for (const id of orderIds) {
          const order = states[id];
          const reasonForRow = String(reasons?.[id] || '').trim() || null;   // v4.0.0
          const row = {
            orderId: id, orderName: order?.name || null, status: 'error', error: null,
            actions: [], warnings: [], resolvedField: null, resolvedLabel: null,
            s1Before: order?.s1 || null, s2Before: order?.s2 || null,
            reason: reasonForRow,
            // v4.3.0 — 'operator' (الموظف اختار قيمة جديدة) | 'existing' (السبب
            // كان مسجّل على شوبيفاي وما اتغيّرش) | null. بيتحدّد جوه applyDirect
            // بعد ما نعرف الـ specifier المتحل، وبيتكتب في extra.reasonSource.
            reasonSource: null,
          };

          try {
            if (!order) throw new Error('الأوردر غير موجود على Shopify');

            // Cancelled orders are never touched again
            if (order.isCancelled && targetLabel !== 'Cancelled' && targetLabel !== 'Returned')
              throw new Error('الأوردر ملغي على Shopify');

            const specifier = resolveSpecifier(targetLabel, order.s1, order.s2);
            if (!specifier || !isTransitionValid(specifier, order.s1, order.s2))
              throw new Error(`انتقال غير مسموح: S1="${order.s1 || 'فارغ'}" / S2="${order.s2 || 'فارغ'}" → ${targetLabel}`);

            const spec = SPECIFIERS[specifier];
            row.resolvedField = spec.field;
            row.resolvedLabel = spec.label;

            // v4.1.0 — السبب بيتكتب/بيتسجّل بس لو الأوردر ده فعليًا اتحل لـ S1
            // (Cancelled/Returned). Returned_S2 ماعادش بيكتب سبب — نصفّر
            // row.reason هنا عشان سجل D1 (notesParts + extra.reason تحت) يعكس
            // اللي اتكتب فعلاً على شوبيفاي، مش أي قيمة جت من الواجهة بالخطأ.
            if (specifier !== 'Cancelled' && specifier !== 'Returned') row.reason = null;

            const { warnings, cancelStartedAt, effectiveReason, reasonSource } =
              await applyDirect(env, token, order, specifier, courier, row.reason, row.actions);
            row.warnings = warnings;
            row.status   = warnings.length ? 'warning' : 'success';
            // v4.3.0 — السبب اللي بيتسجّل هو السبب **الفعلي** للأوردر: اللي
            // الموظف اختاره، أو اللي كان مسجّل من خدمة العملاء لو ما اختارش.
            row.reason       = effectiveReason;
            row.reasonSource = reasonSource;

            if (cancelStartedAt) {
              cancelRecords.push({ orderId: id, gid: order.gid, startedAt: cancelStartedAt, specifier, row });
            }
          } catch (e) {
            row.status = 'error';
            row.error  = e.message;
          }

          results.push(row);
        }

        // ── المرحلة ١ب: تحقق مجمّع من كل عمليات الإلغاء دفعة واحدة (عطل C) ──
        if (cancelRecords.length) {
          try {
            await verifyCancels(env, token, cancelRecords);
          } catch { /* أفضل مجهود — لو فشل التحقق نفسه، السجلات تفضل verified:false تلقائيًا */ }

          for (const rec of cancelRecords) {
            if (rec.row.status !== 'success' && rec.row.status !== 'warning') continue; // صف فشل أصلاً — سيبه زي ما هو
            if (!rec.cancel?.verified) {
              rec.row.status = 'warning';
              rec.row.warnings.push('لسه ما اتأكدش إن إلغاء الأوردر على شوبيفاي نجح فعلاً — راجعه يدويًا');
            } else if (rec.specifier === 'Returned' && !rec.cancel.restockedUnits) {
              rec.row.status = 'warning';
              rec.row.warnings.push('الإلغاء اتأكد لكن لسه مفيش دليل استرجاع مخزون — راجع الأوردر يدويًا');
            }
          }
        }

        // ── المرحلة ٢: كتابة D1 بعد ما النتيجة النهائية اتحسمت (عطل ٩) ──
        for (const row of results) {
          const spec = row.resolvedField ? { field: row.resolvedField, label: row.resolvedLabel } : null;
          const notesParts = [];
          // v4.3.0 — السبب اللي جه جاهز من خدمة العملاء بيتوسم في نص السجل نفسه،
          // عشان اللي بيقرأ تاب السجل يفرّق من غير ما يفتح extra.
          const reasonNote = row.reason
            ? ` · سبب: ${row.reason}${row.reasonSource === 'existing' ? ' (مسجّل مسبقًا)' : ''}`
            : '';
          if (row.status === 'success') {
            notesParts.push(`${spec.field}=${spec.label}${courier ? ` · ${courier}` : ''}${reasonNote}`);
          } else if (row.status === 'warning') {
            notesParts.push(`⚠ تم جزئيًا: ${spec.field}=${spec.label}${courier ? ` · ${courier}` : ''}${reasonNote}`);
            notesParts.push(row.warnings.join(' | '));
          } else {
            notesParts.push(`فشل: ${row.error}`);
            if (row.actions.length) notesParts.push(`(تم فعليًا: ${row.actions.join(', ')})`);
          }

          let logged = true, logError = null;
          try {
            await writeLog(env.DB, {
              tool:       TOOL_NAME,
              type:       'update',
              employee,
              orderId:    row.orderId,
              orderName:  row.orderName,
              valueBefore: spec ? (spec.field === 'S1' ? row.s1Before : row.s2Before) : null,
              valueAfter:  row.status !== 'error' ? spec?.label ?? null : null,
              notes: notesParts.filter(Boolean).join(' — '),
              // ─── §CONTRACT::extra — ⚠️ عقد مقروء من أداة تانية ───
              // cod-payment-center-worker (أداة مالية) بيقرا الصفوف دي من D1
              // مباشرة ويعتمد حرفيًا على: result · courier · targetLabel
              // (مع fallback على specifier). تغيير اسم أي مفتاح من دول، أو
              // إيقاف كتابته، أو تغيير قيمه = **فشل صامت** في أداة التحصيل
              // (ليستة فاضية من غير خطأ، والموظف ما بيحصّلش). عدّل §TODAY-IMPORT
              // هناك في نفس التسليم. راجع بلوك الرأس أعلى الملف.
              extra: {
                batchId, targetLabel,
                field: spec?.field || null, statusLabel: spec?.label || null,
                courier: courier || null, writeMode: 'direct',
                result: row.status, error: row.error, warnings: row.warnings,
                actions: row.actions,
                s1Before: row.s1Before, s2Before: row.s2Before,
                reason: row.reason || null,   // v4.0.0 — سبب الإلغاء/الإرجاع
                // v4.3.0 — مصدر السبب: 'operator' = موظف العمليات اختاره من
                // الأداة · 'existing' = كان مسجّل على شوبيفاي (خدمة العملاء)
                // والأداة ما كتبتش فوقه · null = مفيش سبب على الأوردر ده.
                reasonSource: row.reasonSource || null,
              },
            });
          } catch (e) {
            logged = false; logError = e.message;
          }
          row.logged = logged;
          if (!logged) row.logError = logError;
        }

        const success = results.filter(r => r.status === 'success').length;
        const warning = results.filter(r => r.status === 'warning').length;
        return json({
          ok: true, batchId,
          total: results.length, success, warning, errors: results.length - success - warning,
          results,
        }, 200, request);
      }

      // §STATUS::diag — فحص ذاتي بدون أي كتابة (عطل F) — ممنوع يرجّع قيمة أي سر
      if (action === 'diag') {
        const envKeys = Object.keys(env).sort().map(k => ({
          name:    JSON.stringify(k),   // الـ quotes بتكشف أي مسافة مخفية في الاسم
          nameLen: k.length,
          valLen:  typeof env[k] === 'string' ? env[k].length : null,
        }));

        let d1Ok = false, d1Error = null;
        try { await env.DB.prepare('SELECT 1').first(); d1Ok = true; }
        catch (e) { d1Error = e.message; }

        let shopifyAuth = { ok: false, error: null, scopes: [] };
        let token = null;
        try {
          token = await getAccessToken(env);
          const data = await shopifyGQL(env, token, `{ currentAppInstallation { accessScopes { handle } } }`, {}, 'diag:scopes');
          shopifyAuth.ok = true;
          shopifyAuth.scopes = (data?.data?.currentAppInstallation?.accessScopes || []).map(s => s.handle);
        } catch (e) { shopifyAuth.error = e.message; }

        let locationCheck = { present: !!env.LOCATION_ID, resolvesOk: false, name: null, error: null };
        if (env.LOCATION_ID && token) {
          try {
            const data = await shopifyGQL(env, token, `{ location(id: "gid://shopify/Location/${env.LOCATION_ID}") { id name } }`, {}, 'diag:location');
            locationCheck.resolvesOk = !!data?.data?.location?.id;
            locationCheck.name = data?.data?.location?.name || null;
          } catch (e) { locationCheck.error = e.message; }
        }

        const allOk = d1Ok && shopifyAuth.ok && (!env.LOCATION_ID || locationCheck.resolvesOk);

        return json({
          ok: true, allOk, version: VERSION,
          origin: request.headers.get('Origin') || null,
          allowedOrigins: ALLOWED_ORIGINS,
          envKeys, d1: { ok: d1Ok, error: d1Error },
          shopifyAuth, locationCheck,
        }, 200, request);
      }

      // ─── §LOG-ENDPOINTS ─────────────────────────────────────────────────
      // status/courier/dateFrom/dateTo added 16-08-2026 alongside employee
      // (now accepts a comma-separated list too — multi-select filters).

      if (action === 'get_logs') {
        const employee = url.searchParams.get('employee') || null;
        const status   = url.searchParams.get('status')   || null;
        const courier  = url.searchParams.get('courier')  || null;
        const result   = url.searchParams.get('result')   || null;
        const search   = url.searchParams.get('search')   || null;
        const dateFrom = url.searchParams.get('dateFrom')  || null;
        const dateTo   = url.searchParams.get('dateTo')    || null;
        const sortKey  = url.searchParams.get('sortKey')   || null;   // v3.7.0 — data-table-standard § 8
        const sortDir  = url.searchParams.get('sortDir')   || null;
        const limit    = Math.min(parseInt(url.searchParams.get('limit')  || '100'), 100);
        const offset   = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
        const entries  = await getLogs(env.DB, {
          tool: TOOL_NAME, employee, status, courier, result, search, dateFrom, dateTo, sortKey, sortDir, limit, offset,
        });
        return json({ ok: true, entries }, 200, request);
      }

      if (action === 'get_logs_count') {
        const employee = url.searchParams.get('employee') || null;
        const status   = url.searchParams.get('status')   || null;
        const courier  = url.searchParams.get('courier')  || null;
        const result   = url.searchParams.get('result')   || null;
        const search   = url.searchParams.get('search')   || null;
        const dateFrom = url.searchParams.get('dateFrom')  || null;
        const dateTo   = url.searchParams.get('dateTo')    || null;
        const total    = await getLogsCount(env.DB, {
          tool: TOOL_NAME, employee, status, courier, result, search, dateFrom, dateTo,
        });
        return json({ ok: true, total }, 200, request);
      }

      if (action === 'get_logs_export') {
        const employee = url.searchParams.get('employee') || null;
        const status   = url.searchParams.get('status')   || null;
        const courier  = url.searchParams.get('courier')  || null;
        const result   = url.searchParams.get('result')   || null;
        const search   = url.searchParams.get('search')   || null;
        const dateFrom = url.searchParams.get('dateFrom')  || null;
        const dateTo   = url.searchParams.get('dateTo')    || null;
        const entries  = await getLogsExport(env.DB, {
          tool: TOOL_NAME, employee, status, courier, result, search, dateFrom, dateTo,
        });
        return json({ ok: true, entries }, 200, request);
      }

      return json({ ok: false, error: `action غير معروف: ${action}` }, 404, request);

    } catch (e) {
      return json({ ok: false, error: e.message }, 500, request);
    }
  },
};