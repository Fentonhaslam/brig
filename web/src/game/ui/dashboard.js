// The player dashboard — one home for everything a player needs out of the 3D
// world: their QUESTS, the game SETTINGS, the PERFORMANCE controls (the lag fix
// — Low/Medium/High + live FPS), and a CONTROLS/HELP reference. Opens with the
// ☰ button (top-right) or the Esc key; tabs along the top switch panes. Pulls
// live data from the existing systems via the accessors passed in, so it stays a
// thin presentation layer over quests/quality/audio/difficulty.
//
// EXPORT: createDashboard({ quality, getStats, quests, objective, difficulty,
//                           audio, isBusy, account, onSuggest })
//          -> { open, close, toggle, isOpen }

import { listIdeas, myVotes, toggleVote, listAllFeedback, setFeedbackStatus } from '../../net/ideas.js';
import { supabase } from '../../net/supabase.js';
import { getSfxVolume, setSfxVolume } from '../core/sfx.js';

const CSS = `
#dash-btn {
  position: fixed; top: 14px; right: 244px; z-index: 80; width: 38px; height: 38px;
  border: none; border-radius: 50%; font-size: 17px; cursor: pointer; color: #f3e8cf;
  background: rgba(10,30,45,.55); backdrop-filter: blur(3px);
}
#dash-btn:hover { background: rgba(20,45,62,.8); }
#dash { position: fixed; inset: 0; z-index: 97; display: none; align-items: center; justify-content: center;
  background: rgba(8,5,3,.62); backdrop-filter: blur(2px);
  font-family: 'Cormorant Garamond','Times New Roman',serif; color: #f1e3c4; }
#dash.show { display: flex; }
#dash .card { width: min(560px, 94vw); height: min(560px, 88vh); position: relative; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#231708,#140c06); border: 1px solid rgba(200,160,90,.5);
  border-radius: 10px; box-shadow: 0 24px 90px rgba(0,0,0,.72); overflow: hidden; }
#dash .tabs { display: flex; border-bottom: 1px solid rgba(200,160,90,.25); }
#dash .tabs button { flex: 1; padding: 14px 0; font: 600 12px system-ui; letter-spacing: 2px; text-transform: uppercase;
  color: #b9a577; background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; }
#dash .tabs button.on { color: #f0dca8; border-bottom-color: #c8a050; background: rgba(200,160,90,.08); }
#dash .body { flex: 1; overflow-y: auto; padding: 20px 24px; }
#dash h3 { margin: 0 0 10px; font-size: 22px; letter-spacing: 1px; color: #e8b860; }
#dash .close { position: absolute; top: 13px; right: 16px; font: 600 11px system-ui; letter-spacing: 2px; opacity: .6; cursor: pointer; z-index: 2; }
#dash .q-cur { background: rgba(200,160,90,.1); border: 1px solid rgba(200,160,90,.3); border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; }
#dash .q-cur .t { font-size: 18px; color: #f0dca8; } #dash .q-cur .h { font-size: 14px; opacity: .8; font-style: italic; margin-top: 3px; }
#dash .step { display: flex; gap: 10px; padding: 7px 0; font-size: 15px; border-bottom: 1px solid rgba(200,160,90,.12); }
#dash .step .mk { width: 18px; opacity: .9; } #dash .step.done { opacity: .55; } #dash .step.done .x { text-decoration: line-through; }
#dash .step.cur .x { color: #f0dca8; }
#dash .seg { display: flex; gap: 8px; margin: 6px 0 4px; }
#dash .seg button { flex: 1; padding: 10px 0; font: 600 13px system-ui; cursor: pointer; color: #d8c39a;
  background: rgba(0,0,0,.25); border: 1px solid rgba(190,158,96,.3); border-radius: 6px; }
#dash .seg button.on { color: #fff3df; background: linear-gradient(180deg,#7a5a20,#54380e); border-color: rgba(190,158,96,.85); }
#dash .lab { font: 600 11px system-ui; letter-spacing: 2px; text-transform: uppercase; opacity: .6; margin: 18px 0 4px; }
#dash .meta { font-size: 13px; opacity: .75; line-height: 1.5; }
#dash .fps { font: 700 30px system-ui; color: #9fd29a; } #dash .fps.bad { color: #e8a; } #dash .fps.mid { color: #e8c87a; }
#dash .stat { font-size: 13px; opacity: .7; }
#dash .row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
#dash .toggle { padding: 8px 14px; font: 600 12px system-ui; cursor: pointer; color: #f3e8cf;
  background: rgba(0,0,0,.3); border: 1px solid rgba(190,158,96,.4); border-radius: 6px; }
#dash kbd { display: inline-block; min-width: 16px; text-align: center; padding: 2px 7px; margin-right: 6px; font: 600 12px system-ui;
  background: rgba(0,0,0,.4); border: 1px solid rgba(190,158,96,.4); border-radius: 4px; color: #f0dca8; }
#dash .help div { padding: 6px 0; font-size: 15px; }
#dash .suggest { margin-bottom: 14px; padding: 10px 14px; font: 600 13px system-ui; cursor: pointer; color: #fff3df;
  background: linear-gradient(180deg,#9a6a20,#6a4410); border: 1px solid #c8a050; border-radius: 6px; }
#dash .idea { display: flex; gap: 12px; align-items: flex-start; padding: 11px 0; border-bottom: 1px solid rgba(200,160,90,.14); }
#dash .vote { flex: 0 0 auto; width: 48px; text-align: center; cursor: pointer; padding: 6px 0; border-radius: 6px;
  border: 1px solid rgba(190,158,96,.4); background: rgba(0,0,0,.25); color: #d8c39a; }
#dash .vote .n { display: block; font: 700 16px system-ui; } #dash .vote .a { font-size: 11px; opacity: .8; }
#dash .vote.voted { background: linear-gradient(180deg,#7a5a20,#54380e); color: #fff3df; border-color: #c8a050; }
#dash .idea .txt { flex: 1; } #dash .idea .m { font-size: 15px; line-height: 1.4; } #dash .idea .by { font-size: 12px; opacity: .55; margin-top: 3px; }
#dash .badge { font: 600 10px system-ui; letter-spacing: 1px; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; margin-left: 6px; }
#dash .badge.planned { background: #2d4a6a; color: #cfe3ff; } #dash .badge.done { background: #2f5a36; color: #cfeccf; } #dash .badge.wontfix { background: #5a2f2f; color: #f0caca; }
#dash .report { padding: 12px 0; border-bottom: 1px solid rgba(200,160,90,.14); }
#dash .report .rhead { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
#dash .report .rkind { font: 700 10px system-ui; letter-spacing: 1px; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; }
#dash .report .rkind.bug { background: #5a2020; color: #ffcfcf; } #dash .report .rkind.idea { background: #2d4a6a; color: #cfe3ff; }
#dash .report .rmsg { font-size: 15px; line-height: 1.4; margin-bottom: 4px; }
#dash .report .rmeta { font-size: 12px; opacity: .5; }
#dash .report .ractions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#dash .report .ractions button { font: 600 11px system-ui; padding: 3px 10px; border-radius: 4px; cursor: pointer;
  background: rgba(0,0,0,.3); border: 1px solid rgba(190,158,96,.3); color: #d8c39a; }
#dash .report .ractions button:hover { border-color: #c8a050; color: #fff3df; }
#dash .report .ractions button.active { background: rgba(50,80,50,.4); border-color: #6a9a6a; color: #cfeccf; }
`;

const QUALITY_NOTE = {
  low: 'Cheapest — no ambient occlusion, bloom or shadows, full-speed on weak laptops.',
  medium: 'Balanced — soft shadows + bloom, no costly screen-space AO.',
  high: 'Everything — ambient occlusion, bloom, shadows, crisp pixels.',
};

export function createDashboard({ quality, getStats = () => ({}), quests, objective, difficulty, audio, isBusy = () => false, account = null, onSuggest = null }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'dash-btn'; btn.textContent = '☰'; btn.title = 'Menu (Esc) — quests, settings, performance';
  document.body.appendChild(btn);

  const el = document.createElement('div');
  el.id = 'dash';
  el.innerHTML = `
    <div class="card">
      <div class="close">CLOSE · ESC</div>
      <div class="tabs">
        <button data-tab="quests" class="on">Quests</button>
        <button data-tab="ideas">Ideas</button>
        <button data-tab="settings">Settings</button>
        <button data-tab="perf">Performance</button>
        <button data-tab="help">Controls</button>
        <button data-tab="reports" id="dash-reports-tab" style="display:none">Reports</button>
      </div>
      <div class="body" id="dash-body"></div>
    </div>`;
  document.body.appendChild(el);

  const body = el.querySelector('#dash-body');
  let tab = 'quests';
  let fpsTimer = null;

  function renderQuests() {
    const p = quests?.progress?.();
    const done = quests?.completedList?.() ?? [];

    if (!p && !done.length) {
      return `<h3>Quest Journal</h3><div class="meta">No quests yet — explore the port and speak with the townsfolk to begin your voyage.</div>`;
    }

    let html = '<h3>Quest Journal</h3>';

    if (p) {
      html += `<div class="lab" style="margin-top:0">Active</div>`;
      html += `<div style="font-size:17px;color:#e8b860;margin-bottom:8px">${p.name}</div>`;
      html += p.steps.map((s) => `
        <div class="step ${s.done ? 'done' : ''} ${s.current ? 'cur' : ''}">
          <span class="mk">${s.done ? '✓' : s.current ? '➤' : '·'}</span>
          <span class="x">${s.title}${s.current && s.hint ? `<div style="font-size:13px;opacity:.75;font-style:italic;margin-top:2px">${s.hint}</div>` : ''}</span>
        </div>`).join('');
      html += `<div style="margin-bottom:18px"></div>`;
    } else {
      html += `<div class="meta" style="margin-bottom:18px">No active quest — explore the port and talk to the townsfolk.</div>`;
    }

    if (done.length) {
      html += `<div class="lab">Completed</div>`;
      html += done.map((q) => `
        <div class="step done">
          <span class="mk">✓</span>
          <span class="x">${q.name}</span>
        </div>`).join('');
    }

    return html;
  }

  function renderSettings() {
    const cur = difficulty?.get?.();
    const tiers = difficulty?.tiers || {};
    const diffBtns = Object.entries(tiers).map(([k, t]) =>
      `<button data-diff="${k}" class="${k === cur ? 'on' : ''}">${t.label || k}</button>`).join('');
    const sfxVol = Math.round(getSfxVolume() * 100);
    return `<h3>Settings</h3>
      <div class="lab">The crossing — difficulty</div>
      <div class="meta">How harshly the Atlantic punishes a weak hull.</div>
      <div class="seg">${diffBtns}</div>
      <div class="lab">Music</div>
      <div class="row"><button class="toggle" id="dash-mute">${audio?.playing ? '🔊 On' : '🔇 Off'}</button><span class="meta">Toggle the theme (or press M).</span></div>
      <div class="lab">Sound Effects</div>
      <div class="row" style="gap:12px;align-items:center">
        <input type="range" id="dash-sfx" min="0" max="100" value="${sfxVol}" style="flex:1;accent-color:#c8a050">
        <span class="meta" id="dash-sfxval" style="min-width:32px">${sfxVol}%</span>
      </div>`;
  }

  function renderPerf() {
    const lv = quality.level;
    const btns = quality.levels.map((k) =>
      `<button data-q="${k}" class="${k === lv && !quality.auto ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('');
    const st = getStats() || {};
    return `<h3>Performance</h3>
      <div class="row"><span class="fps" id="dash-fps">– </span><span class="stat">FPS &nbsp;·&nbsp; <span id="dash-draws">${st.calls ?? '–'}</span> draw calls</span></div>
      <div class="lab">Quality preset</div>
      <div class="seg">${btns}</div>
      <div class="meta" id="dash-qnote">${QUALITY_NOTE[lv] || ''}</div>
      <div class="row" style="margin-top:14px"><button class="toggle" id="dash-auto">${quality.auto ? '● Auto (detecting)' : '○ Use Auto'}</button>
        <span class="meta">Auto picks a level for your machine and lowers it if the game struggles.</span></div>
      <div class="meta" style="margin-top:14px">On a weaker laptop, choose <b>Low</b> — it turns off the heavy effects and runs much faster.</div>`;
  }

  function renderHelp() {
    return `<h3>Controls</h3><div class="help">
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move / steer · <kbd>Shift</kbd> Run</div>
      <div><kbd>Click</kbd> Move to point · <kbd>Drag</kbd> Orbit camera · <kbd>Wheel</kbd> Zoom</div>
      <div><kbd>F</kbd> Talk / interact · <kbd>E</kbd> Step ashore · <kbd>T</kbd> Trade</div>
      <div><kbd>M</kbd> Music · <kbd>Esc</kbd> This menu</div>
      <div style="margin-top:10px;opacity:.7;font-size:13px">Use the 💬 Feedback button (bottom-right) to report bugs or suggest ideas.</div>
    </div>`;
  }

  // user-submitted text goes through innerHTML, so escape it
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // the suggestions board — public idea list, most-voted first; signed-in users
  // upvote to prioritise. Async: paints a frame, then fills from Supabase.
  async function loadIdeas() {
    const uid = account?.session?.user?.id || null;
    body.innerHTML = `<h3>Ideas &amp; Improvements</h3>
      <div class="meta" style="margin-bottom:12px">Suggest changes, and vote for what gets built next.${uid ? '' : ' <b>Sign in to vote.</b>'}</div>
      ${onSuggest ? '<button class="suggest" id="dash-suggest">💡 Suggest an improvement</button>' : ''}
      <div id="dash-ideas"><div class="meta">Loading…</div></div>`;
    const sug = body.querySelector('#dash-suggest'); if (sug) sug.onclick = () => { close(); onSuggest(); };
    const wrap = body.querySelector('#dash-ideas');
    let ideas = [], voted = new Set();
    try { [ideas, voted] = await Promise.all([listIdeas(), myVotes(uid)]); }
    catch { wrap.innerHTML = '<div class="meta">Could not load the board (offline?).</div>'; return; }
    if (tab !== 'ideas') return; // switched away while loading
    if (!ideas.length) { wrap.innerHTML = '<div class="meta">No ideas yet — be the first to suggest one!</div>'; return; }
    wrap.innerHTML = ideas.map((it) => {
      const v = voted.has(it.id);
      const badge = it.status && it.status !== 'open' ? `<span class="badge ${esc(it.status)}">${esc(it.status)}</span>` : '';
      return `<div class="idea">
        <div class="vote ${v ? 'voted' : ''}" data-id="${esc(it.id)}"><span class="n">${it.votes ?? 0}</span><span class="a">▲ vote</span></div>
        <div class="txt"><div class="m">${esc(it.message)}${badge}</div><div class="by">— ${esc(it.handle) || 'a sailor'}</div></div>
      </div>`;
    }).join('');
    wrap.querySelectorAll('.vote').forEach((btn) => { btn.onclick = () => castVote(btn); });
  }

  async function castVote(btn) {
    const uid = account?.session?.user?.id;
    if (!uid) { account?.openSignIn?.(); return; }   // voting needs an account
    const id = btn.dataset.id, was = btn.classList.contains('voted');
    btn.style.pointerEvents = 'none';
    try {
      const now = await toggleVote(id, uid, was);
      btn.classList.toggle('voted', now);
      const n = btn.querySelector('.n');
      n.textContent = Math.max(0, (parseInt(n.textContent, 10) || 0) + (now ? 1 : -1));
    } catch (e) { console.warn('[brig] vote failed', e); }
    finally { btn.style.pointerEvents = ''; }
  }

  async function loadReports() {
    body.innerHTML = `<h3>Feedback Inbox</h3><div class="meta" style="margin-bottom:12px">All submitted bugs and ideas, newest first.</div><div id="dash-rlist"><div class="meta">Loading…</div></div>`;
    const wrap = body.querySelector('#dash-rlist');
    const items = await listAllFeedback();
    if (tab !== 'reports') return;
    if (!items.length) { wrap.innerHTML = '<div class="meta">No submissions yet.</div>'; return; }
    const STATUSES = ['open', 'planned', 'done', 'wontfix'];
    wrap.innerHTML = items.map((it) => {
      const ctx = it.context || {};
      const when = new Date(it.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const place = [ctx.place, ctx.vessel, ctx.version].filter(Boolean).join(' · ');
      const statusBtns = STATUSES.map((s) =>
        `<button data-rid="${esc(it.id)}" data-rs="${s}" class="${it.status === s ? 'active' : ''}">${s}</button>`).join('');
      return `<div class="report" id="r-${esc(it.id)}">
        <div class="rhead"><span class="rkind ${esc(it.kind)}">${it.kind === 'bug' ? '🐞 Bug' : '💡 Idea'}</span><span class="rmeta">${esc(it.handle) || 'anonymous'} · ${when}</span></div>
        <div class="rmsg">${esc(it.message)}</div>
        ${place ? `<div class="rmeta">${esc(place)}</div>` : ''}
        <div class="ractions">${statusBtns}</div>
      </div>`;
    }).join('');
    wrap.querySelectorAll('[data-rid]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.rid, status = btn.dataset.rs;
        try {
          await setFeedbackStatus(id, status);
          const row = wrap.querySelector(`#r-${id}`);
          if (row) row.querySelectorAll('[data-rid]').forEach((b) => b.classList.toggle('active', b.dataset.rs === status));
        } catch (e) { console.warn('[brig] status update failed', e); }
      };
    });
  }

  function render() {
    el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'ideas') { loadIdeas(); return; }
    if (tab === 'reports') { loadReports(); return; }
    body.innerHTML = tab === 'quests' ? renderQuests()
      : tab === 'settings' ? renderSettings()
      : tab === 'perf' ? renderPerf() : renderHelp();
    wire();
  }

  function wire() {
    body.querySelectorAll('button[data-diff]').forEach((b) => { b.onclick = () => { difficulty.set(b.dataset.diff); render(); }; });
    const mute = body.querySelector('#dash-mute'); if (mute) mute.onclick = () => { audio.toggle(); render(); };
    body.querySelectorAll('button[data-q]').forEach((b) => { b.onclick = () => { quality.set(b.dataset.q); render(); }; });
    const auto = body.querySelector('#dash-auto'); if (auto) auto.onclick = () => { quality.setAuto?.(); render(); };
    const sfx = body.querySelector('#dash-sfx');
    const sfxVal = body.querySelector('#dash-sfxval');
    if (sfx) sfx.oninput = () => { const v = sfx.value / 100; setSfxVolume(v); if (sfxVal) sfxVal.textContent = sfx.value + '%'; };
  }

  function tickFps() {
    const f = quality.fps, fEl = body.querySelector('#dash-fps'), dEl = body.querySelector('#dash-draws');
    if (fEl) { fEl.textContent = f; fEl.className = 'fps ' + (f < 30 ? 'bad' : f < 50 ? 'mid' : ''); }
    if (dEl) { const st = getStats() || {}; dEl.textContent = st.calls ?? '–'; }
  }

  async function revealAdminTab() {
    const uid = account?.session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('profiles').select('is_admin').eq('id', uid).single();
    if (data?.is_admin) {
      const t = el.querySelector('#dash-reports-tab');
      if (t) t.style.display = '';
    }
  }

  function open() { el.classList.add('show'); render(); revealAdminTab(); fpsTimer = setInterval(() => { if (tab === 'perf') tickFps(); }, 500); }
  function close() { el.classList.remove('show'); if (fpsTimer) { clearInterval(fpsTimer); fpsTimer = null; } }
  const isOpen = () => el.classList.contains('show');
  function toggle() { isOpen() ? close() : open(); }

  el.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
  btn.onclick = toggle;
  el.querySelector('.close').onclick = close;
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isOpen()) { close(); return; }
    // don't pop the menu over another open panel/conversation
    if (isBusy() || document.querySelector('#fb.show, #chronicle.show')) return;
    open();
  });

  // open straight to the suggestions board (used by the plaza plaque)
  function openIdeas() { tab = 'ideas'; open(); }

  return { open, close, toggle, isOpen, openIdeas };
}
