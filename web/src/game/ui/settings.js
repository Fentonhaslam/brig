// A tiny settings panel — pick the crossing's difficulty tier. ⚙ button by the
// other top-right controls; clicking opens a small panel of tiers.
//
// EXPORT: createSettings({ tiers, current, onPick }) -> { }

export function createSettings({ tiers, current, onPick }) {
  const btn = document.createElement('button');
  btn.textContent = '⚙'; btn.title = 'Settings — difficulty';
  btn.style.cssText = 'position:fixed;top:14px;right:106px;z-index:80;width:38px;height:38px;border:none;'
    + 'border-radius:50%;font-size:16px;cursor:pointer;color:#f3e8cf;background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:60px;right:14px;z-index:95;display:none;width:240px;'
    + 'font:14px Georgia,serif;color:#f3e8cf;background:linear-gradient(180deg,rgba(34,26,16,.98),rgba(20,15,9,.99));'
    + 'padding:14px 16px;border:1px solid rgba(190,158,96,.55);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.55)';
  document.body.appendChild(panel);

  let cur = current;
  function render() {
    panel.innerHTML = '<div style="color:#e8b860;font:600 12px system-ui;letter-spacing:1px;margin-bottom:8px">THE CROSSING</div>'
      + '<div style="font-size:12px;opacity:.8;margin-bottom:10px">How harshly the Atlantic punishes a weak hull.</div>'
      + Object.entries(tiers).map(([k, t]) =>
        `<button data-t="${k}" style="display:block;width:100%;text-align:left;margin:5px 0;padding:8px 10px;cursor:pointer;`
        + `font:600 13px system-ui;border-radius:6px;border:1px solid rgba(190,158,96,${k === cur ? 0.8 : 0.3});`
        + `color:${k === cur ? '#fff3df' : '#d8c39a'};background:${k === cur ? 'linear-gradient(180deg,#7a5a20,#54380e)' : 'rgba(0,0,0,.25)'}">`
        + `${t.label}${k === 'harsh' ? ' — roguelike' : ''}</button>`).join('')
      + '<div style="color:#9a8a66;font:11px system-ui;text-align:center;margin-top:8px">Founder and you lose by these rules.</div>';
    panel.querySelectorAll('button[data-t]').forEach((e) => { e.onclick = () => { cur = e.dataset.t; onPick(cur); render(); }; });
  }
  render();

  let open = false;
  btn.addEventListener('click', (e) => { e.stopPropagation(); open = !open; panel.style.display = open ? 'block' : 'none'; });

  return { get current() { return cur; } };
}
