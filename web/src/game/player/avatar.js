// Shared low-poly figure builder — used by the player, the crew NPCs, and
// remote players. The old version was four stacked boxes; this rebuilds the
// figure with rounded toon forms (capsule limbs, a real head with a face),
// limbs that pivot from the hip and shoulder so the walk reads properly, and
// per-role kit (morions, plumed hats, sashes, beards). Still cheap: shared
// cached materials, ink outlines only on the big silhouette masses.
//
// Returns a Group ~1.85 units tall (feet at y=0) with
// .userData.parts = { legL, legR, armL, armR } — each a joint Group rotated by
// animateFigure() for the walk/idle cycle.

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  CapsuleGeometry, MeshStandardMaterial,
} from 'three';
import { withOutline } from '../core/toon.js';
import { mottle } from '../core/textures.js';

// cache materials by colour so a whole crew shares them (fewer GPU programs).
// PBR now (grounded with the world) — one shared mottle map gives cloth/skin/
// armour a little woven/worn relief; lit by the sun + environment.
const _mats = new Map();
const _tex = mottle(1, 1);
function mat(hex) {
  if (!_mats.has(hex)) {
    const m = new MeshStandardMaterial({ color: hex, map: _tex, bumpMap: _tex, bumpScale: 0.015, roughness: 0.82, metalness: 0 });
    m.envMapIntensity = 0.5;
    _mats.set(hex, m);
  }
  return _mats.get(hex);
}

// role -> palette + headgear + facial hair
export const ROLES = {
  player:       { skin: 0xc98d63, armor: 0x9aa3ad, cloth: 0x3a4a6b, accent: 0xb23a2c, boot: 0x4a3422, hat: 'morion', hatColor: 0x9aa3ad, beard: 0 },
  captain:      { skin: 0xc98d63, armor: 0x24304f, cloth: 0x1c2742, accent: 0xc9a23a, boot: 0x2a1c12, hat: 'plume',  hatColor: 0x161d33, plume: 0xb23a2c, beard: 0x2a1d12 },
  conquistador: { skin: 0xc08152, armor: 0x8b939d, cloth: 0x6b2f28, accent: 0xb23a2c, boot: 0x3a2818, hat: 'morion', hatColor: 0x8b939d, beard: 0x3a2616 },
  surgeon:      { skin: 0xc98d63, armor: 0x2d2a33, cloth: 0x3a3640, accent: 0x9c1c1c, boot: 0x2a2026, hat: 'none', beard: 0x4a4048 },
  carpenter:    { skin: 0xbd7e4f, armor: 0x7a5a36, cloth: 0x8a6a40, accent: 0x5a4326, boot: 0x4a3422, hat: 'cap', hatColor: 0x6b4a2c, beard: 0x4a3420 },
  gunner:       { skin: 0xb07746, armor: 0x4a4540, cloth: 0x3a3530, accent: 0x7a2a22, boot: 0x2a2420, hat: 'bandana', hatColor: 0x8a2a22, beard: 0x2a2018 },
  sailor:       { skin: 0xc98d63, armor: 0x6a7d92, cloth: 0x556270, accent: 0xb8a9bd, boot: 0x3a2c1e, hat: 'cap', hatColor: 0x44525e, beard: 0 },
  topman:       { skin: 0xc08152, armor: 0x8a7a5a, cloth: 0x7a6a4a, accent: 0x9c3a2a, boot: 0x3a2c1e, hat: 'bandana', hatColor: 0x5a6a4a, beard: 0 },
  // shore folk — the people of Sevilla and the colony
  friar:        { skin: 0xc08152, armor: 0x4a3826, cloth: 0x4a3826, accent: 0x6b5a3a, boot: 0x2a1c12, hat: 'none', beard: 0x3a2c1e },
  merchant:     { skin: 0xc98d63, armor: 0x33283f, cloth: 0x2a2038, accent: 0xc9a23a, boot: 0x2a1c12, hat: 'cap', hatColor: 0x241b30, beard: 0x2a1d12 },
  matron:       { skin: 0xd1a07a, armor: 0x7a3a4a, cloth: 0x6a3242, accent: 0xe8dcc0, boot: 0x3a2c1e, hat: 'bandana', hatColor: 0xe8dcc0, beard: 0 },
  hidalgo:      { skin: 0xc98d63, armor: 0x2a3550, cloth: 0x1c2742, accent: 0xc9a23a, boot: 0x2a1c12, hat: 'plume', hatColor: 0x161d33, plume: 0x7a2a8a, beard: 0x2a1d12 },
  urchin:       { skin: 0xbd7e4f, armor: 0x8a7a5a, cloth: 0x6a5a3a, accent: 0x5a4326, boot: 0x3a2c1e, hat: 'cap', hatColor: 0x5a4a2c, beard: 0 },
  colonist:     { skin: 0xbd7e4f, armor: 0x6a6250, cloth: 0x5a5240, accent: 0x8a5a32, boot: 0x3a2c1e, hat: 'cap', hatColor: 0x4a4636, beard: 0x3a2c1e },
};

const HIP_Y = 0.9, SHOULDER_Y = 1.42, HEAD_Y = 1.72;

export function makeAvatar(role = 'sailor') {
  const P = ROLES[role] || ROLES.sailor;
  const g = new Group();
  const parts = {};

  // place a mesh straight onto the figure (world-upright body parts)
  const put = (geo, hex, x, y, z, outline = false) => {
    const m = new Mesh(geo, mat(hex));
    m.position.set(x, y, z);
    if (outline) withOutline(m, 0.03);
    g.add(m);
    return m;
  };

  // --- LEGS: a hip joint Group; meshes hang downward inside it so rotating the
  // group swings the whole leg from the hip ---
  function leg(side) {
    const j = new Group();
    j.position.set(side * 0.12, HIP_Y, 0);
    const thigh = new Mesh(new CapsuleGeometry(0.115, 0.26, 3, 7), mat(P.cloth));
    thigh.position.y = -0.2; j.add(thigh); withOutline(thigh, 0.028);
    const shin = new Mesh(new CapsuleGeometry(0.1, 0.26, 3, 7), mat(P.boot));
    shin.position.y = -0.56; j.add(shin);
    const foot = new Mesh(new BoxGeometry(0.18, 0.14, 0.34), mat(P.boot));
    foot.position.set(0, -0.82, 0.06); j.add(foot); withOutline(foot, 0.025);
    g.add(j);
    return j;
  }
  parts.legL = leg(-1);
  parts.legR = leg(1);

  // --- PELVIS + TORSO (rounded jerkin) ---
  put(new BoxGeometry(0.34, 0.22, 0.26), P.cloth, 0, HIP_Y + 0.02, 0, true);
  const torso = new Mesh(new CapsuleGeometry(0.21, 0.34, 4, 9), mat(P.armor));
  torso.position.y = 1.18; torso.scale.set(1, 1, 0.78); g.add(torso); withOutline(torso, 0.032);
  // sash / belt across the waist
  put(new BoxGeometry(0.46, 0.12, 0.32), P.accent, 0, 1.0, 0);
  // collar / shoulder yoke
  put(new BoxGeometry(0.5, 0.12, 0.34), P.cloth, 0, SHOULDER_Y, 0);

  // --- ARMS: shoulder joint Group, meshes hang downward; rotate to swing ---
  function arm(side) {
    const j = new Group();
    j.position.set(side * 0.3, SHOULDER_Y, 0);
    const upper = new Mesh(new CapsuleGeometry(0.085, 0.24, 3, 7), mat(P.cloth));
    upper.position.y = -0.17; j.add(upper); withOutline(upper, 0.026);
    const fore = new Mesh(new CapsuleGeometry(0.078, 0.22, 3, 7), mat(P.skin));
    fore.position.y = -0.46; j.add(fore);
    const hand = new Mesh(new SphereGeometry(0.085, 7, 6), mat(P.skin));
    hand.position.y = -0.62; j.add(hand);
    g.add(j);
    return j;
  }
  parts.armL = arm(-1);
  parts.armR = arm(1);

  // --- NECK + HEAD ---
  put(new CylinderGeometry(0.07, 0.08, 0.1, 7), P.skin, 0, 1.54, 0);
  const head = put(new SphereGeometry(0.18, 10, 8), P.skin, 0, HEAD_Y, 0, true);
  head.scale.set(0.96, 1.06, 1);
  // nose + eyes give it a face that reads at a glance
  put(new ConeGeometry(0.04, 0.1, 5), P.skin, 0, HEAD_Y - 0.02, 0.17).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) put(new SphereGeometry(0.032, 6, 5), 0x1c140e, sx * 0.07, HEAD_Y + 0.03, 0.155);
  if (P.beard) {
    const b = put(new SphereGeometry(0.165, 9, 7), P.beard, 0, HEAD_Y - 0.06, 0.02);
    b.scale.set(0.92, 0.7, 0.86);
  }

  // --- HEADGEAR ---
  if (P.hat === 'morion') {
    put(new SphereGeometry(0.2, 9, 6), P.hatColor, 0, HEAD_Y + 0.08, 0).scale.set(1, 0.7, 1);
    put(new CylinderGeometry(0.3, 0.32, 0.04, 12), P.hatColor, 0, HEAD_Y + 0.02, 0).scale.z = 1.4;
    put(new BoxGeometry(0.04, 0.16, 0.42), P.hatColor, 0, HEAD_Y + 0.2, 0, true); // comb crest
  } else if (P.hat === 'plume') {
    put(new CylinderGeometry(0.32, 0.32, 0.04, 12), P.hatColor, 0, HEAD_Y + 0.06, 0).scale.z = 1.25;
    put(new CylinderGeometry(0.19, 0.21, 0.2, 10), P.hatColor, 0, HEAD_Y + 0.16, 0);
    const plume = put(new ConeGeometry(0.06, 0.42, 6), P.plume || 0xb23a2c, 0.08, HEAD_Y + 0.34, -0.06);
    plume.rotation.x = -0.5;
  } else if (P.hat === 'cap') {
    put(new SphereGeometry(0.195, 9, 6), P.hatColor, 0, HEAD_Y + 0.06, 0).scale.set(1, 0.62, 1);
  } else if (P.hat === 'bandana') {
    put(new SphereGeometry(0.19, 9, 6), P.hatColor, 0, HEAD_Y + 0.04, 0).scale.set(1, 0.55, 1);
    put(new ConeGeometry(0.05, 0.18, 5), P.hatColor, -0.14, HEAD_Y + 0.02, -0.1).rotation.z = 0.8; // knot tail
  }

  g.userData.parts = parts;
  return g;
}

// animate legs/arms; phase advances with movement, eases to rest when idle.
// Joints pivot from the hip/shoulder, so a clean fore/aft swing reads as a walk.
export function animateFigure(g, phase, intensity) {
  const p = g.userData.parts;
  if (!p) return;
  const sw = Math.sin(phase) * 0.5 * intensity;
  p.legL.rotation.x = sw;
  p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.9;
  p.armR.rotation.x = sw * 0.9;
}
