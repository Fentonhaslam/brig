// The people ashore — townsfolk who give each port a pulse. Unlike the ship's
// crew (fixed avatars at the origin), these are spawned when you berth and
// cleared when you cast off, because the harbour they belong to lives in the
// world group: their roster positions are authored in the same design space as
// the harbour build (dx, dz; dz runs inland, flipped by `dir`), then mapped to
// scene space through the world matrix at berth time — exactly as the quay
// colliders are. While berthed the world is static, so they stay put on the
// cobbles and wander a little around their patch. Same dialogue shape as crew.
//
// EXPORT: createTownsfolk(scene) -> { group, roster, populate(h, m), clear(), update(t,dt), nearest(p) }

import { Group, Vector3 } from 'three';
import { makeAvatar, animateFigure } from '../player/avatar.js';

function linearTree(lines) {
  const tree = {};
  lines.forEach((ln, i) => {
    const last = i === lines.length - 1;
    tree['n' + i] = { text: ln, choices: [{ label: last ? 'Farewell.' : 'Go on…', to: last ? null : 'n' + (i + 1) }] };
  });
  return { tree, start: 'n0' };
}

// hand-authored branching conversations, keyed by name
const TREES = {
  'Harbourmaster Quintero': {
    start: 'start',
    tree: {
      start: { text: 'New off the barge? Welcome to Sevilla, sailor. Every soul here is chasing the same thing you are — a deck of their own and a fair wind to the Indies.', choices: [
        { label: 'How do I get a ship?', to: 'ship' },
        { label: 'What is there to do here?', to: 'do' },
        { label: 'Thank you, Harbourmaster.', to: null },
      ] },
      ship: { text: 'You don’t buy your first boat — you build it. Cross the Puente de Barcas to Triana and find the shipwright. He’ll want timber, canvas, rope and pitch before he lays a keel for you.', choices: [
        { label: 'Where do I find all that?', to: 'mats' },
        { label: 'I’ll see the shipwright.', to: null },
      ] },
      mats: { text: 'Timber from the wood beyond the gate, canvas and rope from the Triana chandlers, pitch from the boilers by the quay. Earn coin on errands and trade, and the rest follows. Mind — that great nao at the quay is the Crown’s, not for the likes of us.', choices: [{ label: 'Understood.', to: null }] },
      do: { text: 'Trade at the market, run errands for the merchants and friars, fish the river. Coin and goodwill both buy you closer to a hull of your own.', choices: [{ label: 'Good to know.', to: null }] },
    },
  },
  'Maestro Ribera': {
    start: 'start',
    tree: {
      start: { text: 'So the Harbourmaster sent you. Aye — I build the little boats, the skiffs that teach a man the sea before it kills him. Bring me the makings and I’ll lay your keel.', choices: [
        { label: 'What do you need?', to: 'need' },
        { label: 'Why not just sell me one?', to: 'sell' },
        { label: 'I’ll be back.', to: null },
      ] },
      need: { text: 'Timber for the hull, sailcloth for the canvas, hemp for the rope, pitch to keep the sea out. Stack them on the slipway and lay the keel — then we build.', choices: [{ label: 'Where do I find it all?', to: 'where' }, { label: 'Right.', to: null }] },
      where: { text: 'Timber from the wood past the gate. Canvas and rope from the Triana chandlers. Pitch from the boilers down on the quay. Honest work, all of it.', choices: [{ label: 'Thank you, maestro.', to: null }] },
      sell: { text: 'A boat you didn’t build is a boat you don’t understand — and out on the Ocean Sea, that is how men drown. You’ll build this one.', choices: [{ label: 'Fair enough.', to: null }] },
    },
  },
  'Mercader Esquivel': {
    start: 'start',
    tree: {
      start: { text: 'You came in on the nao? Then you know — everything passes through Sevilla now. The Casa de Contratación weighs every ounce of it.', choices: [
        { label: 'What sells in the Indies?', to: 'sell' },
        { label: 'What comes back?', to: 'back' },
        { label: 'Good trading to you.', to: null },
      ] },
      sell: { text: 'Wine, oil, cloth, iron, tools — anything a colony cannot yet make. Buy it cheap here, and the far quay will pay you dearly for it.', choices: [{ label: 'And the return?', to: 'back' }, { label: 'I’ll remember that.', to: null }] },
      back: { text: 'Gold and spice, when the fleets are kind. A single hold can make a poor man a hidalgo — or feed the fish. The sea takes its tithe.', choices: [{ label: 'A gambler’s trade.', to: 'gamble' }, { label: 'Worth the risk.', to: null }] },
      gamble: { text: 'All trade is a wager, friend. The difference is whether you wager with cloth or with your life. Out there, it is often both.', choices: [{ label: '…', to: null }] },
    },
  },
  'Fray Bartolomé': {
    start: 'start',
    tree: {
      start: { text: 'The Giralda still calls the faithful, though it was a Moor’s minaret once. God works through what He inherits.', choices: [
        { label: 'You sail for the Indies?', to: 'sail' },
        { label: 'A grand cathedral.', to: 'cath' },
        { label: 'Peace, brother.', to: null },
      ] },
      sail: { text: 'I am sent to save souls. But I have read the reports from Hispaniola, and I fear we damn more than we save. Pray I am wrong.', choices: [{ label: 'What do the reports say?', to: 'reports' }, { label: 'A heavy charge.', to: null }] },
      reports: { text: 'That the people of those islands die under our care faster than we can baptise them. Gold has a way of drowning the gospel. Mind your own conscience out there.', choices: [{ label: '…', to: null }] },
      cath: { text: '“Let us build a church so great that those who see it finished will think us mad.” So the chapter said. They were not wrong on either count.', choices: [{ label: 'Madness or faith?', to: 'mad' }, { label: 'It is magnificent.', to: null }] },
      mad: { text: 'Is there a difference, when the stone reaches that high? Go with God, sailor.', choices: [{ label: '…', to: null }] },
    },
  },
  'Don Lope': {
    start: 'start',
    tree: {
      start: { text: 'A second son with a good name and an empty purse — that is what stands before you. The Indies are where such men go to mend the second part.', choices: [
        { label: 'You seek a ship?', to: 'ship' },
        { label: 'And risk the first part?', to: 'name' },
        { label: 'Fortune favour you.', to: null },
      ] },
      ship: { text: 'A berth, a sword, and a letter of introduction to the governor. Give me those and I will give Castile a new province. Do you sail soon?', choices: [{ label: 'Perhaps.', to: null }, { label: 'The sea is hard.', to: 'name' }] },
      name: { text: 'A name unspent is no name at all. Better to wager it on a far shore than polish it in an empty hall in Sevilla. I will take the ship.', choices: [{ label: '…', to: null }] },
    },
  },
};

// Per-port rosters. Design coords (dx, dz) match the harbour build: dz runs
// inland from the quay (flipped by dir), dx is left/right; keep folk in the
// open avenue/plaza, clear of the house colliders at |dx|~13/23.
const FOLK = {
  Sevilla: [
    { name: 'Harbourmaster Quintero', title: 'Harbourmaster', role: 'captain', dx: 6, dz: 12, ry: Math.PI * 0.92, radius: 1.4 },
    { name: 'Estibador Rufino', title: 'Stevedore', role: 'colonist', dx: -6, dz: 12, ry: 0.4,
      lines: ['Forty casks of oil before the bell, they tell me. My back tells me otherwise.', 'Every ship that sails takes a piece of Sevilla with it — and brings back two strangers.'] },
    { name: 'Perico', title: 'Quay Urchin', role: 'urchin', dx: 7, dz: 19, ry: -0.6, scale: 0.72, radius: 3.4,
      lines: ['Señor! Señor! Did you cross the Ocean Sea? Did you see a sea-monster? I am going to sail one day, you’ll see!'] },
    { name: 'Mercader Esquivel', title: 'Merchant', role: 'merchant', dx: 4, dz: 30, ry: Math.PI * 0.9 },
    { name: 'Doña Inés', title: 'Market Wife', role: 'matron', dx: -5, dz: 31, ry: 0.7,
      lines: ['Sardines, fresh up from the river! …no? You have the look of a man with salt still in his ears.', 'My Andrés sailed three years past. I keep a candle for him at the cathedral. The sea keeps its own counsel.'] },
    { name: 'Fray Bartolomé', title: 'Friar', role: 'friar', dx: -4, dz: 44, ry: 0.2 },
    { name: 'Don Lope', title: 'Hidalgo', role: 'hidalgo', dx: 6, dz: 58, ry: Math.PI },
    { name: 'Maestro Ribera', title: 'Shipwright', role: 'carpenter', dx: -58, dz: 40, ry: -0.5, radius: 1.6 },
  ],
  'Santo Domingo': [
    { name: 'Colono Mateo', title: 'Settler', role: 'colonist', dx: -6, dz: 12, ry: 0.4,
      lines: ['We are building a city out of mud and ambition. Mostly mud, so far.', 'Bring tools and nails on your next crossing — we will pay in whatever the land gives up.'] },
    { name: 'Soldado Vargas', title: 'Soldier of the Keep', role: 'conquistador', dx: 6, dz: 16, ry: -0.4,
      lines: ['I crossed an ocean to stand guard over a half-built wall. Glory is slower in arriving than the friars promised.', 'Keep your powder dry and your eyes on the treeline. This island is not as tame as the maps pretend.'] },
    { name: 'Fray Domingo', title: 'Missionary', role: 'friar', dx: -3, dz: 22, ry: 0.3,
      lines: ['The bell we hung last month is the first in the New World. Its sound still surprises the birds.', 'Tell them in Sevilla that souls are saved here — and ask them, quietly, at what cost.'] },
  ],
};

export function createTownsfolk(scene) {
  const group = new Group();
  scene.add(group);
  let roster = [];
  const _v = new Vector3();

  function clear() {
    for (const c of roster) group.remove(c.node);
    roster = [];
  }

  // map design-space (dx, dz) -> world offset (mirroring the quay-collider
  // convention) -> scene space through the berth-time world matrix
  function populate(h, worldMatrix) {
    clear();
    const list = FOLK[h.name];
    if (!list) return;
    roster = list.map((f, i) => {
      const node = makeAvatar(f.role);
      if (f.scale) node.scale.setScalar(f.scale);
      _v.set(h.worldPoint.x + f.dx, h.worldPoint.y + h.walkY, h.worldPoint.z + f.dz * h.dir).applyMatrix4(worldMatrix);
      const base = _v.clone();
      node.position.copy(base);
      node.rotation.y = f.ry || 0;
      group.add(node);
      const conv = TREES[f.name] || linearTree(f.lines);
      return {
        name: f.name, title: f.title, role: f.role,
        tree: conv.tree, start: conv.start,
        node, pos: base.clone(), base, target: base.clone(),
        phase: i * 1.7, baseY: base.y,
        mode: 'idle', timer: 1 + i * 0.7, stride: 0, gesture: 0,
        radius: f.radius ?? 2.4, frozen: false,
      };
    });
  }

  function update(t, dt = 0.016) {
    for (const c of roster) {
      if (c.frozen) {
        c.mode = 'idle'; c.gesture = 0;
        animateFigure(c.node, t * 1.6 + c.phase, 0.1);
      } else if (c.mode === 'walk') {
        const dx = c.target.x - c.node.position.x, dz = c.target.z - c.node.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.16) { c.mode = 'idle'; c.timer = 1.5 + Math.random() * 3.5; c.stride = 0; }
        else {
          const step = Math.min(d, 1.1 * dt);
          c.node.position.x += (dx / d) * step;
          c.node.position.z += (dz / d) * step;
          c.node.rotation.y = Math.atan2(dx, dz);
          c.stride += dt * 7;
          animateFigure(c.node, c.stride, 1);
        }
      } else {
        c.timer -= dt;
        if (c.gesture > 0) {
          c.gesture -= dt;
          animateFigure(c.node, 0, 0);
          c.node.userData.parts.armR.rotation.x = -1.3 + Math.sin(t * 5) * 0.15;
        } else {
          animateFigure(c.node, t * 1.6 + c.phase, 0.12);
        }
        if (c.timer <= 0) {
          if (Math.random() < 0.6) { // amble to a new spot on the patch
            const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * c.radius;
            c.target.set(c.base.x + Math.cos(a) * r, c.base.y, c.base.z + Math.sin(a) * r);
            c.mode = 'walk';
          } else {
            c.gesture = 1.0 + Math.random() * 1.6;
            c.timer = c.gesture + 0.8;
          }
        }
      }
      c.node.position.y = c.baseY + Math.sin(t * 1.1 + c.phase) * 0.012;
      c.pos.copy(c.node.position);
    }
  }

  function nearest(p, maxDist = 2.6) {
    let best = null, bd = maxDist;
    for (const c of roster) {
      const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  return { group, get roster() { return roster; }, populate, clear, update, nearest };
}
