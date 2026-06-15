// The ship's hold — the player's cargo and coin. Persists across sessions:
// immediately to localStorage, and best-effort to a Supabase `inventories`
// table (so it survives a cache wipe / follows the account once login lands).
// If the table isn't there yet or we're offline, it silently stays local.
//
// Toggle the panel with I (or the 🎒 button). Other systems call add()/take()
// — e.g. trading at port, or hauling Indies gold home — and the save is
// automatic and debounced.

import { supabase, online } from '../../net/supabase.js';

// what a 1519 nao carries and trades
const CATALOG = {
  coin:    { name: 'Maravedís',       icon: '🪙' },
  wine:    { name: 'Wine',            icon: '🍷' },
  oil:     { name: 'Olive Oil',       icon: '🫒' },
  biscuit: { name: "Ship's Biscuit",  icon: '🍞' },
  cloth:   { name: 'Castilian Cloth', icon: '🧵' },
  tools:   { name: 'Iron Tools',      icon: '🔨' },
  timber:  { name: 'Timber',          icon: '🪵' },
  spice:   { name: 'Spice',           icon: '🌶️' },
  gold:    { name: 'Indies Gold',     icon: '✨' },
};
const START = { coin: 200, wine: 6, oil: 4, biscuit: 8, cloth: 3, tools: 2 };

export function createInventory({ key, handle }) {
  const LSKEY = 'brig:inv:' + key;
  let items = loadLocal();
  let saveTimer = null;

  function loadLocal() {
    try { const raw = localStorage.getItem(LSKEY); if (raw) return JSON.parse(raw); } catch {}
    return { ...START }; // first-ever load → starting provisions
  }
  function persistLocal() { try { localStorage.setItem(LSKEY, JSON.stringify(items)); } catch {} }

  async function pullCloud() {
    if (!online) return;
    try {
      const { data, error } = await supabase
        .from('inventories').select('items').eq('player_key', key).maybeSingle();
      if (error) return;                 // table missing / RLS → stay local
      if (data && data.items && Object.keys(data.items).length) {
        items = data.items; persistLocal(); render();
      } else {
        pushCloud();                     // no row yet → seed it
      }
    } catch {}
  }
  async function pushCloud() {
    if (!online) return;
    try {
      await supabase.from('inventories').upsert(
        { player_key: key, handle, items, updated_at: new Date().toISOString() },
        { onConflict: 'player_key' },
      );
    } catch {}
  }
  function save() {
    persistLocal();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushCloud, 600); // debounce cloud writes
  }

  // --- API ---------------------------------------------------------------
  function add(id, n = 1) {
    if (!CATALOG[id]) return;
    items[id] = Math.max(0, (items[id] || 0) + n);
    if (!items[id]) delete items[id];
    save(); render();
  }
  function take(id, n = 1) { add(id, -n); }
  function count(id) { return items[id] || 0; }

  // --- UI ----------------------------------------------------------------
  const btn = document.createElement('button');
  btn.textContent = '🎒';
  btn.title = 'Hold (I)';
  btn.style.cssText = 'position:fixed;top:14px;right:60px;z-index:80;width:38px;height:38px;'
    + 'border:none;border-radius:50%;font-size:17px;cursor:pointer;color:#f3e8cf;'
    + 'background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:90;'
    + 'display:none;width:min(440px,90vw);font:14px/1.5 Georgia,serif;color:#f3e8cf;'
    + 'background:linear-gradient(180deg,rgba(34,26,16,.97),rgba(20,15,9,.98));'
    + 'padding:18px 20px 22px;border:1px solid rgba(180,150,90,.55);border-radius:10px;'
    + 'box-shadow:0 18px 50px rgba(0,0,0,.6)';
  document.body.appendChild(panel);

  let open = false;
  function toggle(force) {
    open = force == null ? !open : force;
    panel.style.display = open ? 'block' : 'none';
    if (open) render();
  }

  function render() {
    if (!open) return;
    const coin = items.coin || 0;
    const cells = Object.keys(CATALOG)
      .filter((id) => id !== 'coin' && (items[id] || 0) > 0)
      .map((id) => {
        const c = CATALOG[id];
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;`
          + `padding:10px 6px;background:rgba(0,0,0,.25);border:1px solid rgba(180,150,90,.25);border-radius:8px">`
          + `<div style="font-size:26px">${c.icon}</div>`
          + `<div style="font-size:11px;color:#d8c39a;text-align:center;line-height:1.2">${c.name}</div>`
          + `<div style="font-weight:700;color:#fff">×${items[id]}</div></div>`;
      }).join('');
    panel.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(180,150,90,.3);padding-bottom:8px;margin-bottom:12px">`
      + `<span style="color:#d8b46a;font:600 15px system-ui;letter-spacing:.5px">THE HOLD</span>`
      + `<span style="color:#e9c87a">🪙 ${coin} maravedís</span></div>`
      + (cells
        ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${cells}</div>`
        : `<div style="opacity:.7;text-align:center;padding:16px 0">The hold is empty.</div>`)
      + `<div style="color:#9a8a66;font:11px system-ui;text-align:center;margin-top:14px">I or 🎒 to close</div>`;
  }

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyI') toggle(); });

  // init
  persistLocal();
  render();
  pullCloud();

  return { add, take, count, get items() { return items; }, toggle, render, catalog: CATALOG };
}
