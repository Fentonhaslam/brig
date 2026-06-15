// Refit: name your ship and choose her colours. A small wrench button opens a
// parchment panel with a name field and swatch rows for sail, banner and hull;
// picks apply live to the merged-mesh materials (via ship setters) and persist
// to localStorage (keyed by the player identity; re-keyed to the account on
// sign-in). The chosen name shows on a small brass plate bottom-left.

const SAILS = [0xddcfae, 0xede4cc, 0xc7d2d8, 0xd9b486, 0xb9c0a6];
const BANNERS = [0x9c3528, 0x244a8c, 0x2e7d4f, 0x6a2f8a, 0xc9a23a, 0xf0f0f0];
const HULLS = [0x5a3a20, 0x3a2a1a, 0x6a4a2c, 0x4a3550, 0x2f4038];
const DEFAULTS = { name: 'Santa Engracia', sail: SAILS[0], banner: BANNERS[0], hull: HULLS[0] };

export function createRefit({ ship, key }) {
  let lsKey = 'brig:refit:' + key;
  let state = load(lsKey) || { ...DEFAULTS };

  function load(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } }
  function save() { try { localStorage.setItem(lsKey, JSON.stringify(state)); } catch {} }

  function apply() {
    ship.setSailColor(state.sail);
    ship.setBannerColor(state.banner);
    ship.setHullColor(state.hull);
    plate.textContent = '⚓ ' + state.name;
  }

  // brass name plate
  const plate = document.createElement('div');
  plate.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:55;font:600 13px Georgia,serif;'
    + 'color:#f3e8cf;background:rgba(10,30,45,.5);backdrop-filter:blur(3px);padding:6px 12px;'
    + 'border-radius:8px;letter-spacing:.5px;pointer-events:none';
  document.body.appendChild(plate);

  // wrench button
  const btn = document.createElement('button');
  btn.textContent = '🔧'; btn.title = 'Refit the ship';
  btn.style.cssText = 'position:fixed;top:14px;right:152px;z-index:80;width:38px;height:38px;border:none;'
    + 'border-radius:50%;font-size:16px;cursor:pointer;color:#f3e8cf;background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:60px;right:14px;z-index:96;display:none;width:300px;'
    + 'font:14px Georgia,serif;color:#f3e8cf;background:linear-gradient(180deg,rgba(32,24,14,.98),rgba(18,13,8,.99));'
    + 'padding:16px;border:1px solid rgba(190,158,96,.55);border-radius:9px;box-shadow:0 14px 40px rgba(0,0,0,.6)';
  document.body.appendChild(panel);

  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  function row(label, list, field) {
    const sw = list.map((c) => `<span data-c="${c}" data-f="${field}" style="display:inline-block;width:26px;height:26px;`
      + `margin:2px;border-radius:5px;cursor:pointer;background:${hex(c)};`
      + `border:2px solid ${c === state[field] ? '#f0d070' : 'rgba(0,0,0,.4)'}"></span>`).join('');
    return `<div style="margin-top:10px"><div style="font-size:11px;letter-spacing:1px;opacity:.7;text-transform:uppercase">${label}</div>${sw}</div>`;
  }
  function render() {
    panel.innerHTML = `<div style="color:#e8b860;font:600 14px system-ui;letter-spacing:1px;margin-bottom:8px">REFIT</div>`
      + `<input id="refit-name" maxlength="28" value="${state.name.replace(/"/g, '&quot;')}" `
      + `style="width:100%;box-sizing:border-box;padding:8px 10px;font:15px Georgia,serif;background:rgba(0,0,0,.3);border:1px solid rgba(200,160,90,.3);border-radius:4px;color:#f4ead2" />`
      + row('Sails', SAILS, 'sail') + row('Banner', BANNERS, 'banner') + row('Hull', HULLS, 'hull')
      + `<div style="font-size:11px;opacity:.55;margin-top:12px;font-style:italic">Saved to your log.</div>`;
    panel.querySelector('#refit-name').oninput = (e) => { state.name = e.target.value || 'Brig'; plate.textContent = '⚓ ' + state.name; save(); };
    panel.querySelectorAll('span[data-c]').forEach((s) => {
      s.onclick = () => { state[s.dataset.f] = +s.dataset.c; apply(); save(); render(); };
    });
  }

  let open = false;
  btn.onclick = () => { open = !open; panel.style.display = open ? 'block' : 'none'; if (open) render(); };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { open = false; panel.style.display = 'none'; } });

  apply();
  return {
    apply,
    setKey(k) { lsKey = 'brig:refit:' + k; const s = load(lsKey); if (s) { state = s; apply(); } else { save(); } },
    get name() { return state.name; },
  };
}
