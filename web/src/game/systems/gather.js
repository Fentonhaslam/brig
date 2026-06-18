// Gathering + the shipwright's build. Located interactions in the Andalusian
// region: stand near a gather point and press G to harvest a material (with a
// short cooldown + a pickup toast), or near the Ribalta slipway press G to lay
// your skiff's keel once you hold the materials. Everything routes through the
// persisted inventory and can complete 'have'/'flag' quest steps.
//
// EXPORT: createGather({ inventory, quests, sceneAt, getBerthedName, getPlayerPos, getActive, catalog })
//   -> { update(dt), get near() }

// the skiff recipe — must match the spine quest's 'have' step
export const SKIFF_RECIPE = { timber: 8, canvas: 3, rope: 4, pitch: 2 };
// patching the hull at the slipway costs less
export const REPAIR_RECIPE = { timber: 2, pitch: 1 };

// gather + build points, in Valdara-region design coords (Ribalta + campiña are
// part of the Valdara harbour build)
const POINTS = {
  Valdara: [
    { dx: -42, dz: 98, r: 6.5, item: 'timber', verb: 'fell timber', cd: 0.9 },
    { dx: -36, dz: 110, r: 6.5, item: 'timber', verb: 'fell timber', cd: 0.9 },
    { dx: -74, dz: 50, r: 5.5, item: 'canvas', verb: 'cut sailcloth at the chandler', cd: 0.9 },
    { dx: -62, dz: 58, r: 5.5, item: 'rope', verb: 'lay rope at the ropewalk', cd: 0.9 },
    { dx: -50, dz: 31, r: 6, item: 'pitch', verb: 'render pitch at the boilers', cd: 0.9 },
    { dx: -60, dz: 44, r: 6.5, build: true },
  ],
};

export function createGather({ inventory, quests, sceneAt, getBerthedName, getPlayerPos, getActive, catalog, hull }) {
  // prompt (just above the main hint) + a pickup toast
  const prompt = document.createElement('div');
  prompt.style.cssText = 'position:fixed;left:50%;bottom:58px;transform:translateX(-50%);z-index:51;display:none;'
    + 'font:600 14px system-ui;color:#fff;background:rgba(40,28,10,.62);backdrop-filter:blur(3px);'
    + 'padding:7px 15px;border-radius:18px;border:1px solid rgba(190,158,96,.4);pointer-events:none;white-space:nowrap';
  document.body.appendChild(prompt);
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:52;display:none;'
    + 'font:700 15px Georgia,serif;color:#ffe6b0;text-shadow:0 2px 8px rgba(0,0,0,.8);pointer-events:none';
  document.body.appendChild(toast);
  let toastT = 0;
  const say = (m) => { toast.textContent = m; toast.style.display = 'block'; toastT = 1.8; };

  let near = null;       // the in-range point this frame
  const cds = new Map(); // point -> seconds remaining

  function harvest(pt) {
    if ((cds.get(pt) || 0) > 0) return;
    inventory.add(pt.item, 1);
    cds.set(pt, pt.cd);
    const c = catalog[pt.item] || { name: pt.item, icon: '•' };
    say(`${c.icon} +1 ${c.name}  (×${inventory.count(pt.item)})`);
  }

  function missing() {
    const m = [];
    for (const [k, n] of Object.entries(SKIFF_RECIPE)) { const have = inventory.count(k); if (have < n) m.push(`${(catalog[k] || {}).name || k} ${have}/${n}`); }
    return m;
  }
  function lacks(recipe) {
    const m = [];
    for (const [k, n] of Object.entries(recipe)) { const have = inventory.count(k); if (have < n) m.push(`${(catalog[k] || {}).name || k} ${have}/${n}`); }
    return m;
  }
  function build() {
    const built = quests && quests.flags && quests.flags['skiff-built'];
    if (built) { // already have a skiff — the slipway repairs it instead
      if (hull && hull.hull < 100) {
        const need = lacks(REPAIR_RECIPE);
        if (need.length) { say('Repairs need: ' + need.join(' · ')); return; }
        for (const [k, n] of Object.entries(REPAIR_RECIPE)) inventory.take(k, n);
        hull.repair(30); say(`⚒ Hull patched — ${Math.round(hull.hull)}%`);
      } else say('⚓ Your skiff is sound.');
      return;
    }
    const m = missing();
    if (m.length) { say('Need: ' + m.join(' · ')); return; }
    for (const [k, n] of Object.entries(SKIFF_RECIPE)) inventory.take(k, n);
    if (quests) quests.flag('skiff-built');
    say('⚓ Your keel is laid — the shipwright sets to work!');
  }

  function interact() {
    if (!near || !getActive || !getActive()) return;
    if (near.build) build(); else harvest(near);
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyG') interact(); });

  function update(dt) {
    for (const [pt, v] of cds) if (v > 0) cds.set(pt, Math.max(0, v - dt));
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.display = 'none'; }

    near = null;
    const name = getBerthedName && getBerthedName();
    const list = name && POINTS[name];
    const active = getActive ? getActive() : true;
    if (list && active) {
      const p = getPlayerPos();
      let best = 1e9;
      for (const pt of list) {
        const sc = sceneAt(pt.dx, pt.dz);
        if (!sc) continue;
        const d = Math.hypot(p.x - sc.x, p.z - sc.z);
        if (d < pt.r && d < best) { best = d; near = pt; }
      }
    }
    if (near) {
      if (near.build) {
        const built = quests && quests.flags && quests.flags['skiff-built'];
        if (built) prompt.textContent = (hull && hull.hull < 100) ? '⚒ Press G to repair the hull (timber×2, pitch×1)' : 'The shipwright’s slipway';
        else { const m = missing(); prompt.textContent = m.length ? `Shipwright — needs ${m.join(' · ')}` : '⚒ Press G to lay your skiff’s keel'; }
      } else {
        const onCd = (cds.get(near) || 0) > 0;
        prompt.textContent = onCd ? '…' : `Press G to ${near.verb}`;
      }
      prompt.style.display = 'block';
    } else {
      prompt.style.display = 'none';
    }
  }

  return { update, get near() { return near; } };
}
