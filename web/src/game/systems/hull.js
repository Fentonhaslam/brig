// Vessel hull condition — a 0-100 integrity for the boat you sail. Storm
// exposure at sea wears it down, pirate hits + whale strikes gouge it; you patch
// it with timber + pitch at the shipwright's slipway (or carried stock). At 0
// you FOUNDER (the crossing's roguelike loss — handled by the onFounder cb).
// Persisted per player. A small HUD bar shows it while at sea or when damaged.
//
// EXPORT: createHull({ persistKey, onFounder }) -> { update(dt,{atSea,storm}),
//   damage(n), repair(n), get hull(), get full(), set(n), reset() }

export function createHull({ persistKey = 'brig:hull', onFounder } = {}) {
  let pk = persistKey;
  let hull = 100;
  try { const v = parseFloat(localStorage.getItem(pk)); if (v >= 0 && v <= 100) hull = v; } catch {}
  let saveT = 0;
  let foundered = false;

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:140px;left:50%;transform:translateX(-50%);z-index:56;display:none;'
    + 'font:600 12px system-ui;color:#f3e8cf;background:rgba(30,22,12,.55);backdrop-filter:blur(3px);'
    + 'padding:6px 14px;border-radius:10px;text-align:center;min-width:170px;pointer-events:none';
  document.body.appendChild(hud);

  function save() { try { localStorage.setItem(pk, String(Math.round(hull))); } catch {} }
  function saveSoon() { saveT = 0.8; }

  function render() {
    const pct = Math.max(0, hull) / 100;
    const col = hull > 60 ? '#7ad0a0' : hull > 30 ? '#e0c060' : '#e0654a';
    hud.innerHTML = `⛵ Hull ${Math.round(hull)}%`
      + '<div style="margin-top:5px;height:6px;width:150px;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden">'
      + `<div style="height:100%;width:${(pct * 100).toFixed(0)}%;background:${col}"></div></div>`;
  }

  function set(v) {
    hull = Math.max(0, Math.min(100, v));
    render();
    if (hull <= 0 && !foundered) { foundered = true; if (onFounder) onFounder(); }
  }
  function damage(n) { if (n > 0) { set(hull - n); saveSoon(); } }
  function repair(n) {
    if (n <= 0) return;
    set(Math.min(100, hull + n)); save();
    if (hull > 0) foundered = false; // only clear the latch once she's actually afloat again
  }
  function reset() { hull = 100; foundered = false; save(); render(); } // after foundering / a fresh boat

  // account sync: re-point the save key (sign-in) + snapshot/restore the value
  function setKey(k) { pk = k; }
  function load() {
    try { const v = parseFloat(localStorage.getItem(pk)); if (v >= 0 && v <= 100) set(v); } catch {}
  }
  function snapshot() { return Math.round(hull); }
  function restore(v) { if (typeof v === 'number' && v >= 0 && v <= 100) { set(v); save(); } }

  function update(dt, { atSea = false, storm = 0 } = {}) {
    // storms gnaw at the hull while you're exposed at sea
    if (atSea && storm > 0.25 && hull > 0) { set(hull - storm * 1.1 * dt); saveSoon(); }
    if (saveT > 0) { saveT -= dt; if (saveT <= 0) save(); }
    hud.style.display = (atSea || hull < 100) ? 'block' : 'none';
    if (hud.style.display === 'block') render();
  }

  render();
  return { update, damage, repair, set, reset, setKey, load, snapshot, restore, get hull() { return hull; }, get full() { return hull >= 100; }, get foundered() { return foundered; } };
}
