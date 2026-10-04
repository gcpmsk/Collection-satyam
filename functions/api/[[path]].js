/* =====================================================================
   SATYAM GOLD — COLLECTION APP API  (Cloudflare Pages Function)
   सारे routes: /api/*
   Env (Cloudflare → Pages → Settings → Variables and Secrets):
     DATABASE_URL   postgresql://postgres:PASSWORD@HOST:5432/postgres   (main app वाला same)
     ADMIN_MOBILE   9631816666   (optional, default यही)
     ADMIN_PASS     Satyam       (optional, default यही — बदल लें)
     SESSION_SECRET कोई भी लंबा random text (ज़रूरी — login token sign होता है)
   ===================================================================== */
import { Client } from 'pg';

const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const ok = (o = {}) => new Response(JSON.stringify({ ok: true, ...o }), { headers: H });
const bad = (msg, status = 400) => new Response(JSON.stringify({ ok: false, error: String(msg) }), { status, headers: H });

/* ---------------- helpers ---------------- */
const N = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const K = s => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const pad = n => String(n).padStart(2, '0');
function ist(d = new Date()) { return new Date(d.getTime() + 330 * 60000); }       // IST wall-clock in UTC fields
function istDate(d) { const x = ist(d); return `${pad(x.getUTCDate())}-${pad(x.getUTCMonth() + 1)}-${x.getUTCFullYear()}`; }
function istTS(d) { const x = ist(d); let h = x.getUTCHours(); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${pad(h)}:${pad(x.getUTCMinutes())} ${ap}`; }
function dv(d) { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d || ''); return m ? (+m[3]) * 10000 + (+m[2]) * 100 + (+m[1]) : 0; }
function isoToDMY(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : (/^\d{2}-\d{2}-\d{4}$/.test(s || '') ? s : ''); }
/* IST midnight (next) as epoch ms */
function nextMidnightIST() { const x = ist(); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() + 1) - 330 * 60000; }
function todayAtIST(hhmm) { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); if (!m) return null; const x = ist();
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), +m[1], +m[2]) - 330 * 60000; }

const AREAS = [
  { code: 'BKP', pat: /बिक्रम|bikram/i }, { code: 'PLG', pat: /पालीगंज|paliganj/i },
  { code: 'NBT', pat: /नौबतपुर|naubatpur/i }, { code: 'DLM', pat: /दुल्हिन|dulhin/i },
  { code: 'KJR', pat: /कंचनपुर|kanchan/i }, { code: 'PTN', pat: /पटना|patna/i }
];
function areaOf(addr) { const s = String(addr || '').trim(); if (!s) return 'OTHER';
  for (const a of AREAS) if (a.pat.test(s)) return a.code; return s.split(/[\s,]+/)[0].toUpperCase().slice(0, 10); }

/* ---------------- token (HMAC) ---------------- */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(enc.encode(s));
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
async function hkey(env) {
  const secret = env.SESSION_SECRET || ('sg-coll::' + (env.DATABASE_URL || 'x'));
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(env, payload) {
  const body = b64uStr(unescape(encodeURIComponent(JSON.stringify(payload))));
  const sig = await crypto.subtle.sign('HMAC', await hkey(env), enc.encode(body));
  return body + '.' + b64u(sig);
}
async function verify(env, tok) {
  const [body, sig] = String(tok || '').split('.'); if (!body || !sig) return null;
  const exp = b64u(await crypto.subtle.sign('HMAC', await hkey(env), enc.encode(body)));
  if (exp !== sig) return null;
  try { const p = JSON.parse(unb64u(body)); if (!p.exp || p.exp < Date.now()) return null; return p; } catch (_) { return null; }
}

/* ---------------- DB ---------------- */
async function db(env) {
  const url = env.DATABASE_URL || env.POSTGRES_URL || env.PG_URL;
  if (!url) throw new Error('DATABASE_URL environment variable set नहीं है');
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect(); return c;
}
const DDL = `
CREATE TABLE IF NOT EXISTS sg_store (key TEXT PRIMARY KEY, value JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())*1000)::BIGINT, synced_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS coll_agents (id SERIAL PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL,
  areas JSONB NOT NULL DEFAULT '["ALL"]', logout_time TEXT NOT NULL DEFAULT '23:59', otp TEXT, otp_expires TIMESTAMPTZ,
  gen INT NOT NULL DEFAULT 1, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS coll_payments (id BIGSERIAL PRIMARY KEY, pdate TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ts TEXT, cust_key TEXT NOT NULL, name TEXT NOT NULL, address TEXT, area TEXT, cash NUMERIC NOT NULL DEFAULT 0,
  online NUMERIC NOT NULL DEFAULT 0, mode TEXT NOT NULL, agent_id INT, agent_name TEXT, agent_short TEXT,
  source TEXT NOT NULL DEFAULT 'coll', nb_seen BOOLEAN NOT NULL DEFAULT false, cancelled BOOLEAN NOT NULL DEFAULT false);
CREATE INDEX IF NOT EXISTS coll_payments_date_idx ON coll_payments (pdate);
CREATE TABLE IF NOT EXISTS coll_orders (id BIGSERIAL PRIMARY KEY, odate TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cust_key TEXT NOT NULL, name TEXT, address TEXT, items JSONB NOT NULL, ord_id TEXT, ord_no TEXT,
  agent_id INT, agent_name TEXT, agent_short TEXT, ob_seen BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS coll_visits (id BIGSERIAL PRIMARY KEY, vdate TEXT NOT NULL, cust_key TEXT NOT NULL, area TEXT,
  agent_id INT, agent_name TEXT, kind TEXT NOT NULL DEFAULT 'profile', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vdate, cust_key, agent_id, kind));
`;
let ddlDone = false;
async function ensure(c) { if (!ddlDone) { await c.query(DDL); ddlDone = true; } }

async function getKey(c, key) { const r = await c.query('SELECT value FROM sg_store WHERE key=$1', [key]);
  const v = r.rows[0]?.value; return v && !v.__deleted ? v.v : null; }
async function putKey(c, key, val) {
  await c.query(`INSERT INTO sg_store (key,value,updated_at) VALUES ($1,$2::jsonb,$3)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=GREATEST(sg_store.updated_at+1,EXCLUDED.updated_at), synced_at=now()`,
    [key, JSON.stringify({ v: val }), Date.now()]);
}

/* ---------------- ledger (main app tally.js का debtor हिस्सा) ---------------- */
async function buildLedger(c) {
  const r = await c.query(`SELECT key, value FROM sg_store WHERE (key LIKE 'sg_arcpt_%' OR key LIKE 'sg_nb_%' OR key LIKE 'sg_tvup_%'
     OR key IN ('sg_tv_manual','sg_mobiles','sg_rates')) AND NOT COALESCE((value->>'__deleted')::boolean,false)`);
  const deb = {}; let mobiles = {}, rates = {};
  const C = (name, addr) => { const key = K(name); if (!key) return null;
    if (!deb[key]) deb[key] = { key, name: String(name).trim(), address: addr || '', due: [], paid: [] };
    if (addr && !deb[key].address) deb[key].address = addr; return deb[key]; };
  const rows = r.rows.map(x => ({ key: x.key, v: x.value?.v }));
  for (const { key, v } of rows) {
    if (key === 'sg_mobiles') mobiles = v || {};
    else if (key === 'sg_rates') rates = v || {};
  }
  for (const { key, v } of rows) {
    if (key.startsWith('sg_arcpt_') && Array.isArray(v)) {
      const d = key.slice(9);
      v.forEach(x => { const nm = x?.name || x?.nameHi; if (!nm) return; const o = C(nm, x.address || x.addressHi); if (!o) return;
        const amt = (x.tvAmt !== undefined && x.tvAmt !== null) ? N(x.tvAmt) : N(x.total);
        o.due.push({ date: d, amt, cut: !!x.cancelled || !!x.tvCut, label: 'Receipt #' + (x.no || '-'),
          items: (x.items || []).map(i => `${i.name} ${i.qty}`).join(', ') }); });
    } else if (key.startsWith('sg_nb_') && v && Array.isArray(v.jama)) {
      const d = key.slice(6);
      v.jama.forEach(j => { if (!j?.name) return; const o = C(j.name, j.address); if (!o) return;
        o.paid.push({ date: d, amt: N(j.amount), cut: !!j.cut, ts: j.ts || '',
          mode: j.collMode || (N(j.online) > 0 ? (N(j.online) < N(j.amount) ? 'Mix' : 'Online') : 'Cash'), by: j.collBy || '' }); });
    } else if (key === 'sg_tv_manual' && Array.isArray(v)) {
      v.forEach(p => { if (p?.kind !== 'deb') return; const o = C(p.name, p.address); if (!o) return;
        if (N(p.due) > 0) o.due.push({ date: p.date || istDate(), amt: N(p.due), cut: !!p.tvCut, label: p.note || 'Opening / Manual' });
        if (N(p.paid) > 0) o.paid.push({ date: p.date || istDate(), amt: N(p.paid), cut: false, mode: p.mode || 'Cash' }); });
    } else if (key.startsWith('sg_tvup_') && v && v.kind === 'deb') {
      const o = C(v.name, v.address); if (!o) continue;
      if (N(v.due) > 0) o.due.push({ date: v.date || istDate(), amt: N(v.due), cut: !!v.tvCut, label: v.note || 'PDF Upload' });
      if (N(v.paid) > 0) o.paid.push({ date: v.date || istDate(), amt: N(v.paid), cut: false, mode: 'PDF' });
    }
  }
  const list = Object.values(deb).map(o => {
    o.dueT = o.due.filter(x => !x.cut).reduce((a, x) => a + x.amt, 0);
    o.paidT = o.paid.filter(x => !x.cut).reduce((a, x) => a + x.amt, 0);
    o.bal = o.dueT - o.paidT; o.area = areaOf(o.address); o.mobile = mobiles[o.key] || '';
    return o;
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { list, map: deb, rates };
}

/* ---------------- rates (setrate.js) ---------------- */
const RATE_ITEMS = [
  { k: 'gold', t: 'Atta Gold (23kg)' }, { k: 'a5', t: 'Atta 5kg' }, { k: 'a10', t: 'Atta 10kg' }, { k: 'a18', t: 'Atta 18kg' },
  { k: 'besan', t: 'Besan 1kg' }, { k: 'sattu', t: 'Sattu 1kg' }, { k: 'chokar', t: 'Chokar' }
];
function rateOf(R, key, area, k) {
  R = R || {}; const m = N((R.master || {})[k]);
  let base = m;
  const adj = ((R.areaAdj || {})[area] || {})[k];
  const abs = ((R.area || {})[area] || {})[k];
  if (adj !== undefined && adj !== '' && adj !== null) base = Math.max(0, m + N(adj));
  else if (abs !== undefined && abs !== '' && abs !== null) base = N(abs);
  const sp = ((R.cust || {})[key] || {})[k];
  if (sp !== undefined && sp !== '' && sp !== null) return Math.max(0, base - N(sp));
  return base;
}

/* FIFO — कौन सी तारीख़ का कितना बाक़ी */
function fifo(o) {
  const bills = o.due.filter(x => !x.cut).map(x => ({ ...x })).sort((a, b) => dv(a.date) - dv(b.date));
  let pool = o.paidT;
  for (const b of bills) { const use = Math.min(pool, b.amt); b.left = +(b.amt - use).toFixed(2); pool -= use; }
  return { open: bills.filter(b => b.left > 0.009), advance: pool > 0.009 ? +pool.toFixed(2) : 0 };
}

/* ---------------- notebook / order book sync (self-healing) ---------------- */
const NB_EMPTY = () => ({ opening: null, rokad: [], jama: [], maal: [], nagad: [], kharch: [], inhome: [], outhome: [], receipts: [], totals: null });
async function pushJama(c, p) {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['sg_nb_' + p.pdate]);
  const key = 'sg_nb_' + p.pdate;
  const nb = (await c.query('SELECT value FROM sg_store WHERE key=$1 FOR UPDATE', [key])).rows[0]?.value?.v || NB_EMPTY();
  if (!Array.isArray(nb.jama)) nb.jama = [];
  if (nb.jama.some(j => String(j.collId) === String(p.id))) return true;
  const total = N(p.cash) + N(p.online);
  nb.jama.push({ name: p.name, address: p.address || '', amount: total, online: N(p.online), item: `Collection (${p.agent_short || 'Owner'})`,
    ts: p.ts, cut: false, fromColl: true, collId: String(p.id), collBy: p.agent_name || 'Owner', collMode: p.mode });
  await putKey(c, key, nb); return false;
}
async function pushOrder(c, o) {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['wa:orders']);
  const key = 'sg_ord_' + o.odate;
  const cur = (await c.query('SELECT value FROM sg_store WHERE key=$1 FOR UPDATE', [key])).rows[0]?.value?.v || [];
  const list = Array.isArray(cur) ? cur : [];
  if (list.some(x => x.collId === String(o.id))) return true;
  let no = o.ord_no;
  if (!no) {
    const mx = (await c.query(`SELECT COALESCE(max((x->>'no')::INT),0) AS m FROM sg_store s,
      jsonb_array_elements(CASE WHEN jsonb_typeof(s.value->'v')='array' THEN s.value->'v' ELSE '[]'::jsonb END) x
      WHERE s.key LIKE 'sg_ord_%' AND (x->>'no') ~ '^\\d+$'`)).rows[0].m;
    no = String(mx + 1).padStart(2, '0');
    await c.query('UPDATE coll_orders SET ord_no=$1, ord_id=$2 WHERE id=$3', [no, 'c' + o.id, o.id]);
    o.ord_no = no;
  }
  list.push({ id: 'c' + o.id, no, ts: istTS(new Date(o.created_at || Date.now())), date: o.odate, name: o.name, address: o.address || '',
    src: 'coll', coll: o.agent_short || 'Owner', collBy: o.agent_name || 'Owner', collId: String(o.id),
    items: o.items.map(i => ({ name: i.name, qty: N(i.qty), rate: i.rate ? String(i.rate) : '', note: i.note || '' })),
    ordered: o.items.map(i => ({ name: i.name, qty: N(i.qty) })), deliv: [] });
  await putKey(c, key, list); return false;
}
/* main app ने sync race में entry overwrite कर दी हो तो वापस डालो — एक बार दिख गई तो फिर कभी नहीं (owner delete करे तो वापस न आए) */
async function heal(c) {
  const ps = (await c.query(`SELECT * FROM coll_payments WHERE NOT nb_seen AND NOT cancelled AND created_at > now() - interval '3 days' ORDER BY id LIMIT 50`)).rows;
  for (const p of ps) {
    await c.query('BEGIN');
    try { const seen = await pushJama(c, p); if (seen && Date.now() - new Date(p.created_at).getTime() > 600000) await c.query('UPDATE coll_payments SET nb_seen=true WHERE id=$1', [p.id]); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); }
  }
  const os = (await c.query(`SELECT * FROM coll_orders WHERE NOT ob_seen AND created_at > now() - interval '3 days' ORDER BY id LIMIT 50`)).rows;
  for (const o of os) {
    await c.query('BEGIN');
    try { const seen = await pushOrder(c, o); if (seen && Date.now() - new Date(o.created_at).getTime() > 600000) await c.query('UPDATE coll_orders SET ob_seen=true WHERE id=$1', [o.id]); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); }
  }
}

/* ---------------- order items ---------------- */
const ORDER_ITEMS = {
  a5: { name: 'Atta 5kg', rk: 'a5' }, a10: { name: 'Atta 10kg', rk: 'a10' }, a18: { name: 'Atta 18kg', rk: 'a18' },
  a23: { name: 'Atta Gold', rk: 'gold' }, a48: { name: 'Atta 48kg', rk: '' },
  s500: { name: 'Sattu 500g', rk: '' }, s200: { name: 'Sattu 200g', rk: '' },
  b500: { name: 'Besan 500g', rk: '' }, b200: { name: 'Besan 200g', rk: '' }
};

/* ---------------- auth ---------------- */
async function auth(request, env, c) {
  const h = request.headers.get('Authorization') || ''; const p = await verify(env, h.replace(/^Bearer\s+/i, ''));
  if (!p) return null;
  if (p.role === 'admin') return p;
  if (p.role === 'agent') {
    const a = (await c.query('SELECT * FROM coll_agents WHERE id=$1', [p.aid])).rows[0];
    if (!a || !a.active || a.gen !== p.gen || p.day !== istDate()) return null;
    p.areas = a.areas || []; p.name = a.name; p.short = a.short_name; return p;
  }
  return null;
}
const canArea = (u, area) => u.role === 'admin' || (u.areas || []).includes('ALL') || (u.areas || []).includes(area);

/* ===================================================================== */
export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const path = '/' + [].concat(params.path || []).join('/');
  const method = request.method;
  const url = new URL(request.url);
  const q = k => url.searchParams.get(k) || '';
  let body = {};
  if (method === 'POST') { try { body = await request.json(); } catch (_) { body = {}; } }
  let c;
  try {
    if (path === '/health') { c = await db(env); await ensure(c); return ok({ db: true, now: istDate() + ' ' + istTS() }); }
    c = await db(env); await ensure(c);

    /* ---------- LOGIN ---------- */
    if (path === '/login' && method === 'POST') {
      if (body.otp) {
        const otp = String(body.otp).replace(/\D/g, '');
        const a = (await c.query(`UPDATE coll_agents SET otp=NULL, otp_expires=NULL, gen=gen+1
            WHERE otp=$1 AND otp_expires > now() AND active RETURNING *`, [otp])).rows[0];
        if (!a) return bad('OTP गलत है या 2 मिनट की validity ख़त्म — Owner से नया OTP लें', 401);
        const mid = nextMidnightIST(); const lt = todayAtIST(a.logout_time);
        const exp = lt && lt > Date.now() ? Math.min(lt, mid) : mid;
        const tok = await sign(env, { role: 'agent', aid: a.id, gen: a.gen, day: istDate(), exp });
        return ok({ token: tok, user: { role: 'agent', name: a.name, short: a.short_name, areas: a.areas, exp } });
      }
      const mob = String(body.mobile || '').replace(/\D/g, '').slice(-10);
      if (mob === String(env.ADMIN_MOBILE || '9631816666') && String(body.password || '') === String(env.ADMIN_PASS || 'Satyam')) {
        const exp = Date.now() + 30 * 864e5;
        return ok({ token: await sign(env, { role: 'admin', exp }), user: { role: 'admin', name: 'Owner', exp } });
      }
      return bad('गलत मोबाइल नंबर या पासवर्ड!', 401);
    }

    const u = await auth(request, env, c);
    if (!u) return bad('Login expire — दोबारा login करें', 401);
    const today = istDate();
    const me = { role: u.role, name: u.role === 'admin' ? 'Owner' : u.name, short: u.short || '', areas: u.areas || ['ALL'], exp: u.exp };

    if (path === '/me') return ok({ user: me, today });

    /* ---------- CUSTOMERS ---------- */
    if (path === '/customers') {
      await heal(c);
      const L = await buildLedger(c);
      const allAreas = [...new Set(L.list.map(o => o.area))].sort();
      const areas = allAreas.filter(a => canArea(u, a));
      const area = q('area');
      let list = L.list.filter(o => canArea(u, o.area));
      if (area && area !== 'ALL') list = list.filter(o => o.area === area);
      if (area && u.role === 'agent') await c.query(`INSERT INTO coll_visits (vdate,cust_key,area,agent_id,agent_name,kind)
        VALUES ($1,$2,$3,$4,$5,'area') ON CONFLICT DO NOTHING`, [today, '__AREA__' + area, area, u.aid, u.name]);
      return ok({ areas, customers: list.map(o => ({ key: o.key, name: o.name, address: o.address, area: o.area, due: +o.bal.toFixed(2), mobile: o.mobile })) });
    }
    if (path === '/customer') {
      const L = await buildLedger(c); const o = L.map[K(q('key'))];
      if (!o || !canArea(u, o.area)) return bad('Customer नहीं मिला', 404);
      if (u.role === 'agent') await c.query(`INSERT INTO coll_visits (vdate,cust_key,area,agent_id,agent_name,kind)
        VALUES ($1,$2,$3,$4,$5,'profile') ON CONFLICT DO NOTHING`, [today, o.key, o.area, u.aid, u.name]);
      const F = fifo(o);
      const rates = RATE_ITEMS.map(it => ({ t: it.t, k: it.k, rate: rateOf(L.rates, o.key, o.area, it.k) })).filter(x => x.rate > 0);
      const entries = o.due.map(x => ({ ...x, kind: 'due' })).concat(o.paid.map(x => ({ ...x, kind: 'paid' })))
        .sort((a, b) => dv(a.date) - dv(b.date));
      return ok({ customer: { key: o.key, name: o.name, address: o.address, area: o.area, mobile: o.mobile,
        dueT: o.dueT, paidT: o.paidT, bal: +o.bal.toFixed(2), open: F.open, advance: F.advance,
        rates, entries: u.role === 'admin' ? entries : [] } });
    }

    /* ---------- PAYMENT ---------- */
    if (path === '/pay' && method === 'POST') {
      const L = await buildLedger(c); const o = L.map[K(body.key)];
      if (!o || !canArea(u, o.area)) return bad('Customer नहीं मिला', 404);
      const mode = String(body.mode || '');
      if (!['Cash', 'Online', 'Mix'].includes(mode)) return bad('Payment mode चुनें');
      let cash = N(body.cash), online = N(body.online);
      if (mode === 'Cash') online = 0; if (mode === 'Online') cash = 0;
      if (cash < 0 || online < 0 || cash + online <= 0) return bad('Amount भरें');
      let pdate = today, source = 'coll';
      if (body.date) { if (u.role !== 'admin') return bad('Back-date सिर्फ़ Owner कर सकते हैं', 403);
        pdate = isoToDMY(body.date); if (!pdate) return bad('Date गलत है'); source = 'upc'; }
      await c.query('BEGIN');
      const p = (await c.query(`INSERT INTO coll_payments (pdate,ts,cust_key,name,address,area,cash,online,mode,agent_id,agent_name,agent_short,source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [pdate, istTS(), o.key, o.name, o.address, o.area, cash, online, mode, u.aid || null,
         u.role === 'admin' ? 'Owner' : u.name, u.role === 'admin' ? 'OWN' : u.short, source])).rows[0];
      await pushJama(c, p);
      await c.query('COMMIT');
      return ok({ payment: p, newBal: +(o.bal - cash - online).toFixed(2) });
    }

    /* ---------- ORDER ---------- */
    if (path === '/order' && method === 'POST') {
      const L = await buildLedger(c); const o = L.map[K(body.key)];
      if (!o || !canArea(u, o.area)) return bad('Customer नहीं मिला', 404);
      const items = (Array.isArray(body.items) ? body.items : []).map(i => {
        const def = ORDER_ITEMS[i.item]; const qty = N(i.qty); if (!def || qty <= 0) return null;
        const unit = i.unit === 'bora' ? 'बोरा' : 'थैला';
        const rate = def.rk ? rateOf(L.rates, o.key, o.area, def.rk) : 0;
        return { name: def.name, qty, unit, rate: rate || '', note: `${qty} ${unit}` };
      }).filter(Boolean);
      if (!items.length) return bad('कम से कम एक item और quantity भरें');
      await c.query('BEGIN');
      const r = (await c.query(`INSERT INTO coll_orders (odate,cust_key,name,address,items,agent_id,agent_name,agent_short)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *`,
        [today, o.key, o.name, o.address, JSON.stringify(items), u.aid || null, u.role === 'admin' ? 'Owner' : u.name, u.role === 'admin' ? 'OWN' : u.short])).rows[0];
      await pushOrder(c, r);
      await c.query('COMMIT');
      return ok({ order: r });
    }

    /* ---------- DAY TO DAY / TODAY COLLECTION ---------- */
    if (path === '/day') {
      await heal(c);
      let date = isoToDMY(q('date')) || today; const args = [date];
      let sql = 'SELECT * FROM coll_payments WHERE pdate=$1 AND NOT cancelled';
      if (u.role === 'agent') { date = today; args[0] = today; sql += ' AND agent_id=$2 AND created_at >= $3'; args.push(u.aid, new Date(nextMidnightIST() - 864e5)); }
      else if (q('agent')) { sql += ' AND agent_id=$2'; args.push(+q('agent')); }
      const rows = (await c.query(sql + ' ORDER BY id', args)).rows;
      const orders = (await c.query(`SELECT * FROM coll_orders WHERE odate=$1 ${u.role === 'agent' ? 'AND agent_id=$2' : ''} ORDER BY id`,
        u.role === 'agent' ? [date, u.aid] : [date])).rows;
      const cash = rows.reduce((a, r) => a + N(r.cash), 0), online = rows.reduce((a, r) => a + N(r.online), 0);
      const byAgent = {};
      rows.forEach(r => { const k = r.agent_name || 'Owner'; byAgent[k] = byAgent[k] || { name: k, short: r.agent_short, cash: 0, online: 0, count: 0 };
        byAgent[k].cash += N(r.cash); byAgent[k].online += N(r.online); byAgent[k].count++; });
      return ok({ date, payments: rows, orders, cash, online, total: cash + online, byAgent: Object.values(byAgent) });
    }

    /* ======== नीचे के सब routes सिर्फ़ OWNER ======== */
    if (u.role !== 'admin') return bad('यह सिर्फ़ Owner के लिए है', 403);

    if (path === '/payment/cancel' && method === 'POST') {
      await c.query('BEGIN');
      const p = (await c.query('UPDATE coll_payments SET cancelled=true WHERE id=$1 RETURNING *', [+body.id])).rows[0];
      if (p) { const key = 'sg_nb_' + p.pdate; const nb = await getKey(c, key);
        if (nb && Array.isArray(nb.jama)) { nb.jama.forEach(j => { if (String(j.collId) === String(p.id)) j.cut = true; }); await putKey(c, key, nb); } }
      await c.query('COMMIT'); return ok({});
    }
    if (path === '/agents' && method === 'GET') {
      const L = await buildLedger(c);
      const rows = (await c.query('SELECT id,name,short_name,areas,logout_time,otp,otp_expires,active FROM coll_agents ORDER BY id DESC')).rows;
      return ok({ agents: rows.map(a => ({ ...a, otp_left: a.otp_expires ? Math.max(0, Math.round((new Date(a.otp_expires) - Date.now()) / 1000)) : 0 })),
        areas: [...new Set(L.list.map(o => o.area))].sort(), serverNow: Date.now() });
    }
    if (path === '/agents' && method === 'POST') {
      const name = String(body.name || '').trim(); if (!name) return bad('नाम भरें');
      const short = (String(body.short || '').trim() || name.split(/\s+/)[0]).slice(0, 12);
      let areas = Array.isArray(body.areas) ? body.areas.map(String) : []; if (!areas.length) return bad('कम से कम एक Area allow करें');
      if (areas.includes('ALL')) areas = ['ALL'];
      const lt = /^\d{1,2}:\d{2}$/.test(body.logout_time || '') ? body.logout_time : '23:59';
      let a;
      if (body.id) a = (await c.query(`UPDATE coll_agents SET name=$1, short_name=$2, areas=$3::jsonb, logout_time=$4 WHERE id=$5 RETURNING *`,
        [name, short, JSON.stringify(areas), lt, +body.id])).rows[0];
      else a = (await c.query(`INSERT INTO coll_agents (name,short_name,areas,logout_time) VALUES ($1,$2,$3::jsonb,$4) RETURNING *`,
        [name, short, JSON.stringify(areas), lt])).rows[0];
      return ok({ agent: a });
    }
    if (path === '/agents/otp' && method === 'POST') {
      const otp = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const a = (await c.query(`UPDATE coll_agents SET otp=$1, otp_expires=now()+interval '2 minutes', active=true WHERE id=$2 RETURNING id,otp,otp_expires`, [otp, +body.id])).rows[0];
      if (!a) return bad('Agent नहीं मिला', 404);
      return ok({ id: a.id, otp: a.otp, otp_left: 120 });
    }
    if (path === '/agents/logout' && method === 'POST') {
      await c.query('UPDATE coll_agents SET gen=gen+1, otp=NULL, otp_expires=NULL WHERE id=$1', [+body.id]); return ok({});
    }
    if (path === '/agents/delete' && method === 'POST') {
      await c.query('UPDATE coll_agents SET active=false, gen=gen+1, otp=NULL WHERE id=$1', [+body.id]);
      await c.query('DELETE FROM coll_agents WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM coll_payments WHERE agent_id=$1)', [+body.id]);
      return ok({});
    }
    /* NOT VISIT — agent ने जो area खोला, उसमें किस customer की profile नहीं खोली */
    if (path === '/notvisit') {
      const date = isoToDMY(q('date')) || today; const aid = +q('agent');
      const agents = (await c.query('SELECT id,name,short_name,areas FROM coll_agents ORDER BY name')).rows;
      const vs = (await c.query('SELECT agent_id,agent_name,cust_key,area,kind FROM coll_visits WHERE vdate=$1' + (aid ? ' AND agent_id=$2' : ''),
        aid ? [date, aid] : [date])).rows;
      const L = await buildLedger(c);
      const out = {};
      vs.forEach(v => { const k = v.agent_id; out[k] = out[k] || { agent: v.agent_name, areas: new Set(), seen: new Set() };
        if (v.kind === 'area') out[k].areas.add(v.area); else { out[k].seen.add(v.cust_key); out[k].areas.add(v.area); } });
      const report = Object.entries(out).map(([id, r]) => ({
        agent_id: +id, agent: r.agent,
        areas: [...r.areas].sort().map(area => {
          const all = L.list.filter(o => o.area === area);
          const miss = all.filter(o => !r.seen.has(o.key)).map(o => ({ name: o.name, address: o.address, due: +o.bal.toFixed(2) }));
          return { area, total: all.length, visited: all.length - miss.length, notVisited: miss };
        })
      }));
      return ok({ date, agents, report });
    }
    return bad('Route नहीं मिला: ' + path, 404);
  } catch (e) {
    try { await c?.query('ROLLBACK'); } catch (_) {}
    return bad(e.message || e, 500);
  } finally { try { await c?.end(); } catch (_) {} }
}
