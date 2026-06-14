// Procedural Spanish nao / galleon, c. early 16th century.
// Three masts: foresail + mainsail (square rig) + lateen mizzen.
// Built from primitives — no external assets required.

import * as THREE from 'three';

// The whole ship is scaled up so a human-sized character has room to roam a
// deck of properly grand, period proportions. The player and crew are built at
// human scale and counter-scaled so they stay 1.7m tall on the bigger hull.
export const SHIP_SCALE = 1.4;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const MAT = {
  hullDark:    new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide }),
  hullMid:     new THREE.MeshStandardMaterial({ color: 0x6a4220, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide }),
  hullLight:   new THREE.MeshStandardMaterial({ color: 0x8a5828, roughness: 0.78, metalness: 0.02 }),
  deck:        new THREE.MeshStandardMaterial({ color: 0xa07440, roughness: 0.95, metalness: 0.0 }),
  deckDark:    new THREE.MeshStandardMaterial({ color: 0x8a5e30, roughness: 0.95, metalness: 0.0 }),
  hold:        new THREE.MeshStandardMaterial({ color: 0x3a2210, roughness: 0.98, metalness: 0.0 }),
  beam:        new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.95 }),
  barrel:      new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 }),
  cannon:      new THREE.MeshStandardMaterial({ color: 0x14110c, roughness: 0.4, metalness: 0.7 }),
  mast:        new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.88 }),
  spar:        new THREE.MeshStandardMaterial({ color: 0x2a1d10, roughness: 0.9 }),
  sail:        new THREE.MeshStandardMaterial({ color: 0xede2c4, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide }),
  sailRed:     new THREE.MeshStandardMaterial({ color: 0xb43020, roughness: 0.9, side: THREE.DoubleSide }),
  rope:        new THREE.LineBasicMaterial({ color: 0x1a1208, transparent: true, opacity: 0.85 }),
  trimGold:    new THREE.MeshStandardMaterial({ color: 0xc89030, roughness: 0.35, metalness: 0.65 }),
  trimRed:     new THREE.MeshStandardMaterial({ color: 0x801818, roughness: 0.7 }),
  flagWhite:   new THREE.MeshStandardMaterial({ color: 0xf2ead0, roughness: 0.7, side: THREE.DoubleSide }),
  flagRed:     new THREE.MeshStandardMaterial({ color: 0xa01818, roughness: 0.7, side: THREE.DoubleSide }),
  lanternGlow: new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xff9438, emissiveIntensity: 3.0, roughness: 0.4 }),
  iron:        new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.55, metalness: 0.8 }),
  windowGlow:  new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffaa44, emissiveIntensity: 0.8 }),
  flame:       new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xff8418, emissiveIntensity: 4.0, roughness: 0.5, transparent: true, opacity: 0.92 }),
  flameHot:    new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffb030, emissiveIntensity: 5.0, roughness: 0.4 }),
  glassGlow:   new THREE.MeshStandardMaterial({ color: 0xffca78, emissive: 0xff9028, emissiveIntensity: 1.6, roughness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  ember:       new THREE.MeshStandardMaterial({ color: 0x3a1206, emissive: 0xff5410, emissiveIntensity: 2.4, roughness: 0.9 }),
  canvasMat:   new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.96, metalness: 0.0, side: THREE.DoubleSide }),
};

// ---------------------------------------------------------------------------
// Sail cloth — procedural canvas texture: stitched panels, reef bands with
// reef points, weather staining, and (optionally) a red Cross of Burgundy.
// ---------------------------------------------------------------------------
function makeSailTexture(cross = false) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#e9dfc4'; x.fillRect(0, 0, 512, 512);

  // vertical cloth panels (canvas was sewn from ~60cm widths)
  for (let i = 0; i < 512; i += 40) {
    x.fillStyle = 'rgba(120,100,68,0.12)'; x.fillRect(i, 0, 2, 512);
    x.fillStyle = 'rgba(255,252,240,0.07)'; x.fillRect(i + 2, 0, 1, 512);
  }
  // horizontal reef bands with reef-point stitches
  for (const yy of [110, 285, 410]) {
    x.fillStyle = 'rgba(150,124,82,0.28)'; x.fillRect(0, yy, 512, 7);
    x.fillStyle = 'rgba(70,52,28,0.55)';
    for (let i = 18; i < 512; i += 38) x.fillRect(i, yy - 4, 3, 15);
  }
  // soft weather staining
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
    // raguly "knots" along the saltire
    x.fillStyle = '#86170f';
    for (let t = 0.12; t < 0.9; t += 0.16) {
      x.fillRect(80 + 352 * t - 6, 80 + 352 * t - 18, 12, 12);
      x.fillRect(432 - 352 * t - 6, 80 + 352 * t + 6, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const SAIL_TEX = makeSailTexture(false);
const SAIL_TEX_CROSS = makeSailTexture(true);
const sailMatPlain = new THREE.MeshStandardMaterial({ map: SAIL_TEX, color: 0xfff6e2, roughness: 0.96, metalness: 0.0, side: THREE.DoubleSide });
const sailMatCross = new THREE.MeshStandardMaterial({ map: SAIL_TEX_CROSS, color: 0xfff6e2, roughness: 0.96, metalness: 0.0, side: THREE.DoubleSide });

// ---------------------------------------------------------------------------
// Hull — lofted from parametric cross-sections
// ---------------------------------------------------------------------------
const SHIP_LENGTH = 26;
const SHIP_BEAM = 7.0;
const HULL_DEPTH = 3.6;
const DECK_Y = 2.4;          // gunwale (top of hull) at midship

function widthAt(z01) {
  // z01: 0 = stern, 1 = bow
  // Stern is full, midship widest, bow fine
  const t = z01 * 2 - 1; // -1..1
  let w = (SHIP_BEAM / 2) * Math.sqrt(Math.max(0, 1 - t * t * 0.78));
  if (z01 > 0.55) {
    // Bow tapers more aggressively
    w *= 1 - Math.pow((z01 - 0.55) / 0.45, 1.6) * 0.85;
  }
  return Math.max(w, 0.05);
}

function keelAt(z01) {
  // Bottom of hull — deepest at midship, rises at bow and stern
  const t = z01 - 0.5;
  const base = -HULL_DEPTH + t * t * 3.2;
  // Bow rises a bit more steeply
  if (z01 > 0.8) return base + Math.pow((z01 - 0.8) / 0.2, 2) * 1.2;
  return base;
}

function deckSheerAt(z01) {
  // Gunwale line — the top edge of the main hull (where deck planking sits)
  // Drops to lowest at ~midship, rises forward and aft to receive castles
  if (z01 < 0.2) return DECK_Y + Math.pow((0.2 - z01) / 0.2, 2) * 1.4;
  if (z01 > 0.78) return DECK_Y + Math.pow((z01 - 0.78) / 0.22, 1.6) * 1.6;
  return DECK_Y;
}

function buildHull() {
  const lengthSegs = 48;
  const heightSegs = 18;

  function pointAt(z01, v) {
    // v: 0 = port deck edge, 0.5 = keel, 1 = starboard deck edge
    const w = widthAt(z01);
    const k = keelAt(z01);
    const d = deckSheerAt(z01);

    const portSide = v < 0.5;
    const t = portSide ? v * 2 : (1 - v) * 2; // 0..1, 0 = deck edge, 1 = keel
    // Slight tumblehome — top edge pulled inward a touch
    const tumble = 1.0 - 0.08 * (1 - t);
    const x = (portSide ? -1 : 1) * w * Math.cos(t * Math.PI / 2) * tumble;
    const y = d - (d - k) * Math.sin(t * Math.PI / 2);
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    return [x, y, z];
  }

  const positions = [];
  const indices = [];
  for (let i = 0; i <= lengthSegs; i++) {
    const z01 = i / lengthSegs;
    for (let j = 0; j <= heightSegs; j++) {
      const v = j / heightSegs;
      const [x, y, z] = pointAt(z01, v);
      positions.push(x, y, z);
    }
  }
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < heightSegs; j++) {
      const a = i * (heightSegs + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (heightSegs + 1) + j;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const hull = new THREE.Mesh(geo, MAT.hullMid);
  hull.castShadow = true;
  hull.receiveShadow = true;
  return hull;
}

// ---------------------------------------------------------------------------
// Decorative wales — horizontal planking bands at three heights
// ---------------------------------------------------------------------------
function buildWales() {
  const grp = new THREE.Group();
  const segs = 64;

  function makeWale(yOffset, thickness, material) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segs; i++) {
      const z01 = i / segs;
      const w = widthAt(z01) * 1.005;
      const d = deckSheerAt(z01);
      const y = d - yOffset;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      // Each cross-section: 4 corners of a thin band wrapping around hull side
      // We'll do port and starboard separately as two ribbons
      positions.push(-w, y, z);
      positions.push(-w, y - thickness, z);
      positions.push(w, y, z);
      positions.push(w, y - thickness, z);
    }
    for (let i = 0; i < segs; i++) {
      const base = i * 4;
      // Port ribbon
      indices.push(base, base + 1, base + 4);
      indices.push(base + 1, base + 5, base + 4);
      // Starboard ribbon
      indices.push(base + 2, base + 6, base + 3);
      indices.push(base + 3, base + 6, base + 7);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    return m;
  }

  grp.add(makeWale(0.05, 0.20, MAT.hullDark));   // gunwale cap
  grp.add(makeWale(1.10, 0.22, MAT.hullDark));   // upper wale
  grp.add(makeWale(2.40, 0.22, MAT.hullDark));   // lower wale
  return grp;
}

// ---------------------------------------------------------------------------
// Main deck — multi-section, with midship "waist" left open so you can see
// the gun deck below. Historically accurate for a 16th-c. Spanish nao.
// ---------------------------------------------------------------------------
const WAIST_AFT = -SHIP_LENGTH * 0.22;   // z where the open well begins (aft side)
const WAIST_FWD = SHIP_LENGTH * 0.20;    // z where the open well ends (fwd side)
const GANGWAY_WIDTH = 1.2;               // meters — narrow side walkways

function buildDeckStrip(zMin, zMax, leftFn, rightFn, segs, material, walkable = false) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = zMin + (zMax - zMin) * t;
    const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
    const y = deckSheerAt(z01) - 0.15;
    const xL = leftFn(z01);
    const xR = rightFn(z01);
    positions.push(xL, y, z, xR, y, z);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    // wound so the top face (and its normal) points UP — correct lighting and,
    // critically, so the character's downward collision ray actually hits it
    indices.push(a, a + 2, a + 1);
    indices.push(a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  if (walkable) mesh.userData.walkable = true;
  return mesh;
}

function buildMainDeck() {
  const grp = new THREE.Group();
  const innerW = (z01) => widthAt(z01) * 0.92;

  // One continuous weather deck, stern to bow — fully walkable, no open well
  grp.add(buildDeckStrip(
    -SHIP_LENGTH / 2 - 0.5, SHIP_LENGTH / 2 + 0.6,
    (z01) => -innerW(z01),
    (z01) => innerW(z01),
    56, MAT.deck, true
  ));

  // Caulked plank seams running fore-and-aft
  for (let i = -6; i <= 6; i++) {
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.02, SHIP_LENGTH - 0.5),
      MAT.beam
    );
    seam.position.set(i * 0.5, DECK_Y - 0.135, 0);
    grp.add(seam);
  }

  // Two cargo hatches with raised coamings + gratings, sitting on the deck
  for (const hz of [0.6, -4.2]) {
    const hatchW = hz > 0 ? 2.6 : 1.8;
    const hatchL = hz > 0 ? 3.0 : 2.0;
    for (const rz of [hatchL / 2, -hatchL / 2]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(hatchW + 0.28, 0.3, 0.14), MAT.hullDark);
      c.position.set(0, DECK_Y, hz + rz); c.castShadow = true; grp.add(c);
    }
    for (const rx of [-hatchW / 2 - 0.07, hatchW / 2 + 0.07]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, hatchL), MAT.hullDark);
      c.position.set(rx, DECK_Y, hz); c.castShadow = true; grp.add(c);
    }
    const nx = Math.round(hatchW / 0.38);
    for (let i = 0; i <= nx; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, hatchL), MAT.beam);
      b.position.set(-hatchW / 2 + i * (hatchW / nx), DECK_Y + 0.04, hz); grp.add(b);
    }
    const nz = Math.round(hatchL / 0.34);
    for (let i = 0; i <= nz; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(hatchW, 0.06, 0.05), MAT.beam);
      b.position.set(0, DECK_Y + 0.04, hz - hatchL / 2 + i * (hatchL / nz)); grp.add(b);
    }
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Gun deck — second deck, ~1.5m below the main deck. Visible through the
// open waist. Cannons sit on this deck.
// ---------------------------------------------------------------------------
const GUN_DECK_Y = 0.85;

function buildGunDeck() {
  const grp = new THREE.Group();
  const segs = 30;

  const gunDeck = buildDeckStrip(
    -SHIP_LENGTH * 0.42, SHIP_LENGTH * 0.42,
    (z01) => -widthAt(z01) * 0.88,
    (z01) => widthAt(z01) * 0.88,
    segs,
    MAT.deckDark, true
  );
  // Manually override y to be the gun-deck level rather than gunwale-relative
  const pos = gunDeck.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, GUN_DECK_Y);
  }
  pos.needsUpdate = true;
  gunDeck.geometry.computeVertexNormals();
  grp.add(gunDeck);

  // Plank seams on gun deck
  for (let i = -2; i <= 2; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, SHIP_LENGTH * 0.78),
      MAT.beam
    );
    plank.position.set(i * 0.55, GUN_DECK_Y + 0.015, 0);
    grp.add(plank);
  }

  // Vertical posts (knees) supporting the deck above
  for (let i = -3; i <= 3; i += 2) {
    const z = i * 2.0;
    const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
    const w = widthAt(z01) * 0.7;
    for (let side = -1; side <= 1; side += 2) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, DECK_Y - GUN_DECK_Y, 0.18),
        MAT.beam
      );
      post.position.set(side * w, (DECK_Y + GUN_DECK_Y) / 2, z);
      grp.add(post);
    }
  }

  // Small hatch in the gun deck revealing the hold below
  const hatchZ = -3;
  const hatch = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.06, 1.4),
    MAT.beam
  );
  hatch.position.set(0, GUN_DECK_Y + 0.04, hatchZ);
  // Hatch frame is solid; we'll cut visual interest with a black square in middle
  grp.add(hatch);

  const hatchHole = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.02, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  hatchHole.position.set(0, GUN_DECK_Y + 0.06, hatchZ);
  grp.add(hatchHole);

  return grp;
}

// ---------------------------------------------------------------------------
// Hold — lowest deck, visible through the gun-deck hatch. Contains cargo.
// ---------------------------------------------------------------------------
const HOLD_Y = -0.6;

function buildHold() {
  const grp = new THREE.Group();

  // Hold floor — narrower than gun deck since the hull tapers
  const segs = 16;
  const floor = buildDeckStrip(
    -SHIP_LENGTH * 0.32, SHIP_LENGTH * 0.32,
    (z01) => -widthAt(z01) * 0.7,
    (z01) => widthAt(z01) * 0.7,
    segs,
    MAT.hold
  );
  const pos = floor.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, HOLD_Y);
  pos.needsUpdate = true;
  floor.geometry.computeVertexNormals();
  grp.add(floor);

  // Cargo barrels stacked in the hold (visible through the hatch)
  const barrelPositions = [
    [-0.4, -3.5], [0.4, -3.5], [0, -3.0],
    [-0.5, -2.4], [0.5, -2.4],
    [-0.4, -4.1], [0.4, -4.1],
  ];
  for (const [x, z] of barrelPositions) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.30, 0.7, 10),
      MAT.barrel
    );
    barrel.position.set(x, HOLD_Y + 0.35, z);
    // Iron rings
    for (let k = 0; k < 2; k++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.33, 0.015, 4, 12),
        MAT.iron
      );
      ring.position.set(x, HOLD_Y + 0.18 + k * 0.32, z);
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);
    }
    grp.add(barrel);
  }

  // Crates further along
  for (const [x, z] of [[-0.6, 0], [0.6, 0], [0, 0.8]]) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.55, 0.7),
      MAT.barrel
    );
    crate.position.set(x, HOLD_Y + 0.28, z);
    grp.add(crate);
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Cannons — full carriages with barrels, on the gun deck, barrels protruding
// through the hull's gun ports
// ---------------------------------------------------------------------------
function buildCannon() {
  const grp = new THREE.Group();

  // Barrel — long thin cylinder, tapered toward the muzzle
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.16, 1.8, 14),
    MAT.cannon
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.55, 0, 0); // muzzle forward
  barrel.castShadow = true;
  grp.add(barrel);

  // Trunnion ring (decorative band on the barrel)
  const trunnion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12),
    MAT.iron
  );
  trunnion.rotation.z = Math.PI / 2;
  trunnion.position.set(0.0, 0, 0);
  grp.add(trunnion);

  // Carriage (wooden base)
  const carriage = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.28, 0.55),
    MAT.barrel
  );
  carriage.position.set(0, -0.28, 0);
  carriage.castShadow = true;
  grp.add(carriage);

  // Four wheels
  for (const [x, z] of [[-0.35, -0.22], [0.35, -0.22], [-0.35, 0.22], [0.35, 0.22]]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10),
      MAT.beam
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, -0.45, z);
    grp.add(wheel);
  }

  return grp;
}

function buildCannons() {
  const grp = new THREE.Group();
  const portRowY = GUN_DECK_Y + 0.45; // cannon barrel height above gun deck
  const count = 6;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < count; i++) {
      const z01 = 0.22 + (i / (count - 1)) * 0.50;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);

      // The cannon sits just inside the hull, barrel pointing outward
      const cannon = buildCannon();
      cannon.position.set(side * (w - 0.85), portRowY, z);
      cannon.rotation.y = side > 0 ? 0 : Math.PI;
      grp.add(cannon);

      // Gun port frame on the hull (dark rectangle outlining the opening)
      const portFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.62, 0.62),
        MAT.hullDark
      );
      portFrame.position.set(side * (w + 0.03), portRowY + 0.05, z);
      grp.add(portFrame);

      // Port lid hinged open (a small flap above the port)
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.58, 0.58),
        MAT.hullLight
      );
      lid.position.set(side * (w + 0.18), portRowY + 0.50, z);
      lid.rotation.z = side * 0.5; // hinged outward and upward
      grp.add(lid);
    }
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Deck furniture — capstan, ship's wheel, deck barrels, coiled ropes
// ---------------------------------------------------------------------------
function buildDeckFurniture() {
  const grp = new THREE.Group();

  // Capstan (vertical winch) between fore and main masts — its own group so it
  // can be turned when the crew "man the capstan".
  const capstan = new THREE.Group();
  capstan.position.set(0, 0, 4.2);
  const capstanBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.55, 1.0, 12),
    MAT.barrel
  );
  capstanBody.position.set(0, DECK_Y + 0.65, 0);
  capstanBody.castShadow = true;
  capstan.add(capstanBody);

  const capstanCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.42, 0.12, 12),
    MAT.beam
  );
  capstanCap.position.set(0, DECK_Y + 1.20, 0);
  capstan.add(capstanCap);

  // Capstan bars (horizontal spokes)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.07, 0.07),
      MAT.spar
    );
    bar.position.set(0.85 * Math.cos(angle), DECK_Y + 1.00, 0.85 * Math.sin(angle));
    bar.rotation.y = -angle;
    capstan.add(bar);
  }
  grp.add(capstan);
  grp.userData.capstan = capstan;

  // Ship's wheel — on the quarterdeck, in front of the great-cabin bulkhead.
  // Mounted in its own group so the helm can spin it. (A whipstaff was more
  // strictly period, but a wheel reads instantly as "take the helm".)
  const HELM = new THREE.Vector3(0, DECK_Y + 0.3 + 2.6 + 0.18 + 0.85, -7.7);
  const wheel = new THREE.Group();
  wheel.position.copy(HELM);

  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), MAT.iron);
  axle.rotation.x = Math.PI / 2; wheel.add(axle);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 10), MAT.beam);
  hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 6, 24), MAT.beam);
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.04, 0.045), MAT.beam);
    spoke.rotation.z = a; wheel.add(spoke);
    // turned handle projecting past the rim
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), MAT.hullDark);
    handle.position.set(Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0);
    handle.rotation.x = Math.PI / 2; wheel.add(handle);
  }
  grp.add(wheel);
  grp.userData.wheel = wheel;

  // Binnacle pedestal carrying the wheel down to the deck
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.4, 0.34), MAT.hullDark);
  pedestal.position.set(0, HELM.y - 0.9, -7.7);
  pedestal.castShadow = true;
  grp.add(pedestal);
  const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), MAT.beam);
  binnacle.position.set(0, HELM.y - 0.2, -7.4);
  grp.add(binnacle);

  // Deck barrels (water, gunpowder, salted pork) — clustered near the foremast
  const deckBarrelPos = [
    [-1.8, DECK_Y + 0.5, 7.5], [-1.2, DECK_Y + 0.5, 8.2],
    [1.5, DECK_Y + 0.5, 7.5], [1.9, DECK_Y + 0.5, 6.8],
    [-2.0, DECK_Y + 0.5, -6], [2.0, DECK_Y + 0.5, -6],
  ];
  for (const [x, y, z] of deckBarrelPos) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.30, 0.70, 10),
      MAT.barrel
    );
    barrel.position.set(x, y, z);
    barrel.castShadow = true;
    grp.add(barrel);
    // Iron bands
    for (let k = 0; k < 2; k++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.33, 0.018, 4, 12),
        MAT.iron
      );
      ring.position.set(x, y - 0.16 + k * 0.32, z);
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);
    }
  }

  // Coiled rope on deck
  for (const [x, z] of [[-2.2, -1], [2.2, 2], [-1.5, 5.5]]) {
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.07, 5, 14),
      MAT.beam
    );
    coil.position.set(x, DECK_Y + 0.21, z);
    coil.rotation.x = Math.PI / 2;
    grp.add(coil);
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Forecastle — raised structure at the bow
// ---------------------------------------------------------------------------
function buildForecastle() {
  const grp = new THREE.Group();
  const z = SHIP_LENGTH * 0.34;
  const width = widthAt(0.85) * 1.7;
  const height = 2.4;

  // Side walls
  const wallH = height;
  const wallT = 0.18;
  const wallL = 4.2;

  const sidePort = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, wallH, wallL),
    MAT.hullMid
  );
  sidePort.position.set(-width / 2, DECK_Y + 0.3 + wallH / 2, z);
  sidePort.castShadow = true;
  sidePort.userData.solid = true;
  grp.add(sidePort);

  const sideStbd = sidePort.clone();
  sideStbd.position.x = width / 2;
  grp.add(sideStbd);

  // Front wall (bulkhead)
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallH, wallT),
    MAT.hullMid
  );
  front.position.set(0, DECK_Y + 0.3 + wallH / 2, z + wallL / 2);
  front.castShadow = true;
  front.userData.solid = true;
  grp.add(front);

  // Roof / fighting top deck
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.4, 0.18, wallL + 0.4),
    MAT.deck
  );
  roof.position.set(0, DECK_Y + 0.3 + wallH + 0.05, z);
  roof.receiveShadow = true;
  roof.userData.walkable = true;
  grp.add(roof);

  // Aft bulkhead with a doorway, so the forecastle top is reachable yet enclosed
  const backL = new THREE.Mesh(new THREE.BoxGeometry(width * 0.32, wallH, wallT), MAT.hullMid);
  backL.position.set(-width * 0.34, DECK_Y + 0.3 + wallH / 2, z - wallL / 2);
  backL.castShadow = true;
  backL.userData.solid = true;
  grp.add(backL);
  const backR = backL.clone();
  backR.position.x = width * 0.34;
  grp.add(backR);

  // Decorative trim band along the top
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, 0.15, 0.1),
    MAT.trimRed
  );
  trim.position.set(0, DECK_Y + 0.3 + wallH - 0.08, z + wallL / 2 + 0.05);
  grp.add(trim);

  return grp;
}

// ---------------------------------------------------------------------------
// Sterncastle — taller, more ornate structure at the stern
// ---------------------------------------------------------------------------
function buildSterncastle() {
  const grp = new THREE.Group();
  const z = -SHIP_LENGTH * 0.38;
  const width = widthAt(0.12) * 1.6;
  const lowerH = 2.6;
  const upperH = 1.8;
  const wallT = 0.18;
  const lowerL = 5.6;
  const upperL = 3.8;

  // Lower deck (quarterdeck) walls
  const lowerY = DECK_Y + 0.3 + lowerH / 2;

  const lp = new THREE.Mesh(new THREE.BoxGeometry(wallT, lowerH, lowerL), MAT.hullMid);
  lp.position.set(-width / 2, lowerY, z);
  lp.castShadow = true;
  lp.userData.solid = true;
  grp.add(lp);

  const ls = lp.clone();
  ls.position.x = width / 2;
  grp.add(ls);

  // Forward bulkhead of the cabin, split around a companionway door
  const fwL = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, lowerH, wallT), MAT.hullMid);
  fwL.position.set(-width * 0.33, lowerY, z + lowerL / 2);
  fwL.castShadow = true;
  fwL.userData.solid = true;
  grp.add(fwL);
  const fwR = fwL.clone();
  fwR.position.x = width * 0.33;
  grp.add(fwR);

  // Aft wall (stern transom) — slightly angled outward at top
  const transom = new THREE.Mesh(
    new THREE.BoxGeometry(width, lowerH, wallT),
    MAT.hullDark
  );
  transom.position.set(0, lowerY, z - lowerL / 2);
  transom.rotation.x = -0.08;
  transom.castShadow = true;
  transom.userData.solid = true;
  grp.add(transom);

  // Lower roof / poop deck floor
  const lowerRoof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.4, 0.18, lowerL + 0.4),
    MAT.deck
  );
  lowerRoof.position.set(0, lowerY + lowerH / 2 + 0.09, z);
  lowerRoof.receiveShadow = true;
  lowerRoof.userData.walkable = true;
  grp.add(lowerRoof);

  // Upper deck (poop) — smaller and aft-set
  const upperY = lowerY + lowerH / 2 + 0.18 + upperH / 2;
  const upperZ = z - 0.8;

  const up = new THREE.Mesh(new THREE.BoxGeometry(wallT, upperH, upperL), MAT.hullMid);
  up.position.set(-width / 2 + 0.4, upperY, upperZ);
  up.castShadow = true;
  up.userData.solid = true;
  grp.add(up);

  const us = up.clone();
  us.position.x = width / 2 - 0.4;
  grp.add(us);

  const upperTransom = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.8, upperH, wallT),
    MAT.hullDark
  );
  upperTransom.position.set(0, upperY, upperZ - upperL / 2);
  upperTransom.userData.solid = true;
  grp.add(upperTransom);

  // Forward bulkhead of the upper cabin (closes it off; poop deck sits above)
  const upFront = new THREE.Mesh(new THREE.BoxGeometry(width - 0.8, upperH, wallT), MAT.hullMid);
  upFront.position.set(0, upperY, upperZ + upperL / 2);
  upFront.userData.solid = true;
  grp.add(upFront);

  const upperRoof = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.4, 0.15, upperL + 0.3),
    MAT.deck
  );
  upperRoof.position.set(0, upperY + upperH / 2 + 0.08, upperZ);
  upperRoof.userData.walkable = true;
  grp.add(upperRoof);

  // Decorative gold trim band on the lower castle
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, 0.18, 0.1),
    MAT.trimGold
  );
  trim.position.set(0, lowerY + lowerH / 2 - 0.15, z - lowerL / 2 - 0.02);
  grp.add(trim);

  // Stern gallery windows — glowing amber rectangles on the transom
  for (let i = -1; i <= 1; i++) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.05),
      MAT.windowGlow
    );
    win.position.set(i * 1.0, lowerY + 0.2, z - lowerL / 2 - 0.09);
    grp.add(win);
  }

  // Stern lantern — small box on the topmost roof, glowing
  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.65, 0.45),
    MAT.lanternGlow
  );
  lantern.position.set(0, upperY + upperH / 2 + 0.5, upperZ - upperL / 2 + 0.3);
  grp.add(lantern);

  const lanternCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.4, 6),
    MAT.iron
  );
  lanternCap.position.set(0, upperY + upperH / 2 + 1.0, upperZ - upperL / 2 + 0.3);
  grp.add(lanternCap);

  // Point light from the lantern (subtle, warm)
  const lanternLight = new THREE.PointLight(0xffa040, 1.5, 12, 2);
  lanternLight.position.copy(lantern.position);
  grp.add(lanternLight);

  return { group: grp, topY: upperY + upperH / 2 + 1.2, sternZ: z - lowerL / 2 };
}

// ---------------------------------------------------------------------------
// Mast — vertical pole with optional crow's nest and mounted yards
// ---------------------------------------------------------------------------
function buildMast(height, baseRadius, topRadius, withCrowsNest = false) {
  const grp = new THREE.Group();

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(topRadius, baseRadius, height, 12),
    MAT.mast
  );
  mast.position.y = height / 2;
  mast.castShadow = true;
  mast.userData.solid = true;
  grp.add(mast);

  // Woolding — rope wrappings banding the lower mast, with iron hoops
  const woldCount = 5;
  for (let i = 0; i < woldCount; i++) {
    const wy = height * (0.12 + i * 0.07);
    const r = THREE.MathUtils.lerp(baseRadius, topRadius, wy / height) + 0.03;
    const wold = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.04, 5, 16),
      MAT.iron
    );
    wold.position.y = wy;
    wold.rotation.x = Math.PI / 2;
    grp.add(wold);
  }

  if (withCrowsNest) {
    const nest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.55, 0.7, 14, 1, true),
      MAT.beam
    );
    nest.position.y = height * 0.6;
    nest.castShadow = true;
    grp.add(nest);

    const nestFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.55, 0.08, 14),
      MAT.deck
    );
    nestFloor.position.y = height * 0.6 - 0.32;
    grp.add(nestFloor);
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Yard — horizontal spar that holds a square sail
// ---------------------------------------------------------------------------
function buildYard(length, radius = 0.12) {
  const yard = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius, length, 8),
    MAT.spar
  );
  yard.rotation.z = Math.PI / 2;
  yard.castShadow = true;
  return yard;
}

// ---------------------------------------------------------------------------
// Square sail — wide rectangle with billow and a slight flutter animation
// ---------------------------------------------------------------------------
function buildSquareSail(width, height, cross = false) {
  const wSegs = 28, hSegs = 20;
  const geo = new THREE.PlaneGeometry(width, height, wSegs, hSegs);

  // Wind-filled belly: deep forward billow, fuller toward the foot, with a
  // catenary droop along the bottom edge (the way a set course actually hangs).
  const pos = geo.attributes.position;
  const baseZ = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = x / width;            // -0.5..0.5
    const v = (y / height) + 0.5;   // 0 (foot) .. 1 (head)
    const acrossBelly = Math.cos(u * Math.PI);          // 1 at centre, 0 at leeches
    const downBelly = 0.45 + 0.55 * (1 - v);            // fuller low down
    const billow = Math.max(0, acrossBelly) * downBelly * width * 0.26;
    // foot scallop (canvas sags between the clews)
    const scallop = (v < 0.12) ? -Math.cos(u * Math.PI) * 0.18 * height : 0;
    pos.setZ(i, billow);
    pos.setY(i, y + scallop);
    baseZ[i] = billow;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, cross ? sailMatCross : sailMatPlain);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Bolt-rope sewn around the edges
  const ep = [];
  const hw = width / 2, hh = height / 2;
  ep.push(new THREE.Vector3(-hw, hh, 0.02), new THREE.Vector3(hw, hh, 0.02));
  ep.push(new THREE.Vector3(hw, hh, 0.02), new THREE.Vector3(hw, -hh, 0.02));
  ep.push(new THREE.Vector3(hw, -hh, 0.02), new THREE.Vector3(-hw, -hh, 0.02));
  ep.push(new THREE.Vector3(-hw, -hh, 0.02), new THREE.Vector3(-hw, hh, 0.02));
  const boltGeo = new THREE.BufferGeometry().setFromPoints(ep);
  mesh.add(new THREE.LineSegments(boltGeo, MAT.rope));

  // flutter — amplitude eases off as the sail is taken in. Skip entirely when
  // furled, and recompute the (expensive) normals only every 3rd frame.
  mesh.userData.deploy = 1;
  let frame = 0;
  mesh.userData.update = (t) => {
    if (mesh.userData.deploy < 0.05 || !mesh.visible) return;
    const amp = 0.35 + 0.65 * mesh.userData.deploy;
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const flutter =
        Math.sin(t * 1.8 + x * 0.55 + y * 0.4) * 0.05 +
        Math.sin(t * 2.6 + y * 0.9) * 0.03;
      p.setZ(i, baseZ[i] + flutter * amp);
    }
    p.needsUpdate = true;
    if ((frame++ % 3) === 0) mesh.geometry.computeVertexNormals();
  };

  return mesh;
}

// ---------------------------------------------------------------------------
// Lateen sail — triangular sail on the mizzen (Spanish nao signature)
// ---------------------------------------------------------------------------
function buildLateenSail(length, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-length * 0.15, height * 0.5);
  shape.lineTo(length * 0.85, -height * 0.4);
  shape.lineTo(-length * 0.2, -height * 0.45);
  shape.lineTo(-length * 0.15, height * 0.5);

  const geo = new THREE.ShapeGeometry(shape, 8);
  // Subdivide for billow
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const billow = Math.max(0, 1 - Math.abs(y) / (height * 0.5)) *
                   Math.max(0, 1 - Math.abs(x - length * 0.3) / (length * 0.6)) *
                   0.6;
    pos.setZ(i, billow);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const sail = new THREE.Mesh(geo, MAT.sail);
  sail.castShadow = true;
  return sail;
}

// ---------------------------------------------------------------------------
// Rigging — shrouds and stays as line segments
// ---------------------------------------------------------------------------
function buildRigging(mastPositions) {
  const positions = [];
  const { foreZ, mainZ, mizzenZ, foreH, mainH, mizzenH, deckY } = mastPositions;

  // Shrouds — angled lines from masthead down to gunwale, port and starboard
  function addShrouds(mastZ, mastHeight, count, spread, baseZSpread) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const baseX = side * (1.6 + t * 1.4);
        const baseZ = mastZ + (t - 0.5) * baseZSpread;
        positions.push(0, deckY + mastHeight * 0.92, mastZ);
        positions.push(baseX, deckY + 0.25, baseZ);
      }
    }
  }
  addShrouds(foreZ, foreH, 5, 2.0, 2.6);
  addShrouds(mainZ, mainH, 6, 2.4, 3.4);
  addShrouds(mizzenZ, mizzenH, 4, 1.6, 2.0);

  // Forestays — single lines from each mast's top forward to the next mast/bow
  positions.push(0, deckY + foreH, foreZ);
  positions.push(0, deckY + 1.5, SHIP_LENGTH * 0.48); // foremast forestay to bowsprit base

  positions.push(0, deckY + mainH, mainZ);
  positions.push(0, deckY + foreH * 0.92, foreZ);     // main->fore stay

  positions.push(0, deckY + mizzenH, mizzenZ);
  positions.push(0, deckY + mainH * 0.92, mainZ);     // mizzen->main stay

  // Backstays
  positions.push(0, deckY + mainH, mainZ);
  positions.push(0, deckY + 2.0, -SHIP_LENGTH * 0.42);

  positions.push(0, deckY + mizzenH, mizzenZ);
  positions.push(0, deckY + 3.0, -SHIP_LENGTH * 0.46);

  // Ratlines — horizontal rungs across the shrouds (a few per mast for detail)
  function addRatlines(mastZ, mastHeight, count, spread, baseZSpread) {
    for (let side = -1; side <= 1; side += 2) {
      // Pick 2 outer shrouds to span between
      const innerT = 0;
      const outerT = 1;
      const innerBaseX = side * (1.6 + innerT * 1.4);
      const innerBaseZ = mastZ + (innerT - 0.5) * baseZSpread;
      const outerBaseX = side * (1.6 + outerT * 1.4);
      const outerBaseZ = mastZ + (outerT - 0.5) * baseZSpread;
      const topY = deckY + mastHeight * 0.92;
      const baseY = deckY + 0.25;

      for (let r = 0; r < count; r++) {
        const ratT = r / (count - 1);
        const yA = baseY + (topY - baseY) * ratT;
        // Interpolate between inner and outer shroud at this height
        // Inner shroud point at this y: lerp from base to top
        const ix = THREE.MathUtils.lerp(innerBaseX, 0, ratT);
        const iz = THREE.MathUtils.lerp(innerBaseZ, mastZ, ratT);
        const ox = THREE.MathUtils.lerp(outerBaseX, 0, ratT);
        const oz = THREE.MathUtils.lerp(outerBaseZ, mastZ, ratT);
        positions.push(ix, yA, iz);
        positions.push(ox, yA, oz);
      }
    }
  }
  addRatlines(foreZ, foreH, 8, 2.0, 2.6);
  addRatlines(mainZ, mainH, 10, 2.4, 3.4);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geo, MAT.rope);
}

// ---------------------------------------------------------------------------
// Bowsprit — angled forward spar with a spritsail underneath
// ---------------------------------------------------------------------------
function buildBowsprit() {
  const grp = new THREE.Group();
  const length = 8;
  const spar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, length, 10),
    MAT.mast
  );
  spar.rotation.x = Math.PI / 2.2;
  spar.position.set(0, DECK_Y + 1.6, SHIP_LENGTH / 2 + 1.6);
  spar.castShadow = true;
  grp.add(spar);

  // Spritsail yard underneath
  const yard = buildYard(4.5, 0.1);
  yard.position.set(0, DECK_Y + 0.5, SHIP_LENGTH / 2 + 3.2);
  grp.add(yard);

  // Spritsail
  const sail = buildSquareSail(4.0, 2.0);
  sail.position.set(0, DECK_Y - 0.5, SHIP_LENGTH / 2 + 3.2);
  sail.rotation.x = 0.15;
  grp.add(sail);

  return { group: grp, sail };
}

// ---------------------------------------------------------------------------
// Cross of Burgundy flag — red saltire (X) on white, the Spanish naval flag
// ---------------------------------------------------------------------------
function buildBurgundyFlag(width, height) {
  const grp = new THREE.Group();

  // White base
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height, 12, 6),
    MAT.flagWhite
  );
  grp.add(base);

  // Two red bars forming an X
  const barLen = Math.sqrt(width * width + height * height);
  const barThick = height * 0.18;

  const bar1 = new THREE.Mesh(
    new THREE.PlaneGeometry(barLen * 0.95, barThick),
    MAT.flagRed
  );
  bar1.rotation.z = Math.atan2(height, width);
  bar1.position.z = 0.01;
  grp.add(bar1);

  const bar2 = new THREE.Mesh(
    new THREE.PlaneGeometry(barLen * 0.95, barThick),
    MAT.flagRed
  );
  bar2.rotation.z = -Math.atan2(height, width);
  bar2.position.z = 0.02;
  grp.add(bar2);

  // Gentle wave deformation on the base
  const pos = base.geometry.attributes.position;
  const baseX = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) baseX[i] = pos.getX(i);

  grp.userData.update = (t) => {
    const pos = base.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = baseX[i];
      const sway = Math.sin(t * 2.5 + x * 1.5) * 0.12 * ((x + width / 2) / width);
      pos.setZ(i, sway);
    }
    pos.needsUpdate = true;
    base.geometry.computeVertexNormals();
  };

  return grp;
}

// ---------------------------------------------------------------------------
// Ship's company — a handful of fully-modelled individuals rather than a crowd:
// sailors in slops, conquistador soldiers in morion + cuirass with pikes, and
// officers in plumed hats and capes. Built human-sized and counter-scaled so
// they stand 1.7m tall on the up-scaled hull.
// ---------------------------------------------------------------------------
const CREW = {
  skin:  new THREE.MeshStandardMaterial({ color: 0xb07a52, roughness: 0.8 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xa6a6ae, roughness: 0.32, metalness: 0.88 }),
  steelD:new THREE.MeshStandardMaterial({ color: 0x70707a, roughness: 0.4,  metalness: 0.8 }),
  hose:  new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.9 }),
  boot:  new THREE.MeshStandardMaterial({ color: 0x251710, roughness: 0.6 }),
  hair:  new THREE.MeshStandardMaterial({ color: 0x2a1b10, roughness: 0.95 }),
  hat:   new THREE.MeshStandardMaterial({ color: 0x1c1812, roughness: 0.8 }),
  plume: new THREE.MeshStandardMaterial({ color: 0xb02828, roughness: 0.7 }),
  gold:  new THREE.MeshStandardMaterial({ color: 0xc89030, roughness: 0.35, metalness: 0.7 }),
};
const SLOPS = [0x7a4a2a, 0x556048, 0x8a3424, 0x4a4640, 0x9a7a48, 0x614a34];

function buildCrewman(type, hex, rot) {
  const g = new THREE.Group();
  const tunic = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88 });

  // legs on hip pivots so they can swing for a walk cycle
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.86, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 6), CREW.hose);
    leg.position.y = -0.38; leg.castShadow = true; hip.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.3), CREW.boot);
    boot.position.set(0, -0.8, 0.05); hip.add(boot);
    g.add(hip); legs.push(hip);
  }
  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 5, 10), tunic);
  torso.position.y = 1.15; torso.scale.z = 0.72; torso.castShadow = true; g.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), CREW.boot);
  belt.position.y = 0.92; belt.scale.z = 0.74; g.add(belt);
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.27, 1.4, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.5, 4, 6), tunic);
    arm.position.y = -0.28; arm.castShadow = true; sh.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), CREW.skin);
    hand.position.y = -0.56; sh.add(hand);
    g.add(sh); arms.push(sh);
  }
  // neck + head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), CREW.skin);
  head.position.y = 1.64; head.scale.set(0.92, 1.06, 1); head.castShadow = true; g.add(head);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), CREW.hair);
  beard.position.set(0, 1.6, 0.03); g.add(beard);

  if (type === 'soldier') {
    // steel cuirass over the torso
    const cuirass = new THREE.Mesh(new THREE.CapsuleGeometry(0.215, 0.34, 5, 10), CREW.steel);
    cuirass.position.y = 1.18; cuirass.scale.z = 0.78; g.add(cuirass);
    // morion helmet + comb
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), CREW.steel);
    helm.position.y = 1.68; g.add(helm);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), CREW.steel);
    brim.position.y = 1.66; brim.rotation.x = Math.PI / 2; brim.scale.set(1, 1.5, 1); g.add(brim);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.34), CREW.steelD);
    comb.position.set(0, 1.77, 0); g.add(comb);
    // pike held upright in the right hand
    arms[1].rotation.x = -0.25;
    const pike = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.9, 6), MAT.beam);
    pike.position.set(0.3, 1.45, 0.05); g.add(pike);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 6), CREW.steel);
    tip.position.set(0.3, 3.0, 0.05); g.add(tip);
  } else if (type === 'officer') {
    // wide-brimmed plumed hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), CREW.hat);
    brim.position.y = 1.78; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.18, 12), CREW.hat);
    crown.position.y = 1.86; g.add(crown);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), CREW.plume);
    plume.position.set(0.12, 1.98, -0.05); plume.rotation.z = -0.5; g.add(plume);
    // half-cape over one shoulder
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 12, 1, true, 0, Math.PI), tunic);
    cape.position.set(0, 1.2, -0.12); cape.rotation.x = 0.1; cape.material = CREW.hat; g.add(cape);
    // sword at the hip
    const scabbard = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.7, 6), CREW.steelD);
    scabbard.position.set(-0.22, 0.7, 0.05); scabbard.rotation.x = 0.4; g.add(scabbard);
    const hiltG = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), CREW.gold);
    hiltG.position.set(-0.26, 1.02, -0.05); g.add(hiltG);
    arms[0].rotation.z = 0.3; // hand resting on hip
  } else {
    // sailor — knit cap, bare or rolled sleeves
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: (hex ^ 0x202020) & 0xffffff, roughness: 0.85 }));
    cap.position.y = 1.72; g.add(cap);
  }

  g.rotation.y = rot;
  g.scale.setScalar(1 / SHIP_SCALE); // counter-scale: stays 1.7m on the big hull
  g.userData.legs = legs;
  g.userData.arms = arms;
  g.userData.armBase = [arms[0].rotation.x, arms[1].rotation.x];
  return g;
}

function buildCrew() {
  const grp = new THREE.Group();
  // walkable regions for the wandering crew: [xMin, xMax, zMin, zMax, deckY]
  const WAIST = [-2.7, 2.7, -5.0, 6.2, 2.25];
  const FORE = [-1.0, 1.0, 7.2, 10.4, 5.24];
  // the rank-and-file, by station: [region, type, role, line]
  const T = 'A topman', M = 'A midshipman', S = 'A man-at-arms', G = "A gunner's mate", C = "A carpenter's mate";
  const roster = [
    [WAIST, 'sailor', T, 'Topman, señor — give me a stiff breeze and I\'ll have every sail drawing taut.'],
    [WAIST, 'soldier', S, 'I\'m a soldier of Castile, not a deckhand. I\'ll earn my pay when we make landfall.'],
    [WAIST, 'sailor', M, 'No rest on this barky — holystone the planks, coil the lines, work the pump. What of it?'],
    [WAIST, 'soldier', S, 'Sharpen the steel and trust in God. The Indies won\'t conquer themselves.'],
    [WAIST, 'sailor', M, 'I\'ve the porter\'s duty today — hauling casks up from the hold till my arms give out.'],
    [WAIST, 'sailor', C, 'Mind the fresh caulking, friend. The carpenter will have my hide if it\'s marred.'],
    [WAIST, 'soldier', G, 'Powder\'s kept dry and the shot\'s counted twice, by the condestable\'s order.'],
    [WAIST, 'sailor', T, 'Up the ratlines a hundred times a day. My hands are leather and my head\'s in the clouds.'],
    [WAIST, 'sailor', M, 'She takes water like all her kind — back to the bilge pump for me.'],
    [WAIST, 'soldier', S, 'They say there\'s gold enough on the mainland to pave a cathedral. I mean to see it.'],
    [FORE, 'soldier', S, 'Lookout on the forecastle head. Nothing yet but sea and more sea.'],
    [FORE, 'sailor', T, 'Best view on the ship from up here — and the first to feel the weather change.'],
  ];

  const wanderers = [];
  const crewList = [];
  const pick = (r) => new THREE.Vector3(
    r[0] + Math.random() * (r[1] - r[0]),
    r[4],
    r[2] + Math.random() * (r[3] - r[2]),
  );

  let i = 0;
  for (const [region, type, role, line] of roster) {
    const fig = buildCrewman(type, SLOPS[i % SLOPS.length], Math.random() * Math.PI * 2);
    const start = pick(region);
    fig.position.copy(start);
    grp.add(fig);
    wanderers.push({
      fig, region, type,
      target: pick(region),
      pause: Math.random() * 4,
      phase: Math.random() * 6,
      speed: 0.5 + Math.random() * 0.5,
      amp: 0,
    });
    crewList.push({ object: fig, role, line });
    i++;
  }
  grp.userData.crewList = crewList;

  // simple wander AI: stroll to a point, pause, choose another; animate the
  // walk cycle while moving. dt is derived from the shared elapsed clock.
  let prevT = -1;
  grp.userData.update = (t) => {
    let dt = prevT < 0 ? 0 : t - prevT;
    prevT = t;
    if (dt <= 0 || dt > 0.1) dt = Math.min(Math.max(dt, 0), 0.05);

    for (const w of wanderers) {
      const p = w.fig.position;
      if (w.fig.userData.talking) {
        w.amp += (0 - w.amp) * Math.min(1, dt * 8);  // halt while spoken to
      } else if (w.pause > 0) {
        w.pause -= dt;
        w.amp += (0 - w.amp) * Math.min(1, dt * 6);
      } else {
        const dx = w.target.x - p.x, dz = w.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) {
          w.pause = 1.5 + Math.random() * 4;
          w.target = pick(w.region);
        } else {
          p.x += (dx / d) * w.speed * dt;
          p.z += (dz / d) * w.speed * dt;
          p.y = w.region[4];
          const want = Math.atan2(dx, dz);
          let df = want - w.fig.rotation.y;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          w.fig.rotation.y += df * Math.min(1, dt * 8);
          w.amp += (1 - w.amp) * Math.min(1, dt * 6);
          w.phase += dt * w.speed * 6;
        }
      }
      const sw = Math.sin(w.phase) * 0.6 * w.amp;
      w.fig.userData.legs[0].rotation.x = sw;
      w.fig.userData.legs[1].rotation.x = -sw;
      w.fig.userData.arms[0].rotation.x = -sw * 0.7;
      w.fig.userData.arms[1].rotation.x = sw * 0.7;
    }
  };

  return grp;
}

// ---------------------------------------------------------------------------
// The three patrons — wealthy noblemen whose families underwrote the campaign.
// Richly modelled, each with a distinct silhouette, and individually
// interactable (see ship.userData.npcs and the dialogue in player.js/main.js).
// ---------------------------------------------------------------------------
function buildConquistador(kind, coatHex, accentHex) {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.82 });
  const accent = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.7 });

  // legs + fine boots
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.66, 4, 7), CREW.hose);
    leg.position.set(s * 0.12, 0.5, 0); leg.castShadow = true; g.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.34), CREW.boot);
    boot.position.set(s * 0.12, 0.08, 0.06); g.add(boot);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 8), CREW.boot);
    cuff.position.set(s * 0.12, 0.78, 0); g.add(cuff);
  }
  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.5, 6, 12), coat);
  torso.position.y = 1.16; torso.scale.z = 0.74; torso.castShadow = true; g.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.1, 12), CREW.boot);
  belt.position.y = 0.92; belt.scale.z = 0.76; g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.03), CREW.gold);
  buckle.position.set(0, 0.92, 0.18); g.add(buckle);

  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.28, 1.42, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.52, 4, 7), coat);
    arm.position.y = -0.3; arm.castShadow = true; sh.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), CREW.skin);
    hand.position.y = -0.6; sh.add(hand);
    g.add(sh); arms.push(sh);
  }

  // head, beard, hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), CREW.skin);
  head.position.y = 1.66; head.scale.set(0.92, 1.07, 1); head.castShadow = true; g.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 6), CREW.skin);
  nose.position.set(0, 1.65, 0.14); nose.rotation.x = Math.PI / 2; g.add(nose);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), CREW.hair);
  beard.position.set(0, 1.61, 0.03); beard.scale.set(0.96, 1.15, 0.96); g.add(beard);

  if (kind === 'captain') {
    // gilt-edged cuirass, morion, red sash, drawn sword held point-down
    const cuirass = new THREE.Mesh(new THREE.CapsuleGeometry(0.225, 0.36, 5, 12), CREW.steel);
    cuirass.position.y = 1.18; cuirass.scale.z = 0.8; g.add(cuirass);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.04), CREW.gold);
    ridge.position.set(0, 1.18, 0.2); g.add(ridge);
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.46), accent);
    sash.position.y = 1.12; sash.rotation.z = 0.5; g.add(sash);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.6), CREW.steel);
    helm.position.y = 1.7; g.add(helm);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 18), CREW.steel);
    brim.position.y = 1.68; brim.rotation.x = Math.PI / 2; brim.scale.set(1, 1.6, 1); g.add(brim);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.36), CREW.steel);
    comb.position.y = 1.8; g.add(comb);
    // both hands forward on the pommel of a grounded sword
    arms[0].rotation.x = -1.0; arms[1].rotation.x = -1.0;
    arms[0].position.z += 0.05; arms[1].position.z += 0.05;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.02), CREW.steel);
    blade.position.set(0, 0.75, 0.42); g.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), CREW.gold);
    guard.position.set(0, 1.3, 0.42); g.add(guard);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), CREW.gold);
    pommel.position.set(0, 1.42, 0.42); g.add(pommel);
  } else if (kind === 'crusader') {
    // plumed hat, half-cape, prominent cross pendant, sash + sword at hip
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.95, 14, 1, true, 0, Math.PI), accent);
    cape.position.set(0, 1.18, -0.13); cape.rotation.x = 0.12; g.add(cape);
    const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), CREW.steel);
    ruff.material = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.8 });
    ruff.position.y = 1.5; ruff.rotation.x = Math.PI / 2; g.add(ruff);
    // cross pendant on a chain
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), CREW.gold);
    chain.position.y = 1.42; chain.rotation.x = Math.PI / 2.3; g.add(chain);
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.02), CREW.gold);
    cv.position.set(0, 1.28, 0.19); g.add(cv);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.02), CREW.gold);
    ch.position.set(0, 1.32, 0.19); g.add(ch);
    // hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), CREW.hat);
    brim.position.y = 1.79; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.2, 12), CREW.hat);
    crown.position.y = 1.88; g.add(crown);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 6), CREW.plume);
    plume.position.set(-0.13, 2.0, -0.04); plume.rotation.z = 0.5; g.add(plume);
    arms[1].rotation.x = -0.2;
  } else {
    // lord / financier — doublet, ruff, chain of office, flat cap, rolled chart
    const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xeee8d6, roughness: 0.85 }));
    ruff.position.y = 1.52; ruff.rotation.x = Math.PI / 2; g.add(ruff);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 18), CREW.gold);
    chain.position.y = 1.38; chain.rotation.x = Math.PI / 2.2; g.add(chain);
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), CREW.gold);
    medal.position.set(0, 1.26, 0.19); medal.rotation.x = Math.PI / 2; g.add(medal);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16), CREW.hat);
    cap.position.y = 1.78; g.add(cap);
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.28, 5), accent);
    feather.position.set(0.16, 1.86, -0.02); feather.rotation.z = -0.7; g.add(feather);
    // rolled chart tucked under the left arm
    arms[0].rotation.x = -0.5;
    const chart = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 0.9 }));
    chart.position.set(-0.34, 1.2, 0.12); chart.rotation.z = 0.5; chart.rotation.x = 0.2; g.add(chart);
  }

  g.scale.setScalar(1 / SHIP_SCALE);
  g.userData.arms = arms;
  g.userData.armBase = [arms[0].rotation.x, arms[1].rotation.x];
  return g;
}

function buildChartTable(x, y, z) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.0), MAT.hullDark);
  top.position.set(x, y + 0.95, z); top.castShadow = true; g.add(top);
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 6), MAT.beam);
    leg.position.set(x + sx, y + 0.47, z + sz); g.add(leg);
  }
  // unrolled chart of the Ocean Sea
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 0.95, side: THREE.DoubleSide }));
  chart.rotation.x = -Math.PI / 2; chart.position.set(x, y + 0.995, z); g.add(chart);
  // a couple of weights and a pair of dividers
  for (const c of [[-0.45, -0.28], [0.5, 0.3]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), CREW.gold);
    w.position.set(x + c[0], y + 1.01, z + c[1]); g.add(w);
  }
  const div = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.32, 4), CREW.steel);
  div.position.set(x + 0.1, y + 1.02, z - 0.1); div.rotation.x = Math.PI; g.add(div);
  return g;
}

// Names, families and dialogue for the three patrons. `pos` is ship-local
// (deck coordinates); `rot` is their resting facing.
const CONQUISTADORS = [
  {
    name: 'Don Gonzalo de Carvajal', title: 'Capitán-General', kind: 'captain',
    coat: 0x5a1a14, accent: 0xb02828, pos: [0.7, 2.25, 1.6], rot: Math.PI * 0.92,
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
    coat: 0x202830, accent: 0x6a1620, pos: [0, 5.24, 9.4], rot: 0.1,
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
    coat: 0x241f2e, accent: 0xc0a040, pos: [-1.5, 5.48, -7.0], rot: Math.PI,
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

// The ship's officers, who serve under the maestre. Built from the crewman
// model (lighter than the patrons) but each with proper, role-rich dialogue.
const OFFICERS = [
  {
    name: 'Esteban de Ribera', title: 'Maestre', build: 'officer', hex: 0x2a2a30,
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
    name: 'Martín Pérez', title: 'Contramaestre', build: 'officer', hex: 0x4a3a26,
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
    name: 'Andrés de Olid', title: 'Condestable', build: 'soldier', hex: 0x55524a,
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
    name: 'Bartolomé Núñez', title: 'Carpintero', build: 'sailor', hex: 0x6a4a28,
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
    name: 'Maestre Cristóbal', title: 'Cirujano', build: 'officer', hex: 0x3a2030,
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
    name: 'Lope de Triana', title: 'Timonel', build: 'sailor', hex: 0x3a4250,
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

// ---------------------------------------------------------------------------
// Hull caps — close off the bow and stern so you can't see straight through
// ---------------------------------------------------------------------------
function buildHullCaps() {
  const grp = new THREE.Group();

  function capAt(z01, zOffset, material) {
    // Build a closed U-shaped cross-section at this z position
    const w = widthAt(z01);
    const k = keelAt(z01);
    const d = deckSheerAt(z01);
    const segs = 16;
    const positions = [];
    const indices = [];

    // Outline points around the U (port deck -> keel -> starboard deck)
    const outline = [];
    for (let j = 0; j <= segs; j++) {
      const v = j / segs;
      const portSide = v < 0.5;
      const t = portSide ? v * 2 : (1 - v) * 2;
      const x = (portSide ? -1 : 1) * w * Math.cos(t * Math.PI / 2);
      const y = d - (d - k) * Math.sin(t * Math.PI / 2);
      outline.push([x, y]);
    }

    // Center point (for fan triangulation)
    const cx = 0;
    const cy = (k + d) / 2;
    positions.push(cx, cy, zOffset);
    for (const [x, y] of outline) positions.push(x, y, zOffset);

    for (let j = 0; j < segs; j++) {
      indices.push(0, j + 1, j + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Stern cap (back of hull at z = -SHIP_LENGTH/2)
  grp.add(capAt(0, -SHIP_LENGTH / 2, MAT.hullDark));
  // Bow cap (front)
  grp.add(capAt(1, SHIP_LENGTH / 2, MAT.hullDark));

  return grp;
}

// ---------------------------------------------------------------------------
// Bulwarks — short walls above the main deck along port/starboard so you
// can't see straight over the deck edge. Strong silhouette element.
// ---------------------------------------------------------------------------
function buildBulwarks() {
  const grp = new THREE.Group();
  const bulwarkHeight = 0.85;
  const segs = 32;

  for (let side = -1; side <= 1; side += 2) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segs; i++) {
      const z01 = 0.05 + (i / segs) * 0.9;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);
      const baseY = deckSheerAt(z01);
      const topY = baseY + bulwarkHeight;
      // Inner and outer at this rib — bulwark is ~6cm thick
      positions.push(side * w, baseY, z);
      positions.push(side * w, topY, z);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1);
      indices.push(a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, MAT.hullMid);
    m.castShadow = true;
    m.userData.solid = true;
    grp.add(m);
  }

  // Cap rail along the top of each bulwark (lighter wood band)
  for (let side = -1; side <= 1; side += 2) {
    const positions = [];
    const indices = [];
    const t = 0.12; // rail thickness inward
    for (let i = 0; i <= segs; i++) {
      const z01 = 0.05 + (i / segs) * 0.9;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);
      const topY = deckSheerAt(z01) + bulwarkHeight;
      positions.push(side * w, topY, z);
      positions.push(side * (w - t), topY, z);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2);
      indices.push(a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    grp.add(new THREE.Mesh(geo, MAT.hullDark));
  }

  return grp;
}

// ---------------------------------------------------------------------------
// Internal hull ribs — curved beams visible from inside the open waist
// ---------------------------------------------------------------------------
function buildHullRibs() {
  const grp = new THREE.Group();
  const ribCount = 10;
  const segs = 16;

  for (let i = 0; i < ribCount; i++) {
    const z01 = 0.20 + (i / (ribCount - 1)) * 0.60;
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;

    const points = [];
    for (let j = 0; j <= segs; j++) {
      const v = j / segs;
      const w = widthAt(z01) * 0.97;
      const k = keelAt(z01);
      const d = deckSheerAt(z01);
      const portSide = v < 0.5;
      const t = portSide ? v * 2 : (1 - v) * 2;
      const x = (portSide ? -1 : 1) * w * Math.cos(t * Math.PI / 2);
      const y = d - (d - k) * Math.sin(t * Math.PI / 2);
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 18, 0.07, 6, false);
    const rib = new THREE.Mesh(tubeGeo, MAT.beam);
    rib.castShadow = true;
    grp.add(rib);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Anchor — iron stock anchor hanging from the bow, with cable
// ---------------------------------------------------------------------------
function buildAnchor() {
  const grp = new THREE.Group();

  // Shank — vertical iron bar (the spine of the anchor)
  const shank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 2.4, 10),
    MAT.iron
  );
  shank.position.y = 0;
  shank.castShadow = true;
  grp.add(shank);

  // Arms — two curved arms forming inverted V at the bottom
  for (let side = -1; side <= 1; side += 2) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.11, 1.35, 8),
      MAT.iron
    );
    arm.rotation.z = side * Math.PI / 3.2;
    // Position so top of arm meets bottom of shank
    arm.position.set(side * 0.50, -1.55, 0);
    arm.castShadow = true;
    grp.add(arm);

    // Fluke — triangular flat at the end of each arm
    const fluke = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.45, 4),
      MAT.iron
    );
    fluke.rotation.z = side * Math.PI / 3.2 + Math.PI / 2;
    fluke.position.set(side * 1.05, -2.04, 0);
    grp.add(fluke);
  }

  // Crown — short fat band where shank meets arms
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.18, 10),
    MAT.iron
  );
  crown.position.y = -1.25;
  grp.add(crown);

  // Wooden stock — horizontal beam near the top, perpendicular to arms
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.16, 0.16),
    MAT.barrel
  );
  stock.position.y = 0.90;
  stock.castShadow = true;
  grp.add(stock);

  // Iron bands wrapping the stock
  for (const x of [-0.45, 0.45]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.20, 0.20),
      MAT.iron
    );
    band.position.set(x, 0.90, 0);
    grp.add(band);
  }

  // Ring at the very top where the cable attaches
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.04, 6, 14),
    MAT.iron
  );
  ring.position.y = 1.30;
  ring.rotation.x = Math.PI / 2;
  grp.add(ring);

  return grp;
}

function buildAnchorAndCable() {
  const grp = new THREE.Group();

  // Hang the anchor off the starboard bow, just behind the bowsprit
  const anchorX = 2.1;
  const anchorZ = SHIP_LENGTH / 2 - 1.4;
  const anchorTopY = DECK_Y + 0.4;       // just below the gunwale
  const anchor = buildAnchor();
  anchor.position.set(anchorX, anchorTopY - 1.3, anchorZ);  // shank centered
  anchor.rotation.z = -0.08;
  anchor.rotation.y = -0.25;
  grp.add(anchor);

  // Cathead — the heavy timber projecting from the bow that the anchor hangs from
  const cathead = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 1.6),
    MAT.beam
  );
  cathead.position.set(anchorX, DECK_Y + 0.95, anchorZ + 0.3);
  cathead.rotation.y = -0.15;
  cathead.castShadow = true;
  grp.add(cathead);

  // Cable — thick rope from the anchor ring up to the cathead end
  const cableStart = new THREE.Vector3(anchorX + 0.05, anchorTopY + 0.1, anchorZ);
  const cableEnd = new THREE.Vector3(anchorX, DECK_Y + 1.05, anchorZ - 0.4);
  const cableMid = new THREE.Vector3(
    (cableStart.x + cableEnd.x) / 2 + 0.05,
    (cableStart.y + cableEnd.y) / 2 - 0.05,
    (cableStart.z + cableEnd.z) / 2
  );
  const cableCurve = new THREE.CatmullRomCurve3([cableStart, cableMid, cableEnd]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 12, 0.05, 6, false),
    MAT.beam
  );
  grp.add(cable);

  grp.userData.anchor = anchor;
  grp.userData.anchorBaseY = anchorTopY - 1.3;
  return grp;
}

// ---------------------------------------------------------------------------
// Railings — turned balusters + a solid top rail (blocks walking off edges)
// ---------------------------------------------------------------------------
function densify(points, spacing) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function buildRailing(points, baseY, height = 0.95) {
  const grp = new THREE.Group();

  // Turned balusters
  const balGeo = new THREE.CylinderGeometry(0.035, 0.05, height, 6);
  for (const [x, z] of densify(points, 0.5)) {
    const b = new THREE.Mesh(balGeo, MAT.beam);
    b.position.set(x, baseY + height / 2, z);
    b.castShadow = true;
    grp.add(b);
    // little turned knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), MAT.beam);
    knob.position.set(x, baseY + height, z);
    grp.add(knob);
  }

  // Solid top rail segments (act as collision so you can't step off the edge)
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, len + 0.05), MAT.hullDark);
    rail.position.set((x0 + x1) / 2, baseY + height, (z0 + z1) / 2);
    rail.rotation.y = Math.atan2(dx, dz);
    rail.castShadow = true;
    rail.userData.solid = true;
    grp.add(rail);
    // mid rail (decorative, non-colliding)
    const mid = rail.clone();
    mid.material = MAT.beam;
    mid.position.y = baseY + height * 0.5;
    mid.userData = {};
    grp.add(mid);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Staircase — steep companion ladder of solid treads the character can climb
// ---------------------------------------------------------------------------
function buildStaircase(cx, z0, z1, baseY, topY, width) {
  const grp = new THREE.Group();
  const rise = topY - baseY;
  const steps = Math.max(4, Math.round(rise / 0.34));
  const dz = (z1 - z0) / steps;
  const dy = rise / steps;
  for (let i = 0; i < steps; i++) {
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.1, Math.abs(dz) + 0.22),
      MAT.deckDark
    );
    tread.position.set(cx, baseY + dy * (i + 1) - 0.05, z0 + dz * (i + 0.5));
    tread.castShadow = true;
    tread.receiveShadow = true;
    tread.userData.walkable = true;
    grp.add(tread);
  }
  // Stringers down each side
  for (const s of [-1, 1]) {
    const len = Math.hypot(z1 - z0, rise);
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, len), MAT.beam);
    stringer.position.set(cx + s * (width / 2 + 0.02), (baseY + topY) / 2, (z0 + z1) / 2);
    stringer.rotation.x = -Math.atan2(rise, z1 - z0) + Math.PI / 2;
    grp.add(stringer);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Channels + deadeyes — the planks projecting from the hull that anchor the
// shrouds, each with a row of deadeyes and lanyards. Physically tied to hull.
// ---------------------------------------------------------------------------
function buildChannels(mastZ, span) {
  const grp = new THREE.Group();
  const z01 = (mastZ + SHIP_LENGTH / 2) / SHIP_LENGTH;
  const w = widthAt(z01);
  const y = deckSheerAt(z01) - 0.05;
  for (let side = -1; side <= 1; side += 2) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.1, span + 0.5),
      MAT.hullDark
    );
    plank.position.set(side * (w + 0.22), y, mastZ);
    plank.castShadow = true;
    grp.add(plank);

    const n = Math.max(3, Math.round(span / 0.45));
    for (let i = 0; i < n; i++) {
      const z = mastZ - span / 2 + (i / (n - 1)) * span;
      // deadeye — round disc clamped in an iron strop
      const deadeye = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10),
        MAT.barrel
      );
      deadeye.position.set(side * (w + 0.34), y + 0.18, z);
      deadeye.rotation.x = Math.PI / 2;
      deadeye.rotation.z = Math.PI / 2;
      grp.add(deadeye);
      const strop = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.02, 5, 12),
        MAT.iron
      );
      strop.position.copy(deadeye.position);
      strop.rotation.y = Math.PI / 2;
      grp.add(strop);
    }
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Fife rail — rail around a mast base studded with belaying pins for halyards
// ---------------------------------------------------------------------------
function buildFifeRail(mastZ, radius) {
  const grp = new THREE.Group();
  const y = DECK_Y + 0.3;
  const railH = 0.9;
  const posts = 6;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const px = Math.cos(a) * radius;
    const pz = mastZ + Math.sin(a) * radius;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, railH, 6), MAT.beam);
    post.position.set(px, y + railH / 2, pz);
    grp.add(post);
    // belaying pin angled out of the rail
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 6), MAT.beam);
    pin.position.set(px * 1.04, y + railH + 0.05, pz);
    grp.add(pin);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 6, 20), MAT.hullDark);
  ring.position.set(0, y + railH, mastZ);
  ring.rotation.x = Math.PI / 2;
  grp.add(ring);
  return grp;
}

// ---------------------------------------------------------------------------
// Ship's bell on a carved belfry gallows, mounted at the break of the deck
// ---------------------------------------------------------------------------
function buildBell(x, y, z) {
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 8), MAT.beam);
    post.position.set(x + s * 0.4, y + 0.5, z);
    grp.add(post);
  }
  const crown = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.12), MAT.beam);
  crown.position.set(x, y + 1.02, z);
  grp.add(crown);
  // bell hangs from a pivot at the crossbeam so it can swing when rung
  const swing = new THREE.Group();
  swing.position.set(x, y + 1.0, z);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.32, 12), MAT.trimGold);
  bell.position.set(0, -0.18, 0);
  swing.add(bell);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 14), MAT.trimGold);
  lip.position.set(0, -0.34, 0);
  lip.rotation.x = Math.PI / 2;
  swing.add(lip);
  grp.add(swing);
  grp.userData.swing = swing;
  return grp;
}

// ---------------------------------------------------------------------------
// Figurehead + beakhead — carved gilt figure projecting from the stem
// ---------------------------------------------------------------------------
function buildFigurehead() {
  const grp = new THREE.Group();
  const z = SHIP_LENGTH / 2;

  // Beakhead knee — the structural timber the figure rides on
  const knee = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 2.2), MAT.hullDark);
  knee.position.set(0, DECK_Y - 0.3, z + 1.0);
  knee.rotation.x = 0.35;
  knee.castShadow = true;
  grp.add(knee);

  // Carved lion-ish body (gilt) leaning forward off the stem
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 8), MAT.trimGold);
  body.position.set(0, DECK_Y + 0.45, z + 1.5);
  body.rotation.x = Math.PI / 2 - 0.5;
  body.castShadow = true;
  grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), MAT.trimGold);
  head.position.set(0, DECK_Y + 0.95, z + 2.05);
  head.castShadow = true;
  grp.add(head);
  // little carved scrolls flanking the stem
  for (const s of [-1, 1]) {
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 12, Math.PI * 1.4), MAT.trimGold);
    scroll.position.set(s * 0.45, DECK_Y + 0.1, z + 0.9);
    scroll.rotation.y = Math.PI / 2;
    scroll.rotation.z = s * 0.3;
    grp.add(scroll);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Quarter galleries — the ornate windowed bays on the stern quarters, a
// hallmark of the period. Bolted to the sterncastle corners.
// ---------------------------------------------------------------------------
function buildQuarterGalleries() {
  const grp = new THREE.Group();
  const z = -SHIP_LENGTH * 0.38;
  const lowerL = 5.6;
  const width = widthAt(0.12) * 1.6;
  const yMid = DECK_Y + 0.3 + 2.6 / 2 + 0.4;

  for (const side of [-1, 1]) {
    const bay = new THREE.Group();
    const bx = side * (width / 2 + 0.05);
    const bz = z - lowerL / 2 + 0.5;

    // rounded bay body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 1.8, 10, 1, false, -Math.PI / 2, Math.PI),
      MAT.hullMid
    );
    body.position.set(bx, yMid, bz);
    body.rotation.y = side > 0 ? 0 : Math.PI;
    body.castShadow = true;
    bay.add(body);

    // little leaded windows around the bay
    for (let i = -1; i <= 1; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.28), MAT.windowGlow);
      win.position.set(bx + side * 0.5, yMid + 0.1, bz + i * 0.42);
      bay.add(win);
    }

    // gilt cornice + domed cap
    const cornice = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 6, 14, Math.PI), MAT.trimGold);
    cornice.position.set(bx, yMid + 0.95, bz);
    cornice.rotation.x = Math.PI / 2;
    cornice.rotation.z = side > 0 ? 0 : Math.PI;
    bay.add(cornice);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.55, 10, 1, false, -Math.PI / 2, Math.PI), MAT.trimGold);
    cap.position.set(bx, yMid + 1.2, bz);
    cap.rotation.y = side > 0 ? 0 : Math.PI;
    bay.add(cap);

    grp.add(bay);
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Lanterns & fire baskets — detailed iron-and-glass lights that flicker.
// Every flame/light is registered so the ship's update() can animate it.
// ---------------------------------------------------------------------------
function buildLantern(scale = 1) {
  const g = new THREE.Group();
  // domed iron top + finial ring
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17 * scale, 0.16 * scale, 8), MAT.iron);
  cap.position.y = 0.32 * scale; g.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05 * scale, 0.012 * scale, 5, 10), MAT.iron);
  ring.position.y = 0.43 * scale; ring.rotation.x = Math.PI / 2; g.add(ring);
  // four corner bars of the cage
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * scale, 0.012 * scale, 0.42 * scale, 4), MAT.iron);
    bar.position.set(Math.cos(a) * 0.11 * scale, 0.07 * scale, Math.sin(a) * 0.11 * scale);
    g.add(bar);
  }
  // warm glass body
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.4 * scale, 8), MAT.glassGlow);
  glass.position.y = 0.07 * scale; g.add(glass);
  // candle flame inside
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045 * scale, 0.15 * scale, 6), MAT.flameHot);
  flame.position.y = 0.04 * scale; g.add(flame);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.15 * scale, 0.07 * scale, 8), MAT.iron);
  base.position.y = -0.15 * scale; g.add(base);
  const light = new THREE.PointLight(0xff9436, 2.0, 13, 2);
  light.position.y = 0.07 * scale; g.add(light);
  g.userData.flame = flame; g.userData.glass = glass; g.userData.light = light;
  return g;
}

function buildLanternPost(x, z, postH, scale = 1) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, postH, 8), MAT.beam);
  post.position.set(x, DECK_Y + 0.15 + postH / 2, z); post.castShadow = true; g.add(post);
  // little wrought-iron arm
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), MAT.iron);
  arm.position.set(x + Math.sign(x || 1) * -0.12, DECK_Y + 0.15 + postH, z); arm.rotation.z = Math.PI / 2; g.add(arm);
  const lant = buildLantern(scale);
  lant.position.set(x + Math.sign(x || 1) * -0.24, DECK_Y + 0.15 + postH - 0.05, z);
  g.add(lant);
  g.userData.lantern = lant;
  return g;
}

function buildBrazier(x, z) {
  const g = new THREE.Group();
  // three iron legs
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), MAT.iron);
    leg.position.set(x + Math.cos(a) * 0.18, DECK_Y + 0.15 + 0.32, z + Math.sin(a) * 0.18);
    leg.rotation.x = Math.sin(a) * 0.32; leg.rotation.z = -Math.cos(a) * 0.32;
    g.add(leg);
  }
  // bowl
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.3, 12, 1, true), MAT.iron);
  bowl.position.set(x, DECK_Y + 0.15 + 0.7, z); bowl.castShadow = true; g.add(bowl);
  // glowing coals
  const coals = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.ember);
  coals.position.set(x, DECK_Y + 0.15 + 0.68, z); coals.scale.y = 0.45; g.add(coals);
  // licking flames
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 6), MAT.flame);
    fl.position.set(x + Math.cos(a) * 0.12, DECK_Y + 0.15 + 0.92, z + Math.sin(a) * 0.12);
    g.add(fl); flames.push(fl);
  }
  const light = new THREE.PointLight(0xff6e1c, 3.4, 18, 2);
  light.position.set(x, DECK_Y + 0.15 + 1.1, z); g.add(light);
  g.userData.flames = flames; g.userData.light = light; g.userData.coals = coals;
  return g;
}

function buildShipLighting() {
  const grp = new THREE.Group();
  const units = [];

  // deck lanterns on posts along the bulwarks (port & starboard, fore & aft)
  for (const [x, z, h] of [
    [-2.7, 5.5, 1.5], [2.7, 5.5, 1.5],
    [-3.0, -2.0, 1.4], [3.0, -2.0, 1.4],
    [-2.4, -6.0, 1.3], [2.4, -6.0, 1.3],
  ]) {
    const lp = buildLanternPost(x, z, h);
    grp.add(lp); units.push(lp.userData.lantern);
  }

  // forecastle break lantern, hung high
  const fc = buildLanternPost(0, 6.7, 2.0, 1.1);
  grp.add(fc); units.push(fc.userData.lantern);

  // a pair of fire baskets amidships — the "ship's fires"
  const braziers = [buildBrazier(-1.6, 3.6), buildBrazier(1.7, -3.4)];
  for (const b of braziers) grp.add(b);

  // flicker everything
  grp.userData.update = (t) => {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const f = 0.78 + Math.sin(t * 11 + i * 1.7) * 0.13 + Math.sin(t * 23 + i) * 0.07;
      if (u.userData.light) u.userData.light.intensity = 2.0 * f;
      if (u.userData.flame) {
        u.userData.flame.material.emissiveIntensity = 4.0 * f;
        u.userData.flame.scale.y = 0.85 + 0.3 * f;
      }
    }
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i];
      const f = 0.8 + Math.sin(t * 9 + i * 2.1) * 0.15 + Math.sin(t * 19 + i) * 0.08;
      b.userData.light.intensity = 3.4 * f;
      b.userData.coals.material.emissiveIntensity = 2.4 * f;
      for (let k = 0; k < b.userData.flames.length; k++) {
        const fl = b.userData.flames[k];
        fl.scale.y = 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * 13 + k * 1.3 + i));
        fl.material.emissiveIntensity = 4.0 * f;
      }
    }
  };

  return grp;
}

// ---------------------------------------------------------------------------
// Assemble the full ship
// ---------------------------------------------------------------------------
export function createShip(scene) {
  const ship = new THREE.Group();
  ship.name = 'GalleonNuestraSenoraDeLaVictoria';

  ship.add(buildHull());
  ship.add(buildHullCaps());    // seal bow + stern so the hull doesn't look hollow
  ship.add(buildWales());
  ship.add(buildHold());        // built first so it renders behind the upper decks
  ship.add(buildGunDeck());
  ship.add(buildHullRibs());    // curved interior beams visible through the waist
  ship.add(buildMainDeck());
  ship.add(buildBulwarks());    // tall walls above the deck — strong silhouette
  ship.add(buildForecastle());
  const stern = buildSterncastle();
  ship.add(stern.group);

  // Mast positions (z values)
  const foreZ = SHIP_LENGTH * 0.26;
  const mainZ = -SHIP_LENGTH * 0.02;
  const mizzenZ = -SHIP_LENGTH * 0.28;

  const foreH = 17;
  const mainH = 21;
  const mizzenH = 13;

  // Hoistable square sails — each hangs from a pivot at its yard so it can be
  // furled (scaled up to the yard, bundle shown) or set (dropped, drawing full).
  const sailPivots = [];
  function addSquareSail(width, height, yardY, z, cross = false) {
    const pivot = new THREE.Group();
    pivot.position.set(0, yardY, z);
    const sail = buildSquareSail(width, height, cross);
    sail.position.set(0, -height / 2 - 0.1, 0.35);
    pivot.add(sail);
    ship.add(pivot);
    // furled bundle that hugs the yard when the sail is taken in
    const bundle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, width * 0.92, 8), sailMatPlain
    );
    bundle.rotation.z = Math.PI / 2;
    bundle.position.set(0, yardY - 0.12, z + 0.12);
    bundle.visible = false;
    bundle.castShadow = true;
    ship.add(bundle);
    pivot.userData.sail = sail;
    pivot.userData.bundle = bundle;
    sailPivots.push(pivot);
    return pivot;
  }

  // Foremast
  const fore = buildMast(foreH, 0.32, 0.18, true);
  fore.position.set(0, DECK_Y + 0.3, foreZ);
  ship.add(fore);

  // Foresail
  const foreYard = buildYard(8, 0.13);
  foreYard.position.set(0, DECK_Y + foreH * 0.55, foreZ);
  ship.add(foreYard);
  addSquareSail(8, 5.5, DECK_Y + foreH * 0.55, foreZ + 0.05);

  // Mainmast (tallest, with crow's nest)
  const main = buildMast(mainH, 0.40, 0.22, true);
  main.position.set(0, DECK_Y + 0.3, mainZ);
  ship.add(main);

  // Main course (lower square sail) — carries the red Cross of Burgundy
  const mainYard = buildYard(10, 0.15);
  mainYard.position.set(0, DECK_Y + mainH * 0.5, mainZ);
  ship.add(mainYard);
  addSquareSail(10, 7.5, DECK_Y + mainH * 0.5, mainZ + 0.1, true);

  // Main topsail (smaller, above the course)
  const topYard = buildYard(7, 0.11);
  topYard.position.set(0, DECK_Y + mainH * 0.85, mainZ);
  ship.add(topYard);
  addSquareSail(7, 4, DECK_Y + mainH * 0.85, mainZ + 0.05);

  // Mizzenmast with lateen
  const mizzen = buildMast(mizzenH, 0.26, 0.14, false);
  mizzen.position.set(0, DECK_Y + 0.3, mizzenZ);
  ship.add(mizzen);

  // Lateen yard — angled diagonally
  const lateenYard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 11, 8),
    MAT.spar
  );
  lateenYard.position.set(0, DECK_Y + mizzenH * 0.6, mizzenZ - 0.5);
  lateenYard.rotation.z = Math.PI / 2 - 0.55;
  ship.add(lateenYard);

  const lateenSail = buildLateenSail(8, 7);
  lateenSail.position.set(2.5, DECK_Y + mizzenH * 0.4, mizzenZ - 0.4);
  lateenSail.rotation.y = Math.PI / 2;
  lateenSail.rotation.z = -0.3;
  ship.add(lateenSail);

  // Bowsprit
  const bowsprit = buildBowsprit();
  ship.add(bowsprit.group);

  // Cross of Burgundy flag at the top of the mainmast
  const flag = buildBurgundyFlag(3, 1.8);
  flag.position.set(1.6, DECK_Y + mainH + 0.5, mainZ);
  flag.rotation.y = Math.PI / 2;
  ship.add(flag);

  // Smaller flag on mizzen top
  const flagMizzen = buildBurgundyFlag(1.8, 1.0);
  flagMizzen.position.set(1.0, DECK_Y + mizzenH + 0.3, mizzenZ);
  flagMizzen.rotation.y = Math.PI / 2;
  ship.add(flagMizzen);

  // Rigging
  ship.add(buildRigging({
    foreZ, mainZ, mizzenZ, foreH, mainH, mizzenH, deckY: DECK_Y + 0.3
  }));

  // Cannons (replace the flat gun-port stickers)
  ship.add(buildCannons());

  // Deck furniture — capstan, wheel, barrels, rope coils
  const furniture = buildDeckFurniture();
  ship.add(furniture);
  ship.userData.wheel = furniture.userData.wheel;
  ship.userData.helmStand = new THREE.Vector3(0, DECK_Y + 0.3 + 2.6 + 0.18, -8.05); // where the helmsman stands
  ship.userData.capstan = furniture.userData.capstan;
  ship.userData.capstanStation = new THREE.Vector3(0, 2.25, 5.9);

  // Starboard gun stations / muzzles for the "fire a broadside" interaction
  ship.userData.gunStation = new THREE.Vector3(2.3, 2.25, 0.5);
  const gunports = [];
  for (let i = 0; i < 5; i++) {
    const z01 = 0.26 + (i / 4) * 0.44;
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    gunports.push(new THREE.Vector3(widthAt(z01) + 0.15, 1.35, z));
  }
  ship.userData.gunports = gunports;

  // Anchor + cable on the starboard bow (can be weighed / let go)
  const anchorGrp = buildAnchorAndCable();
  ship.add(anchorGrp);
  ship.userData.anchor = {
    object: anchorGrp.userData.anchor,
    upY: anchorGrp.userData.anchorBaseY,        // stowed at the cathead
    downY: anchorGrp.userData.anchorBaseY - 4.5, // let go, hanging into the sea
    up: true,
  };

  // --- Intricate fittings, all physically attached to the ship ---

  // Channels + deadeyes carrying the shrouds, projecting from the hull
  ship.add(buildChannels(foreZ, 2.6));
  ship.add(buildChannels(mainZ, 3.4));
  ship.add(buildChannels(mizzenZ, 2.0));

  // Fife rails with belaying pins around the working masts
  ship.add(buildFifeRail(foreZ, 0.95));
  ship.add(buildFifeRail(mainZ, 1.15));

  // Carved gilt figurehead + beakhead off the stem
  ship.add(buildFigurehead());

  // Ornate windowed quarter galleries on the stern corners
  ship.add(buildQuarterGalleries());

  // Ship's bell on its belfry at the break of the forecastle (ringable)
  const bellGrp = buildBell(0, DECK_Y + 0.3, WAIST_FWD + 0.4);
  ship.add(bellGrp);
  ship.userData.bell = { object: bellGrp.userData.swing, local: new THREE.Vector3(0, DECK_Y + 1.0, WAIST_FWD + 0.4) };

  // Lanterns + fire baskets lighting the decks (flicker animated)
  ship.add(buildShipLighting());

  // --- Stairs & railings so a character can move between the decks ---

  // Companion ladders: main deck -> forecastle top, and -> quarterdeck.
  // (Roof top surfaces, so add the 0.09 half-thickness to reach the walk plane.)
  const foreTopY = DECK_Y + 0.3 + 2.4 + 0.05 + 0.09;
  const lowerRoofY = (DECK_Y + 0.3 + 2.6 / 2) + 2.6 / 2 + 0.09 + 0.09;

  // forecastle ladder offset to port so it clears the foremast & fife rail
  ship.add(buildStaircase(-0.9, WAIST_FWD + 0.05, 6.55, DECK_Y + 0.15, foreTopY, 1.0));
  // quarterdeck ladder on centreline, landing at the front-rail gap
  ship.add(buildStaircase(0, WAIST_AFT - 0.05, -6.85, DECK_Y + 0.15, lowerRoofY, 1.4));

  // Railings around the exposed upper-deck edges (top rail blocks falling off)
  const fcHalfX = widthAt(0.85) * 1.7 / 2;
  const fcZf = SHIP_LENGTH * 0.34 + 2.1, fcZa = SHIP_LENGTH * 0.34 - 2.1 + 0.3;
  ship.add(buildRailing([[-fcHalfX, fcZa], [-fcHalfX, fcZf], [fcHalfX, fcZf], [fcHalfX, fcZa]], foreTopY, 0.9));

  const qdHalfX = widthAt(0.12) * 1.6 / 2;
  const qdZf = -SHIP_LENGTH * 0.38 + 2.8, qdZa = -SHIP_LENGTH * 0.38 - 2.8;
  // port & starboard rails, plus a forward rail split by the stair gap
  ship.add(buildRailing([[-qdHalfX, qdZf], [-qdHalfX, qdZa]], lowerRoofY, 0.9));
  ship.add(buildRailing([[qdHalfX, qdZf], [qdHalfX, qdZa]], lowerRoofY, 0.9));
  ship.add(buildRailing([[-qdHalfX, qdZf], [-0.9, qdZf]], lowerRoofY, 0.9));
  ship.add(buildRailing([[0.9, qdZf], [qdHalfX, qdZf]], lowerRoofY, 0.9));

  // Crew — wandering rank-and-file, each talkable with a role line
  const crewGrp = buildCrew();
  ship.add(crewGrp);
  ship.userData.crew = crewGrp.userData.crewList;

  // The three patrons + the officers who serve under the maestre. All stationed
  // and individually talkable (the dialogue system reads ship.userData.npcs).
  const npcGroup = new THREE.Group();
  const npcs = [];
  for (const c of CONQUISTADORS) {
    const fig = buildConquistador(c.kind, c.coat, c.accent);
    fig.position.set(c.pos[0], c.pos[1], c.pos[2]);
    fig.rotation.y = c.rot;
    npcGroup.add(fig);
    npcs.push({
      name: c.name, title: c.title, lines: c.lines, choices: c.choices || [],
      object: fig, local: new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), restRot: c.rot,
    });
  }
  for (const o of OFFICERS) {
    const fig = buildCrewman(o.build, o.hex, o.rot);
    fig.position.set(o.pos[0], o.pos[1], o.pos[2]);
    npcGroup.add(fig);
    npcs.push({
      name: o.name, title: o.title, lines: o.lines, choices: o.choices || [],
      object: fig, local: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), restRot: o.rot,
    });
  }
  ship.add(npcGroup);
  ship.add(buildChartTable(-1.5, 5.48, -7.5));
  ship.userData.npcs = npcs;

  // Navigation state — shared by the helm and the cinematic-view driver.
  // heading in radians (0 = bow +z), speed normalized 0..1 (slight reverse ok).
  ship.userData.nav = { heading: 0, speed: 0 };

  // Sail control — set (drop) or strike (furl) all square sails together.
  ship.userData.sailDeploy = 1;
  ship.userData.setSails = (d) => {
    d = Math.max(0, Math.min(1, d));
    ship.userData.sailDeploy = d;
    for (const p of sailPivots) {
      p.scale.y = 0.04 + 0.96 * d;
      p.userData.sail.userData.deploy = d;
      p.userData.sail.visible = d > 0.05;
      p.userData.bundle.visible = d < 0.55;
    }
  };

  // Aggregate updateable children (sails + flags flutter) and gather the
  // collision sets the character controller walks on / bumps into.
  const updateables = [];
  const walkable = [];
  const solid = [];
  ship.traverse((obj) => {
    if (obj.userData && typeof obj.userData.update === 'function' && obj !== ship) {
      updateables.push(obj.userData.update);
    }
    if (obj.isMesh && obj.userData.walkable) walkable.push(obj);
    if (obj.isMesh && obj.userData.solid) solid.push(obj);
  });
  ship.userData.update = (t) => {
    for (const fn of updateables) fn(t);
  };
  ship.userData.colliders = { walkable, solid };

  // Scale the finished hull up to grand proportions. Collision raycasts run in
  // world space so they respect this automatically; the helm/spawn points are
  // ship-local and get transformed through the (scaled) world matrix.
  ship.scale.setScalar(SHIP_SCALE);
  ship.userData.scale = SHIP_SCALE;
  ship.updateMatrixWorld(true);

  scene.add(ship);
  return ship;
}
