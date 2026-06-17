// The quest framework. Quests are small state machines: an ordered list of
// steps, each with a trigger that completes it and optional rewards. Progress is
// persisted (localStorage now, keyed per player so it's multiplayer-safe; a
// Supabase sync can layer on later) and drives the diegetic objective HUD.
//
// Trigger types supported now:
//   { talk: 'NPC Name' }                         — fired when you open a dialogue
//   { reach: { harbour, dx, dz, r } }            — walk within r of a design point
//   { have: { item: n, ... } }                   — hold these in your inventory
// (deliver/fish/build/sail will slot in as those systems land in Phase 2/3.)
//
// EXPORT: createQuests({ objective, inventory, sceneAt, getBerthedName, persistKey })
//   -> { start, notify, update, load, save, get active(), get step(), flag() }

const QUESTS = {
  berth: {
    name: 'A Berth of Your Own',
    steps: [
      { id: 'meet-master', title: 'Speak with the Harbourmaster', hint: 'He keeps the Sevilla quay — press F to speak.', trigger: { talk: 'Harbourmaster Quintero' } },
      { id: 'to-triana', title: 'Cross the Puente de Barcas into Triana', hint: 'The shipwrights and chandlers keep the far bank.', trigger: { reach: { harbour: 'Sevilla', dx: -38, dz: 18, r: 8 } } },
      { id: 'meet-wright', title: "Find the shipwright's slipway in Triana", hint: 'His half-built hulls line the river quay.', trigger: { reach: { harbour: 'Sevilla', dx: -60, dz: 44, r: 9 }, reward: { coin: 25 } } },
      { id: 'gather', title: 'Gather timber ×8, canvas ×3, rope ×4 & pitch ×2', hint: 'Timber in the wood beyond the gate; canvas & rope in Triana; pitch by the quay.', trigger: { have: { timber: 8, canvas: 3, rope: 4, pitch: 2 } } },
      { id: 'build', title: 'Bring the materials to the shipwright to lay your keel', hint: 'Your skiff begins on the stocks. (Shipwright build — coming next.)', trigger: { flag: 'skiff-built' } },
    ],
  },
};

export function createQuests({ objective, inventory, sceneAt, getBerthedName, persistKey = 'brig:quests' }) {
  const state = { active: null, step: 0, flags: {} };
  const _p = {}; // scratch

  function save() {
    try { localStorage.setItem(persistKey, JSON.stringify(state)); } catch {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.active !== undefined) state.active = p.active;
        if (typeof p.step === 'number') state.step = p.step;
        // merge INTO the existing flags object so the exposed `flags` reference
        // (window.brig.quests.flags, gather's skiff-built check) stays live
        if (p.flags) Object.assign(state.flags, p.flags);
      }
    } catch {}
    refreshHUD();
    return state.active;
  }

  function def() { return state.active ? QUESTS[state.active] : null; }
  function curStep() { const q = def(); return q && q.steps[state.step]; }

  function refreshHUD() {
    const s = curStep();
    if (s) objective.set(s.title, s.hint);
    else objective.clear();
  }

  function grant(reward) {
    if (!reward) return;
    if (reward.coin) inventory.add('coin', reward.coin);
    if (reward.items) for (const [k, n] of Object.entries(reward.items)) inventory.add(k, n);
  }

  function start(id) {
    if (!QUESTS[id]) return;
    state.active = id; state.step = 0;
    save(); refreshHUD();
  }

  function advance() {
    const q = def(); if (!q) return;
    const s = q.steps[state.step];
    if (s && s.trigger && s.trigger.reward) grant(s.trigger.reward);
    state.step += 1;
    if (state.step >= q.steps.length) {
      // quest complete (for now the spine ends at the build step until Phase 2/3)
      objective.set(`✓ ${q.name}`, 'Your voyage continues — provision at Sanlúcar and dare the crossing.');
      state.active = null; state.step = 0;
    } else {
      refreshHUD();
    }
    save();
  }

  // fired by main when a dialogue opens on an NPC
  function notify(type, data) {
    const s = curStep(); if (!s) return;
    if (type === 'talk' && s.trigger.talk && s.trigger.talk === data) advance();
  }

  // set a world flag (e.g. 'skiff-built') and advance if the current step waits on it
  function flag(name, val = true) {
    state.flags[name] = val;
    const s = curStep();
    if (s && s.trigger.flag === name && val) advance();
    else save();
  }

  // passive triggers, checked each frame
  function update(dt, playerPos) {
    const s = curStep(); if (!s || !playerPos) return;
    const t = s.trigger;
    if (t.reach) {
      if (getBerthedName() === t.reach.harbour) {
        const sc = sceneAt(t.reach.dx, t.reach.dz);
        if (sc && Math.hypot(playerPos.x - sc.x, playerPos.z - sc.z) < t.reach.r) advance();
      }
    } else if (t.have) {
      let ok = true;
      for (const [k, n] of Object.entries(t.have)) if (inventory.count(k) < n) { ok = false; break; }
      if (ok) advance();
    } else if (t.flag) {
      if (state.flags[t.flag]) advance(); // flag may have been set before this step became current
    }
  }

  return {
    start, notify, update, load, save, flag,
    get active() { return state.active; },
    get step() { return state.step; },
    get stepId() { const s = curStep(); return s && s.id; },
    flags: state.flags,
  };
}
