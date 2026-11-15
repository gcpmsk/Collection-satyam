/* =====================================================================
   SATYAM GOLD — COLLECTION APP (frontend)
   Owner (mobile + password)  → सब menu
   OTP Agent (मुंशी)           → ADD CUSTOMER AMOUNT + TODAY COLLECTION (सिर्फ़ allowed area)
   ===================================================================== */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const INR = n => '₹' + (Math.round(N(n) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const TK = 'sgc_token', UK = 'sgc_user', NK = 'sgc_nav';
let USER = null, LOGOUT_TIMER = null, POLL = null;   /* boot() नीचे जल्दी चलता है — सब state ऊपर declare */
/* session localStorage + cookie (backup) दोनों में — refresh / tab बंद-खुले पर logout नहीं */
function ckSet(k, v, exp) { try { document.cookie = `${k}=${encodeURIComponent(v)};expires=${new Date(exp).toUTCString()};path=/;SameSite=Lax`; } catch (e) {} }
function ckGet(k) { const m = document.cookie.split('; ').find(x => x.startsWith(k + '=')); return m ? decodeURIComponent(m.slice(k.length + 1)) : null; }
function ckDel(k) { document.cookie = `${k}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`; }
function saveSession(tok, user) {
  try { localStorage.setItem(TK, tok); localStorage.setItem(UK, JSON.stringify(user)); } catch (e) {}
  ckSet(TK, tok, user.exp); ckSet(UK, JSON.stringify(user), user.exp);
}
function loadSession() {
  let tok = null, user = null;
  try { tok = localStorage.getItem(TK); user = JSON.parse(localStorage.getItem(UK) || 'null'); } catch (e) {}
  if (!tok || !user) { try { tok = ckGet(TK); user = JSON.parse(ckGet(UK) || 'null'); } catch (e) {} if (tok && user) saveSession(tok, user); }
  return tok && user && user.exp > Date.now() ? { tok, user } : null;
}
function clearSession() { try { localStorage.removeItem(TK); localStorage.removeItem(UK); localStorage.removeItem(NK); } catch (e) {} ckDel(TK); ckDel(UK); }
const navSave = o => { try { localStorage.setItem(NK, JSON.stringify(o)); } catch (e) {} };
const navLoad = () => { try { return JSON.parse(localStorage.getItem(NK) || 'null') || {}; } catch (e) { return {}; } };

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
function todayISO() { const d = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

async function api(path, body, method) {
  const opt = { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' } };
  const tok = (loadSession() || {}).tok; if (tok) opt.headers.Authorization = 'Bearer ' + tok;
  if (body) opt.body = JSON.stringify(body);
  let r, d;
  try { r = await fetch('/api' + path, opt); d = await r.json(); }
  catch (e) { throw new Error('Server / Internet से connect नहीं हुआ'); }
  /* सिर्फ़ server का साफ़ 401 (Owner ने logout किया / समय पूरा) — network / server error पर कभी logout नहीं */
  if (r.status === 401 && path !== '/login') { doLogout(true); throw new Error(d.error || 'Login expire'); }
  if (!d.ok) throw new Error(d.error || 'Error');
  return d;
}

/* ---------------- LOGIN ---------------- */
(function particles() { const p = $('.particles'); for (let i = 0; i < 40; i++) { const e = document.createElement('div'); e.className = 'particle';
  e.style.left = Math.random() * 100 + '%'; e.style.animationDelay = Math.random() * 20 + 's'; e.style.animationDuration = 10 + Math.random() * 10 + 's'; p.appendChild(e); } })();
document.querySelectorAll('.tab-btn').forEach((b, i) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active')); document.querySelectorAll('.form-section').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('#' + b.dataset.tab).classList.add('active'); $('.tab-indicator').style.transform = `translateX(${i * 100}%)`;
}));
$('#password-login').addEventListener('submit', async e => { e.preventDefault();
  try { const d = await api('/login', { mobile: $('#mobileInput').value, password: $('#passwordInput').value }); startSession(d); }
  catch (err) { alert(err.message); } });
$('#otp-login').addEventListener('submit', async e => { e.preventDefault();
  try { const d = await api('/login', { otp: $('#otpInput').value }); startSession(d); }
  catch (err) { alert(err.message); } });

function startSession(d) {
  saveSession(d.token, d.user); navSave({});
  /* agent: पिछले दिन का कोई भी local data नहीं */
  if (d.user.role === 'agent') Object.keys(localStorage).filter(k => k.startsWith('sgc_cache')).forEach(k => localStorage.removeItem(k));
  $('#otpInput').value = ''; $('#passwordInput').value = '';
  enterDash(d.user);
}
function enterDash(u) {
  USER = u; $('#loginScreen').classList.add('hidden'); $('#dashScreen').classList.remove('hidden'); startPoll();
  $('#whoami').textContent = u.role === 'admin' ? 'Owner' : `👤 ${u.name} · Area: ${(u.areas || []).join(', ')} · Logout ${new Date(u.exp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  clearTimeout(LOGOUT_TIMER);
  const left = u.exp - Date.now(); if (left <= 0) return doLogout(true);
  LOGOUT_TIMER = setTimeout(() => { alert('Logout time हो गया — दोबारा OTP से login करें'); doLogout(true); }, Math.min(left, 2147000000));
  renderMenu();
}
function doLogout(silent) {
  clearSession(); USER = null; clearTimeout(LOGOUT_TIMER); stopPoll();
  $('#view').innerHTML = ''; $('#dashScreen').classList.add('hidden'); $('#loginScreen').classList.remove('hidden'); closeModal();
  if (!silent) toast('Logout ✔');
}
$('#logoutBtn').addEventListener('click', () => doLogout());
setInterval(() => { if (USER && USER.exp < Date.now()) doLogout(true); }, 20000);
/* boot() सबसे नीचे चलता है (सारे state declare होने के बाद) */


/* ---------------- MENU ---------------- */
const MENU = {
  dayToDay: ['📅', 'DAY TO DAY'], search: ['🔍', 'NAME / ADDRESS SEARCH'], collect: ['💰', 'ADD CUSTOMER AMOUNT'],
  todayColl: ['📊', 'TODAY COLLECTION'], todayOrd: ['🛒', 'TODAY ORDERS'], later: ['🔔', 'PAYMENT REMINDER'],
  upc: ['✏️', 'UPDATE PAYMENT (UPC)'], otp: ['🔑', 'OTP LOGIN USERS'], notVisit: ['🚫', 'NOT VISIT']
};
function renderMenu() {
  const keys = USER.role === 'admin' ? ['dayToDay', 'search', 'collect', 'todayOrd', 'later', 'upc', 'otp', 'notVisit'] : ['collect', 'todayColl', 'todayOrd', 'later'];
  $('#menu').innerHTML = keys.map(k => `<button class="menu-btn" data-v="${k}"><span class="ic">${MENU[k][0]}</span><span>${MENU[k][1]}</span>${k === 'later' ? '<i class="mb" id="laterBadge"></i>' : ''}</button>`).join('');
  $('#menu').classList.remove('hidden');
  document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', () => openView(b.dataset.v)));
  $('#view').innerHTML = ''; laterBadge();
}
async function laterBadge() {
  try { const d = await api('/laters'); const n = d.laters.filter(l => l.date < d.today || (l.date === d.today && l.time <= d.now)).length;
    const b = $('#laterBadge'); if (b) { b.textContent = n || ''; b.style.display = n ? 'flex' : 'none'; } } catch (e) {}
}
function openView(v, restoring) { if (!restoring) navSave({ view: v }); ({ dayToDay: vDay, search: vSearch, collect: vCollect, todayColl: vToday, todayOrd: vOrders, later: vLater, upc: vUpc, otp: vOtp, notVisit: vNotVisit })[v](); }
/* refresh के बाद वहीं वापस — जिस screen / area / customer पर थे */
function restoreNav() {
  const n = navLoad(); if (!n.view) return;
  const allow = USER.role === 'admin' ? Object.keys(MENU) : ['collect', 'todayColl', 'todayOrd', 'later'];
  if (!allow.includes(n.view)) return;
  if (n.view === 'collect') { CS.area = n.area || ''; CS.q = n.q || ''; CS.restoreKey = n.profile || ''; }
  openView(n.view, true);        /* nav state को overwrite नहीं करता — network error आए तो भी अगली refresh पर वहीं */
}
function shell(title, inner) {
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${title}</h2><button class="x" id="vx">&times;</button></div>${inner}</div>`;
  $('#vx').onclick = () => { $('#view').innerHTML = ''; $('#menu').classList.remove('hidden'); navSave({}); laterBadge(); };
  $('#view').scrollIntoView({ behavior: 'smooth' });
}
function openModal(html, onOpen) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); if (onOpen) onOpen($('#modalBody')); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }
$('#modalX').onclick = closeModal;

/* ---------------- customer search helper ---------------- */
let CUST_CACHE = null;
const PK = { packs: {}, laters: {}, unlocked: {} };       /* live PACK / बाद में maps (server poll से) */
async function customers(area) { const d = await api('/customers' + (area ? '?area=' + encodeURIComponent(area) : '')); if (!area) CUST_CACHE = d;
  d.customers.forEach(c => { PK.packs[c.key] = c.pack || null; PK.laters[c.key] = c.later || ''; }); return d; }
function suggest(input, box, onPick) {
  input.addEventListener('input', async () => {
    const q = input.value.trim().toUpperCase(); box.innerHTML = ''; if (!q) return;
    const d = CUST_CACHE || await customers();
    d.customers.filter(c => c.name.toUpperCase().includes(q) || String(c.address).toUpperCase().includes(q)).slice(0, 40).forEach(c => {
      const el = document.createElement('div'); el.innerHTML = `${esc(c.name)} <small>${esc(c.address)} · बाक़ी ${INR(c.due)}</small>`;
      el.onclick = () => { box.innerHTML = ''; onPick(c); }; box.appendChild(el); });
  });
}

/* =================== DAY TO DAY (Owner) =================== */
async function vDay() {
  shell('Day to Day Report', `<div class="fg"><label>Date</label><input type="date" id="dDate" value="${todayISO()}"></div><div id="dOut" class="muted">Loading…</div>`);
  const load = async () => {
    try { const d = await api('/day?date=' + $('#dDate').value); renderDay(d, $('#dOut'), true); }
    catch (e) { $('#dOut').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; }
  };
  $('#dDate').onchange = load; load();
}
function renderDay(d, el, admin) {
  if (!d.payments.length && !d.orders.length) { el.innerHTML = '<div class="empty">इस तारीख़ का कोई collection नहीं</div>'; return; }
  let h = `<table class="tbl"><thead><tr><th>#</th><th>Customer</th><th>Amount</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>`;
  d.payments.forEach((p, i) => {
    h += `<tr class="${N(p.online) > 0 ? 'on' : ''}"><td>${i + 1}</td><td>${esc(p.name)}<br><small class="muted">${esc(p.address || '')}</small>
      <span class="who">${esc(p.agent_name || '')}</span></td>
      <td><b>${INR(N(p.cash) + N(p.online))}</b><br><small>${esc(p.mode)}${p.mode === 'Mix' ? ` (C ${INR(p.cash)} + O ${INR(p.online)})` : ''} · ${esc(p.ts || '')}</small></td>
      ${admin ? `<td><button class="btn sm sec" data-rc="${p.id}">🧾</button><br><button class="btn sm red" style="margin-top:4px" data-cx="${p.id}">✖</button></td>` : ''}</tr>`;
  });
  h += '</tbody></table>';
  h += `<div class="sum"><p><span>💵 Total Cash</span><b>${INR(d.cash)}</b></p><p><span>🏦 Total Online</span><b>${INR(d.online)}</b></p><p class="g"><span>Grand Total</span><b>${INR(d.total)}</b></p></div>`;
  if (admin && d.byAgent.length) h += `<div class="sum"><b>👤 कौन ने कितना collection किया</b>${d.byAgent.map(a => `<p><span>${esc(a.name)} (${a.count})</span><span>C ${INR(a.cash)} · O ${INR(a.online)} = <b>${INR(a.cash + a.online)}</b></span></p>`).join('')}</div>`;
  if (d.orders.length) h += `<div class="sum"><b>🛒 Orders (${d.orders.length})</b>${d.orders.map(o => `<p><span>${esc(o.name)} <span class="who">${esc(o.agent_name || '')}</span></span><small>${o.items.map(i => esc(i.name + ' ' + i.qty + ' ' + i.unit)).join(', ')}</small></p>`).join('')}</div>`;
  h += `<div class="pdfbar"><button class="btn gold" id="pdfBtn">📄 PDF देखें / Download</button></div>`;
  el.innerHTML = h;
  el.querySelector('#pdfBtn').onclick = () => dayPDF(d);
  el.querySelectorAll('[data-rc]').forEach(b => b.onclick = () => showReceipt(d.payments.find(p => String(p.id) === b.dataset.rc)));
  el.querySelectorAll('[data-cx]').forEach(b => b.onclick = async () => {
    if (!confirm('यह payment cancel करें? (Notebook में भी कट हो जाएगा)')) return;
    try { await api('/payment/cancel', { id: b.dataset.cx }); toast('Cancel ✔'); vDay(); } catch (e) { alert(e.message); } });
}

/* ---------------- PDF ---------------- */
async function dayPDF(d) {
  let sh = document.getElementById('pdfSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'pdfSheet'; document.body.appendChild(sh); }
  sh.innerHTML = `<h1>SATYAM FOOD PRODUCT</h1><div class="sub">Collection Report — ${esc(d.date)}${USER.role === 'agent' ? ' — ' + esc(USER.name) : ''}</div>
    <table><thead><tr><th>#</th><th>Customer / Address</th><th>Mode</th><th>Cash</th><th>Online</th><th>Total</th><th>By</th></tr></thead><tbody>
    ${d.payments.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}<br><small>${esc(p.address || '')}</small></td><td>${esc(p.mode)}<br><small>${esc(p.ts || '')}</small></td>
      <td class="n">${INR(p.cash)}</td><td class="n">${INR(p.online)}</td><td class="n"><b>${INR(N(p.cash) + N(p.online))}</b></td><td class="by">${esc(p.agent_name || '')}</td></tr>`).join('')}
    <tr class="tot"><td></td><td colspan="2">TOTAL</td><td class="n">${INR(d.cash)}</td><td class="n">${INR(d.online)}</td><td class="n">${INR(d.total)}</td><td></td></tr></tbody></table>
    ${d.byAgent.length ? `<br><table><thead><tr><th>Collected By (किसने पैसे लिए)</th><th>Entries</th><th>Cash</th><th>Online</th><th>Total</th></tr></thead><tbody>${d.byAgent.map(a => `<tr><td>${esc(a.name)}</td><td>${a.count}</td><td class="n">${INR(a.cash)}</td><td class="n">${INR(a.online)}</td><td class="n">${INR(a.cash + a.online)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${d.orders.length ? `<br><table><thead><tr><th>#</th><th>Order — Customer</th><th>Items</th><th>By</th></tr></thead><tbody>${d.orders.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(o.name)}</td><td>${o.items.map(x => esc(x.name + ' ' + x.qty + ' ' + x.unit)).join(', ')}</td><td class="by">${esc(o.agent_name || '')}</td></tr>`).join('')}</tbody></table>` : ''}`;
  try {
    toast('PDF बन रहा है…');
    const cv = await html2canvas(sh, { scale: 2, backgroundColor: '#fff' });
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    const W = 210, M = 8, w = W - 2 * M, pageH = 297 - 2 * M; const pxPerMm = cv.width / w; const sliceH = Math.floor(pageH * pxPerMm);
    for (let y = 0, pg = 0; y < cv.height; y += sliceH, pg++) {
      const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = Math.min(sliceH, cv.height - y);
      c2.getContext('2d').drawImage(cv, 0, y, cv.width, c2.height, 0, 0, cv.width, c2.height);
      if (pg) pdf.addPage(); pdf.addImage(c2.toDataURL('image/jpeg', .92), 'JPEG', M, M, w, c2.height / pxPerMm);
    }
    const name = `Collection_${d.date}.pdf`; const blob = pdf.output('blob'); const url = URL.createObjectURL(blob);
    openModal(`<h3>📄 ${esc(name)}</h3><img src="${cv.toDataURL('image/jpeg', .8)}" style="width:100%;border-radius:8px;border:1px solid #ddd">
      <div class="row" style="margin-top:10px"><a class="btn grn" style="text-align:center;text-decoration:none" href="${url}" download="${name}">⬇ Download</a>
      <button class="btn" id="pdfOpen">👁 Open PDF</button>${navigator.share ? '<button class="btn sec" id="pdfShare">📤 Share</button>' : ''}</div>`, el => {
      el.querySelector('#pdfOpen').onclick = () => window.open(url, '_blank');
      const s = el.querySelector('#pdfShare'); if (s) s.onclick = () => navigator.share({ files: [new File([blob], name, { type: 'application/pdf' })], title: name }).catch(() => {});
    });
  } catch (e) { alert('PDF error: ' + e.message); }
}

/* =================== NAME / ADDRESS SEARCH (Owner) =================== */
function vSearch() {
  shell('Search Customer History', `<div class="fg"><label>नाम या पता लिखें</label><input id="sQ" autocomplete="off"><div class="sugg" id="sS"></div></div><div id="sOut"></div>`);
  customers().catch(e => toast(e.message));
  suggest($('#sQ'), $('#sS'), async c => {
    $('#sQ').value = c.name; $('#sOut').innerHTML = '<div class="muted">Loading…</div>';
    try {
      const { customer: x } = await api('/customer?key=' + encodeURIComponent(c.key));
      $('#sOut').innerHTML = `<div class="prof"><h3>${esc(x.name)} <i>(${esc(x.address)})</i></h3><small class="muted">Area ${esc(x.area)}${x.mobile ? ' · 📞 ' + esc(x.mobile) : ''}</small>
        <div class="sum"><p><span>कुल Due (बिल)</span><b style="color:var(--red)">${INR(x.dueT)}</b></p><p><span>कुल Paid</span><b style="color:var(--grn)">${INR(x.paidT)}</b></p><p class="g"><span>${x.bal < 0 ? 'Advance' : 'बाक़ी'}</span><b>${INR(Math.abs(x.bal))}</b></p></div>
        <table class="tbl"><thead><tr><th>Date</th><th>Detail</th><th>Due</th><th>Paid</th></tr></thead><tbody>
        ${x.entries.map(e => `<tr style="${e.cut ? 'text-decoration:line-through;opacity:.5' : ''}"><td>${esc(e.date)}</td><td>${esc(e.kind === 'due' ? (e.label || '') + (e.items ? ' · ' + e.items : '') : 'Payment · ' + (e.mode || ''))}${e.by ? ` <span class="who">${esc(e.by)}</span>` : ''}</td>
          <td style="color:var(--red)">${e.kind === 'due' ? INR(e.amt) : ''}</td><td style="color:var(--grn)">${e.kind === 'paid' ? INR(e.amt) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">कोई entry नहीं</td></tr>'}
        </tbody></table></div>`;
    } catch (e) { $('#sOut').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; }
  });
}

/* =================== UPDATE PAYMENT (UPC) — back-dated =================== */
function vUpc() {
  shell('Back-Dated Payment (UPC)', `<div class="fg"><label>Payment Date</label><input type="date" id="uD" max="${todayISO()}"></div>
    <div class="fg"><label>Search Customer</label><input id="uQ" autocomplete="off"><div class="sugg" id="uS"></div></div>
    <input type="hidden" id="uK"><div class="fg"><label>Name</label><input id="uN" readonly></div>
    <div class="fg"><label>Amount</label><input type="number" inputmode="decimal" id="uA"></div>
    <div class="fg"><label>Mode</label><select id="uM"><option value="Online">🏦 Online</option><option value="Cash">💵 Cash</option></select></div>
    <button class="btn" id="uSave">Save Payment</button>`);
  customers().catch(e => toast(e.message));
  suggest($('#uQ'), $('#uS'), c => { $('#uK').value = c.key; $('#uN').value = c.name + ' (' + c.address + ')'; $('#uQ').value = c.name; });
  const upcBase = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  $('#uSave').onclick = async e => {
    const btn = e.currentTarget; if (btn.disabled) return;
    const date = $('#uD').value, key = $('#uK').value, amt = N($('#uA').value), mode = $('#uM').value;
    if (!date || !key || amt <= 0) return alert('Date, customer और amount भरें!');
    btn.disabled = true;
    try { const d = await api('/pay', { key, date, mode, cash: mode === 'Cash' ? amt : 0, online: mode === 'Online' ? amt : 0,
        req_id: [upcBase, key, date, mode, amt].join('|') });
      toast(d.duplicate ? 'पहले ही save है (दोबारा नहीं जुड़ा)' : 'Back-dated payment saved ✔'); showReceipt(d.payment); vUpc(); } catch (err) { btn.disabled = false; alert(err.message); }
  };
}

/* =================== ADD CUSTOMER AMOUNT — collection screen =================== */
const CS = { area: '', q: '', list: [], areas: [], profile: null, restoreKey: '' };
const cOut = h => { const e = $('#cOut'); if (e) e.innerHTML = h; return e; };
const navCollect = () => navSave({ view: 'collect', area: CS.area, q: CS.q, profile: CS.profile ? CS.profile.key : '' });
const fmtLater = at => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(at || ''); if (!m) return ''; let h = +m[4]; const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${m[3]}-${m[2]}-${m[1]} ${String(h).padStart(2, '0')}:${m[5]} ${ap}`; };
function pkBadge(k) { const p = PK.packs[k]; return p ? `<span class="pk ${p.locked ? 'lk' : 'me'}">📦 PACK · ${esc(p.by)}${p.last ? ' · ' + esc(p.last) : ''}</span>` : ''; }
function ltBadge(k) { const l = PK.laters[k]; return l ? `<span class="lt">🔔 ${esc(fmtLater(l))}</span>` : ''; }
async function vCollect() {
  $('#menu').classList.add('hidden');
  $('#view').innerHTML = `<div class="cbar"><button class="btn sm sec" id="cBack">←</button><input id="cQ" placeholder="🔍 Name search…" value="${esc(CS.q)}"><select id="cA"><option value="">📍 Area…</option></select></div><div id="cOut"><div class="muted">Loading…</div></div>`;
  $('#cBack').onclick = () => { CS.profile = null; $('#view').innerHTML = ''; $('#menu').classList.remove('hidden'); navSave({}); laterBadge(); };
  try {
    const d = await customers(); CS.areas = d.areas; if (!$('#cA')) return;     /* user इस बीच back दबा चुका */
    $('#cA').innerHTML = `<option value="">📍 Area…</option>${USER.role === 'admin' || (USER.areas || []).includes('ALL') ? '<option value="ALL">All Area</option>' : ''}` + d.areas.map(a => `<option ${a === CS.area ? 'selected' : ''}>${esc(a)}</option>`).join('');
    if (CS.area && (CS.area === 'ALL' || d.areas.includes(CS.area))) $('#cA').value = CS.area; else CS.area = '';
    if (!CS.area && d.areas.length === 1) { CS.area = d.areas[0]; $('#cA').value = CS.area; }
    $('#cA').onchange = () => { CS.area = $('#cA').value; loadArea(); };
    $('#cQ').oninput = () => { CS.q = $('#cQ').value; if (CS.profile) { CS.profile = null; } drawList(); };
    const rk = CS.restoreKey; CS.restoreKey = '';
    await loadArea(); if (rk) openProfile(rk);
  } catch (e) { cOut(`<div class="empty">❌ ${esc(e.message)}</div>`); }
}
async function loadArea() {
  CS.profile = null; navCollect();
  if (!CS.area) { cOut('<div class="empty">👆 ऊपर दाईं तरफ़ से <b>Area</b> चुनें</div>'); return; }
  cOut('<div class="muted">Loading…</div>');
  try { const d = await customers(CS.area); CS.list = d.customers.slice().sort((a, b) => a.name.localeCompare(b.name, 'en')); drawList(); }
  catch (e) { cOut(`<div class="empty">❌ ${esc(e.message)}</div>`); }
}
function drawList() {
  CS.profile = null; navCollect();
  const q = CS.q.trim().toUpperCase();
  if (!CS.area && !q) { cOut('<div class="empty">👆 ऊपर दाईं तरफ़ से <b>Area</b> चुनें</div>'); return; }
  const src = CS.area ? CS.list : ((CUST_CACHE && CUST_CACHE.customers) || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const list = src.filter(c => !q || c.name.toUpperCase().includes(q) || String(c.address).toUpperCase().includes(q));
  if (!list.length) { cOut('<div class="empty">कोई customer नहीं</div>'); return; }
  let h = '', last = '';
  list.forEach((c, i) => { const L = (c.name[0] || '#').toUpperCase(); if (L !== last) { h += `${last ? '</ul>' : ''}<div class="letter">${esc(L)}</div><ul class="clist">`; last = L; }
    h += `<li data-k="${esc(c.key)}" class="${PK.packs[c.key] ? 'packed' : ''}"><span class="sr">${i + 1}</span><span class="nm"><b>${esc(c.name)}</b><small>${esc(c.address)}</small><span class="tags">${pkBadge(c.key)}${ltBadge(c.key)}</span></span><span class="du ${c.due <= 0 ? 'z' : ''}">${c.due < 0 ? 'Adv ' + INR(-c.due) : INR(c.due)}</span></li>`; });
  if (!cOut(h + '</ul>')) return;
  $('#cOut').querySelectorAll('li').forEach(li => li.onclick = () => openProfile(li.dataset.k));
}
async function openProfile(key) {
  if (!cOut('<div class="muted">Loading…</div>')) return; window.scrollTo(0, 0);
  try {
    const { customer: x } = await api('/customer?key=' + encodeURIComponent(key)); CS.profile = x;
    if (!$('#cOut')) return;
    $('#cOut').innerHTML = `<div class="prof">
      <div class="row" style="justify-content:space-between"><h3 style="flex:3">${esc(x.name)} <i>(${esc(x.address)})</i></h3><button class="btn sm sec" style="flex:0" id="pBack">✖</button></div>
      ${x.pack ? `<div class="pkbar ${x.pack.locked ? 'lk' : 'me'}">📦 PACK — ${esc(x.pack.by)} · ${esc(x.pack.last)} · ${esc(x.pack.at)}${x.pack.locked ? '<br><small>Payment दोबारा लेने के लिए PAID पर 3 बार जल्दी tap करें · ORDER खुला है</small>' : ''}</div>` : ''}
      ${x.later ? `<div class="ltbar">🔔 बाद में: <b>${esc(isoDMY(x.later.date))} ${esc(t12(x.later.time))}</b>${x.later.amount ? ' · ' + INR(x.later.amount) : ''}${x.later.note ? ' · ' + esc(x.later.note) : ''} <small>(${esc(x.later.by || '')})</small></div>` : ''}
      ${x.mobile ? `<a href="tel:${esc(x.mobile)}" class="muted">📞 ${esc(x.mobile)}</a>` : ''}
      <div class="rates">${x.rates.length ? x.rates.map(r => `<span>${esc(r.t)}: ₹${r.rate}</span>`).join('') : '<span>Rate set नहीं</span>'}</div>
      <div class="pgrid">
        <div class="dues">${x.open.length ? x.open.map(b => `<div class="d"><span>${esc(b.date)}<br><small class="muted">${esc(b.label || '')}</small></span><b>${INR(b.left)}</b></div>`).join('') : '<div class="empty">✅ कोई due नहीं</div>'}
          ${x.advance ? `<div class="d" style="color:var(--grn)"><span>Advance</span><b>${INR(x.advance)}</b></div>` : ''}
          <div class="tot"><span>Total Due</span><span>${INR(Math.max(0, x.bal))}</span></div></div>
        <div class="acts"><button class="btn grn" id="pPaid">💵<br>PAID</button><button class="btn" id="pOrder">🛒<br>ORDER</button></div>
      </div></div>`;
    $('#pBack').onclick = () => drawList();      /* सिर्फ़ profile देख कर back = कोई PACK नहीं (action पर ही pack) */
    navCollect();
    $('#pPaid').onclick = tripleTap(x, () => paidPopup(x));
    $('#pOrder').onclick = () => orderPopup(x);
  } catch (e) { cOut(`<div class="empty">❌ ${esc(e.message)}</div>`); }
}
const isoDMY = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : d || ''; };
const t12 = h => { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ''); if (!m) return ''; let H = +m[1]; const ap = H < 12 ? 'AM' : 'PM'; H = H % 12 || 12; return `${String(H).padStart(2, '0')}:${m[2]} ${ap}`; };
/* दूसरे user ने pack कर दिया हो तो PAID खोलने के लिए 3 बार जल्दी tap (1.5 sec में) — वरना सीधे खुलेगा */
function tripleTap(x, open) {
  let n = 0, t0 = 0;
  return () => {
    if (!(x.pack && x.pack.locked) || PK.unlocked[x.key]) return open();
    const now = Date.now(); if (now - t0 > 1500) n = 0; if (!n) t0 = now; n++;
    if (n >= 3) { n = 0; PK.unlocked[x.key] = true; toast('🔓 Unlock — अब payment ले सकते हैं'); return open(); }
    toast(`📦 ${x.pack.by} ने pack किया (${x.pack.last}) — ${3 - n} tap और`);
  };
}
/* हर Save के लिए एक पहचान: popup खुलने पर बनती है; वही amount दोबारा submit हो (double click / network retry) तो server पुरानी payment ही लौटाता है */
const RQ = { base: '' };
function reqId(key, m, cash, online) { return RQ.base + '|' + key + '|' + m + '|' + cash + '|' + online; }
function paidPopup(x) {
  RQ.base = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  openModal(`<h3>💵 Payment — ${esc(x.name)}</h3><p class="muted" style="margin-bottom:10px">बाक़ी: <b style="color:var(--red)">${INR(Math.max(0, x.bal))}</b></p>
    <div class="chips" id="pm">${['Cash', 'Online', 'Mix', 'बाद में'].map(m => `<button class="chip" data-m="${m}">${{ Cash: '💵 Cash', Online: '🏦 Online', Mix: '🔀 Mix', 'बाद में': '⏳ बाद में' }[m]}</button>`).join('')}</div>
    <div id="pf"></div>`, el => {
    const pf = el.querySelector('#pf');
    el.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      el.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); b.classList.add('on'); const m = b.dataset.m;
      if (m === 'बाद में') {
        const n = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000); const hh = String(Math.min(n.getHours() + 1, 23)).padStart(2, '0');
        pf.innerHTML = `<p class="muted" style="margin-bottom:8px">कब payment देगा — तारीख़ और समय डालें (Owner के Payment Reminder में दिखेगा)</p>
          <div class="row"><div class="fg"><label>📅 तारीख़</label><input type="date" id="ld" min="${todayISO()}" value="${todayISO()}"></div><div class="fg"><label>🕐 समय</label><input type="time" id="lt" value="${hh}:00"></div></div>
          <div class="fg"><label>कितना देगा ₹ (optional)</label><input type="number" inputmode="decimal" id="la"></div>
          <div class="fg"><label>Note (optional)</label><input id="ln" maxlength="120" placeholder="जैसे: शाम को दुकान पर"></div>
          <button class="btn sec" id="pl">⏳ बाद में Save</button>`;
        pf.querySelector('#pl').onclick = async e => {
          const date = pf.querySelector('#ld').value, time = pf.querySelector('#lt').value; if (!date || !time) return alert('तारीख़ और समय दोनों भरें');
          e.target.disabled = true;
          try { await api('/later', { key: x.key, date, time, amount: N(pf.querySelector('#la').value), note: pf.querySelector('#ln').value, force: !!PK.unlocked[x.key] });
            closeModal(); toast(`⏳ बाद में — ${isoDMY(date)} ${t12(time)}`); pollNow(); openProfile(x.key); }
          catch (err) { e.target.disabled = false; alert(err.message); }
        }; return; }
      pf.innerHTML = (m !== 'Online' ? `<div class="fg"><label>💵 Cash ₹</label><input type="number" inputmode="decimal" id="pc"></div>` : '') +
        (m !== 'Cash' ? `<div class="fg"><label>🏦 Online ₹</label><input type="number" inputmode="decimal" id="po"></div>` : '') +
        `<button class="btn grn" id="ps">✓ Save & Receipt</button>`;
      (pf.querySelector('#pc') || pf.querySelector('#po')).focus();
      pf.querySelector('#ps').onclick = async e => {
        const cash = N(pf.querySelector('#pc')?.value), online = N(pf.querySelector('#po')?.value);
        if (cash + online <= 0) return alert('Amount भरें');
        e.target.disabled = true;
        try { const d = await api('/pay', { key: x.key, mode: m, cash, online, force: !!PK.unlocked[x.key], req_id: reqId(x.key, m, cash, online) });
          toast(d.duplicate ? '✔ Payment पहले ही save है (दोबारा नहीं जुड़ा)' : '✔ Payment saved' + (d.receipt === 'queued' ? ' · WhatsApp receipt जा रही है' : '')); pollNow(); showReceipt(d.payment); openProfileSilent(x.key); }
        catch (err) { e.target.disabled = false; alert(err.message); }
      };
    });
  });
}
function openProfileSilent(key) { if (CS.profile && CS.profile.key === key) { CS.list.forEach(c => { if (c.key === key) c._stale = 1; }); setTimeout(() => { if (CS.profile && CS.profile.key === key) openProfile(key); }, 300); loadAreaQuiet(); } }
async function loadAreaQuiet() { try { const d = await customers(CS.area); CS.list = d.customers.slice().sort((a, b) => a.name.localeCompare(b.name, 'en')); } catch (e) {} }

const OITEMS = [['a5', 'Atta 5kg'], ['a10', 'Atta 10kg'], ['a18', 'Atta 18kg'], ['a23', 'Atta 23kg (Gold)'], ['a48', 'Atta 48kg'], ['s500', 'Sattu 500g'], ['s200', 'Sattu 200g'], ['b500', 'Besan 500g'], ['b200', 'Besan 200g']];
function orderPopup(x) {
  openModal(`<h3>🛒 Order — ${esc(x.name)}</h3>
    <div>${OITEMS.map(([k, t]) => `<div class="oitem" data-i="${k}"><span>${t}</span><input type="number" inputmode="numeric" placeholder="Qty" min="0"><div class="seg"><button class="on" data-u="thela">थैला</button><button data-u="bora">बोरा</button></div></div>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn sec" id="oNo">⏳ अभी नहीं</button><button class="btn" id="oSave">✓ Order Save</button></div>`, el => {
    el.querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { s.querySelectorAll('button').forEach(z => z.classList.remove('on')); b.classList.add('on'); }));
    el.querySelector('#oNo').onclick = () => { closeModal(); toast('⏳ Order अभी नहीं'); };
    el.querySelector('#oSave').onclick = async e => {
      const items = [...el.querySelectorAll('.oitem')].map(r => ({ item: r.dataset.i, qty: N(r.querySelector('input').value), unit: r.querySelector('.seg .on').dataset.u })).filter(i => i.qty > 0);
      if (!items.length) return alert('कम से कम एक item की quantity भरें (या "अभी नहीं" दबाएँ)');
      e.target.disabled = true;
      try { const d = await api('/order', { key: x.key, items }); closeModal(); pollNow(); openProfile(x.key); toast('✔ Order No ' + (d.order.ord_no || '') + ' Order Book में गया'); }
      catch (err) { e.target.disabled = false; alert(err.message); }
    };
  });
}

/* ---------------- receipt ---------------- */
let seriesCounter = 1;
function numberToWords(num) { num = Math.floor(N(num)); const a = ['', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस']; const b = ['', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे']; if ((num = num.toString()).length > 9) return 'overflow'; const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/); if (!n) return ''; let s = ''; s += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' करोड़ ' : ''; s += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' लाख ' : ''; s += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' हज़ार ' : ''; s += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' सौ ' : ''; s += (n[5] != 0) ? ((s !== '') ? ' ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : ''; return s.trim() + ' रुपये मात्र'; }
function showReceipt(p) {
  if (!p) return; const amt = N(p.cash) + N(p.online); const t = new Date(p.created_at || Date.now());
  const h = t.getHours(), mm = String(t.getMinutes()).padStart(2, '0'); const rno = `${h < 12 ? '00' : '000'}${h % 12 || 12}0${mm}0${String(p.id || seriesCounter++).slice(-3).padStart(3, '0')}`;
  openModal(`<div class="receipt" id="rcpt"><div class="receipt-header"><h2>SATYAM FOOD PRODUCT</h2><p>Vidyardhar, Khagaria</p><p>FSSAI No: 10421168000028 | GSTIN: 10DWFPD7233GIZI</p><p><b>Mobile: 9631816666</b></p></div>
    <div class="rtitle"><span>PAYMENT RECEIPT</span></div>
    <div class="details-grid"><span class="l">रसीद संख्या:</span><span class="v">${rno}</span><span class="l">दिनांक:</span><span class="v">${esc(p.pdate)}</span>
      <span class="l">से प्राप्त हुए:</span><span class="v">${esc(p.name)}</span>${p.address ? `<span class="l">पता:</span><span class="v">${esc(p.address)}</span>` : ''}
      <span class="l">भुगतान का प्रकार:</span><span class="v">${esc(p.mode)}${p.mode === 'Mix' ? ` (Cash ${INR(p.cash)} + Online ${INR(p.online)})` : ''}</span></div>
    <div class="total-section"><span>कुल राशि (Total Amount)</span><div class="total-amount">${INR(amt)}</div><p class="amount-words">${numberToWords(amt)}</p></div>
    <div class="receipt-footer"><div class="bank-details"><b>Bank Details for Payment:</b><br>A/c No: 60440573620, IFSC: MAHB0002230</div><p class="thank-you">धन्यवाद!</p></div>
    <div class="rby">Collected by: ${esc(p.agent_name || '')}</div></div>
    <button class="btn gold" id="rImg">📥 Receipt Image Download</button>`, el => {
    el.querySelector('#rImg').onclick = async () => { const cv = await html2canvas(el.querySelector('#rcpt'), { scale: 2 }); const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = `Receipt_${p.name}_${p.pdate}.png`; a.click(); };
  });
}

/* =================== TODAY COLLECTION (OTP agent) =================== */
async function vToday() {
  shell('Today Collection', `<div id="tOut" class="muted">Loading…</div>`);
  try { const d = await api('/day'); renderDay(d, $('#tOut'), false); } catch (e) { $('#tOut').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; }
}

/* =================== TODAY ORDERS (Owner + OTP user) =================== */
async function vOrders() {
  shell('🛒 Today Orders', `${USER.role === 'admin' ? `<div class="fg"><label>Date</label><input type="date" id="oDt" value="${todayISO()}"></div>` : ''}<div id="oOut" class="muted">Loading…</div>`);
  const load = async () => {
    try {
      const d = await api('/orders' + (USER.role === 'admin' ? '?date=' + $('#oDt').value : ''));
      $('#oOut').innerHTML = d.orders.length ? `<div class="muted" style="margin-bottom:6px">${esc(d.date)} · कुल ${d.orders.length} order</div>` + d.orders.map(o => `<div class="agent ordc"><div class="t"><div><b>#${esc(o.no || '-')} ${esc(o.name)}</b> <span class="badge">${esc(o.area)}</span><br><small class="muted">${esc(o.address || '')}</small></div><small class="muted">${esc(o.at)}</small></div>
        <div style="margin-top:6px">${o.items.map(i => `<span class="ipill">${esc(i.name)} <b>${esc(i.qty)}</b> ${esc(i.unit || '')}</span>`).join('')}</div>
        <small class="muted">👤 ${esc(o.by)}</small></div>`).join('') : '<div class="empty">इस दिन कोई order नहीं</div>';
    } catch (e) { $('#oOut').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; }
  };
  if ($('#oDt')) $('#oDt').onchange = load; load();
}

/* =================== PAYMENT REMINDER — "बाद में" (Owner + OTP user, अपने area तक) =================== */
async function vLater() {
  shell('🔔 Payment Reminder (बाद में)', `<div id="lOut" class="muted">Loading…</div>`);
  try {
    const d = await api('/laters');
    const late = l => l.date < d.today || (l.date === d.today && l.time <= d.now);
    $('#lOut').innerHTML = d.laters.length ? d.laters.map(l => `<div class="agent ${late(l) ? 'late' : ''}"><div class="t"><div><b>${esc(l.name)}</b> <span class="badge">${esc(l.area)}</span><br><small class="muted">${esc(l.address || '')}</small></div>
        <div style="text-align:right"><b>${esc(isoDMY(l.date))}</b><br><small>${esc(t12(l.time))}</small></div></div>
      <div class="muted" style="margin-top:4px">बाक़ी <b style="color:var(--red)">${INR(l.due)}</b>${l.amount ? ' · देगा ' + INR(l.amount) : ''}${l.note ? ' · ' + esc(l.note) : ''} · 👤 ${esc(l.by)}</div>
      ${late(l) ? '<div class="lateTag">⏰ समय हो गया — collection करें</div>' : ''}
      <div class="row" style="margin-top:8px"><button class="btn sm grn" data-o="${esc(l.key)}" data-a="${esc(l.area)}">💰 Collect</button><button class="btn sm sec" data-d="${l.id}">✓ Done</button></div></div>`).join('') : '<div class="empty">कोई "बाद में" pending नहीं ✅</div>';
    $('#lOut').querySelectorAll('[data-o]').forEach(b => b.onclick = () => { CS.area = b.dataset.a; CS.q = ''; CS.restoreKey = b.dataset.o; openView('collect'); });
    $('#lOut').querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { await api('/later/done', { id: +b.dataset.d }); toast('Done ✔'); vLater(); });
  } catch (e) { $('#lOut').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; }
}

/* =================== LIVE PACK poll — दूसरे user की action तुरंत दिखे =================== */
async function pollNow() {
  if (!USER) return;
  try {
    const d = await api('/packs' + (CS.area ? '?area=' + encodeURIComponent(CS.area) : ''));
    const np = {}; d.packs.forEach(p => np[p.key] = p); const nl = {}; d.later.forEach(l => nl[l.key] = l.at);
    const same = JSON.stringify(np) === JSON.stringify(Object.fromEntries(Object.entries(PK.packs).filter(([, v]) => v))) && JSON.stringify(nl) === JSON.stringify(Object.fromEntries(Object.entries(PK.laters).filter(([, v]) => v)));
    if (CS.area) Object.keys(PK.packs).forEach(k => { if (CS.list.some(c => c.key === k) && !np[k]) PK.packs[k] = null; });
    d.packs.forEach(p => PK.packs[p.key] = p); Object.keys(PK.laters).forEach(k => { if (CS.list.some(c => c.key === k) && !nl[k]) PK.laters[k] = ''; }); Object.entries(nl).forEach(([k, v]) => PK.laters[k] = v);
    if (!same && $('#cOut') && !CS.profile && $('#modal').classList.contains('hidden') && CS.area) drawListKeep();
  } catch (e) {}
}
function drawListKeep() { const y = window.scrollY; const prof = CS.profile; drawList(); window.scrollTo(0, y); CS.profile = prof; }
function startPoll() { stopPoll(); POLL = setInterval(() => { if (!document.hidden) pollNow(); }, 7000); }
function stopPoll() { clearInterval(POLL); POLL = null; }

/* =================== OTP USERS (Owner) =================== */
let OTP_TIMER = null;
async function vOtp() {
  shell('🔑 OTP Login Users', `<button class="btn" id="oNew">➕ नया OTP User</button><div id="oList" style="margin-top:12px" class="muted">Loading…</div>`);
  $('#oNew').onclick = () => agentForm(null);
  loadAgents();
}
let AG = { agents: [], areas: [] };
async function loadAgents() {
  try { AG = await api('/agents'); } catch (e) { $('#oList').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; return; }
  const skew = Date.now() - AG.serverNow;
  AG.agents.forEach(a => a._otpEnd = a.otp && a.otp_left > 0 ? Date.now() + a.otp_left * 1000 : 0);
  $('#oList').innerHTML = AG.agents.length ? AG.agents.map(a => `<div class="agent" data-id="${a.id}"><div class="t"><div><b>${esc(a.name)}</b><br>
      <small class="muted">Area: ${(a.areas || []).map(x => `<span class="badge">${esc(x === 'ALL' ? 'All' : x)}</span>`).join('')} · Logout ${esc(a.logout_time)}</small></div></div>
      <div class="row" style="margin-top:8px"><button class="btn sm gold" data-g="${a.id}">🔑 OTP बनाएँ</button><button class="btn sm sec" data-e="${a.id}">✏️</button><button class="btn sm sec" data-l="${a.id}">⏻</button><button class="btn sm red" data-d="${a.id}">🗑</button></div>
      <div class="otpslot"></div></div>`).join('') : '<div class="empty">अभी कोई OTP user नहीं — ऊपर ➕ दबाएँ</div>';
  const L = $('#oList');
  L.querySelectorAll('[data-g]').forEach(b => b.onclick = () => genOtp(+b.dataset.g));
  L.querySelectorAll('[data-e]').forEach(b => b.onclick = () => agentForm(AG.agents.find(a => a.id === +b.dataset.e)));
  L.querySelectorAll('[data-l]').forEach(b => b.onclick = async () => { if (!confirm('इस user को अभी logout करें?')) return; await api('/agents/logout', { id: +b.dataset.l }); toast('Logout ✔'); });
  L.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (!confirm('User हटाएँ?')) return; await api('/agents/delete', { id: +b.dataset.d }); loadAgents(); });
  tickOtp();
}
async function genOtp(id) {
  try { const d = await api('/agents/otp', { id }); const a = AG.agents.find(x => x.id === id); a.otp = d.otp; a._otpEnd = Date.now() + d.otp_left * 1000; tickOtp(); }
  catch (e) { alert(e.message); }
}
function tickOtp() {
  clearInterval(OTP_TIMER);
  const draw = () => {
    let any = false;
    AG.agents.forEach(a => { const slot = document.querySelector(`.agent[data-id="${a.id}"] .otpslot`); if (!slot) return;
      const left = Math.round((a._otpEnd - Date.now()) / 1000);
      if (a.otp && left > 0) { any = true; slot.innerHTML = `<div class="otpbox"><small>OTP — ${esc(a.name)}</small><b>${esc(a.otp)}</b><small>⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} बाक़ी</small></div>`; }
      else if (a.otp) { a.otp = null; slot.innerHTML = `<div class="otpbox" style="color:#f87171">OTP expire — नया OTP बन रहा है…</div>`; genOtp(a.id); any = true; }
      else slot.innerHTML = ''; });
    if (!any || !document.querySelector('#oList')) clearInterval(OTP_TIMER);
  };
  draw(); OTP_TIMER = setInterval(draw, 1000);
}
function agentForm(a) {
  const sel = new Set(a ? a.areas : []);
  openModal(`<h3>${a ? '✏️ Edit' : '➕ नया'} OTP User</h3>
    <div class="fg"><label>User का नाम (PDF)</label><input id="aN" value="${esc(a?.name || '')}" placeholder="जैसे: Ramesh Munshi">
      <small class="muted">यह नाम सिर्फ़ Collection app में दिखेगा — Collection PDF में "किसने पैसे लिए" यही नाम आएगा</small></div>
    <div class="fg"><label>Area Allow करें</label><div class="areachk"><label><input type="checkbox" value="ALL" ${sel.has('ALL') ? 'checked' : ''}> <b>All</b></label>
      ${AG.areas.map(x => `<label><input type="checkbox" value="${esc(x)}" ${sel.has(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</div></div>
    <div class="fg"><label>Logout Time (रात 12 बजे अपने-आप logout हमेशा)</label><input type="time" id="aT" value="${esc(a?.logout_time || '23:59')}"></div>
    <button class="btn" id="aSave">✓ Save ${a ? '' : '& OTP बनाएँ'}</button>`, el => {
    el.querySelector('#aSave').onclick = async () => {
      const areas = [...el.querySelectorAll('.areachk input:checked')].map(i => i.value);
      if (!el.querySelector('#aN').value.trim()) return alert('नाम भरें');
      if (!areas.length) return alert('कम से कम एक Area allow करें — तभी OTP बनेगा');
      try { const d = await api('/agents', { id: a?.id, name: el.querySelector('#aN').value, areas, logout_time: el.querySelector('#aT').value });
        closeModal(); await loadAgents(); if (!a) genOtp(d.agent.id); } catch (e) { alert(e.message); }
    };
  });
}

/* =================== NOT VISIT (Owner) =================== */
async function vNotVisit() {
  shell('🚫 Not Visit Report', `<div class="row"><div class="fg"><label>Date</label><input type="date" id="nD" value="${todayISO()}"></div><div class="fg"><label>OTP User</label><select id="nA"><option value="">सभी</option></select></div></div><div id="nOut" class="muted">Loading…</div>`);
  const load = async () => {
    try {
      const d = await api('/notvisit?date=' + $('#nD').value + '&agent=' + $('#nA').value);
      if ($('#nA').options.length === 1) d.agents.forEach(a => $('#nA').add(new Option(a.name, a.id)));
      $('#nOut').innerHTML = d.report.length ? d.report.map(r => `<div class="agent"><b>👤 ${esc(r.agent)}</b>${r.areas.map(ar => `<div style="margin-top:8px"><span class="badge">${esc(ar.area)}</span>
          <small>Visit ${ar.visited}/${ar.total} · <b style="color:var(--red)">Miss ${ar.notVisited.length}</b></small>
          <table class="tbl">${ar.notVisited.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.name)}<br><small class="muted">${esc(c.address)}</small></td><td style="color:var(--red)">${INR(c.due)}</td></tr>`).join('') || '<tr><td class="empty">✅ सब visit हुए</td></tr>'}</table></div>`).join('')}</div>`).join('')
        : '<div class="empty">इस दिन किसी OTP user ने login/visit नहीं किया</div>';
    } catch (e) { $('#nOut').innerHTML = `<div class="empty">❌ ${esc(e.message)}</div>`; }
  };
  $('#nD').onchange = load; $('#nA').onchange = load; load();
}

/* =================== BOOT — refresh पर session वापस =================== */
function boot() {
  const ss = loadSession();
  if (!ss) { $('#loginScreen').classList.remove('hidden'); return; }
  enterDash(ss.user); restoreNav();
  api('/me').catch(() => {});                         /* 401 आए (Owner ने logout किया) तभी बाहर */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && USER) api('/me').catch(() => {}); });
}
boot();
