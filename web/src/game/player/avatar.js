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

// soft contact-ink: thin, warm-dark outlines that read as a grounding shadow
// line rather than a hard cartoon marker. Silhouette masses (head/torso) get a
// touch more; limbs barely any. Tuned down hard from the old 0.025–0.032 ink.
const INK = 0x281b12;
const OUT = { body: 0.016, limb: 0.009, kit: 0.012 };

// Shared geometry — every figure is identical in shape (only material colour and
// a few per-mesh scales vary), so one set of geometries serves the whole cast.
// This removes ~30 BufferGeometry allocations per avatar (a crew + townsfolk =
// hundreds) and means disposeAvatar() only has to free the per-instance outline
// shells; the shared geometries below live for the page and are never disposed.
// Segment counts bumped up for rounder, less-faceted silhouettes — paid once.
const GEO = {
  thigh: new CapsuleGeometry(0.12, 0.3, 4, 14),
  shin: new CapsuleGeometry(0.1, 0.3, 4, 14),
  foot: new BoxGeometry(0.18, 0.13, 0.36),
  pelvis: new BoxGeometry(0.33, 0.22, 0.25),
  torso: new CapsuleGeometry(0.205, 0.42, 6, 16),
  sash: new BoxGeometry(0.45, 0.12, 0.31),
  collar: new BoxGeometry(0.48, 0.12, 0.33),
  armUpper: new CapsuleGeometry(0.082, 0.26, 4, 12),
  armFore: new CapsuleGeometry(0.072, 0.24, 4, 12),
  hand: new SphereGeometry(0.08, 12, 9),
  neck: new CylinderGeometry(0.066, 0.082, 0.12, 12),
  head: new SphereGeometry(0.17, 22, 16),
  brow: new BoxGeometry(0.085, 0.022, 0.04),
  nose: new ConeGeometry(0.034, 0.085, 8),
  eye: new SphereGeometry(0.03, 10, 8),
  beard: new SphereGeometry(0.158, 14, 11),
  morionDome: new SphereGeometry(0.195, 14, 9),
  morionBrim: new CylinderGeometry(0.3, 0.32, 0.04, 20),
  morionComb: new BoxGeometry(0.04, 0.16, 0.42),
  plumeBrim: new CylinderGeometry(0.32, 0.32, 0.04, 20),
  plumeCrown: new CylinderGeometry(0.19, 0.21, 0.2, 16),
  plume: new ConeGeometry(0.06, 0.42, 8),
  cap: new SphereGeometry(0.19, 14, 9),
  bandanaDome: new SphereGeometry(0.185, 14, 9),
  bandanaKnot: new ConeGeometry(0.05, 0.18, 7),
};

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
  // shore folk — the people of Valdara and the colony
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

  // place a mesh straight onto the figure (world-upright body parts).
  // `outline` may be true (→ body weight) or a number (explicit thickness).
  const put = (geo, hex, x, y, z, outline = false) => {
    const m = new Mesh(geo, mat(hex));
    m.position.set(x, y, z);
    if (outline) withOutline(m, typeof outline === 'number' ? outline : OUT.body, INK);
    g.add(m);
    return m;
  };

  // --- LEGS: a hip joint Group; meshes hang downward inside it so rotating the
  // group swings the whole leg from the hip ---
  function leg(side) {
    const j = new Group();
    j.position.set(side * 0.12, HIP_Y, 0);
    const thigh = new Mesh(GEO.thigh, mat(P.cloth));
    thigh.position.y = -0.2; j.add(thigh); withOutline(thigh, OUT.limb, INK);
    const shin = new Mesh(GEO.shin, mat(P.boot));
    shin.position.y = -0.58; j.add(shin);
    const foot = new Mesh(GEO.foot, mat(P.boot));
    foot.position.set(0, -0.84, 0.07); j.add(foot); withOutline(foot, OUT.limb, INK);
    g.add(j);
    return j;
  }
  parts.legL = leg(-1);
  parts.legR = leg(1);

  // --- PELVIS + TORSO (rounded jerkin) ---
  put(GEO.pelvis, P.cloth, 0, HIP_Y + 0.02, 0, true);
  const torso = new Mesh(GEO.torso, mat(P.armor));
  torso.position.y = 1.18; torso.scale.set(1, 1, 0.76); g.add(torso); withOutline(torso, OUT.body, INK);
  // sash / belt across the waist
  put(GEO.sash, P.accent, 0, 1.0, 0);
  // collar / shoulder yoke
  put(GEO.collar, P.cloth, 0, SHOULDER_Y, 0);

  // --- ARMS: shoulder joint Group, meshes hang downward; rotate to swing ---
  function arm(side) {
    const j = new Group();
    j.position.set(side * 0.3, SHOULDER_Y, 0);
    const upper = new Mesh(GEO.armUpper, mat(P.cloth));
    upper.position.y = -0.17; j.add(upper); withOutline(upper, OUT.limb, INK);
    const fore = new Mesh(GEO.armFore, mat(P.skin));
    fore.position.y = -0.46; j.add(fore);
    const hand = new Mesh(GEO.hand, mat(P.skin));
    hand.position.y = -0.62; j.add(hand);
    g.add(j);
    return j;
  }
  parts.armL = arm(-1);
  parts.armR = arm(1);

  // --- NECK + HEAD ---
  put(GEO.neck, P.skin, 0, 1.54, 0);
  const head = put(GEO.head, P.skin, 0, HEAD_Y, 0, true);
  head.scale.set(0.95, 1.05, 0.98);
  // a face that reads at a glance: brow line, set-in eyes (white + dark iris),
  // a smaller nose. The eyes sit slightly into the head so they don't bulge.
  const browCol = P.beard || 0x3a2a1c;
  put(GEO.nose, P.skin, 0, HEAD_Y - 0.025, 0.165).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) {
    // a dark, set-in almond eye (reads grounded at distance — no white sclera)
    put(GEO.eye, 0x1a120c, sx * 0.07, HEAD_Y + 0.02, 0.156).scale.set(1.2, 0.78, 0.7);
    put(GEO.brow, browCol, sx * 0.07, HEAD_Y + 0.082, 0.158).rotation.z = sx * 0.12;
  }
  if (P.beard) {
    const b = put(GEO.beard, P.beard, 0, HEAD_Y - 0.06, 0.02);
    b.scale.set(0.92, 0.72, 0.86);
  }

  // --- HEADGEAR ---
  if (P.hat === 'morion') {
    put(GEO.morionDome, P.hatColor, 0, HEAD_Y + 0.08, 0).scale.set(1, 0.7, 1);
    put(GEO.morionBrim, P.hatColor, 0, HEAD_Y + 0.02, 0).scale.z = 1.4;
    put(GEO.morionComb, P.hatColor, 0, HEAD_Y + 0.2, 0, true); // comb crest
  } else if (P.hat === 'plume') {
    put(GEO.plumeBrim, P.hatColor, 0, HEAD_Y + 0.06, 0).scale.z = 1.25;
    put(GEO.plumeCrown, P.hatColor, 0, HEAD_Y + 0.16, 0);
    const plume = put(GEO.plume, P.plume || 0xb23a2c, 0.08, HEAD_Y + 0.34, -0.06);
    plume.rotation.x = -0.5;
  } else if (P.hat === 'cap') {
    put(GEO.cap, P.hatColor, 0, HEAD_Y + 0.06, 0).scale.set(1, 0.62, 1);
  } else if (P.hat === 'bandana') {
    put(GEO.bandanaDome, P.hatColor, 0, HEAD_Y + 0.04, 0).scale.set(1, 0.55, 1);
    put(GEO.bandanaKnot, P.hatColor, -0.14, HEAD_Y + 0.02, -0.1).rotation.z = 0.8; // knot tail
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

// Free an avatar's GPU resources when it's removed for good (e.g. townsfolk on
// cast-off). Only the inverted-hull outline shells own unique materials — the
// body geometries (GEO) and colour materials (_mats) are shared across the whole
// cast and must survive, so we dispose just the per-instance ShaderMaterials.
export function disposeAvatar(node) {
  node.traverse((o) => {
    if (o.material && o.material.isShaderMaterial) o.material.dispose();
  });
}
