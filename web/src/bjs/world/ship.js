// Procedural Spanish nao / galleon, c. early 16th century — Babylon.js port of
// the Three.js ship.js. Three masts: foresail + mainsail (square rig) + lateen
// mizzen. Built from primitives (MeshBuilder) + custom VertexData lofts. PBR
// materials for the cinematic look. Babylon is LEFT-HANDED.
//
//   export function createShip(scene) -> {
//     root, colliders:{walkable,solid}, npcs, helmStand, wheel,
//     anchor:{node,upY,downY,up}, gunports, capstan, capstanStation,
//     gunStation, setSails(d), update(t)
//   }

import {
  Vector3, Color3, Mesh, VertexData, MeshBuilder, TransformNode,
  PBRMaterial, StandardMaterial, DynamicTexture, PointLight, Scalar,
} from '@babylonjs/core';

export const SHIP_SCALE = 1.4;

// ---------------------------------------------------------------------------
// Materials (PBR, shared)
// ---------------------------------------------------------------------------
function pbr(scene, name, hex, rough, metal = 0.02, twoSided = false) {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex);
  m.metallic = metal; m.roughness = rough;
  if (twoSided) m.backFaceCulling = false;
  return m;
}
function emissivePbr(scene, name, hex, emHex, emInt, rough = 0.4, alpha = 1) {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex);
  m.emissiveColor = Color3.FromHexString(emHex).scale(emInt);
  m.metallic = 0; m.roughness = rough;
  if (alpha < 1) { m.alpha = alpha; m.transparencyMode = 2; }
  return m;
}

function buildMaterials(scene) {
  return {
    hullDark:   pbr(scene, 'sh_hullDark', '#4a2c18', 0.92, 0.02, true),
    hullMid:    pbr(scene, 'sh_hullMid', '#6a4220', 0.85, 0.02, true),
    hullLight:  pbr(scene, 'sh_hullLight', '#8a5828', 0.78),
    deck:       pbr(scene, 'sh_deck', '#a07440', 0.95, 0.0),
    deckDark:   pbr(scene, 'sh_deckDark', '#8a5e30', 0.95, 0.0),
    hold:       pbr(scene, 'sh_hold', '#3a2210', 0.98, 0.0),
    beam:       pbr(scene, 'sh_beam', '#2a1810', 0.95),
    barrel:     pbr(scene, 'sh_barrel', '#5a3a1c', 0.9),
    cannon:     pbr(scene, 'sh_cannon', '#14110c', 0.4, 0.7),
    mast:       pbr(scene, 'sh_mast', '#3a2a18', 0.88),
    spar:       pbr(scene, 'sh_spar', '#2a1d10', 0.9),
    trimGold:   pbr(scene, 'sh_trimGold', '#c89030', 0.35, 0.65),
    trimRed:    pbr(scene, 'sh_trimRed', '#801818', 0.7),
    iron:       pbr(scene, 'sh_iron', '#1a1410', 0.55, 0.8),
    flagWhite:  pbr(scene, 'sh_flagWhite', '#f2ead0', 0.7, 0.0, true),
    flagRed:    pbr(scene, 'sh_flagRed', '#a01818', 0.7, 0.0, true),
    windowGlow: emissivePbr(scene, 'sh_windowGlow', '#ffe2a0', '#ffaa44', 0.8),
    lanternGlow:emissivePbr(scene, 'sh_lanternGlow', '#fff0c0', '#ff9438', 3.0, 0.4),
    flame:      emissivePbr(scene, 'sh_flame', '#ffd070', '#ff8418', 4.0, 0.5, 0.92),
    flameHot:   emissivePbr(scene, 'sh_flameHot', '#fff0c0', '#ffb030', 5.0, 0.4),
    glassGlow:  emissivePbr(scene, 'sh_glassGlow', '#ffca78', '#ff9028', 1.6, 0.2, 0.55),
    ember:      emissivePbr(scene, 'sh_ember', '#3a1206', '#ff5410', 2.4, 0.9),
  };
}

// ---------------------------------------------------------------------------
// Sail cloth — procedural canvas texture via DynamicTexture
// ---------------------------------------------------------------------------
function makeSailTexture(scene, name, cross) {
  const dt = new DynamicTexture(name, { width: 512, height: 512 }, scene, true);
  const x = dt.getContext();
  x.fillStyle = '#e9dfc4'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 40) {
    x.fillStyle = 'rgba(120,100,68,0.12)'; x.fillRect(i, 0, 2, 512);
    x.fillStyle = 'rgba(255,252,240,0.07)'; x.fillRect(i + 2, 0, 1, 512);
  }
  for (const yy of [110, 285, 410]) {
    x.fillStyle = 'rgba(150,124,82,0.28)'; x.fillRect(0, yy, 512, 7);
    x.fillStyle = 'rgba(70,52,28,0.55)';
    for (let i = 18; i < 512; i += 38) x.fillRect(i, yy - 4, 3, 15);
  }
  for (let k = 0; k < 60; k++) {
    const px = ((k * 97) % 512), py = ((k * 211) % 512), r = 18 + (k % 5) * 14;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(120,98,62,0.05)'); g.addColorStop(1, 'rgba(120,98,62,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r);
  }
  if (cross) {
    x.strokeStyle = '#9c2118'; x.lineWidth = 30; x.lineCap = 'round';
    x.beginPath();
    x.moveTo(80, 80); x.lineTo(432, 432);
    x.moveTo(432, 80); x.lineTo(80, 432);
    x.stroke();
    x.fillStyle = '#86170f';
    for (let t = 0.12; t < 0.9; t += 0.16) {
      x.fillRect(80 + 352 * t - 6, 80 + 352 * t - 18, 12, 12);
      x.fillRect(432 - 352 * t - 6, 80 + 352 * t + 6, 12, 12);
    }
  }
  dt.update();
  return dt;
}

// ---------------------------------------------------------------------------
// Hull geometry — parametric cross-sections (same maths as the Three version)
// ---------------------------------------------------------------------------
const SHIP_LENGTH = 26;
const SHIP_BEAM = 7.0;
const HULL_DEPTH = 3.6;
const DECK_Y = 2.4;

function widthAt(z01) {
  const t = z01 * 2 - 1;
  let w = (SHIP_BEAM / 2) * Math.sqrt(Math.max(0, 1 - t * t * 0.78));
  if (z01 > 0.55) w *= 1 - Math.pow((z01 - 0.55) / 0.45, 1.6) * 0.85;
  return Math.max(w, 0.05);
}
function keelAt(z01) {
  const t = z01 - 0.5;
  const base = -HULL_DEPTH + t * t * 3.2;
  if (z01 > 0.8) return base + Math.pow((z01 - 0.8) / 0.2, 2) * 1.2;
  return base;
}
function deckSheerAt(z01) {
  if (z01 < 0.2) return DECK_Y + Math.pow((0.2 - z01) / 0.2, 2) * 1.4;
  if (z01 > 0.78) return DECK_Y + Math.pow((z01 - 0.78) / 0.22, 1.6) * 1.6;
  return DECK_Y;
}

// build a custom mesh from positions[] + indices[], computing normals
function customMesh(name, positions, indices, scene, mat, doubleSided = false) {
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.applyToMesh(mesh);
  mesh.material = mat;
  if (doubleSided) mesh.material.backFaceCulling = false;
  return mesh;
}

function buildHull(scene, MAT) {
  const lengthSegs = 48, heightSegs = 18;
  function pointAt(z01, v) {
    const w = widthAt(z01), k = keelAt(z01), d = deckSheerAt(z01);
    const portSide = v < 0.5;
    const t = portSide ? v * 2 : (1 - v) * 2;
    const tumble = 1.0 - 0.08 * (1 - t);
    const x = (portSide ? -1 : 1) * w * Math.cos(t * Math.PI / 2) * tumble;
    const y = d - (d - k) * Math.sin(t * Math.PI / 2);
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    return [x, y, z];
  }
  const positions = [], indices = [];
  for (let i = 0; i <= lengthSegs; i++) {
    const z01 = i / lengthSegs;
    for (let j = 0; j <= heightSegs; j++) {
      const [x, y, z] = pointAt(z01, j / heightSegs);
      positions.push(x, y, z);
    }
  }
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < heightSegs; j++) {
      const a = i * (heightSegs + 1) + j, b = a + 1;
      const c = (i + 1) * (heightSegs + 1) + j, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return customMesh('hull', positions, indices, scene, MAT.hullMid, true);
}

function buildHullCaps(scene, MAT) {
  const meshes = [];
  function capAt(z01, zOffset) {
    const w = widthAt(z01), k = keelAt(z01), d = deckSheerAt(z01);
    const segs = 16;
    const positions = [], indices = [];
    const outline = [];
    for (let j = 0; j <= segs; j++) {
      const v = j / segs;
      const portSide = v < 0.5;
      const t = portSide ? v * 2 : (1 - v) * 2;
      const x = (portSide ? -1 : 1) * w * Math.cos(t * Math.PI / 2);
      const y = d - (d - k) * Math.sin(t * Math.PI / 2);
      outline.push([x, y]);
    }
    positions.push(0, (k + d) / 2, zOffset);
    for (const [x, y] of outline) positions.push(x, y, zOffset);
    for (let j = 0; j < segs; j++) indices.push(0, j + 1, j + 2);
    return customMesh('hullCap', positions, indices, scene, MAT.hullDark, true);
  }
  meshes.push(capAt(0, -SHIP_LENGTH / 2));
  meshes.push(capAt(1, SHIP_LENGTH / 2));
  return meshes;
}

// horizontal wale band wrapping the hull side, port + starboard ribbons
function buildWale(scene, MAT, yOffset, thickness, mat) {
  const segs = 64;
  const positions = [], indices = [];
  for (let i = 0; i <= segs; i++) {
    const z01 = i / segs;
    const w = widthAt(z01) * 1.005;
    const y = deckSheerAt(z01) - yOffset;
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    positions.push(-w, y, z, -w, y - thickness, z, w, y, z, w, y - thickness, z);
  }
  for (let i = 0; i < segs; i++) {
    const base = i * 4;
    indices.push(base, base + 1, base + 4, base + 1, base + 5, base + 4);
    indices.push(base + 2, base + 6, base + 3, base + 3, base + 6, base + 7);
  }
  return customMesh('wale', positions, indices, scene, mat, true);
}

// a deck strip lofted between two side functions; optional fixed Y override
function buildDeckStrip(scene, mat, zMin, zMax, leftFn, rightFn, segs, fixedY = null) {
  const positions = [], indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = zMin + (zMax - zMin) * t;
    const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
    const y = fixedY != null ? fixedY : deckSheerAt(z01) - 0.15;
    positions.push(leftFn(z01), y, z, rightFn(z01), y, z);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    // wound so the top face normal points up (LH): a, a+1, a+2 / a+1, a+3, a+2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return customMesh('deckStrip', positions, indices, scene, mat, true);
}

// ---------------------------------------------------------------------------
// Small primitive helpers
// ---------------------------------------------------------------------------
const PI2 = Math.PI / 2;

function box(scene, name, w, h, d, mat, parent) {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.material = mat; if (parent) m.parent = parent; return m;
}
function cyl(scene, name, h, dTop, dBot, mat, parent, tess = 12) {
  const m = MeshBuilder.CreateCylinder(name, { height: h, diameterTop: dTop, diameterBottom: dBot, tessellation: tess }, scene);
  m.material = mat; if (parent) m.parent = parent; return m;
}
function torus(scene, name, diameter, thickness, mat, parent, tess = 16) {
  const m = MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: tess }, scene);
  m.material = mat; if (parent) m.parent = parent; return m;
}
function sphere(scene, name, dia, mat, parent, seg = 10) {
  const m = MeshBuilder.CreateSphere(name, { diameter: dia, segments: seg }, scene);
  m.material = mat; if (parent) m.parent = parent; return m;
}
function capsule(scene, name, radius, height, mat, parent) {
  const m = MeshBuilder.CreateCapsule(name, { radius, height, tessellation: 8, subdivisions: 1 }, scene);
  m.material = mat; if (parent) m.parent = parent; return m;
}
function cone(scene, name, dia, h, mat, parent, tess = 6) {
  const m = MeshBuilder.CreateCylinder(name, { height: h, diameterTop: 0, diameterBottom: dia, tessellation: tess }, scene);
  m.material = mat; if (parent) m.parent = parent; return m;
}

// ---------------------------------------------------------------------------
// Main + gun + hold decks
// ---------------------------------------------------------------------------
const GUN_DECK_Y = 0.85;
const HOLD_Y = -0.6;
const WAIST_AFT = -SHIP_LENGTH * 0.22;
const WAIST_FWD = SHIP_LENGTH * 0.20;

function buildMainDeck(scene, MAT, parent) {
  const innerW = (z01) => widthAt(z01) * 0.92;
  const deck = buildDeckStrip(scene, MAT.deck, -SHIP_LENGTH / 2 - 0.5, SHIP_LENGTH / 2 + 0.6,
    (z01) => -innerW(z01), (z01) => innerW(z01), 56);
  deck.metadata = { walkable: true };
  deck.parent = parent;

  for (let i = -6; i <= 6; i++) {
    const seam = box(scene, 'seam', 0.03, 0.02, SHIP_LENGTH - 0.5, MAT.beam, parent);
    seam.position.set(i * 0.5, DECK_Y - 0.135, 0);
  }
  for (const hz of [0.6, -4.2]) {
    const hatchW = hz > 0 ? 2.6 : 1.8, hatchL = hz > 0 ? 3.0 : 2.0;
    for (const rz of [hatchL / 2, -hatchL / 2]) {
      const c = box(scene, 'coam', hatchW + 0.28, 0.3, 0.14, MAT.hullDark, parent);
      c.position.set(0, DECK_Y, hz + rz);
    }
    for (const rx of [-hatchW / 2 - 0.07, hatchW / 2 + 0.07]) {
      const c = box(scene, 'coam', 0.14, 0.3, hatchL, MAT.hullDark, parent);
      c.position.set(rx, DECK_Y, hz);
    }
    const nx = Math.round(hatchW / 0.38);
    for (let i = 0; i <= nx; i++) {
      const b = box(scene, 'grate', 0.05, 0.06, hatchL, MAT.beam, parent);
      b.position.set(-hatchW / 2 + i * (hatchW / nx), DECK_Y + 0.04, hz);
    }
    const nz = Math.round(hatchL / 0.34);
    for (let i = 0; i <= nz; i++) {
      const b = box(scene, 'grate', hatchW, 0.06, 0.05, MAT.beam, parent);
      b.position.set(0, DECK_Y + 0.04, hz - hatchL / 2 + i * (hatchL / nz));
    }
  }
}

function buildGunDeck(scene, MAT, parent) {
  const deck = buildDeckStrip(scene, MAT.deckDark, -SHIP_LENGTH * 0.42, SHIP_LENGTH * 0.42,
    (z01) => -widthAt(z01) * 0.88, (z01) => widthAt(z01) * 0.88, 30, GUN_DECK_Y);
  deck.metadata = { walkable: true };
  deck.parent = parent;
  for (let i = -2; i <= 2; i++) {
    const plank = box(scene, 'gdPlank', 0.04, 0.02, SHIP_LENGTH * 0.78, MAT.beam, parent);
    plank.position.set(i * 0.55, GUN_DECK_Y + 0.015, 0);
  }
  for (let i = -3; i <= 3; i += 2) {
    const z = i * 2.0;
    const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
    const w = widthAt(z01) * 0.7;
    for (let s = -1; s <= 1; s += 2) {
      const post = box(scene, 'knee', 0.18, DECK_Y - GUN_DECK_Y, 0.18, MAT.beam, parent);
      post.position.set(s * w, (DECK_Y + GUN_DECK_Y) / 2, z);
    }
  }
  const hatch = box(scene, 'gdHatch', 1.4, 0.06, 1.4, MAT.beam, parent);
  hatch.position.set(0, GUN_DECK_Y + 0.04, -3);
}

function buildHold(scene, MAT, parent) {
  const floor = buildDeckStrip(scene, MAT.hold, -SHIP_LENGTH * 0.32, SHIP_LENGTH * 0.32,
    (z01) => -widthAt(z01) * 0.7, (z01) => widthAt(z01) * 0.7, 16, HOLD_Y);
  floor.parent = parent;
  const barrelPos = [[-0.4, -3.5], [0.4, -3.5], [0, -3.0], [-0.5, -2.4], [0.5, -2.4], [-0.4, -4.1], [0.4, -4.1]];
  for (const [x, z] of barrelPos) {
    const b = cyl(scene, 'holdBarrel', 0.7, 0.64, 0.6, MAT.barrel, parent, 10);
    b.position.set(x, HOLD_Y + 0.35, z);
    for (let k = 0; k < 2; k++) {
      const ring = torus(scene, 'ring', 0.66, 0.03, MAT.iron, parent, 12);
      ring.position.set(x, HOLD_Y + 0.18 + k * 0.32, z); ring.rotation.x = PI2;
    }
  }
  for (const [x, z] of [[-0.6, 0], [0.6, 0], [0, 0.8]]) {
    const crate = box(scene, 'crate', 0.7, 0.55, 0.7, MAT.barrel, parent);
    crate.position.set(x, HOLD_Y + 0.28, z);
  }
}

// ---------------------------------------------------------------------------
// Cannons
// ---------------------------------------------------------------------------
function buildCannon(scene, MAT, parent) {
  const g = new TransformNode('cannon', scene); g.parent = parent;
  const barrel = cyl(scene, 'cbarrel', 1.8, 0.2, 0.32, MAT.cannon, g, 14);
  barrel.rotation.z = PI2; barrel.position.set(0.55, 0, 0);
  const trunnion = cyl(scene, 'trunnion', 0.08, 0.36, 0.36, MAT.iron, g, 12);
  trunnion.rotation.z = PI2;
  const carriage = box(scene, 'carriage', 0.95, 0.28, 0.55, MAT.barrel, g);
  carriage.position.set(0, -0.28, 0);
  for (const [x, z] of [[-0.35, -0.22], [0.35, -0.22], [-0.35, 0.22], [0.35, 0.22]]) {
    const wheel = cyl(scene, 'cwheel', 0.06, 0.28, 0.28, MAT.beam, g, 10);
    wheel.rotation.x = PI2; wheel.position.set(x, -0.45, z);
  }
  return g;
}

function buildCannons(scene, MAT, parent) {
  const portRowY = GUN_DECK_Y + 0.45, count = 6;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < count; i++) {
      const z01 = 0.22 + (i / (count - 1)) * 0.50;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);
      const c = buildCannon(scene, MAT, parent);
      c.position.set(side * (w - 0.85), portRowY, z);
      c.rotation.y = side > 0 ? 0 : Math.PI;
      const frame = box(scene, 'portFrame', 0.08, 0.62, 0.62, MAT.hullDark, parent);
      frame.position.set(side * (w + 0.03), portRowY + 0.05, z);
      const lid = box(scene, 'portLid', 0.05, 0.58, 0.58, MAT.hullLight, parent);
      lid.position.set(side * (w + 0.18), portRowY + 0.50, z);
      lid.rotation.z = side * 0.5;
    }
  }
}

// ---------------------------------------------------------------------------
// Deck furniture — capstan (TransformNode), wheel (TransformNode), barrels
// ---------------------------------------------------------------------------
function buildDeckFurniture(scene, MAT, parent) {
  const capstan = new TransformNode('capstan', scene); capstan.parent = parent;
  capstan.position.set(0, 0, 4.2);
  const body = cyl(scene, 'capBody', 1.0, 0.84, 1.1, MAT.barrel, capstan, 12);
  body.position.set(0, DECK_Y + 0.65, 0);
  const cap = cyl(scene, 'capCap', 0.12, 1.0, 0.84, MAT.beam, capstan, 12);
  cap.position.set(0, DECK_Y + 1.20, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bar = box(scene, 'capBar', 1.4, 0.07, 0.07, MAT.spar, capstan);
    bar.position.set(0.85 * Math.cos(a), DECK_Y + 1.00, 0.85 * Math.sin(a));
    bar.rotation.y = -a;
  }

  const HELM = new Vector3(0, DECK_Y + 0.3 + 2.6 + 0.18 + 0.85, -7.7);
  const wheel = new TransformNode('wheel', scene); wheel.parent = parent;
  wheel.position.copyFrom(HELM);
  const axle = cyl(scene, 'axle', 0.4, 0.12, 0.12, MAT.iron, wheel, 8); axle.rotation.x = PI2;
  const hub = cyl(scene, 'hub', 0.14, 0.22, 0.22, MAT.beam, wheel, 10); hub.rotation.x = PI2;
  const rim = torus(scene, 'rim', 1.0, 0.09, MAT.beam, wheel, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = box(scene, 'spoke', 0.045, 1.04, 0.045, MAT.beam, wheel);
    spoke.rotation.z = a;
    const handle = cyl(scene, 'handle', 0.18, 0.06, 0.06, MAT.hullDark, wheel, 6);
    handle.position.set(Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0); handle.rotation.x = PI2;
  }

  const pedestal = box(scene, 'pedestal', 0.34, 1.4, 0.34, MAT.hullDark, parent);
  pedestal.position.set(0, HELM.y - 0.9, -7.7);
  const binnacle = box(scene, 'binnacle', 0.4, 0.3, 0.3, MAT.beam, parent);
  binnacle.position.set(0, HELM.y - 0.2, -7.4);

  const deckBarrels = [
    [-1.8, DECK_Y + 0.5, 7.5], [-1.2, DECK_Y + 0.5, 8.2],
    [1.5, DECK_Y + 0.5, 7.5], [1.9, DECK_Y + 0.5, 6.8],
    [-2.0, DECK_Y + 0.5, -6], [2.0, DECK_Y + 0.5, -6],
  ];
  for (const [x, y, z] of deckBarrels) {
    const b = cyl(scene, 'deckBarrel', 0.7, 0.64, 0.6, MAT.barrel, parent, 10);
    b.position.set(x, y, z);
    for (let k = 0; k < 2; k++) {
      const ring = torus(scene, 'ring', 0.66, 0.036, MAT.iron, parent, 12);
      ring.position.set(x, y - 0.16 + k * 0.32, z); ring.rotation.x = PI2;
    }
  }
  for (const [x, z] of [[-2.2, -1], [2.2, 2], [-1.5, 5.5]]) {
    const coil = torus(scene, 'coil', 0.64, 0.07, MAT.beam, parent, 14);
    coil.position.set(x, DECK_Y + 0.21, z); coil.rotation.x = PI2;
  }
  return { capstan, wheel };
}

// ---------------------------------------------------------------------------
// Forecastle + sterncastle
// ---------------------------------------------------------------------------
function buildForecastle(scene, MAT, parent) {
  const z = SHIP_LENGTH * 0.34;
  const width = widthAt(0.85) * 1.7;
  const wallH = 2.4, wallT = 0.18, wallL = 4.2;
  const baseY = DECK_Y + 0.3;
  const solid = [], walkable = [];

  const sidePort = box(scene, 'fcSide', wallT, wallH, wallL, MAT.hullMid, parent);
  sidePort.position.set(-width / 2, baseY + wallH / 2, z); sidePort.metadata = { solid: true };
  const sideStbd = box(scene, 'fcSide', wallT, wallH, wallL, MAT.hullMid, parent);
  sideStbd.position.set(width / 2, baseY + wallH / 2, z); sideStbd.metadata = { solid: true };
  const front = box(scene, 'fcFront', width, wallH, wallT, MAT.hullMid, parent);
  front.position.set(0, baseY + wallH / 2, z + wallL / 2); front.metadata = { solid: true };
  const roof = box(scene, 'fcRoof', width + 0.4, 0.18, wallL + 0.4, MAT.deck, parent);
  roof.position.set(0, baseY + wallH + 0.05, z); roof.metadata = { walkable: true };
  const backL = box(scene, 'fcBack', width * 0.32, wallH, wallT, MAT.hullMid, parent);
  backL.position.set(-width * 0.34, baseY + wallH / 2, z - wallL / 2); backL.metadata = { solid: true };
  const backR = box(scene, 'fcBack', width * 0.32, wallH, wallT, MAT.hullMid, parent);
  backR.position.set(width * 0.34, baseY + wallH / 2, z - wallL / 2); backR.metadata = { solid: true };
  const trim = box(scene, 'fcTrim', width + 0.5, 0.15, 0.1, MAT.trimRed, parent);
  trim.position.set(0, baseY + wallH - 0.08, z + wallL / 2 + 0.05);

  solid.push(sidePort, sideStbd, front, backL, backR);
  walkable.push(roof);
  return { solid, walkable };
}

function buildSterncastle(scene, MAT, parent) {
  const z = -SHIP_LENGTH * 0.38;
  const width = widthAt(0.12) * 1.6;
  const lowerH = 2.6, upperH = 1.8, wallT = 0.18, lowerL = 5.6, upperL = 3.8;
  const lowerY = DECK_Y + 0.3 + lowerH / 2;
  const solid = [], walkable = [];

  const lp = box(scene, 'scSide', wallT, lowerH, lowerL, MAT.hullMid, parent);
  lp.position.set(-width / 2, lowerY, z); lp.metadata = { solid: true };
  const ls = box(scene, 'scSide', wallT, lowerH, lowerL, MAT.hullMid, parent);
  ls.position.set(width / 2, lowerY, z); ls.metadata = { solid: true };
  const fwL = box(scene, 'scFwd', width * 0.34, lowerH, wallT, MAT.hullMid, parent);
  fwL.position.set(-width * 0.33, lowerY, z + lowerL / 2); fwL.metadata = { solid: true };
  const fwR = box(scene, 'scFwd', width * 0.34, lowerH, wallT, MAT.hullMid, parent);
  fwR.position.set(width * 0.33, lowerY, z + lowerL / 2); fwR.metadata = { solid: true };
  const transom = box(scene, 'transom', width, lowerH, wallT, MAT.hullDark, parent);
  transom.position.set(0, lowerY, z - lowerL / 2); transom.rotation.x = -0.08; transom.metadata = { solid: true };
  const lowerRoof = box(scene, 'scLowerRoof', width + 0.4, 0.18, lowerL + 0.4, MAT.deck, parent);
  lowerRoof.position.set(0, lowerY + lowerH / 2 + 0.09, z); lowerRoof.metadata = { walkable: true };

  const upperY = lowerY + lowerH / 2 + 0.18 + upperH / 2;
  const upperZ = z - 0.8;
  const up = box(scene, 'scUp', wallT, upperH, upperL, MAT.hullMid, parent);
  up.position.set(-width / 2 + 0.4, upperY, upperZ); up.metadata = { solid: true };
  const us = box(scene, 'scUp', wallT, upperH, upperL, MAT.hullMid, parent);
  us.position.set(width / 2 - 0.4, upperY, upperZ); us.metadata = { solid: true };
  const upT = box(scene, 'scUpT', width - 0.8, upperH, wallT, MAT.hullDark, parent);
  upT.position.set(0, upperY, upperZ - upperL / 2); upT.metadata = { solid: true };
  const upFront = box(scene, 'scUpFront', width - 0.8, upperH, wallT, MAT.hullMid, parent);
  upFront.position.set(0, upperY, upperZ + upperL / 2); upFront.metadata = { solid: true };
  const upperRoof = box(scene, 'scUpperRoof', width - 0.4, 0.15, upperL + 0.3, MAT.deck, parent);
  upperRoof.position.set(0, upperY + upperH / 2 + 0.08, upperZ); upperRoof.metadata = { walkable: true };

  const trim = box(scene, 'scTrim', width + 0.5, 0.18, 0.1, MAT.trimGold, parent);
  trim.position.set(0, lowerY + lowerH / 2 - 0.15, z - lowerL / 2 - 0.02);
  for (let i = -1; i <= 1; i++) {
    const win = box(scene, 'scWin', 0.7, 0.5, 0.05, MAT.windowGlow, parent);
    win.position.set(i * 1.0, lowerY + 0.2, z - lowerL / 2 - 0.09);
  }
  const lantern = box(scene, 'scLantern', 0.45, 0.65, 0.45, MAT.lanternGlow, parent);
  lantern.position.set(0, upperY + upperH / 2 + 0.5, upperZ - upperL / 2 + 0.3);
  const lanternCap = cone(scene, 'scLanternCap', 0.6, 0.4, MAT.iron, parent, 6);
  lanternCap.position.set(0, upperY + upperH / 2 + 1.0, upperZ - upperL / 2 + 0.3);
  const lanternLight = new PointLight('scLanternLight', lantern.position.clone(), scene);
  lanternLight.diffuse = Color3.FromHexString('#ffa040'); lanternLight.intensity = 1.5; lanternLight.range = 12;
  lanternLight.parent = parent;

  solid.push(lp, ls, fwL, fwR, transom, up, us, upT, upFront);
  walkable.push(lowerRoof, upperRoof);
  return { solid, walkable };
}

// ---------------------------------------------------------------------------
// Masts, yards, sails
// ---------------------------------------------------------------------------
function buildMast(scene, MAT, parent, height, baseRadius, topRadius, withNest) {
  const g = new TransformNode('mast', scene); g.parent = parent;
  const mast = cyl(scene, 'mastPole', height, topRadius * 2, baseRadius * 2, MAT.mast, g, 12);
  mast.position.y = height / 2; mast.metadata = { solid: true };
  for (let i = 0; i < 5; i++) {
    const wy = height * (0.12 + i * 0.07);
    const r = Scalar.Lerp(baseRadius, topRadius, wy / height) + 0.03;
    const wold = torus(scene, 'wold', r * 2, 0.08, MAT.iron, g, 16);
    wold.position.y = wy; wold.rotation.x = PI2;
  }
  if (withNest) {
    const nest = cyl(scene, 'nest', 0.7, 1.7, 1.1, MAT.beam, g, 14);
    nest.position.y = height * 0.6;
    const floor = cyl(scene, 'nestFloor', 0.08, 1.2, 1.1, MAT.deck, g, 14);
    floor.position.y = height * 0.6 - 0.32;
  }
  return { node: g, solidMast: mast };
}

function buildYard(scene, MAT, parent, length, radius) {
  const yard = cyl(scene, 'yard', length, radius * 1.4, radius * 2, MAT.spar, parent, 8);
  yard.rotation.z = PI2;
  return yard;
}

// square sail plane with billow baked in + flutter animation
function buildSquareSail(scene, sailMat, width, height) {
  const wSegs = 24, hSegs = 16;
  const mesh = MeshBuilder.CreateGround('sail', { width, height, subdivisions: Math.max(wSegs, hSegs) }, scene);
  // CreateGround is XZ; we want an XY plane facing +Z. Re-layout positions.
  const positions = [];
  const indices = [];
  for (let j = 0; j <= hSegs; j++) {
    for (let i = 0; i <= wSegs; i++) {
      const x = (i / wSegs - 0.5) * width;
      const y = (j / hSegs - 0.5) * height;
      positions.push(x, y, 0);
    }
  }
  for (let j = 0; j < hSegs; j++) {
    for (let i = 0; i < wSegs; i++) {
      const a = j * (wSegs + 1) + i, b = a + 1;
      const c = (j + 1) * (wSegs + 1) + i, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const uvs = [];
  for (let j = 0; j <= hSegs; j++)
    for (let i = 0; i <= wSegs; i++) uvs.push(i / wSegs, j / hSegs);

  const baseZ = new Float32Array(positions.length / 3);
  for (let n = 0; n < positions.length / 3; n++) {
    const x = positions[n * 3], y = positions[n * 3 + 1];
    const u = x / width;
    const v = (y / height) + 0.5;
    const acrossBelly = Math.cos(u * Math.PI);
    const downBelly = 0.45 + 0.55 * (1 - v);
    const billow = Math.max(0, acrossBelly) * downBelly * width * 0.26;
    const scallop = (v < 0.12) ? -Math.cos(u * Math.PI) * 0.18 * height : 0;
    positions[n * 3 + 1] = y + scallop;
    positions[n * 3 + 2] = billow;
    baseZ[n] = billow;
  }
  const vd = new VertexData();
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.positions = positions; vd.indices = indices; vd.normals = normals; vd.uvs = uvs;
  vd.applyToMesh(mesh, true);
  mesh.material = sailMat;
  mesh.material.backFaceCulling = false;

  let frame = 0;
  mesh.metadata = { deploy: 1 };
  mesh.flutter = (t) => {
    if (mesh.metadata.deploy < 0.05 || !mesh.isVisible) return;
    const amp = 0.35 + 0.65 * mesh.metadata.deploy;
    const p = mesh.getVerticesData('position');
    for (let n = 0; n < baseZ.length; n++) {
      const x = p[n * 3], y = p[n * 3 + 1];
      const flutter = Math.sin(t * 1.8 + x * 0.55 + y * 0.4) * 0.05 + Math.sin(t * 2.6 + y * 0.9) * 0.03;
      p[n * 3 + 2] = baseZ[n] + flutter * amp;
    }
    mesh.updateVerticesData('position', p);
    if ((frame++ % 3) === 0) {
      const nrm = mesh.getVerticesData('normal');
      VertexData.ComputeNormals(p, indices, nrm);
      mesh.updateVerticesData('normal', nrm);
    }
  };
  return mesh;
}

// triangular lateen sail
function buildLateenSail(scene, sailMat, length, height) {
  // three corners; subdivide via a simple fan with billow
  const A = [-length * 0.15, height * 0.5];
  const B = [length * 0.85, -height * 0.4];
  const C = [-length * 0.2, -height * 0.45];
  const N = 6;
  const positions = [], indices = [], uvs = [];
  // barycentric grid
  const idx = (i, j) => `${i},${j}`;
  const map = {};
  let count = 0;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N - i; j++) {
      const a = 1 - (i + j) / N, b = i / N, c = j / N;
      const x = a * A[0] + b * B[0] + c * C[0];
      const y = a * A[1] + b * B[1] + c * C[1];
      const billow = Math.max(0, 1 - Math.abs(y) / (height * 0.5)) *
        Math.max(0, 1 - Math.abs(x - length * 0.3) / (length * 0.6)) * 0.6;
      positions.push(x, y, billow);
      uvs.push(0.5 + x / length, 0.5 + y / height);
      map[idx(i, j)] = count++;
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N - i; j++) {
      indices.push(map[idx(i, j)], map[idx(i + 1, j)], map[idx(i, j + 1)]);
      if (j < N - i - 1) indices.push(map[idx(i + 1, j)], map[idx(i + 1, j + 1)], map[idx(i, j + 1)]);
    }
  }
  const mesh = new Mesh('lateen', scene);
  const vd = new VertexData();
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.positions = positions; vd.indices = indices; vd.normals = normals; vd.uvs = uvs;
  vd.applyToMesh(mesh);
  mesh.material = sailMat;
  mesh.material.backFaceCulling = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Bowsprit
// ---------------------------------------------------------------------------
function buildBowsprit(scene, MAT, sailMat, parent) {
  const g = new TransformNode('bowsprit', scene); g.parent = parent;
  const spar = cyl(scene, 'bspar', 8, 0.32, 0.52, MAT.mast, g, 10);
  spar.rotation.x = Math.PI / 2.2; spar.position.set(0, DECK_Y + 1.6, SHIP_LENGTH / 2 + 1.6);
  const yard = buildYard(scene, MAT, g, 4.5, 0.1);
  yard.position.set(0, DECK_Y + 0.5, SHIP_LENGTH / 2 + 3.2);
  const sail = buildSquareSail(scene, sailMat, 4.0, 2.0);
  sail.parent = g;
  sail.position.set(0, DECK_Y - 0.5, SHIP_LENGTH / 2 + 3.2);
  sail.rotation.x = 0.15;
  return { node: g, sail };
}

// ---------------------------------------------------------------------------
// Cross of Burgundy flag — animated sway
// ---------------------------------------------------------------------------
function buildBurgundyFlag(scene, MAT, parent, width, height) {
  const g = new TransformNode('flag', scene); g.parent = parent;
  const base = MeshBuilder.CreateGround('flagBase', { width, height, subdivisions: 10 }, scene);
  // re-layout to XY plane
  const wS = 12, hS = 6;
  const positions = [], indices = [], uvs = [];
  for (let j = 0; j <= hS; j++)
    for (let i = 0; i <= wS; i++) { positions.push((i / wS - 0.5) * width, (j / hS - 0.5) * height, 0); uvs.push(i / wS, j / hS); }
  for (let j = 0; j < hS; j++) for (let i = 0; i < wS; i++) {
    const a = j * (wS + 1) + i, b = a + 1, c = (j + 1) * (wS + 1) + i, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const vd = new VertexData();
  const normals = []; VertexData.ComputeNormals(positions, indices, normals);
  vd.positions = positions; vd.indices = indices; vd.normals = normals; vd.uvs = uvs;
  vd.applyToMesh(base, true);
  base.material = MAT.flagWhite; base.material.backFaceCulling = false;
  base.parent = g;

  const barLen = Math.sqrt(width * width + height * height);
  const barThick = height * 0.18;
  const bar1 = MeshBuilder.CreatePlane('flagBar', { width: barLen * 0.95, height: barThick }, scene);
  bar1.material = MAT.flagRed; bar1.rotation.z = Math.atan2(height, width); bar1.position.z = 0.01; bar1.parent = g;
  const bar2 = MeshBuilder.CreatePlane('flagBar', { width: barLen * 0.95, height: barThick }, scene);
  bar2.material = MAT.flagRed; bar2.rotation.z = -Math.atan2(height, width); bar2.position.z = 0.02; bar2.parent = g;

  const baseX = new Float32Array(positions.length / 3);
  for (let n = 0; n < baseX.length; n++) baseX[n] = positions[n * 3];
  g.flutter = (t) => {
    const p = base.getVerticesData('position');
    for (let n = 0; n < baseX.length; n++) {
      const x = baseX[n];
      p[n * 3 + 2] = Math.sin(t * 2.5 + x * 1.5) * 0.12 * ((x + width / 2) / width);
    }
    base.updateVerticesData('position', p);
  };
  return g;
}

// ---------------------------------------------------------------------------
// Bulwarks, hull ribs, railings, stairs, channels, fife rails, bell,
// figurehead, quarter galleries
// ---------------------------------------------------------------------------
function buildBulwarks(scene, MAT, parent) {
  const bH = 0.85, segs = 32;
  const solid = [];
  for (let side = -1; side <= 1; side += 2) {
    const positions = [], indices = [];
    for (let i = 0; i <= segs; i++) {
      const z01 = 0.05 + (i / segs) * 0.9;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);
      const baseY = deckSheerAt(z01);
      positions.push(side * w, baseY, z, side * w, baseY + bH, z);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      if (side > 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const m = customMesh('bulwark', positions, indices, scene, MAT.hullMid, true);
    m.parent = parent; m.metadata = { solid: true };
    solid.push(m);
  }
  for (let side = -1; side <= 1; side += 2) {
    const positions = [], indices = [], t = 0.12;
    for (let i = 0; i <= segs; i++) {
      const z01 = 0.05 + (i / segs) * 0.9;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);
      const topY = deckSheerAt(z01) + bH;
      positions.push(side * w, topY, z, side * (w - t), topY, z);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const cap = customMesh('bulwarkCap', positions, indices, scene, MAT.hullDark, true);
    cap.parent = parent;
  }
  return { solid };
}

function buildHullRibs(scene, MAT, parent) {
  const ribCount = 10, segs = 16;
  for (let i = 0; i < ribCount; i++) {
    const z01 = 0.20 + (i / (ribCount - 1)) * 0.60;
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    const pts = [];
    for (let j = 0; j <= segs; j++) {
      const v = j / segs;
      const w = widthAt(z01) * 0.97, k = keelAt(z01), d = deckSheerAt(z01);
      const portSide = v < 0.5;
      const t = portSide ? v * 2 : (1 - v) * 2;
      const x = (portSide ? -1 : 1) * w * Math.cos(t * Math.PI / 2);
      const y = d - (d - k) * Math.sin(t * Math.PI / 2);
      pts.push(new Vector3(x, y, z));
    }
    const rib = MeshBuilder.CreateTube('rib', { path: pts, radius: 0.07, tessellation: 6 }, scene);
    rib.material = MAT.beam; rib.parent = parent;
  }
}

function densify(points, spacing) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k < n; k++) { const t = k / n; out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); }
  }
  out.push(points[points.length - 1]);
  return out;
}

function buildRailing(scene, MAT, parent, points, baseY, height) {
  const solid = [];
  for (const [x, z] of densify(points, 0.5)) {
    const b = cyl(scene, 'baluster', height, 0.07, 0.1, MAT.beam, parent, 6);
    b.position.set(x, baseY + height / 2, z);
    const knob = sphere(scene, 'knob', 0.11, MAT.beam, parent, 5);
    knob.position.set(x, baseY + height, z);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const rail = box(scene, 'topRail', 0.09, 0.1, len + 0.05, MAT.hullDark, parent);
    rail.position.set((x0 + x1) / 2, baseY + height, (z0 + z1) / 2);
    rail.rotation.y = Math.atan2(dx, dz); rail.metadata = { solid: true };
    solid.push(rail);
    const mid = box(scene, 'midRail', 0.09, 0.1, len + 0.05, MAT.beam, parent);
    mid.position.set((x0 + x1) / 2, baseY + height * 0.5, (z0 + z1) / 2);
    mid.rotation.y = Math.atan2(dx, dz);
  }
  return solid;
}

function buildStaircase(scene, MAT, parent, cx, z0, z1, baseY, topY, width) {
  const walkable = [];
  const rise = topY - baseY;
  const steps = Math.max(4, Math.round(rise / 0.34));
  const dz = (z1 - z0) / steps, dy = rise / steps;
  for (let i = 0; i < steps; i++) {
    const tread = box(scene, 'tread', width, 0.1, Math.abs(dz) + 0.22, MAT.deckDark, parent);
    tread.position.set(cx, baseY + dy * (i + 1) - 0.05, z0 + dz * (i + 0.5));
    tread.metadata = { walkable: true };
    walkable.push(tread);
  }
  for (const s of [-1, 1]) {
    const len = Math.hypot(z1 - z0, rise);
    const stringer = box(scene, 'stringer', 0.08, 0.18, len, MAT.beam, parent);
    stringer.position.set(cx + s * (width / 2 + 0.02), (baseY + topY) / 2, (z0 + z1) / 2);
    stringer.rotation.x = -Math.atan2(rise, z1 - z0) + PI2;
  }
  return walkable;
}

function buildChannels(scene, MAT, parent, mastZ, span) {
  const z01 = (mastZ + SHIP_LENGTH / 2) / SHIP_LENGTH;
  const w = widthAt(z01), y = deckSheerAt(z01) - 0.05;
  for (let side = -1; side <= 1; side += 2) {
    const plank = box(scene, 'channel', 0.55, 0.1, span + 0.5, MAT.hullDark, parent);
    plank.position.set(side * (w + 0.22), y, mastZ);
    const n = Math.max(3, Math.round(span / 0.45));
    for (let i = 0; i < n; i++) {
      const z = mastZ - span / 2 + (i / (n - 1)) * span;
      const de = cyl(scene, 'deadeye', 0.07, 0.2, 0.2, MAT.barrel, parent, 10);
      de.position.set(side * (w + 0.34), y + 0.18, z); de.rotation.x = PI2; de.rotation.z = PI2;
      const strop = torus(scene, 'strop', 0.22, 0.04, MAT.iron, parent, 12);
      strop.position.copyFrom(de.position); strop.rotation.y = PI2;
    }
  }
}

function buildFifeRail(scene, MAT, parent, mastZ, radius) {
  const y = DECK_Y + 0.3, railH = 0.9, posts = 6;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const px = Math.cos(a) * radius, pz = mastZ + Math.sin(a) * radius;
    const post = cyl(scene, 'fifePost', railH, 0.1, 0.12, MAT.beam, parent, 6);
    post.position.set(px, y + railH / 2, pz);
    const pin = cyl(scene, 'pin', 0.34, 0.05, 0.06, MAT.beam, parent, 6);
    pin.position.set(px * 1.04, y + railH + 0.05, pz);
  }
  const ring = torus(scene, 'fifeRing', radius * 2, 0.1, MAT.hullDark, parent, 20);
  ring.position.set(0, y + railH, mastZ); ring.rotation.x = PI2;
}

function buildBell(scene, MAT, parent, x, y, z) {
  for (const s of [-1, 1]) {
    const post = cyl(scene, 'bellPost', 1.0, 0.1, 0.12, MAT.beam, parent, 8);
    post.position.set(x + s * 0.4, y + 0.5, z);
  }
  const crown = box(scene, 'bellCrown', 1.05, 0.12, 0.12, MAT.beam, parent);
  crown.position.set(x, y + 1.02, z);
  const swing = new TransformNode('bellSwing', scene); swing.parent = parent;
  swing.position.set(x, y + 1.0, z);
  const bell = cyl(scene, 'bell', 0.32, 0.26, 0.4, MAT.trimGold, swing, 12);
  bell.position.set(0, -0.18, 0);
  const lip = torus(scene, 'bellLip', 0.4, 0.025, MAT.trimGold, swing, 14);
  lip.position.set(0, -0.34, 0); lip.rotation.x = PI2;
  return swing;
}

function buildFigurehead(scene, MAT, parent) {
  const z = SHIP_LENGTH / 2;
  const knee = box(scene, 'knee', 0.35, 0.6, 2.2, MAT.hullDark, parent);
  knee.position.set(0, DECK_Y - 0.3, z + 1.0); knee.rotation.x = 0.35;
  const body = capsule(scene, 'figBody', 0.22, 0.7 + 0.44, MAT.trimGold, parent);
  body.position.set(0, DECK_Y + 0.45, z + 1.5); body.rotation.x = PI2 - 0.5;
  const head = sphere(scene, 'figHead', 0.48, MAT.trimGold, parent, 8);
  head.position.set(0, DECK_Y + 0.95, z + 2.05);
  for (const s of [-1, 1]) {
    const scroll = torus(scene, 'scroll', 0.36, 0.05, MAT.trimGold, parent, 12);
    scroll.position.set(s * 0.45, DECK_Y + 0.1, z + 0.9);
    scroll.rotation.y = PI2; scroll.rotation.z = s * 0.3;
  }
}

function buildQuarterGalleries(scene, MAT, parent) {
  const z = -SHIP_LENGTH * 0.38, lowerL = 5.6;
  const width = widthAt(0.12) * 1.6;
  const yMid = DECK_Y + 0.3 + 2.6 / 2 + 0.4;
  for (const side of [-1, 1]) {
    const bx = side * (width / 2 + 0.05), bz = z - lowerL / 2 + 0.5;
    const body = cyl(scene, 'qgBody', 1.8, 1.1, 0.9, MAT.hullMid, parent, 10);
    body.position.set(bx, yMid, bz);
    for (let i = -1; i <= 1; i++) {
      const win = box(scene, 'qgWin', 0.04, 0.55, 0.28, MAT.windowGlow, parent);
      win.position.set(bx + side * 0.5, yMid + 0.1, bz + i * 0.42);
    }
    const cornice = torus(scene, 'qgCornice', 1.04, 0.06, MAT.trimGold, parent, 14);
    cornice.position.set(bx, yMid + 0.95, bz); cornice.rotation.x = PI2;
    const cap = cone(scene, 'qgCap', 1.0, 0.55, MAT.trimGold, parent, 10);
    cap.position.set(bx, yMid + 1.2, bz);
  }
}

function buildChartTable(scene, MAT, CREW, parent, x, y, z) {
  const top = box(scene, 'chartTop', 1.5, 0.08, 1.0, MAT.hullDark, parent);
  top.position.set(x, y + 0.95, z);
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.4, 0.4]) {
    const leg = cyl(scene, 'chartLeg', 0.95, 0.1, 0.12, MAT.beam, parent, 6);
    leg.position.set(x + sx, y + 0.47, z + sz);
  }
  const chart = MeshBuilder.CreateGround('chart', { width: 1.2, height: 0.8 }, scene);
  const cm = new StandardMaterial('chartMat', scene);
  cm.diffuseColor = Color3.FromHexString('#d8c89a'); cm.backFaceCulling = false;
  chart.material = cm; chart.position.set(x, y + 0.995, z); chart.parent = parent;
  for (const c of [[-0.45, -0.28], [0.5, 0.3]]) {
    const wgt = cyl(scene, 'weight', 0.05, 0.1, 0.1, CREW.gold, parent, 8);
    wgt.position.set(x + c[0], y + 1.01, z + c[1]);
  }
  const div = cone(scene, 'dividers', 0.08, 0.32, CREW.steel, parent, 4);
  div.position.set(x + 0.1, y + 1.02, z - 0.1); div.rotation.x = Math.PI;
}

// ---------------------------------------------------------------------------
// Anchor
// ---------------------------------------------------------------------------
function buildAnchor(scene, MAT, parent) {
  const g = new TransformNode('anchor', scene); g.parent = parent;
  const shank = cyl(scene, 'shank', 2.4, 0.18, 0.18, MAT.iron, g, 10);
  for (let side = -1; side <= 1; side += 2) {
    const arm = cyl(scene, 'arm', 1.35, 0.15, 0.22, MAT.iron, g, 8);
    arm.rotation.z = side * Math.PI / 3.2; arm.position.set(side * 0.50, -1.55, 0);
    const fluke = cone(scene, 'fluke', 0.44, 0.45, MAT.iron, g, 4);
    fluke.rotation.z = side * Math.PI / 3.2 + PI2; fluke.position.set(side * 1.05, -2.04, 0);
  }
  const crown = cyl(scene, 'crown', 0.18, 0.28, 0.36, MAT.iron, g, 10);
  crown.position.y = -1.25;
  const stock = box(scene, 'stock', 1.7, 0.16, 0.16, MAT.barrel, g);
  stock.position.y = 0.90;
  for (const x of [-0.45, 0.45]) {
    const band = box(scene, 'stockBand', 0.06, 0.20, 0.20, MAT.iron, g);
    band.position.set(x, 0.90, 0);
  }
  const ring = torus(scene, 'anchorRing', 0.32, 0.04, MAT.iron, g, 14);
  ring.position.y = 1.30; ring.rotation.x = PI2;
  return g;
}

function buildAnchorAndCable(scene, MAT, parent) {
  const anchorX = 2.1, anchorZ = SHIP_LENGTH / 2 - 1.4;
  const anchorTopY = DECK_Y + 0.4;
  const anchor = buildAnchor(scene, MAT, parent);
  const baseY = anchorTopY - 1.3;
  anchor.position.set(anchorX, baseY, anchorZ);
  anchor.rotation.z = -0.08; anchor.rotation.y = -0.25;
  const cathead = box(scene, 'cathead', 0.28, 0.28, 1.6, MAT.beam, parent);
  cathead.position.set(anchorX, DECK_Y + 0.95, anchorZ + 0.3); cathead.rotation.y = -0.15;
  const path = [
    new Vector3(anchorX + 0.05, anchorTopY + 0.1, anchorZ),
    new Vector3(anchorX + 0.075, (anchorTopY + 0.1 + DECK_Y + 1.05) / 2 - 0.05, (anchorZ + anchorZ - 0.4) / 2),
    new Vector3(anchorX, DECK_Y + 1.05, anchorZ - 0.4),
  ];
  const cable = MeshBuilder.CreateTube('cable', { path, radius: 0.05, tessellation: 6 }, scene);
  cable.material = MAT.beam; cable.parent = parent;
  return { node: anchor, baseY };
}

// ---------------------------------------------------------------------------
// Lanterns + braziers (point lights + emissive, flicker animated)
// ---------------------------------------------------------------------------
function buildLantern(scene, MAT, parent, scale = 1) {
  const g = new TransformNode('lantern', scene); g.parent = parent;
  const cap = cone(scene, 'lcap', 0.34 * scale, 0.16 * scale, MAT.iron, g, 8);
  cap.position.y = 0.32 * scale;
  const ring = torus(scene, 'lring', 0.1 * scale, 0.012 * scale, MAT.iron, g, 10);
  ring.position.y = 0.43 * scale; ring.rotation.x = PI2;
  for (let i = 0; i < 4; i++) {
    const a = i * PI2 + Math.PI / 4;
    const bar = cyl(scene, 'lbar', 0.42 * scale, 0.024 * scale, 0.024 * scale, MAT.iron, g, 4);
    bar.position.set(Math.cos(a) * 0.11 * scale, 0.07 * scale, Math.sin(a) * 0.11 * scale);
  }
  const glass = cyl(scene, 'lglass', 0.4 * scale, 0.24 * scale, 0.24 * scale, MAT.glassGlow, g, 8);
  glass.position.y = 0.07 * scale;
  const flame = cone(scene, 'lflame', 0.09 * scale, 0.15 * scale, MAT.flameHot, g, 6);
  flame.position.y = 0.04 * scale;
  const base = cyl(scene, 'lbase', 0.07 * scale, 0.28 * scale, 0.3 * scale, MAT.iron, g, 8);
  base.position.y = -0.15 * scale;
  const light = new PointLight('llight', new Vector3(0, 0.07 * scale, 0), scene);
  light.diffuse = Color3.FromHexString('#ff9436'); light.intensity = 2.0; light.range = 13;
  light.parent = g;
  return { node: g, flame, light };
}

function buildLanternPost(scene, MAT, parent, x, z, postH, scale = 1) {
  const g = new TransformNode('lanternPost', scene); g.parent = parent;
  const post = cyl(scene, 'lpost', postH, 0.1, 0.12, MAT.beam, g, 8);
  post.position.set(x, DECK_Y + 0.15 + postH / 2, z);
  const arm = cyl(scene, 'larm', 0.3, 0.04, 0.04, MAT.iron, g, 5);
  arm.position.set(x + Math.sign(x || 1) * -0.12, DECK_Y + 0.15 + postH, z); arm.rotation.z = PI2;
  const lant = buildLantern(scene, MAT, g, scale);
  lant.node.position.set(x + Math.sign(x || 1) * -0.24, DECK_Y + 0.15 + postH - 0.05, z);
  return lant;
}

function buildBrazier(scene, MAT, parent, x, z) {
  const g = new TransformNode('brazier', scene); g.parent = parent;
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3);
    const leg = cyl(scene, 'blleg', 0.7, 0.05, 0.05, MAT.iron, g, 5);
    leg.position.set(x + Math.cos(a) * 0.18, DECK_Y + 0.15 + 0.32, z + Math.sin(a) * 0.18);
    leg.rotation.x = Math.sin(a) * 0.32; leg.rotation.z = -Math.cos(a) * 0.32;
  }
  const bowl = cyl(scene, 'bowl', 0.3, 0.68, 0.4, MAT.iron, g, 12);
  bowl.position.set(x, DECK_Y + 0.15 + 0.7, z);
  const coals = sphere(scene, 'coals', 0.6, MAT.ember, g, 8);
  coals.position.set(x, DECK_Y + 0.15 + 0.68, z); coals.scaling.y = 0.45;
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const fl = cone(scene, 'flame', 0.18, 0.36, MAT.flame, g, 6);
    fl.position.set(x + Math.cos(a) * 0.12, DECK_Y + 0.15 + 0.92, z + Math.sin(a) * 0.12);
    flames.push(fl);
  }
  const light = new PointLight('blight', new Vector3(x, DECK_Y + 0.15 + 1.1, z), scene);
  light.diffuse = Color3.FromHexString('#ff6e1c'); light.intensity = 3.4; light.range = 18;
  light.parent = g;
  return { node: g, flames, light, coals };
}

function buildShipLighting(scene, MAT, parent) {
  const units = [];
  for (const [x, z, h] of [
    [-2.7, 5.5, 1.5], [2.7, 5.5, 1.5],
    [-3.0, -2.0, 1.4], [3.0, -2.0, 1.4],
    [-2.4, -6.0, 1.3], [2.4, -6.0, 1.3],
  ]) units.push(buildLanternPost(scene, MAT, parent, x, z, h));
  units.push(buildLanternPost(scene, MAT, parent, 0, 6.7, 2.0, 1.1));
  const braziers = [buildBrazier(scene, MAT, parent, -1.6, 3.6), buildBrazier(scene, MAT, parent, 1.7, -3.4)];

  return (t) => {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const f = 0.78 + Math.sin(t * 11 + i * 1.7) * 0.13 + Math.sin(t * 23 + i) * 0.07;
      u.light.intensity = 2.0 * f;
      u.flame.material.emissiveColor = Color3.FromHexString('#ffb030').scale(5.0 * f);
      u.flame.scaling.y = 0.85 + 0.3 * f;
    }
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i];
      const f = 0.8 + Math.sin(t * 9 + i * 2.1) * 0.15 + Math.sin(t * 19 + i) * 0.08;
      b.light.intensity = 3.4 * f;
      b.coals.material.emissiveColor = Color3.FromHexString('#ff5410').scale(2.4 * f);
      for (let k = 0; k < b.flames.length; k++) {
        b.flames[k].scaling.y = 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * 13 + k * 1.3 + i));
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Crew + NPC figures (built human-scale, counter-scaled to stay ~1.7m)
// ---------------------------------------------------------------------------
function buildCrewMaterials(scene) {
  return {
    skin:   pbr(scene, 'cr_skin', '#b07a52', 0.8),
    steel:  pbr(scene, 'cr_steel', '#a6a6ae', 0.32, 0.88),
    steelD: pbr(scene, 'cr_steelD', '#70707a', 0.4, 0.8),
    hose:   pbr(scene, 'cr_hose', '#3a3226', 0.9),
    boot:   pbr(scene, 'cr_boot', '#251710', 0.6),
    hair:   pbr(scene, 'cr_hair', '#2a1b10', 0.95),
    hat:    pbr(scene, 'cr_hat', '#1c1812', 0.8),
    plume:  pbr(scene, 'cr_plume', '#b02828', 0.7),
    gold:   pbr(scene, 'cr_gold', '#c89030', 0.35, 0.7),
    ruff:   pbr(scene, 'cr_ruff', '#e8e2d0', 0.8),
  };
}
const SLOPS = ['#7a4a2a', '#556048', '#8a3424', '#4a4640', '#9a7a48', '#614a34'];

function tunicMat(scene, hex) { return pbr(scene, 'cr_tunic_' + hex, hex, 0.88); }

function buildCrewman(scene, CREW, parent, type, hex, rot) {
  const g = new TransformNode('crew', scene); g.parent = parent;
  const tunic = tunicMat(scene, hex);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new TransformNode('hip', scene); hip.parent = g; hip.position.set(s * 0.12, 0.86, 0);
    const leg = capsule(scene, 'leg', 0.1, 0.8, CREW.hose, hip); leg.position.y = -0.38;
    const boot = box(scene, 'boot', 0.16, 0.13, 0.3, CREW.boot, hip); boot.position.set(0, -0.8, 0.05);
    legs.push(hip);
  }
  const torso = capsule(scene, 'torso', 0.2, 0.9, tunic, g); torso.position.y = 1.15; torso.scaling.z = 0.72;
  const belt = cyl(scene, 'belt', 0.1, 0.44, 0.44, CREW.boot, g, 10); belt.position.y = 0.92; belt.scaling.z = 0.74;
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new TransformNode('shoulder', scene); sh.parent = g; sh.position.set(s * 0.27, 1.4, 0);
    const arm = capsule(scene, 'arm', 0.072, 0.65, tunic, sh); arm.position.y = -0.28;
    const hand = sphere(scene, 'hand', 0.14, CREW.skin, sh, 5); hand.position.y = -0.56;
    arms.push(sh);
  }
  const head = sphere(scene, 'head', 0.28, CREW.skin, g, 10); head.position.y = 1.64; head.scaling.set(0.92, 1.06, 1);
  const beard = sphere(scene, 'beard', 0.26, CREW.hair, g, 8); beard.position.set(0, 1.6, 0.03); beard.scaling.set(1, 0.7, 1);

  if (type === 'soldier') {
    const cuirass = capsule(scene, 'cuirass', 0.215, 0.55, CREW.steel, g); cuirass.position.y = 1.18; cuirass.scaling.z = 0.78;
    const helm = sphere(scene, 'helm', 0.34, CREW.steel, g, 10); helm.position.y = 1.68; helm.scaling.y = 0.62;
    const brim = torus(scene, 'helmBrim', 0.34, 0.06, CREW.steel, g, 16); brim.position.y = 1.66; brim.rotation.x = PI2; brim.scaling.set(1, 1, 1.5);
    const comb = box(scene, 'comb', 0.02, 0.12, 0.34, CREW.steelD, g); comb.position.set(0, 1.77, 0);
    arms[1].rotation.x = -0.25;
    const pike = cyl(scene, 'pike', 2.9, 0.044, 0.044, CREW.boot, g, 6); pike.position.set(0.3, 1.45, 0.05);
    const tip = cone(scene, 'pikeTip', 0.09, 0.22, CREW.steel, g, 6); tip.position.set(0.3, 3.0, 0.05);
  } else if (type === 'officer') {
    const brim = cyl(scene, 'hatBrim', 0.03, 0.52, 0.52, CREW.hat, g, 16); brim.position.y = 1.78;
    const crown = cyl(scene, 'hatCrown', 0.18, 0.3, 0.32, CREW.hat, g, 12); crown.position.y = 1.86;
    const plume = cone(scene, 'plume', 0.1, 0.4, CREW.plume, g, 6); plume.position.set(0.12, 1.98, -0.05); plume.rotation.z = -0.5;
    const cape = cyl(scene, 'cape', 0.8, 0, 0.68, CREW.hat, g, 12); cape.position.set(0, 1.2, -0.12); cape.rotation.x = 0.1;
    const scabbard = cyl(scene, 'scabbard', 0.7, 0.05, 0.036, CREW.steelD, g, 6); scabbard.position.set(-0.22, 0.7, 0.05); scabbard.rotation.x = 0.4;
    const hilt = sphere(scene, 'hilt', 0.08, CREW.gold, g, 5); hilt.position.set(-0.26, 1.02, -0.05);
    arms[0].rotation.z = 0.3;
  } else {
    const capMat = pbr(scene, 'cr_cap_' + hex, hex, 0.85);
    const cap = sphere(scene, 'cap', 0.31, capMat, g, 10); cap.position.y = 1.72; cap.scaling.y = 0.6;
  }

  g.rotation.y = rot;
  g.scaling.setAll(1 / SHIP_SCALE);
  return { node: g, legs, arms, armBase: [arms[0].rotation.x, arms[1].rotation.x] };
}

function buildConquistador(scene, CREW, parent, kind, coatHex, accentHex) {
  const g = new TransformNode('conq', scene); g.parent = parent;
  const coat = tunicMat(scene, coatHex);
  const accent = pbr(scene, 'cr_accent_' + accentHex, accentHex, 0.7);
  for (const s of [-1, 1]) {
    const leg = capsule(scene, 'leg', 0.1, 0.86, CREW.hose, g); leg.position.set(s * 0.12, 0.5, 0);
    const boot = box(scene, 'boot', 0.17, 0.16, 0.34, CREW.boot, g); boot.position.set(s * 0.12, 0.08, 0.06);
    const cuff = cyl(scene, 'cuff', 0.16, 0.26, 0.22, CREW.boot, g, 8); cuff.position.set(s * 0.12, 0.78, 0);
  }
  const torso = capsule(scene, 'torso', 0.21, 0.92, coat, g); torso.position.y = 1.16; torso.scaling.z = 0.74;
  const belt = cyl(scene, 'belt', 0.1, 0.46, 0.46, CREW.boot, g, 12); belt.position.y = 0.92; belt.scaling.z = 0.76;
  const buckle = box(scene, 'buckle', 0.1, 0.09, 0.03, CREW.gold, g); buckle.position.set(0, 0.92, 0.18);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new TransformNode('shoulder', scene); sh.parent = g; sh.position.set(s * 0.28, 1.42, 0);
    const arm = capsule(scene, 'arm', 0.075, 0.67, coat, sh); arm.position.y = -0.3;
    const hand = sphere(scene, 'hand', 0.15, CREW.skin, sh, 6); hand.position.y = -0.6;
    arms.push(sh);
  }
  const head = sphere(scene, 'head', 0.29, CREW.skin, g, 12); head.position.y = 1.66; head.scaling.set(0.92, 1.07, 1);
  const nose = cone(scene, 'nose', 0.056, 0.07, CREW.skin, g, 6); nose.position.set(0, 1.65, 0.14); nose.rotation.x = PI2;
  const beard = sphere(scene, 'beard', 0.27, CREW.hair, g, 10); beard.position.set(0, 1.61, 0.03); beard.scaling.set(0.96, 0.6, 0.96);

  if (kind === 'captain') {
    const cuirass = capsule(scene, 'cuirass', 0.225, 0.58, CREW.steel, g); cuirass.position.y = 1.18; cuirass.scaling.z = 0.8;
    const ridge = box(scene, 'ridge', 0.03, 0.5, 0.04, CREW.gold, g); ridge.position.set(0, 1.18, 0.2);
    const sash = box(scene, 'sash', 0.5, 0.12, 0.46, accent, g); sash.position.y = 1.12; sash.rotation.z = 0.5;
    const helm = sphere(scene, 'helm', 0.35, CREW.steel, g, 12); helm.position.y = 1.7; helm.scaling.y = 0.6;
    const brim = torus(scene, 'helmBrim', 0.36, 0.07, CREW.steel, g, 18); brim.position.y = 1.68; brim.rotation.x = PI2; brim.scaling.set(1, 1, 1.6);
    const comb = box(scene, 'comb', 0.02, 0.13, 0.36, CREW.steel, g); comb.position.y = 1.8;
    arms[0].rotation.x = -1.0; arms[1].rotation.x = -1.0;
    arms[0].position.z += 0.05; arms[1].position.z += 0.05;
    const blade = box(scene, 'blade', 0.05, 1.1, 0.02, CREW.steel, g); blade.position.set(0, 0.75, 0.42);
    const guard = box(scene, 'guard', 0.28, 0.04, 0.04, CREW.gold, g); guard.position.set(0, 1.3, 0.42);
    const pommel = sphere(scene, 'pommel', 0.1, CREW.gold, g, 6); pommel.position.set(0, 1.42, 0.42);
  } else if (kind === 'crusader') {
    const cape = cyl(scene, 'cape', 0.95, 0, 0.72, accent, g); cape.position.set(0, 1.18, -0.13); cape.rotation.x = 0.12;
    const ruff = torus(scene, 'ruff', 0.26, 0.035, CREW.ruff, g, 16); ruff.position.y = 1.5; ruff.rotation.x = PI2;
    const chain = torus(scene, 'chain', 0.2, 0.012, CREW.gold, g, 16); chain.position.y = 1.42; chain.rotation.x = Math.PI / 2.3;
    const cv = box(scene, 'crossV', 0.04, 0.2, 0.02, CREW.gold, g); cv.position.set(0, 1.28, 0.19);
    const ch = box(scene, 'crossH', 0.13, 0.04, 0.02, CREW.gold, g); ch.position.set(0, 1.32, 0.19);
    const brim = cyl(scene, 'hatBrim', 0.03, 0.5, 0.5, CREW.hat, g, 16); brim.position.y = 1.79;
    const crown = cyl(scene, 'hatCrown', 0.2, 0.28, 0.32, CREW.hat, g, 12); crown.position.y = 1.88;
    const plume = cone(scene, 'plume', 0.1, 0.42, CREW.plume, g, 6); plume.position.set(-0.13, 2.0, -0.04); plume.rotation.z = 0.5;
    arms[1].rotation.x = -0.2;
  } else {
    const ruff = torus(scene, 'ruff', 0.28, 0.045, CREW.ruff, g, 18); ruff.position.y = 1.52; ruff.rotation.x = PI2;
    const chain = torus(scene, 'chain', 0.24, 0.018, CREW.gold, g, 18); chain.position.y = 1.38; chain.rotation.x = Math.PI / 2.2;
    const medal = cyl(scene, 'medal', 0.02, 0.1, 0.1, CREW.gold, g, 10); medal.position.set(0, 1.26, 0.19); medal.rotation.x = PI2;
    const cap = cyl(scene, 'cap', 0.1, 0.36, 0.36, CREW.hat, g, 16); cap.position.y = 1.78;
    const feather = cone(scene, 'feather', 0.08, 0.28, accent, g, 5); feather.position.set(0.16, 1.86, -0.02); feather.rotation.z = -0.7;
    arms[0].rotation.x = -0.5;
    const chartMat = pbr(scene, 'cr_chart', '#d8c89a', 0.9);
    const chart = cyl(scene, 'chart', 0.5, 0.1, 0.1, chartMat, g, 8); chart.position.set(-0.34, 1.2, 0.12); chart.rotation.z = 0.5; chart.rotation.x = 0.2;
  }
  g.scaling.setAll(1 / SHIP_SCALE);
  return { node: g, arms, armBase: [arms[0].rotation.x, arms[1].rotation.x] };
}

// ---------------------------------------------------------------------------
// Patron + officer rosters (identical names / titles / lines / choices)
// ---------------------------------------------------------------------------
const CONQUISTADORS = [
  {
    name: 'Don Gonzalo de Carvajal', title: 'Capitán-General', kind: 'captain',
    coat: '#5a1a14', accent: '#b02828', pos: [0.7, 2.25, 1.6], rot: Math.PI * 0.92,
    lines: [
      'You there — another back bound for the Indies? Good. We shall have need of strong arms and stout hearts both.',
      'My house of Carvajal mortgaged three estates to lay these decks. I do not mean to come home the poorer for it.',
      'Cortés took an empire with less than rides in this hull. Beyond Hispaniola lie cities of gold, and by God I will have my share of them.',
    ],
    choices: [
      { q: 'Where lies this gold?', reply: ['On the mainland beyond the islands — Tierra Firme. One empire has fallen; there will be others.', 'Stand with me and you shall not want for your portion.'] },
      { q: 'And if they resist us?', reply: ['Then they shall learn the temper of Toledo steel. I did not cross an ocean to be refused.'] },
    ],
  },
  {
    name: 'Don Diego de Guzmán', title: 'Don', kind: 'crusader',
    coat: '#202830', accent: '#6a1620', pos: [0, 5.24, 9.4], rot: 0.1,
    lines: [
      'Peace be with you. Stand a while and watch Sevilla sink astern — we may never look on her towers again.',
      'Gold is what my companions crave. I sail for souls. One heathen brought gently to the Faith outweighs a galleon of bullion.',
      'We make for La Española to gather the fleet, and thence to the mainland. God grant we carry the Cross with mercy... though I fear Don Gonzalo will not.',
    ],
    choices: [
      { q: 'Do you not fear the crossing?', reply: ['The sea is in God\'s hand, not mine. I fear only that we forget our purpose amid the gold.'] },
      { q: 'What awaits at Hispaniola?', reply: ['The Admiral\'s town, and the fleet gathering to it. From there the true work begins.'] },
    ],
  },
  {
    name: 'Don Rodrigo de Mendoza', title: 'Don', kind: 'lord',
    coat: '#241f2e', accent: '#c0a040', pos: [-1.5, 5.48, -7.0], rot: Math.PI,
    lines: [
      'Mind the charts — the ink is scarcely dry. Every league of this passage is reckoned, and every real accounted for.',
      'The House of Mendoza does not gamble; it invests. This voyage is ledgered to the last cask of biscuit and keg of powder.',
      'Reach Hispaniola, regroup the fleet, and the mainland is ours to portion out. See that you live to draw your wages, sailor.',
    ],
    choices: [
      { q: 'How long to Hispaniola?', reply: ['Five weeks with fair winds, perhaps seven. I have victualled for ten — I am not a man who trusts the weather.'] },
      { q: 'What did this fleet cost?', reply: ['More than you will earn in three lifetimes. See that not a single cask is wasted.'] },
    ],
  },
];

const OFFICERS = [
  {
    name: 'Esteban de Ribera', title: 'Maestre', build: 'officer', hex: '#2a2a30',
    pos: [1.3, 5.48, -7.2], rot: Math.PI,
    lines: [
      'I am Esteban de Ribera, maestre of this ship. At sea, her timbers and every soul aboard answer to me — our noble passengers included.',
      'The gentlemen adventurers command the conquest; I command the voyage. Confuse the two and we all drown together.',
    ],
    choices: [
      { q: 'What is our course?', reply: ['Down the Guadalquivir to Sanlúcar, then west on the trade winds to La Española. Five or six weeks, wind and God willing.'] },
      { q: 'Who runs the ship under you?', reply: ['The contramaestre drives the hands, the condestable the guns, the carpintero keeps her swimming, the cirujano keeps you breathing. Learn their faces.'] },
    ],
  },
  {
    name: 'Martín Pérez', title: 'Contramaestre', build: 'officer', hex: '#4a3a26',
    pos: [-2.0, 2.25, 3.6], rot: 0.6,
    lines: [
      "Contramaestre Martín Pérez. I am the maestre's voice and his fist — when a sail wants trimming or a back wants the rope's end, that is me.",
    ],
    choices: [
      { q: 'What is my duty?', reply: ['You go where I point — aloft to the topmen or below to the pump and holystone. Idle hands I will not abide.'] },
      { q: 'How fares the crew?', reply: ["A hundred souls in a hull this size: sailors, soldiers, and a few who signed for gold they'll not live to spend. They'll serve."] },
    ],
  },
  {
    name: 'Andrés de Olid', title: 'Condestable', build: 'soldier', hex: '#55524a',
    pos: [2.2, 2.25, -2.2], rot: -1.2,
    lines: [
      'Condestable Andrés de Olid, master of the ordnance. Every culverin and every keg in the magazine answers to me.',
    ],
    choices: [
      { q: 'How many guns?', reply: ['Enough to make a corsair think twice. They sit on the gun deck below, run out through the ports.'] },
      { q: 'Is the powder safe?', reply: ['Dry, sealed, and far from any fool with a pipe. One spark in the magazine and we are all martyrs together.'] },
    ],
  },
  {
    name: 'Bartolomé Núñez', title: 'Carpintero', build: 'sailor', hex: '#6a4a28',
    pos: [1.9, 2.25, 4.9], rot: 2.4,
    lines: [
      'Bartolomé Núñez, carpintero. While she floats I am the most important man aboard — and she floats only because of me.',
    ],
    choices: [
      { q: 'Does she leak?', reply: ['Every ship leaks, friend. The trick is pumping faster than she fills. Mind you take your turn at the bilge.'] },
      { q: 'If we strike a reef?', reply: ['Then I plug the wound with oakum and prayer, and you bail for your life. Pray it does not come to that.'] },
    ],
  },
  {
    name: 'Maestre Cristóbal', title: 'Cirujano', build: 'officer', hex: '#3a2030',
    pos: [-1.3, 2.25, -4.6], rot: 0.3,
    lines: [
      'Maestre Cristóbal, the ship\'s surgeon — barber, bonesetter, and God willing not yet your gravedigger.',
    ],
    choices: [
      { q: 'What ails the crew?', reply: ['The flux, the fever, and the scurvy that rots the gums after weeks at sea. Eat what greens remain while they last.'] },
      { q: 'Have you medicines?', reply: ['A chest of herbs, a bonesaw, and a bottle of aguardiente — for courage, mine and the patient\'s both.'] },
    ],
  },
  {
    name: 'Lope de Triana', title: 'Timonel', build: 'sailor', hex: '#3a4250',
    pos: [-0.8, 5.48, -7.5], rot: Math.PI,
    lines: [
      'Lope de Triana, timonel. My hands have held this helm since Cádiz. Steady is the word — steady, always.',
    ],
    choices: [
      { q: 'May I take the helm?', reply: ['Step to the wheel and press on, lad. Mind the compass and do not let her gripe up into the wind.'] },
      { q: 'How do you steer at night?', reply: ['By the lodestar, the binnacle lamp, and the feel of her through the wood. The sea will tell you, if you listen.'] },
    ],
  },
];

// rank-and-file roster: [region, type, role, line]
const T = 'A topman', M = 'A midshipman', S = 'A man-at-arms', G = "A gunner's mate", C = "A carpenter's mate";
const WAIST_REGION = [-2.7, 2.7, -5.0, 6.2, 2.25];
const FORE_REGION = [-1.0, 1.0, 7.2, 10.4, 5.24];
const CREW_ROSTER = [
  [WAIST_REGION, 'sailor', T, 'Topman, señor — give me a stiff breeze and I\'ll have every sail drawing taut.'],
  [WAIST_REGION, 'soldier', S, 'I\'m a soldier of Castile, not a deckhand. I\'ll earn my pay when we make landfall.'],
  [WAIST_REGION, 'sailor', M, 'No rest on this barky — holystone the planks, coil the lines, work the pump. What of it?'],
  [WAIST_REGION, 'soldier', S, 'Sharpen the steel and trust in God. The Indies won\'t conquer themselves.'],
  [WAIST_REGION, 'sailor', M, 'I\'ve the porter\'s duty today — hauling casks up from the hold till my arms give out.'],
  [WAIST_REGION, 'sailor', C, 'Mind the fresh caulking, friend. The carpenter will have my hide if it\'s marred.'],
  [WAIST_REGION, 'soldier', G, 'Powder\'s kept dry and the shot\'s counted twice, by the condestable\'s order.'],
  [WAIST_REGION, 'sailor', T, 'Up the ratlines a hundred times a day. My hands are leather and my head\'s in the clouds.'],
  [WAIST_REGION, 'sailor', M, 'She takes water like all her kind — back to the bilge pump for me.'],
  [WAIST_REGION, 'soldier', S, 'They say there\'s gold enough on the mainland to pave a cathedral. I mean to see it.'],
  [FORE_REGION, 'soldier', S, 'Lookout on the forecastle head. Nothing yet but sea and more sea.'],
  [FORE_REGION, 'sailor', T, 'Best view on the ship from up here — and the first to feel the weather change.'],
];

// ---------------------------------------------------------------------------
// Assemble the full ship
// ---------------------------------------------------------------------------
export function createShip(scene) {
  const MAT = buildMaterials(scene);
  const CREW = buildCrewMaterials(scene);
  const sailTexPlain = makeSailTexture(scene, 'sailTexPlain', false);
  const sailTexCross = makeSailTexture(scene, 'sailTexCross', true);
  const sailMatPlain = pbr(scene, 'sh_sailPlain', '#fff6e2', 0.96, 0.0, true);
  sailMatPlain.albedoTexture = sailTexPlain;
  const sailMatCross = pbr(scene, 'sh_sailCross', '#fff6e2', 0.96, 0.0, true);
  sailMatCross.albedoTexture = sailTexCross;

  const root = new TransformNode('GalleonNuestraSenoraDeLaVictoria', scene);

  buildHull(scene, MAT).parent = root;
  for (const c of buildHullCaps(scene, MAT)) c.parent = root;
  buildWale(scene, MAT, 0.05, 0.20, MAT.hullDark).parent = root;
  buildWale(scene, MAT, 1.10, 0.22, MAT.hullDark).parent = root;
  buildWale(scene, MAT, 2.40, 0.22, MAT.hullDark).parent = root;
  buildHold(scene, MAT, root);
  buildGunDeck(scene, MAT, root);
  buildHullRibs(scene, MAT, root);
  buildMainDeck(scene, MAT, root);
  const bw = buildBulwarks(scene, MAT, root);
  const fc = buildForecastle(scene, MAT, root);
  const sc = buildSterncastle(scene, MAT, root);

  // mast geometry positions
  const foreZ = SHIP_LENGTH * 0.26, mainZ = -SHIP_LENGTH * 0.02, mizzenZ = -SHIP_LENGTH * 0.28;
  const foreH = 17, mainH = 21, mizzenH = 13;

  const sailPivots = [];
  function addSquareSail(width, height, yardY, z, cross = false) {
    const pivot = new TransformNode('sailPivot', scene); pivot.parent = root;
    pivot.position.set(0, yardY, z);
    const sail = buildSquareSail(scene, cross ? sailMatCross : sailMatPlain, width, height);
    sail.parent = pivot;
    sail.position.set(0, -height / 2 - 0.1, 0.35);
    const bundle = cyl(scene, 'bundle', width * 0.92, 0.4, 0.4, sailMatPlain, root, 8);
    bundle.rotation.z = PI2; bundle.position.set(0, yardY - 0.12, z + 0.12); bundle.isVisible = false;
    sailPivots.push({ pivot, sail, bundle });
    return sail;
  }

  // Foremast
  buildMast(scene, MAT, root, foreH, 0.32, 0.18, true).node.position.set(0, DECK_Y + 0.3, foreZ);
  buildYard(scene, MAT, root, 8, 0.13).position.set(0, DECK_Y + foreH * 0.55, foreZ);
  addSquareSail(8, 5.5, DECK_Y + foreH * 0.55, foreZ + 0.05);

  // Mainmast (crow's nest)
  buildMast(scene, MAT, root, mainH, 0.40, 0.22, true).node.position.set(0, DECK_Y + 0.3, mainZ);
  buildYard(scene, MAT, root, 10, 0.15).position.set(0, DECK_Y + mainH * 0.5, mainZ);
  addSquareSail(10, 7.5, DECK_Y + mainH * 0.5, mainZ + 0.1, true);  // main course — Cross of Burgundy
  buildYard(scene, MAT, root, 7, 0.11).position.set(0, DECK_Y + mainH * 0.85, mainZ);
  addSquareSail(7, 4, DECK_Y + mainH * 0.85, mainZ + 0.05);

  // Mizzen + lateen
  buildMast(scene, MAT, root, mizzenH, 0.26, 0.14, false).node.position.set(0, DECK_Y + 0.3, mizzenZ);
  const lateenYard = cyl(scene, 'lateenYard', 11, 0.16, 0.24, MAT.spar, root, 8);
  lateenYard.position.set(0, DECK_Y + mizzenH * 0.6, mizzenZ - 0.5); lateenYard.rotation.z = PI2 - 0.55;
  const lateen = buildLateenSail(scene, sailMatPlain, 8, 7);
  lateen.parent = root; lateen.position.set(2.5, DECK_Y + mizzenH * 0.4, mizzenZ - 0.4);
  lateen.rotation.y = PI2; lateen.rotation.z = -0.3;

  // Bowsprit
  const bowsprit = buildBowsprit(scene, MAT, sailMatPlain, root);

  // Flags
  const flag = buildBurgundyFlag(scene, MAT, root, 3, 1.8);
  flag.position.set(1.6, DECK_Y + mainH + 0.5, mainZ); flag.rotation.y = PI2;
  const flagMizzen = buildBurgundyFlag(scene, MAT, root, 1.8, 1.0);
  flagMizzen.position.set(1.0, DECK_Y + mizzenH + 0.3, mizzenZ); flagMizzen.rotation.y = PI2;

  // Cannons, furniture
  buildCannons(scene, MAT, root);
  const furniture = buildDeckFurniture(scene, MAT, root);

  // Anchor
  const anchorInfo = buildAnchorAndCable(scene, MAT, root);

  // Fittings
  buildChannels(scene, MAT, root, foreZ, 2.6);
  buildChannels(scene, MAT, root, mainZ, 3.4);
  buildChannels(scene, MAT, root, mizzenZ, 2.0);
  buildFifeRail(scene, MAT, root, foreZ, 0.95);
  buildFifeRail(scene, MAT, root, mainZ, 1.15);
  buildFigurehead(scene, MAT, root);
  buildQuarterGalleries(scene, MAT, root);
  buildBell(scene, MAT, root, 0, DECK_Y + 0.3, WAIST_FWD + 0.4);

  const lightingUpdate = buildShipLighting(scene, MAT, root);

  // Stairs + railings
  const foreTopY = DECK_Y + 0.3 + 2.4 + 0.05 + 0.09;
  const lowerRoofY = (DECK_Y + 0.3 + 2.6 / 2) + 2.6 / 2 + 0.09 + 0.09;
  const stairW1 = buildStaircase(scene, MAT, root, -0.9, WAIST_FWD + 0.05, 6.55, DECK_Y + 0.15, foreTopY, 1.0);
  const stairW2 = buildStaircase(scene, MAT, root, 0, WAIST_AFT - 0.05, -6.85, DECK_Y + 0.15, lowerRoofY, 1.4);

  const railSolid = [];
  const fcHalfX = widthAt(0.85) * 1.7 / 2;
  const fcZf = SHIP_LENGTH * 0.34 + 2.1, fcZa = SHIP_LENGTH * 0.34 - 2.1 + 0.3;
  railSolid.push(...buildRailing(scene, MAT, root, [[-fcHalfX, fcZa], [-fcHalfX, fcZf], [fcHalfX, fcZf], [fcHalfX, fcZa]], foreTopY, 0.9));
  const qdHalfX = widthAt(0.12) * 1.6 / 2;
  const qdZf = -SHIP_LENGTH * 0.38 + 2.8, qdZa = -SHIP_LENGTH * 0.38 - 2.8;
  railSolid.push(...buildRailing(scene, MAT, root, [[-qdHalfX, qdZf], [-qdHalfX, qdZa]], lowerRoofY, 0.9));
  railSolid.push(...buildRailing(scene, MAT, root, [[qdHalfX, qdZf], [qdHalfX, qdZa]], lowerRoofY, 0.9));
  railSolid.push(...buildRailing(scene, MAT, root, [[-qdHalfX, qdZf], [-0.9, qdZf]], lowerRoofY, 0.9));
  railSolid.push(...buildRailing(scene, MAT, root, [[0.9, qdZf], [qdHalfX, qdZf]], lowerRoofY, 0.9));

  // --- Crew: wandering rank-and-file ---
  const wanderers = [];
  const pick = (r) => new Vector3(r[0] + Math.random() * (r[1] - r[0]), r[4], r[2] + Math.random() * (r[3] - r[2]));
  let ci = 0;
  for (const [region, type, role, line] of CREW_ROSTER) {
    const fig = buildCrewman(scene, CREW, root, type, SLOPS[ci % SLOPS.length], Math.random() * Math.PI * 2);
    const start = pick(region);
    fig.node.position.copyFrom(start);
    wanderers.push({
      fig, region, target: pick(region),
      pause: Math.random() * 4, phase: Math.random() * 6,
      speed: 0.5 + Math.random() * 0.5, amp: 0, talking: false,
    });
    ci++;
  }

  // --- Patrons + officers (NPCs) ---
  const npcs = [];
  for (const c of CONQUISTADORS) {
    const fig = buildConquistador(scene, CREW, root, c.kind, c.coat, c.accent);
    fig.node.position.set(c.pos[0], c.pos[1], c.pos[2]);
    fig.node.rotation.y = c.rot;
    npcs.push({
      name: c.name, title: c.title, lines: c.lines, choices: c.choices || [],
      node: fig.node, local: new Vector3(c.pos[0], c.pos[1], c.pos[2]), restRot: c.rot,
    });
  }
  for (const o of OFFICERS) {
    const fig = buildCrewman(scene, CREW, root, o.build, o.hex, o.rot);
    fig.node.position.set(o.pos[0], o.pos[1], o.pos[2]);
    npcs.push({
      name: o.name, title: o.title, lines: o.lines, choices: o.choices || [],
      node: fig.node, local: new Vector3(o.pos[0], o.pos[1], o.pos[2]), restRot: o.rot,
    });
  }
  buildChartTable(scene, MAT, CREW, root, -1.5, 5.48, -7.5);

  // Gunports (ship-local, starboard side)
  const gunports = [];
  for (let i = 0; i < 5; i++) {
    const z01 = 0.26 + (i / 4) * 0.44;
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    gunports.push(new Vector3(widthAt(z01) + 0.15, 1.35, z));
  }

  // Collider sets
  const walkable = [], solid = [];
  root.getChildMeshes(false).forEach((m) => {
    if (!m.metadata) return;
    if (m.metadata.walkable) walkable.push(m);
    else if (m.metadata.solid) solid.push(m);
  });

  // setSails — set (drop) / strike (furl) all square sails together
  function setSails(d) {
    d = Math.max(0, Math.min(1, d));
    for (const p of sailPivots) {
      p.pivot.scaling.y = 0.04 + 0.96 * d;
      p.sail.metadata.deploy = d;
      p.sail.setEnabled(d > 0.05);
      p.bundle.isVisible = d < 0.55;
    }
  }

  // wander AI step
  let prevT = -1;
  function stepCrew(t) {
    let dt = prevT < 0 ? 0 : t - prevT;
    prevT = t;
    if (dt <= 0 || dt > 0.1) dt = Math.min(Math.max(dt, 0), 0.05);
    for (const w of wanderers) {
      const node = w.fig.node;
      const p = node.position;
      if (w.talking) {
        w.amp += (0 - w.amp) * Math.min(1, dt * 8);
      } else if (w.pause > 0) {
        w.pause -= dt;
        w.amp += (0 - w.amp) * Math.min(1, dt * 6);
      } else {
        const dx = w.target.x - p.x, dz = w.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) { w.pause = 1.5 + Math.random() * 4; w.target = pick(w.region); }
        else {
          p.x += (dx / d) * w.speed * dt;
          p.z += (dz / d) * w.speed * dt;
          p.y = w.region[4];
          const want = Math.atan2(dx, dz);
          let df = want - node.rotation.y;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          node.rotation.y += df * Math.min(1, dt * 8);
          w.amp += (1 - w.amp) * Math.min(1, dt * 6);
          w.phase += dt * w.speed * 6;
        }
      }
      const sw = Math.sin(w.phase) * 0.6 * w.amp;
      w.fig.legs[0].rotation.x = sw;
      w.fig.legs[1].rotation.x = -sw;
      w.fig.arms[0].rotation.x = w.fig.armBase[0] - sw * 0.7;
      w.fig.arms[1].rotation.x = w.fig.armBase[1] + sw * 0.7;
    }
  }

  // gathered flutter functions (sails + flags)
  const flutterFns = [];
  for (const p of sailPivots) flutterFns.push(p.sail.flutter);
  flutterFns.push(bowsprit.sail.flutter);
  flutterFns.push(flag.flutter, flagMizzen.flutter);

  function update(t) {
    for (const fn of flutterFns) fn(t);
    lightingUpdate(t);
    stepCrew(t);
  }

  setSails(1);

  // scale up to grand proportions
  root.scaling.setAll(SHIP_SCALE);

  return {
    root,
    colliders: { walkable, solid: [...solid, ...bw.solid, ...fc.solid, ...sc.solid, ...railSolid] },
    npcs,
    helmStand: new Vector3(0, DECK_Y + 0.3 + 2.6 + 0.18, -8.05),
    wheel: furniture.wheel,
    anchor: { node: anchorInfo.node, upY: anchorInfo.baseY, downY: anchorInfo.baseY - 4.5, up: true },
    gunports,
    capstan: furniture.capstan,
    capstanStation: new Vector3(0, 2.25, 5.9),
    gunStation: new Vector3(2.3, 2.25, 0.5),
    setSails,
    update,
  };
}
