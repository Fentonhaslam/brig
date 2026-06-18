// Fishing — a little cast/bite/land loop. On foot at a riverside/coast spot, or
// over the rail while at sea, press C to cast; after a short wait a fish bites
// (a brief window) — press C again to land it. Catches go to the persisted
// inventory ('fish') and can satisfy a quest 'have' step. Cheap toon feedback
// via a prompt strip + a catch toast.
//
// EXPORT: createFishing({ inventory, sceneAt, getBerthedName, getPlayerPos, getActive, getAtSea, catalog })
//   -> { update(dt), get state, _bite(), _land() }

// riverside / coast fishing spots, in each harbour's design space
const POINTS = {
  Sevilla: [{ dx: -48, dz: 28 }, { dx: -44, dz: 18 }, { dx: -52, dz: 40 }], // Triana riverbank
  'Sanlúcar': [{ dx: -12, dz: 4 }, { dx: 14, dz: 6 }, { dx: 0, dz: 2 }],     // the coast
  'Santo Domingo': [{ dx: -9, dz: 6 }, { dx: 9, dz: 8 }],
};
const SPOT_R = 6;

export function createFishing({ inventory, quests, sceneAt, getBerthedName, getPlayerPos, getActive, getAtSea, catalog }) {
  const prompt = document.createElement('div');
  prompt.style.cssText = 'position:fixed;left:50%;bottom:58px;transform:translateX(-50%);z-index:51;display:none;'
    + 'font:600 14px system-ui;color:#fff;background:rgba(12,34,46,.62);backdrop-filter:blur(3px);'
    + 'padding:7px 15px;border-radius:18px;border:1px solid rgba(120,180,200,.4);pointer-events:none;white-space:nowrap';
  document.body.appendChild(prompt);
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:52;display:none;'
    + 'font:700 16px Georgia,serif;color:#bfe6ff;text-shadow:0 2px 8px rgba(0,0,0,.8);pointer-events:none';
  document.body.appendChild(toast);
  let toastT = 0;
  const say = (m) => { toast.textContent = m; toast.style.display = 'block'; toastT = 2.0; };

  let state = 'idle'; // idle | casting | biting
  let timer = 0;
  let canHere = false;

  function nearWater() {
    if (getAtSea && getAtSea()) return true; // over the rail at sea
    const name = getBerthedName && getBerthedName();
    const list = name && POINTS[name];
    if (!list) return false;
    const p = getPlayerPos();
    for (const s of list) { const sc = sceneAt(s.dx, s.dz); if (sc && Math.hypot(p.x - sc.x, p.z - sc.z) < SPOT_R) return true; }
    return false;
  }

  function cast() { state = 'casting'; timer = 1.2 + Math.random() * 2.4; }
  function bite() { state = 'biting'; timer = 1.7; }
  function land() {
    inventory.add('fish', 1);
    const c = catalog.fish || { name: 'Fish', icon: '🐟' };
    say(`${c.icon} Landed a ${c.name}!  (×${inventory.count('fish')})`);
    state = 'idle';
  }

  function act() {
    if (!getActive || !getActive()) return;
    if (state === 'biting') land();
    else if (state === 'casting') { state = 'idle'; say('… reeled in empty'); }
    else if (nearWater()) cast(); // live check (canHere is only refreshed per-frame)
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyC') act(); });

  function update(dt) {
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.display = 'none'; }
    canHere = nearWater();
    if (state === 'casting') { timer -= dt; if (timer <= 0) bite(); }
    else if (state === 'biting') { timer -= dt; if (timer <= 0) { state = 'idle'; say('… it got away'); } }

    if (state === 'biting') { prompt.textContent = '🎣 A bite! Press C to land it!'; prompt.style.display = 'block'; }
    else if (state === 'casting') { prompt.textContent = '🎣 Line cast — wait for a bite…'; prompt.style.display = 'block'; }
    else if (canHere) { prompt.textContent = 'Press C to cast a line'; prompt.style.display = 'block'; }
    else prompt.style.display = 'none';
  }

  // drop any in-progress cast (called on berth / cast-off so a line started at
  // sea doesn't resolve into a fish while you're now standing in port)
  function reset() { state = 'idle'; timer = 0; prompt.style.display = 'none'; }

  return { update, reset, get state() { return state; }, _bite: bite, _land: land };
}
