// The player dashboard — one home for everything a player needs out of the 3D
// world: their QUESTS, the game SETTINGS, the PERFORMANCE controls (the lag fix
// — Low/Medium/High + live FPS), and a CONTROLS/HELP reference. Opens with the
// ☰ button (top-right) or the Esc key; tabs along the top switch panes. Pulls
// live data from the existing systems via the accessors passed in, so it stays a
// thin presentation layer over quests/quality/audio/difficulty.
//
// EXPORT: createDashboard({ quality, getStats, quests, objective, difficulty,
//                           audio, isBusy }) -> { open, close, toggle, isOpen }

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
`;

const QUALITY_NOTE = {
  low: 'Cheapest — no ambient occlusion, bloom or shadows, full-speed on weak laptops.',
  medium: 'Balanced — soft shadows + bloom, no costly screen-space AO.',
  high: 'Everything — ambient occlusion, bloom, shadows, crisp pixels.',
};

export function createDashboard({ quality, getStats = () => ({}), quests, objective, difficulty, audio, isBusy = () => false }) {
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
        <button data-tab="settings">Settings</button>
        <button data-tab="perf">Performance</button>
        <button data-tab="help">Controls</button>
      </div>
      <div class="body" id="dash-body"></div>
    </div>`;
  document.body.appendChild(el);

  const body = el.querySelector('#dash-body');
  let tab = 'quests';
  let fpsTimer = null;

  function renderQuests() {
    const p = quests?.progress?.();
    const cur = objective?.current;
    if (!p) {
      return `<h3>Quests</h3><div class="meta">${cur ? `<div class="q-cur"><div class="t">${cur.title || cur}</div>${cur.hint ? `<div class="h">${cur.hint}</div>` : ''}</div>` : 'No active quest right now. Explore the port and talk to the townsfolk.'}</div>`;
    }
    const steps = p.steps.map((s) => `
      <div class="step ${s.done ? 'done' : ''} ${s.current ? 'cur' : ''}">
        <span class="mk">${s.done ? '✓' : s.current ? '➤' : '·'}</span>
        <span class="x">${s.title}${s.current && s.hint ? `<div class="h" style="font-size:13px;opacity:.75;font-style:italic">${s.hint}</div>` : ''}</span>
      </div>`).join('');
    return `<h3>${p.name}</h3><div class="meta" style="margin-bottom:10px">Your journey to a ship of your own.</div>${steps}`;
  }

  function renderSettings() {
    const cur = difficulty?.get?.();
    const tiers = difficulty?.tiers || {};
    const diffBtns = Object.entries(tiers).map(([k, t]) =>
      `<button data-diff="${k}" class="${k === cur ? 'on' : ''}">${t.label || k}</button>`).join('');
    return `<h3>Settings</h3>
      <div class="lab">The crossing — difficulty</div>
      <div class="meta">How harshly the Atlantic punishes a weak hull.</div>
      <div class="seg">${diffBtns}</div>
      <div class="lab">Music</div>
      <div class="row"><button class="toggle" id="dash-mute">${audio?.playing ? '🔊 On' : '🔇 Off'}</button><span class="meta">Toggle the theme (or press M).</span></div>`;
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

  function render() {
    el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
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
  }

  function tickFps() {
    const f = quality.fps, fEl = body.querySelector('#dash-fps'), dEl = body.querySelector('#dash-draws');
    if (fEl) { fEl.textContent = f; fEl.className = 'fps ' + (f < 30 ? 'bad' : f < 50 ? 'mid' : ''); }
    if (dEl) { const st = getStats() || {}; dEl.textContent = st.calls ?? '–'; }
  }

  function open() { el.classList.add('show'); render(); fpsTimer = setInterval(() => { if (tab === 'perf') tickFps(); }, 500); }
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

  return { open, close, toggle, isOpen };
}
