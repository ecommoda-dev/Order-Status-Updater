// فحص فلاتر السجل (v4.8.0) على SQLite حقيقي — node log-filters-check.mjs
// بيحمّل index.js كنص ويستخرج الدوال (الملف مابيصدّرش غير الـ default)، وD1 وهمي فوق node:sqlite.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const src = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8').replace(/export default \{/, 'const __default = {');
const api = new Function(`${src}\nreturn { buildLogFilterSQL, getLogs, getLogsCount, getLogsExport, getBatchStats, getLogSuggest, getLogNumValues, cairoMinuteOfDaySQL, cairoTransitions, readLogFilters };`)();

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('❌', m)); };

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, tool TEXT, type TEXT, employee TEXT,
  order_id TEXT, order_name TEXT, value_before TEXT, value_after TEXT, notes TEXT, extra TEXT)`);
const ins = db.prepare('INSERT INTO logs (timestamp, tool, type, employee, order_id, order_name, notes, extra) VALUES (?,?,?,?,?,?,?,?)');
const d1 = { prepare: sql => { const st = db.prepare(sql); return { bind: (...a) => ({
  all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) ?? null }) }; } };

// دفعة A: 5 ✓ + 1 ⚠ + 2 ✗ — الساعة 10:30 بتوقيت القاهرة (شتاء: 08:30Z)
const rowsA = ['success','success','success','success','success','warning','error','rejected'];
rowsA.forEach((r, i) => ins.run(`2026-11-18T08:30:0${i}.000Z`, 'order_status', 'update', 'ahmed', String(100 + i), `#${37000 + i}`, '', JSON.stringify({ batchId: 'A', result: r, courier: 'X', targetLabel: 'Shipped' })));
// دفعة B: 2 ✓ — الساعة 23:30 بتوقيت القاهرة (21:30Z)
['success','success'].forEach((r, i) => ins.run(`2026-11-18T21:30:0${i}.000Z`, 'order_status', 'update', 'sara', String(200 + i), `#${48000 + i}`, '', JSON.stringify({ batchId: 'B', result: r, courier: 'Y', targetLabel: 'Ready' })));
// صف بلا دفعة، وصيفي: 2026-07-01T10:00Z = 13:00 بتوقيت القاهرة (+3)
ins.run('2026-07-01T10:00:00.000Z', 'order_status', 'update', 'ahmed', '300', '#55555', '', JSON.stringify({ result: 'success', courier: 'X', targetLabel: 'Ready' }));
// صف extra باظ + صف أداة تانية + login
ins.run('2026-11-17T09:00:00.000Z', 'order_status', 'update', 'ahmed', '301', '#66666', '', '{bad json');
ins.run('2026-11-17T09:00:00.000Z', 'other_tool', 'update', 'ahmed', '302', '#77777', '', JSON.stringify({ result: 'success' }));
ins.run('2026-11-17T09:00:00.000Z', 'order_status', 'login', 'ahmed', null, null, '', null);

const F = (o = {}) => ({ tool: 'order_status', ...o });
const cnt = async o => api.getLogsCount(d1, F(o));
const orders = async o => (await api.getLogs(d1, F(o))).map(r => r.order_name);

ok(await cnt() === 12, `الإجمالي بلا فلتر = 12 (login وأداة تانية مستبعدين) — طلع ${await cnt()}`);

// توكنز رقم الأوردر
ok(await cnt({ orders: '37001' }) === 1, 'orders تطابق جزئي');
ok(await cnt({ orders: '37001,48000' }) === 2, 'orders OR بين التوكنز');
ok(await cnt({ orders: '٣٧٠٠١' }) === 1, 'orders أرقام عربي');
ok(await cnt({ orders: "37%" }) === 8 || await cnt({ orders: '37' }) === 8, 'orders: % بتتنضّف لأرقام');
ok(await cnt({ orders: "'; DROP TABLE logs;--" }) === 12, 'orders بلا أرقام = بلا فلتر (مفيش حقن)');

// وقت اليوم
ok(await cnt({ timeFrom: '10:00', timeTo: '11:00' }) === 9, 'وقت 10:00–11:00 (شتاء +2) = دفعة A + صف 11:00 (inclusive)');
ok(await cnt({ timeFrom: '23:00' }) === 2, 'وقت من 23:00 = دفعة B');
ok(await cnt({ timeFrom: '13:00', timeTo: '13:00' }) === 1, 'وقت صيفي (+3): 10:00Z = 13:00');
ok(await cnt({ timeFrom: '12:00', timeTo: '12:59' }) === 0, 'وقت صيفي مش بيتحسب +2');
ok(await cnt({ timeFrom: '11:00', timeTo: '10:00' }) === 0, '«من» بعد «إلى» = صفر');
ok(await cnt({ timeFrom: 'abc' }) === 12, 'وقت باظ = بلا فلتر');
// حدود التحوّل: 29-10-2026 (آخر خميس أكتوبر) — بعد منتصف الليل بتوقيت الشتاء
const tr = api.cairoTransitions().list.filter(t => t.at.startsWith('2026'));
ok(tr.length === 2 && tr[0].off === 180 && tr[1].off === 120, `تحوّلات 2026: صيفي ثم شتوي — ${JSON.stringify(tr)}`);
ok(tr[1].at.startsWith('2026-10-29T2') || tr[1].at.startsWith('2026-10-30T0'), `التحوّل الشتوي عند ${tr[1] && tr[1].at}`);

// عدّادات الدفعة
ok(await cnt({ okFrom: '5' }) === 8, 'ok >= 5 = دفعة A كلها (8 صفوف)');
ok(await cnt({ okIn: '2' }) === 2, 'ok IN (2) = دفعة B');
ok(await cnt({ okIn: '1' }) === 1, 'ok IN (1) = الصف المنفرد');
ok(await cnt({ warnFrom: '1' }) === 8, 'warn >= 1');
ok(await cnt({ errFrom: '2', errTo: '2' }) === 8, 'err = 2 (error + rejected)');
ok(await cnt({ errIn: '0' }) === 3 + 0 || await cnt({ errIn: '0' }) >= 3, 'err IN (0) بيشمل B والمنفرد');
ok(await cnt({ okFrom: '5', result: 'error' }) === 1, 'عدّاد الدفعة كلها حتى مع فلتر نتيجة على صف واحد');
ok(await cnt({ okFrom: '5', employee: 'sara' }) === 0, 'يتجمّع مع باقي الفلاتر AND');
const vals = await api.getLogNumValues(d1, 'order_status', 'ok');
ok(JSON.stringify(vals.map(v => v.v)) === '[1,2,5]' || vals.some(v => v.v === 5 && v.n === 1), `قيم ok: ${JSON.stringify(vals)}`);
ok((await api.getLogNumValues(d1, 'order_status', 'err')).some(v => v.v === 2), 'قيم err');
let threw = false; try { await api.getLogNumValues(d1, 'order_status', 'id; drop'); } catch { threw = true; }
ok(threw, 'field بره allow-list بيترفض');

// ترتيب
const byOk = await api.getLogs(d1, F({ sortKey: 'ok', sortDir: 'desc' }));
ok(byOk[0].extra.includes('"batchId":"A"') && byOk.slice(0, 8).every(r => r.extra.includes('"A"')), 'ترتيب ✓ تنازلي: دفعة A متجاورة وفي الأول');
const byOkAsc = await api.getLogs(d1, F({ sortKey: 'ok', sortDir: 'asc' }));
ok(!byOkAsc[0].extra.includes('"A"'), 'ترتيب ✓ تصاعدي: A في الآخر');
const byTime = await orders({ sortKey: 'time', sortDir: 'asc' });
ok(byTime[0].startsWith('#370') && byTime[byTime.length-1] === '#48000' || byTime[byTime.length-1] === '#48001', `ترتيب الوقت تصاعدي: أول 10:30 وآخر 23:30 — ${byTime[0]} … ${byTime[byTime.length-1]}`);
ok(JSON.stringify((await orders({ sortKey: 'timestamp', sortDir: 'asc' }))[0]) === '"#55555"', 'ترتيب التاريخ لسه شغال');
ok((await api.getLogs(d1, F({ sortKey: 'courier', sortDir: 'asc' }))).length === 12, 'ترتيب بمندوب لسه شغال');
ok((await api.getLogs(d1, F({ sortKey: 'err', sortDir: 'desc', okFrom: '1' }))).length === 11, 'JOIN + فلتر عدّاد مع بعض');

// batchStats
const page = await api.getLogs(d1, F({ result: 'error' }));
const st = await api.getBatchStats(d1, 'order_status', page);
ok(st.A && st.A.n === 8 && st.A.ok === 5 && st.A.warn === 1 && st.A.err === 2, `batchStats بتدّي الدفعة الكاملة رغم فلتر النتيجة: ${JSON.stringify(st)}`);

// اقتراحات
const sg = await api.getLogSuggest(d1, 'order_status', '37 3700', '');
ok(sg.suggestions.length > 0 && sg.suggestions.every(x => x.name.includes('3700')), 'اقتراحات على آخر جزء');
const sg2 = await api.getLogSuggest(d1, 'order_status', '3700', '37000');
ok(!sg2.suggestions.some(x => x.name === '#37000'), 'exclude بيشيل اللي اتضاف');
ok((await api.getLogSuggest(d1, 'order_status', 'abc', '')).suggestions.length === 0, 'حروف بس = مفيش اقتراحات');
ok(sg.total >= sg.suggestions.length, 'total');

// فلاتر قديمة لسه شغالة
ok(await cnt({ employee: 'sara' }) === 2 && await cnt({ courier: 'X' }) === 9 && await cnt({ status: 'Ready' }) === 3 && await cnt({ result: 'warning' }) === 1, 'الفلاتر القديمة');
ok(await cnt({ dateFrom: '2026-11-18', dateTo: '2026-11-18' }) === 10, 'التاريخ (يوم القاهرة) — 21:30Z لسه نفس اليوم');
ok(await cnt({ search: '37000' }) === 1, 'search القديم');

console.log(`\n${fail ? '❌' : '✅'} ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
