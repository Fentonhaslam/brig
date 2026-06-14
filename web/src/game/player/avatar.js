// Shared low-poly figure builder — used by the player, the crew NPCs, and
// remote players. Role-tinted so a captain, surgeon, gunner and topman all read
// differently at a glance. Returns a Group ~1.8 units tall (feet at y=0) with
// .userData.parts = { legL, legR, armL, armR } for walk/idle animation.

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
} from 'three';
import { toonMaterial, withOutline } from '../core/toon.js';

// cache materials by colour so a whole crew shares them (fewer GPU programs)
const _mats = new Map();
function mat(hex) {
  if (!_mats.has(hex)) _mats.set(hex, toonMaterial(hex));
  return _mats.get(hex);
}

// role -> palette + headgear
export const ROLES = {
  player:       { skin: 0xc98d63, armor: 0x9aa3ad, cloth: 0x3a4a6b, accent: 0xb23a2c, boot: 0x4a3422, hat: 'morion', hatColor: 0x9aa3ad },
  captain:      { skin: 0xc98d63, armor: 0x24304f, cloth: 0x1c2742, accent: 0xc9a23a, boot: 0x2a1c12, hat: 'plume',  hatColor: 0x161d33, plume: 0xb23a2c },
  conquistador: { skin: 0xc08152, armor: 0x8b939d, cloth: 0x6b2f28, accent: 0xb23a2c, boot: 0x3a2818, hat: 'morion', hatColor: 0x8b939d },
  surgeon:      { skin: 0xc98d63, armor: 0x2d2a33, cloth: 0x3a3640, accent: 0x9c1c1c, boot: 0x2a2026, hat: 'none' },
  carpenter:    { skin: 0xbd7e4f, armor: 0x7a5a36, cloth: 0x8a6a40, accent: 0x5a4326, boot: 0x4a3422, hat: 'cap',    hatColor: 0x6b4a2c },
  gunner:       { skin: 0xb07746, armor: 0x4a4540, cloth: 0x3a3530, accent: 0x7a2a22, boot: 0x2a2420, hat: 'bandana', hatColor: 0x8a2a22 },
  sailor:       { skin: 0xc98d63, armor: 0x6a7d92, cloth: 0x556270, accent: 0xb8a9bd, boot: 0x3a2c1e, hat: 'cap', hatColor: 0x44525e },
  topman:       { skin: 0xc08152, armor: 0x8a7a5a, cloth: 0x7a6a4a, accent: 0x9c3a2a, boot: 0x3a2c1e, hat: 'bandana', hatColor: 0x5a6a4a },
};

export function makeAvatar(role = 'sailor') {
  const P = ROLES[role] || ROLES.sailor;
  const g = new Group();
  const parts = {};
  const add = (geo, hex, x, y, z, outline = false) => {
    const m = new Mesh(geo, mat(hex));
    m.position.set(x, y, z);
    if (outline) withOutline(m, 0.035);
    g.add(m);
    return m;
  };

  parts.legL = add(new BoxGeometry(0.26, 0.7, 0.3), P.boot, -0.16, 0.35, 0, true);
  parts.legR = add(new BoxGeometry(0.26, 0.7, 0.3), P.boot, 0.16, 0.35, 0, true);
  add(new BoxGeometry(0.62, 0.75, 0.42), P.armor, 0, 1.05, 0, true);      // torso
  add(new BoxGeometry(0.66, 0.16, 0.46), P.accent, 0, 0.86, 0);           // sash/belt
  parts.armL = add(new BoxGeometry(0.18, 0.66, 0.22), P.cloth, -0.4, 1.05, 0, true);
  parts.armR = add(new BoxGeometry(0.18, 0.66, 0.22), P.cloth, 0.4, 1.05, 0, true);
  add(new SphereGeometry(0.2, 8, 6), P.skin, 0, 1.62, 0, true);           // head

  // headgear
  if (P.hat === 'morion') {
    const dome = add(new SphereGeometry(0.24, 8, 5), P.hatColor, 0, 1.74, 0); dome.scale.set(1, 0.7, 1);
    const brim = add(new CylinderGeometry(0.34, 0.34, 0.05, 10), P.hatColor, 0, 1.66, 0); brim.scale.z = 1.5;
    add(new BoxGeometry(0.05, 0.18, 0.5), P.hatColor, 0, 1.86, 0, true);   // comb crest
  } else if (P.hat === 'plume') {
    const brim = add(new CylinderGeometry(0.36, 0.36, 0.05, 10), P.hatColor, 0, 1.7, 0); brim.scale.z = 1.3;
    const crown = add(new CylinderGeometry(0.22, 0.24, 0.22, 8), P.hatColor, 0, 1.8, 0);
    const plume = add(new ConeGeometry(0.08, 0.5, 6), P.plume || 0xb23a2c, 0.1, 2.0, -0.1); plume.rotation.x = -0.5;
  } else if (P.hat === 'cap') {
    add(new SphereGeometry(0.23, 8, 5), P.hatColor, 0, 1.72, 0).scale.set(1, 0.6, 1);
  } else if (P.hat === 'bandana') {
    add(new SphereGeometry(0.225, 8, 5), P.hatColor, 0, 1.7, 0).scale.set(1, 0.55, 1);
  }

  g.userData.parts = parts;
  return g;
}

// animate legs/arms; phase advances with movement, eases to rest when idle
export function animateFigure(g, phase, intensity) {
  const p = g.userData.parts;
  if (!p) return;
  const sw = Math.sin(phase) * 0.5 * intensity;
  p.legL.rotation.x = sw;
  p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw;
  p.armR.rotation.x = sw;
}
