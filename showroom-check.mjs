// فحص مسار الشو روم (v4.9.0) — node showroom-check.mjs
// بيحمّل index.js كنص (الملف مابيصدّرش غير الـ default) ويشغّل الـ Worker الفعلي على Shopify/D1 وهميين،
// ويتأكد من: الأهلية · ترتيب الأفعال (fulfillment قبل أي كتابة) · fail-closed · الـ idempotency · عقد D1.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8').replace(/export default \{/, 'const __default = {');
const api = new Function(`${src}\nreturn { __default, showroomIneligibility, isShowroomValue };`)();

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('❌', m)); };

// ── وحدات: الأهلية ──
const base = { isCancelled: false, s1: 'Ready', s2: null, zone: 'Show_Room', courier: 'Showroom' };
ok(api.showroomIneligibility(base) === null, 'أوردر #67094 (Ready · Show_Room · Showroom) مؤهل');
ok(api.showroomIneligibility({ ...base, zone: 'Showroom', courier: 'Show_Room' }) === null, 'التطبيع: الاتجاهين Show_Room/Showroom');
ok(api.showroomIneligibility({ ...base, zone: 'show room' }) === null, 'مسافة/حروف صغيرة');
ok(!!api.showroomIneligibility({ ...base, s1: 'Shipped' }), 'Shipped مرفوض');
ok(!!api.showroomIneligibility({ ...base, s2: 'Ready' }), 'S2 مش فاضي مرفوض (S1 بس)');
ok(!!api.showroomIneligibility({ ...base, zone: 'Cairo+Giza' }), 'zone تانية مرفوضة');
ok(!!api.showroomIneligibility({ ...base, courier: 'Sobhy' }), 'مندوب تاني مرفوض');
ok(!!api.showroomIneligibility({ ...base, isCancelled: true }), 'ملغي مرفوض');
ok(!!api.showroomIneligibility(undefined), 'أوردر مش موجود');

// ── Worker على Shopify وهمي ──
function makeWorld(over = {}) {
  const w = { calls: [], logs: [], failFulfill: false, order: { s1: 'Ready', s2: null, zone: 'Show_Room', courier: 'Showroom',
    fStatus: 'UNFULFILLED', fos: [{ id: 'gid://shopify/FulfillmentOrder/1', status: 'OPEN' }], cancelled: false, ...over } };
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/oauth/access_token')) return new Response(JSON.stringify({ access_token: 't' }));
    const { query, variables } = JSON.parse(init.body);
    const op = (query.match(/(?:query|mutation)\s+(\w+)/) || [])[1] || (query.includes('metafieldDefinitions') ? 'ReasonChoices' : 'anon');
    w.calls.push(op);
    const o = w.order, res = d => new Response(JSON.stringify({ data: d }));
    if (op === 'OrderStates') return res({ nodes: variables.ids.map(id => ({
      id, name: '#67094', cancelledAt: o.cancelled ? 'x' : null, displayFulfillmentStatus: o.fStatus,
      fulfillments: [], fulfillmentOrders: { nodes: o.fos },
      s1: { value: o.s1 }, s2: o.s2 ? { value: o.s2 } : null, courier: o.courier ? { value: o.courier } : null,
      zone: o.zone ? { value: o.zone } : null, cancelReason: null, returnReason: null, returns: { nodes: [] } })) });
    if (op === 'FulfillmentCreate') {
      if (w.failFulfill) return res({ fulfillmentCreate: { fulfillment: null, userErrors: [{ message: 'boom' }] } });
      o.fos = []; o.fStatus = 'FULFILLED';
      return res({ fulfillmentCreate: { fulfillment: { id: 'gid://shopify/Fulfillment/9', status: 'SUCCESS' }, userErrors: [] } });
    }
    if (op === 'OrderCancel') return res({ orderCancel: { job: { id: 'gid://shopify/Job/1' }, orderCancelUserErrors: [] } });
    if (op === 'MetafieldsSet') return res({ metafieldsSet: { metafields: variables.metafields.map(m => ({ id: '1', key: m.key, value: m.value })), userErrors: [] } });
    if (op === 'MetafieldsDelete') return res({ metafieldsDelete: { deletedMetafields: [{}], userErrors: [] } });
    if (op === 'ReasonChoices') return res({ metafieldDefinitions: { nodes: [] } });
    return res({});   // verifyCancels وغيره — بيطلّع warning بس، مش محتاجينه هنا
  };
  w.env = { WORKER_SECRET: 's', SHOP_DOMAIN: 'x.myshopify.com', CLIENT_ID: 'a', CLIENT_SECRET: 'b', LOCATION_ID: '1',
    DB: { prepare: sql => ({ bind: (...a) => ({ run: async () => { w.logs.push({ sql, a }); return {}; }, all: async () => ({ results: [] }), first: async () => null }) }) } };
  return w;
}
async function call(w, action, body) {
  const r = await api.__default.fetch(new Request(`https://w/?action=${action}`, { method: 'POST',
    headers: { Authorization: 'Bearer s', Origin: 'https://ecommoda-dev.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), w.env);
  return { status: r.status, json: await r.json() };
}
const firstWrite = calls => calls.findIndex(c => ['MetafieldsSet', 'OrderCancel', 'MetafieldsDelete'].includes(c));
const rowExtra = w => { const l = w.logs.find(x => /INSERT INTO logs/.test(x.sql) && x.a[1] === 'order_status'); return l ? JSON.parse(l.a[12]) : null; };

// 1) Delivered — fulfillment أولًا ثم الحالة، و D1 بعقد التحصيل
{
  const w = makeWorld();
  const { status, json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Delivered', employee: 'ahmed', flow: 'showroom' });
  const row = json.results?.[0];
  ok(status === 200 && row?.status === 'success', `Delivered نجح: ${JSON.stringify(row)}`);
  ok(w.calls.indexOf('FulfillmentCreate') > -1 && w.calls.indexOf('FulfillmentCreate') < firstWrite(w.calls), 'الـ Fulfillment قبل أي كتابة');
  ok(!w.calls.includes('OrderCancel'), 'Delivered مفيهوش إلغاء');
  const mf = w.logs; const ex = rowExtra(w);
  ok(ex?.targetLabel === 'Delivered' && ex?.courier === 'Showroom' && ex?.result === 'success' && ex?.flow === 'showroom', `عقد D1: ${JSON.stringify(ex)}`);
  ok(w.logs.find(x => x.a[1] === 'order_status')?.a[2] === 'update', 'type=update');
}
// 2) Returned — Fulfillment ← orderCancel ← الحالة
{
  const w = makeWorld();
  const { json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Returned', employee: 'ahmed', flow: 'showroom', reasons: { 1: 'x' } });
  const fi = w.calls.indexOf('FulfillmentCreate'), ci = w.calls.indexOf('OrderCancel'), mi = w.calls.indexOf('MetafieldsSet');
  ok(fi > -1 && fi < ci && ci < mi, `ترتيب Returned: ${w.calls.join(' > ')}`);
  ok(json.results?.[0]?.actions?.some(a => a.startsWith('fulfillmentCreate')) && json.results[0].actions.includes('orderCancel'), 'actions فيها fulfillment و orderCancel');
}
// 3) فشل الـ Fulfillment = error وصفر كتابة (Delivered و Returned)
for (const label of ['Delivered', 'Returned']) {
  const w = makeWorld(); w.failFulfill = true;
  const { json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: label, employee: 'ahmed', flow: 'showroom', reasons: { 1: 'x' } });
  ok(json.results?.[0]?.status === 'error', `${label}: فشل fulfillment = error`);
  ok(firstWrite(w.calls) === -1, `${label}: صفر كتابة/إلغاء بعد فشل fulfillment (${w.calls.join(',')})`);
  ok(rowExtra(w)?.result === 'error', `${label}: صف D1 بـ error`);
}
// 4) idempotent: Fulfilled أصلًا ولا FO مفتوح → يتخطّى ويكمّل
{
  const w = makeWorld({ fStatus: 'FULFILLED', fos: [] });
  const { json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Delivered', employee: 'ahmed', flow: 'showroom' });
  ok(json.results?.[0]?.status === 'success' && !w.calls.includes('FulfillmentCreate'), 'Fulfilled أصلًا: يتخطّى ويكتب الحالة');
}
// 5) FO على hold ومش Fulfilled → fail-closed
{
  const w = makeWorld({ fos: [{ id: 'f', status: 'ON_HOLD' }] });
  const { json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Delivered', employee: 'ahmed', flow: 'showroom' });
  ok(json.results?.[0]?.status === 'error' && firstWrite(w.calls) === -1, 'FO غير مفتوح ومش Fulfilled: error بلا كتابة');
}
// 6) أوردر غير مؤهل بيترفض بالسبب، وبدون flow العادي Ready→Delivered لسه ممنوع
for (const [over, rx] of [[{ zone: 'Cairo+Giza' }, /المنطقة/], [{ courier: 'Sobhy' }, /المندوب/], [{ s1: 'Shipped' }, /Ready/], [{ s2: 'Ready' }, /S1 بس/]]) {
  const w = makeWorld(over);
  const { json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Delivered', employee: 'ahmed', flow: 'showroom' });
  ok(json.results?.[0]?.status === 'error' && rx.test(json.results[0].error) && !w.calls.includes('FulfillmentCreate'), `مرفوض: ${JSON.stringify(over)} → ${json.results?.[0]?.error}`);
}
{
  const w = makeWorld();
  const { json } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Delivered', employee: 'ahmed', courier: 'Showroom' });
  ok(json.results?.[0]?.status === 'error' && /انتقال غير مسموح/.test(json.results[0].error), 'بدون flow: Ready→Delivered لسه ممنوع (القواعد العادية ما اتلمستش)');
  ok(!w.calls.includes('FulfillmentCreate'), 'بدون flow: صفر fulfillment');
}
// 7) flow شو روم بحالة غير Delivered/Returned = 400
{
  const w = makeWorld();
  for (const l of ['Shipped', 'Cancelled', 'Ready']) {
    const { status } = await call(w, 'update_status', { orderIds: ['1'], targetLabel: l, employee: 'a', flow: 'showroom' });
    ok(status === 400, `flow=showroom + ${l} = 400`);
  }
}
// 8) المندوب بيتسجّل بقيمة الأوردر الفعلية حتى لو واجهة بعتت غيرها
{
  const w = makeWorld({ courier: 'Show_Room' });
  await call(w, 'update_status', { orderIds: ['1'], targetLabel: 'Delivered', employee: 'a', flow: 'showroom', courier: 'Hacker' });
  ok(rowExtra(w)?.courier === 'Show_Room', 'extra.courier = قيمة الأوردر الفعلية مش اللي الواجهة بعتته');
}
// 9) order_statuses بيرجّع zone
{
  const w = makeWorld();
  const { json } = await call(w, 'order_statuses', { orderIds: ['1'] });
  ok(json.statuses?.['1']?.zone === 'Show_Room', 'order_statuses فيه zone');
}
// 10) search_showroom_orders: الاستعلام والفلترة
{
  const w = makeWorld(); let q = '';
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const b = (init?.body && typeof init.body === 'string') ? JSON.parse(init.body) : {};
    if (b.query?.includes('ShowroomOrders')) {
      q = b.variables.q;
      const n = (id, o) => ({ node: { id: `gid://shopify/Order/${id}`, name: `#${id}`, cancelledAt: null,
        s1: { value: 'Ready' }, s2: o.s2 ? { value: o.s2 } : null, courier: { value: o.courier || 'Showroom' }, zone: { value: o.zone || 'Show_Room' } } });
      return new Response(JSON.stringify({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null },
        edges: [n(1, {}), n(2, { s2: 'Ready' }), n(3, { zone: 'Showroom', courier: 'Show_Room' }), n(4, { courier: 'Sobhy' })] } } }));
    }
    return prev(url, init);
  };
  const { json } = await call(w, 'search_showroom_orders', {});
  ok(json.ok && json.orders.map(o => o.orderId).join() === '1,3', `البحث بيرجّع المؤهل بس: ${json.orders?.map(o => o.orderId)}`);
  ok(/custom\.zone:"Show_Room"/.test(q) && /custom\.courier:"Showroom"/.test(q) && /manual_status:"Ready"/.test(q), `نص الاستعلام: ${q}`);
}
console.log(fail ? `\n❌ ${fail} فشل · ${pass} عدّى` : `✅ ${pass} بند عدّى`);
process.exit(fail ? 1 : 0);
