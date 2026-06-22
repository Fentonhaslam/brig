// Developer console — a backtick (`) command line over the window.brig dev
// hooks, for driving the game while building/testing: teleport between ports,
// switch quality, read FPS, inspect peers, toggle admin. It's a thin front-end
// over the same `window.brig` API you'd type in DevTools, just faster in-game.
//
// Gated OFF for normal players: it mounts only on a dev build, when the
// localStorage flag `brig:dev=1` is set, or for an admin. Commands are wrapped
// in try/catch so a mismatched API prints an error rather than crashing.

import { log } from '../core/log.js';

const B = () => window.brig || {};

const COMMANDS = {
  help: () => 'commands: ' + Object.keys(COMMANDS).join(', '),
  fps: () => { const b = B(); return `${b.fps} fps · ${b.gfx.calls} draws · ${(b.gfx.tris / 1000 | 0)}k tris · quality ${b.quality.level}${b.quality.auto ? ' (auto)' : ''}`; },
  quality: (a) => { const v = (a[0] || '').toLowerCase(); if (v === 'auto') { B().quality.setAuto(); return 'quality: auto'; } B().quality.set(v); return 'quality: ' + B().quality.level; },
  places: () => B().places.map((p) => p.name).join(', '),
  berth: (a) => {
    const name = a.join(' ').toLowerCase();
    const h = B().harbours.find((x) => x.name.toLowerCase().startsWith(name));
    if (!h) return 'no such port — try: ' + B().places.map((p) => p.name).join(', ');
    B().castOff(); B().approachHarbour(h.name); B().berth(h);
    return 'berthed at ' + h.name;
  },
  tp: (a) => COMMANDS.berth(a),
  castoff: () => { B().castOff(); return 'cast off'; },
  peers: () => `${B().peers?.count ?? 0} peer(s) online · you = ${B().handle || 'guest'}`,
  admin: (a) => { const on = a[0] !== 'off'; B().setAdmin(on); return 'admin ' + (on ? 'on' : 'off') + ' (reload to apply some gates)'; },
  vessel: (a) => { B().setVessel(a[0]); return `vessel set to ${a[0]} (reload to apply)`; },
};

function enabled() {
  try {
    if (import.meta.env && import.meta.env.DEV) return true;
    // a ?dev=1 (or #dev) link turns it on and remembers it — the easy way to
    // get the console on the live site without opening DevTools
    if (/[?&]dev=1\b/.test(location.search) || /(^|#)dev$/.test(location.hash)) {
      localStorage.setItem('brig:dev', '1');
      return true;
    }
    if (localStorage.getItem('brig:dev') === '1') return true;
  } catch { /* ignore */ }
  return Boolean(window.brig && window.brig.isAdmin);
}

const CSS = `
#dev { position: fixed; left: 0; right: 0; bottom: 0; z-index: 99; display: none;
  font: 13px ui-monospace, Menlo, Consolas, monospace; }
#dev.show { display: block; }
#dev .out { max-height: 34vh; overflow-y: auto; padding: 8px 12px; color: #cfe6cf;
  background: rgba(6,10,14,.92); border-top: 1px solid rgba(120,200,140,.3); white-space: pre-wrap; }
#dev .out .cmd { color: #8fd0ff; } #dev .out .err { color: #f0908a; }
#dev .in { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: rgba(6,10,14,.96); }
#dev .in span { color: #9fd29a; } #dev .in input { flex: 1; background: none; border: none; outline: none; color: #eaf6ea; font: inherit; }
`;

export function createDevConsole() {
  if (!enabled()) return { open() {}, close() {}, isOpen: () => false };

  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'dev';
  el.innerHTML = `<div class="out" id="dev-out"></div><div class="in"><span>brig&gt;</span><input id="dev-in" autocomplete="off" spellcheck="false" placeholder="type a command — 'help'"/></div>`;
  document.body.appendChild(el);
  const out = el.querySelector('#dev-out');
  const input = el.querySelector('#dev-in');
  const history = []; let hi = 0;

  const print = (text, cls = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; out.appendChild(d); out.scrollTop = out.scrollHeight; };

  function run(line) {
    print('brig> ' + line, 'cmd');
    const [name, ...args] = line.trim().split(/\s+/);
    const fn = COMMANDS[name];
    if (!fn) { print(`unknown: ${name} (try 'help')`, 'err'); return; }
    try { const r = fn(args); if (r) print(String(r)); } catch (e) { print('error: ' + (e.message || e), 'err'); }
  }

  const isOpen = () => el.classList.contains('show');
  function open() { el.classList.add('show'); setTimeout(() => input.focus(), 20); if (!out.childElementCount) print("brig dev console — type 'help'"); }
  function close() { el.classList.remove('show'); input.blur(); }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); isOpen() ? close() : open(); return; }
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'Enter') { const v = input.value.trim(); if (v) { history.push(v); hi = history.length; run(v); } input.value = ''; }
    else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = history[hi] || ''; e.preventDefault(); } }
    else if (e.key === 'ArrowDown') { if (hi < history.length) { hi++; input.value = history[hi] || ''; e.preventDefault(); } }
  });

  log.info("dev console ready — press ` (backtick) to open");
  return { open, close, isOpen };
}
