// The ship's company — the named crew that made the old version feel alive.
// Each stands at a station with an idle sway; rosters carry dialogue lines so
// the interaction layer can hook them up next. Positions are in world space
// (the ship rides at the origin).
//
// EXPORT: createCrew(scene, ship) -> { group, roster[], update(t), nearest(p) }

import { Group, Vector3 } from 'three';
import { makeAvatar, animateFigure } from '../player/avatar.js';

// wrap a list of plain lines into a single-path dialogue graph
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
  'Maestre Alvarado': {
    start: 'start',
    tree: {
      start: { text: 'We make for Hispaniola. The ship answers well and the company is sound.', choices: [
        { label: 'How long until we make landfall?', to: 'eta' },
        { label: 'What do we carry?', to: 'cargo' },
        { label: 'Steady on, Maestre.', to: null },
      ] },
      eta: { text: 'Hold this heading and we raise Santo Domingo by the forenoon watch — wind willing.', choices: [
        { label: 'And if the wind fails?', to: 'wind' },
        { label: 'Understood.', to: null },
      ] },
      wind: { text: 'Then we whistle for it and pray. The Ocean Sea keeps its own counsel.', choices: [{ label: 'Aye.', to: null }] },
      cargo: { text: 'Oil, wine, cloth and iron for the colony — and hopes enough to founder her.', choices: [
        { label: 'Hopes weigh nothing.', to: 'hopes' },
        { label: 'A fair manifest.', to: null },
      ] },
      hopes: { text: 'Spoken like a man who has never had to carry them. Mind the helm, sailor.', choices: [{ label: '…', to: null }] },
    },
  },
  'Don Ferrante': {
    start: 'start',
    tree: {
      start: { text: 'Steel and faith carried us across the Ocean Sea. They will carry us ashore.', choices: [
        { label: 'You seek gold?', to: 'gold' },
        { label: 'You seek souls?', to: 'souls' },
        { label: 'God speed you.', to: null },
      ] },
      gold: { text: 'I seek what every man seeks — a name that outlasts him. Gold is merely how the world keeps score.', choices: [{ label: 'A costly score.', to: 'cost' }, { label: 'Honest enough.', to: null }] },
      souls: { text: 'The friars will see to souls. I see to the ground they stand on.', choices: [{ label: 'And those already standing on it?', to: 'cost' }, { label: 'I see.', to: null }] },
      cost: { text: 'Every shore is bought with something. Pray it is not your own conscience, friend.', choices: [{ label: '…', to: null }] },
    },
  },
  'Don Rensa': {
    start: 'start',
    tree: {
      start: { text: 'Forty days without solid ground. My legs have forgotten the trick of it.', choices: [
        { label: 'Why did you sail at all?', to: 'why' },
        { label: 'It comes back quickly.', to: 'back' },
        { label: 'Rest easy.', to: null },
      ] },
      why: { text: 'A second son inherits a sword and little else. The Indies are where such men go to become first sons.', choices: [{ label: 'Or to be forgotten.', to: 'forgot' }, { label: 'Bold.', to: null }] },
      forgot: { text: 'Better forgotten over there than ignored at home. At least the sea remembers who it drowns.', choices: [{ label: '…', to: null }] },
      back: { text: 'So they tell me. So they told the men we buried at sea, too.', choices: [{ label: 'Steady on.', to: null }] },
    },
  },
};

export function createCrew(scene, ship) {
  const group = new Group();
  scene.add(group);
  const D = ship.deckY;

  // station: [x, y, z, facingY], role, name, title, lines
  const STATIONS = [
    { p: [1.4, D + 1.2, -8.6], ry: 0.2, role: 'captain', name: 'Maestre Alvarado', title: 'Ship’s Master',
      lines: ['We make for Hispaniola. Hold this heading and we raise Santo Domingo by the forenoon watch.'] },
    { p: [0, D + 1.2, -7.6], ry: 0, role: 'sailor', name: 'Helmsman Brito', title: 'At the Helm',
      lines: ['Steady as she goes. The wheel answers slow when the hold is heavy.'] },
    { p: [-2.2, D, 1.5], ry: Math.PI * 0.55, role: 'conquistador', name: 'Don Ferrante', title: 'Conquistador',
      lines: ['Steel and faith carried us across the Ocean Sea. They will carry us ashore.'] },
    { p: [2.3, D, -1.5], ry: -Math.PI * 0.5, role: 'conquistador', name: 'Don Rensa', title: 'Conquistador',
      lines: ['I have not felt solid ground in forty days. My legs have forgotten it.'] },
    { p: [0, D + 1.0, 9.2], ry: Math.PI, role: 'conquistador', name: 'Don Cabra', title: 'Conquistador',
      lines: ['From the forecastle you see the weather first. Cloud to the south — mark it.'] },
    { p: [-1.6, D, -3.2], ry: 0.1, role: 'surgeon', name: 'Barber-Surgeon Pinto', title: 'Surgeon',
      lines: ['Scurvy, mostly. And the gunner’s ear, which he will not let me see to.'] },
    { p: [1.9, D, 3.6], ry: Math.PI * 0.9, role: 'carpenter', name: 'Carpintero Vela', title: 'Carpenter',
      lines: ['She works in a swell — every seam talks. I keep the oakum close.'] },
    { p: [2.9, D, -2.2], ry: -Math.PI * 0.5, role: 'gunner', name: 'Artillero Sosa', title: 'Master Gunner',
      lines: ['Powder stays dry in the magazine, below the waterline. Pray we never need it.'] },
    { p: [-2.6, D, -5.5], ry: 0.5, role: 'topman', name: 'Gabier Lujan', title: 'Topman',
      lines: ['Up the shrouds and out on the yard — best view on the ship, worst place in a blow.'] },
    { p: [1.4, D + 1.0, 7.8], ry: Math.PI, role: 'sailor', name: 'Marinero Cruz', title: 'Sailor',
      lines: ['Coil the lines, holystone the deck, repeat. The sea does not care for idle hands.'] },
  ];

  const roster = STATIONS.map((s, i) => {
    const node = makeAvatar(s.role);
    node.position.set(s.p[0], s.p[1], s.p[2]);
    node.rotation.y = s.ry;
    group.add(node);
    const conv = TREES[s.name] || linearTree(s.lines); // branching where authored, else a single beat
    return {
      name: s.name, title: s.title, role: s.role,
      tree: conv.tree, start: conv.start,
      node, pos: new Vector3(s.p[0], s.p[1], s.p[2]), phase: i * 1.7, baseY: s.p[1],
    };
  });

  function update(t) {
    for (const c of roster) {
      // gentle idle: subtle limb sway + a slow weight-shift bob
      animateFigure(c.node, t * 1.6 + c.phase, 0.12);
      c.node.position.y = c.baseY + Math.sin(t * 1.1 + c.phase) * 0.015;
    }
  }

  function nearest(p, maxDist = 3) {
    let best = null, bd = maxDist;
    for (const c of roster) {
      const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  return { group, roster, update, nearest };
}
