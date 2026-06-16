// The purse — an always-visible coin readout (top-left, under the minimap) that
// also shows your profit/loss since the last port, so a trade run reads at a
// glance. Polls the inventory cheaply; main marks the baseline on berthing.

export function createPurse(inventory) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:198px;left:14px;z-index:55;font:600 14px Georgia,serif;'
    + 'color:#f3e8cf;background:rgba(10,30,45,.5);backdrop-filter:blur(3px);padding:6px 12px;'
    + 'border-radius:8px;letter-spacing:.4px;pointer-events:none';
  document.body.appendChild(el);

  let mark = inventory.count('coin'); // coin recorded at the last port
  let acc = 0;

  function update(dt) {
    acc += dt; if (acc < 0.25) return; acc = 0;
    const c = inventory.count('coin');
    const d = c - mark;
    const delta = d === 0 ? ''
      : ` <span style="color:${d > 0 ? '#9ad88a' : '#e0917a'};font-size:12px">${d > 0 ? '+' : ''}${d}</span>`;
    el.innerHTML = `🪙 ${c}${delta}`;
  }
  function setMark() { mark = inventory.count('coin'); }

  return { update, setMark };
}
