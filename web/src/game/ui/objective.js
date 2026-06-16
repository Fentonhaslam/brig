// The objective HUD — a small diegetic parchment card (top-left, under the
// minimap) showing the player's current goal + an optional hint. Used by the
// intro's onboarding guide now, and by the quest framework in Phase 2. Cheap:
// one DOM node, shown/hidden on demand.

export function createObjective() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:118px;left:14px;z-index:58;max-width:262px;display:none;'
    + 'font:14px/1.45 Georgia,serif;color:#f3e8cf;'
    + 'background:linear-gradient(180deg,rgba(34,26,16,.9),rgba(20,15,9,.94));'
    + 'padding:10px 14px;border:1px solid rgba(190,158,96,.5);border-left:3px solid #c9923a;'
    + 'border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none;backdrop-filter:blur(3px)';
  document.body.appendChild(el);

  let current = null;
  function set(title, hint) {
    current = title;
    el.style.display = 'block';
    el.innerHTML = '<div style="color:#e8b860;font:600 11px system-ui;letter-spacing:1.2px;margin-bottom:5px">⚑ OBJECTIVE</div>'
      + `<div>${title}</div>`
      + (hint ? `<div style="opacity:.72;font-size:12px;margin-top:5px">${hint}</div>` : '');
    if (el.animate) el.animate([{ transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' });
  }
  function clear() { current = null; el.style.display = 'none'; }

  return { set, clear, get current() { return current; }, el };
}
