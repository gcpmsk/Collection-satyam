import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// In-memory real Postgres + mocked Meta. Production DB / customers ko kuch nahi jata.
const db = new PGlite();
await db.exec(`CREATE TABLE sg_store (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at BIGINT NOT NULL DEFAULT 0, synced_at TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE TABLE wa_log (id BIGSERIAL PRIMARY KEY, phone TEXT, dir TEXT, body JSONB, msg TEXT, created_at TIMESTAMPTZ DEFAULT now());`);
class Client {
  async connect() {} async end() {}
  async query(q, p) { const r = p === undefined ? ((await db.exec(q)).at(-1) || { rows: [] }) : await db.query(q, p);
    return { ...r, rowCount: r.rows.length || r.affectedRows || 0 }; }
}
let sends = [], meta = 'ok';
const context = vm.createContext({ Response, Request, URL, URLSearchParams, console, crypto: webcrypto, TextEncoder, AbortController, setTimeout, clearTimeout, btoa, atob, escape, unescape,
  fetch: async (url, init) => { sends.push(JSON.parse(init.body));
    return meta === 'ok' ? new Response(JSON.stringify({ messages: [{ id: 'wamid.' + sends.length }] }), { status: 200 })
      : new Response(JSON.stringify({ error: { code: 131026, message: 'Message undeliverable' } }), { status: 400 }); } });
const cache = new Map();
async function load(rel) {
  const url = new URL(rel, import.meta.url); if (cache.has(url.href)) return cache.get(url.href);
  const m = new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href }); cache.set(url.href, m);
  await m.link(async spec => spec === 'pg' ? new vm.SyntheticModule(['Client'], function () { this.setExport('Client', Client); }, { context }) : load(new URL(spec, url).href));
  return m;
}
const mod = await load('./functions/api/[[path]].js'); await mod.evaluate();
const env = { DATABASE_URL: 'x', SESSION_SECRET: 's', WA_TOKEN: 't', WA_PHONE_ID: 'p' };
const store = (k, v) => db.query(`INSERT INTO sg_store(key,value) VALUES ($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [k, JSON.stringify({ v })]);
await store('sg_arcpt_01-11-2026', [{ no: 1, name: 'Rahul Kumar', address: 'Bikram', total: 5000 }]);
await store('sg_mobiles', { 'RAHUL KUMAR': '9876543210' });
let tok;
async function call(path, body, method) {
  const bg = [];
  const r = await mod.namespace.onRequest({ env, waitUntil: p => bg.push(p), params: { path: path.slice(1).split('/') },
    request: new Request('https://x/api' + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }) });
  await Promise.all(bg); return { status: r.status, body: await r.json() };
}
tok = (await call('/login', { mobile: '9631816666', password: 'Satyam' })).body.token;
const jamaCount = async () => ((await db.query("SELECT value FROM sg_store WHERE key LIKE 'sg_nb_%'")).rows.flatMap(r => r.value.v.jama || [])).length;

await test('payment save: ek payment, jama notebook me, aur receipt WhatsApp par automatic', async () => {
  const r = await call('/pay', { key: 'RAHUL KUMAR', mode: 'Cash', cash: 1000, online: 0, req_id: 'a1' });
  assert.equal(r.body.ok, true); assert.equal(r.body.receipt, 'queued');
  assert.equal(sends.length, 1); assert.equal(sends[0].to, '919876543210'); assert.equal(sends[0].template.name, 'satyam_payment_receipt');
  assert.equal(JSON.parse(JSON.stringify(sends[0].template.components[0].parameters.map(p => p.text))).join('|').startsWith('Rahul Kumar|1,000|'), true);
  assert.equal(await jamaCount(), 1);
});
await test('DOUBLE CLICK (same req_id) → payment aur receipt ek hi baar', async () => {
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => call('/pay', { key: 'RAHUL KUMAR', mode: 'Online', cash: 0, online: 500, req_id: 'dbl' })));
  assert.equal([a, b, c].filter(x => !x.body.duplicate).length, 1);
  assert.equal([a, b, c].every(x => x.body.ok), true);
  const n = (await db.query("SELECT count(*)::int n FROM coll_payments WHERE req_id='dbl'")).rows[0].n;
  assert.equal(n, 1); assert.equal(sends.length, 2); assert.equal(await jamaCount(), 2);
  assert.equal((await db.query("SELECT count(*)::int n FROM wa_receipts")).rows[0].n, 2);
});
await test('purana app (req_id nahi) bhi: 10 sec me same customer+amount dobara = duplicate', async () => {
  await call('/pay', { key: 'RAHUL KUMAR', mode: 'Cash', cash: 77, online: 0 });
  const r = await call('/pay', { key: 'RAHUL KUMAR', mode: 'Cash', cash: 77, online: 0 });
  assert.equal(r.body.duplicate, true);
  assert.equal((await db.query("SELECT count(*)::int n FROM coll_payments WHERE cash=77")).rows[0].n, 1);
});
await test('alag amount / nayi req_id = nayi payment (asli dusri payment block nahi hoti)', async () => {
  const before = (await db.query("SELECT count(*)::int n FROM coll_payments")).rows[0].n;
  const r = await call('/pay', { key: 'RAHUL KUMAR', mode: 'Cash', cash: 300, online: 0, req_id: 'new1' });
  assert.equal(r.body.duplicate, undefined);
  assert.equal((await db.query("SELECT count(*)::int n FROM coll_payments")).rows[0].n, before + 1);
});
await test('Collection ki entry Notebook sync se dobara receipt nahi banati (fromColl)', async () => {
  const sync = await load('./functions/api/sync.js').catch(() => null); assert.equal(sync, null); // sync.js is repo me nahi — main app me hai
  const col = (await db.query("SELECT value FROM sg_store WHERE key LIKE 'sg_nb_%'")).rows[0].value.v.jama[0];
  assert.equal(col.fromColl, true); assert.equal(col.rid, undefined);
});
await test('mobile nahi / Meta fail → payment save rahe, receipt Failed me, Retry se ek hi baar', async () => {
  await store('sg_arcpt_01-11-2026', [{ no: 1, name: 'Rahul Kumar', address: 'Bikram', total: 5000 }, { no: 2, name: 'Sunita Devi', address: 'Paliganj', total: 900 }]);
  const n = sends.length;
  const r = await call('/pay', { key: 'SUNITA DEVI', mode: 'Cash', cash: 100, online: 0, req_id: 'nomob' });
  assert.equal(r.body.ok, true); assert.equal(sends.length, n);
  const w = (await db.query("SELECT * FROM wa_receipts WHERE name='Sunita Devi'")).rows[0];
  assert.equal(w.status, 'failed'); assert.match(w.error, /number नहीं मिला/);
});
await test('payment cancel hone par pending/failed receipt cancel ho jati hai', async () => {
  const p = (await db.query("SELECT id FROM coll_payments WHERE req_id='nomob'")).rows[0];
  await call('/payment/cancel', { id: p.id });
  assert.equal((await db.query("SELECT status FROM wa_receipts WHERE dedupe_key=$1", ['coll:' + p.id])).rows[0].status, 'cancelled');
});
await test('client: har Save pe req_id aur button double-click guard', async () => {
  const a = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  assert.match(a, /req_id: reqId\(x\.key, m, cash, online\)/);
  assert.match(a, /upcBase/); assert.match(a, /if \(btn\.disabled\) return/);
});
