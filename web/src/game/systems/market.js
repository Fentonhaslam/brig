// The market. Each port prices goods differently — European wares (wine, oil,
// cloth, tools) are cheap in Valdara and dear in the Indies; Indies goods (gold,
// spice) are cheap in Puerto Dorado and dear in Valdara. So the voyage pays:
// buy low at one end, sell high at the other. Trades move coin + goods in the
// inventory (which persists). Open with the ⚖ button or T while berthed.

const PRICES = {
  // good: [buy price, sell price]
  Valdara: {
    wine: [8, 6], oil: [10, 7], biscuit: [4, 3], cloth: [14, 10],
    tools: [20, 15], timber: [6, 4], spice: [90, 70], gold: [140, 110],
  },
  'Puerto Dorado': {
    wine: [16, 12], oil: [18, 14], biscuit: [8, 6], cloth: [26, 20],
    tools: [34, 26], timber: [10, 7], spice: [30, 22], gold: [55, 42],
  },
};

export function createMarket({ inventory, getPort }) {
  const cat = inventory.catalog;

  const btn = document.createElement('button');
  btn.textContent = '⚖'; btn.title = 'Market (T, in port)';
  btn.style.cssText = 'position:fixed;top:14px;right:198px;z-index:80;width:38px;height:38px;border:none;'
    + 'border-radius:50%;font-size:16px;cursor:pointer;color:#f3e8cf;background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:95;display:none;'
    + 'width:min(460px,92vw);max-height:80vh;overflow-y:auto;font:14px Georgia,serif;color:#f3e8cf;'
    + 'background:linear-gradient(180deg,rgba(34,26,16,.98),rgba(20,15,9,.99));padding:18px 20px;'
    + 'border:1px solid rgba(190,158,96,.55);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.6)';
  document.body.appendChild(panel);

  let open = false;
  function show() { open = true; panel.style.display = 'block'; render(); }
  function hide() { open = false; panel.style.display = 'none'; }
  function toggle() { open ? hide() : show(); }

  function trade(id, dir) {
    const port = getPort(); const tbl = port && PRICES[port]; if (!tbl || !tbl[id]) return;
    const [buy, sell] = tbl[id];
    if (dir > 0) { if (inventory.count('coin') >= buy) { inventory.take('coin', buy); inventory.add(id, 1); } }
    else if (inventory.count(id) > 0) { inventory.take(id, 1); inventory.add('coin', sell); }
    render();
  }

  function render() {
    if (!open) return;
    const port = getPort(); const tbl = port && PRICES[port];
    if (!tbl) {
      panel.innerHTML = `<div style="color:#e8b860;font:600 15px system-ui;letter-spacing:1px;margin-bottom:8px">MARKET</div>`
        + `<div style="opacity:.8;font-style:italic">Make port to trade — berth at Valdara or Puerto Dorado.</div>`
        + `<div style="color:#9a8a66;font:11px system-ui;text-align:center;margin-top:14px">T or ⚖ to close</div>`;
      return;
    }
    const rows = Object.keys(tbl).map((id) => {
      const c = cat[id] || { name: id, icon: '•' };
      const [buy, sell] = tbl[id]; const have = inventory.count(id);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(190,158,96,.18)">`
        + `<span style="font-size:20px;width:26px;text-align:center">${c.icon}</span>`
        + `<span style="flex:1">${c.name}<span style="opacity:.55;font-size:12px"> ×${have}</span></span>`
        + `<button data-b="${id}" style="${BTN}">Buy ${buy}</button>`
        + `<button data-s="${id}" style="${BTN2}">Sell ${sell}</button></div>`;
    }).join('');
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(190,158,96,.3);padding-bottom:8px;margin-bottom:8px">`
      + `<span style="color:#e8b860;font:600 15px system-ui;letter-spacing:1px">MARKET · ${port.toUpperCase()}</span>`
      + `<span style="color:#e9c87a">🪙 ${inventory.count('coin')}</span></div>`
      + rows
      + `<div style="color:#9a8a66;font:11px system-ui;text-align:center;margin-top:12px">Buy low here, sell dear at the far port · T / ⚖ to close</div>`;
    panel.querySelectorAll('button[data-b]').forEach((e) => { e.onclick = () => trade(e.dataset.b, 1); });
    panel.querySelectorAll('button[data-s]').forEach((e) => { e.onclick = () => trade(e.dataset.s, -1); });
  }
  const BTN = 'padding:5px 9px;font:600 12px system-ui;background:linear-gradient(180deg,#7a5a20,#54380e);color:#fff3df;border:1px solid #b8923f;border-radius:5px;cursor:pointer';
  const BTN2 = 'padding:5px 9px;font:600 12px system-ui;background:rgba(0,0,0,.3);color:#e9d6a8;border:1px solid rgba(190,158,96,.4);border-radius:5px;cursor:pointer';

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyT') toggle(); else if (e.key === 'Escape' && open) hide(); });

  return { toggle, get isOpen() { return open; } };
}
