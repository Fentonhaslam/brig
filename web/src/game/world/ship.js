// The ship — rebuilt fresh for the lightweight toon build.
//
// Inspired by the old galleon (length ~26, beam ~7, three masts, fore & aft
// castles, wheel, capstan, cannon ports) but rebuilt low-poly the RIGHT way:
//   * chunky faceted geometry (low segment counts) for the Wind Waker look
//   * STATIC parts merged per material -> a handful of draw calls
//   * cel-shaded toon materials + ink outlines on the hero silhouette
//   * rigging/sails kept as live nodes so they can furl and the wheel can turn
//
// EXPORT: createShip() -> {
//   root, deckY, length, beam, sails[], wheel, helm:Vector3, capstanPos,
//   setSails(0..1), update(t)
// }

import {
  Group, Mesh, Vector3, Quaternion, DoubleSide, MeshStandardMaterial,
  BoxGeometry, CylinderGeometry, PlaneGeometry, TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { withOutline } from '../core/toon.js';
import { woodGrain, weave } from '../core/textures.js';

// a PBR ship surface — the procedural grain doubles as albedo map + bumpMap so
// the planking/canvas reads grounded under the sun + environment + AO + grade
function pbr(color, o = {}) {
  const m = new MeshStandardMaterial({
    color, roughness: o.roughness ?? 0.85, metalness: o.metalness ?? 0,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.side,
  });
  if (o.map) { m.map = o.map; m.bumpMap = o.map; m.bumpScale = o.bump ?? 0.05; }
  m.envMapIntensity = o.env ?? 0.5;
  return m;
}

export const SHIP_LENGTH = 28;
export const SHIP_BEAM = 8;
const HULL_DEPTH = 4.2;
const DECK_Y = 2.4;

// The whole ship is built at the base size above, then scaled up uniformly so
// she reads as a proper great nao against the human-sized player. Everything
// returned (deck height, helm, colliders…) is pre-multiplied by this, and the
// harbour lifts to the scaled deck height — so docking + walking stay aligned.
export const SHIP_SCALE = 1.4;
export const DECK_TOP = DECK_Y * SHIP_SCALE;            // walkable deck height (scaled)
export const HULL_HALF_LEN = (SHIP_LENGTH / 2) * SHIP_SCALE; // bow/stern reach (scaled)

const HATCH_HX = 1.7, HATCH_HZ = 2.6;   // open hatch half-extents (deck-local)
const BELOW_TOP = DECK_Y - 2.3;         // the hold floor sits this far under the deck

// --- PBR palette (grounded stylized) ---
const MAT = {
  hull: pbr(0x5a3a20, { map: woodGrain(2, 5), roughness: 0.8, bump: 0.06 }),   // dark oiled wood, planked
  deck: pbr(0xb07c3e, { map: woodGrain(3, 8), roughness: 0.82, bump: 0.05 }),  // sun-bleached planking
  trim: pbr(0x7a4d28, { map: woodGrain(2, 2), roughness: 0.8, bump: 0.05 }),   // rails / beams
  iron: pbr(0x2b2b30, { roughness: 0.5, metalness: 0.7 }),   // cannons, fittings
  gold: pbr(0xb98a2e, { roughness: 0.34, metalness: 0.85, env: 1.0 }),   // gilding / weathered brass
  red:  pbr(0x9c3528, { roughness: 0.9 }),   // banners / trim stripe
  sail: pbr(0xddcfae, { side: DoubleSide, map: weave(2, 2), roughness: 1.0, bump: 0.02 }), // woven canvas
  rope: pbr(0x6a5a3a, { roughness: 0.95 }),   // rigging / cordage
  cask: pbr(0x6f4a28, { map: woodGrain(2, 2), roughness: 0.85, bump: 0.05 }),   // barrels / crates
  // lit glass: emissive so the post bloom blooms it into a warm lantern glow
  glass: pbr(0xf6cf7a, { emissive: 0xffb968, emissiveIntensity: 1.4, roughness: 0.3 }),
  window: pbr(0xffca7a, { emissive: 0xffb060, emissiveIntensity: 1.0, roughness: 0.4 }), // stern gallery
};

// hull half-width at a length fraction (0 stern .. 1 bow): full midships,
// pointed bow, tucked stern.
function widthAt(z01) {
  const t = z01 * 2 - 1; // -1..1
  return (SHIP_BEAM / 2) * Math.sqrt(Math.max(0, 1 - t * t * 0.82));
}

// ---------------------------------------------------------------------------
// Bucketed builder: bake each primitive's transform into its geometry and sort
// it into a per-material bucket, then merge each bucket into one mesh.
// ---------------------------------------------------------------------------
function makeBuilder() {
  const buckets = new Map(); // material -> [geometry,...]
  const add = (mat, geo) => {
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(geo);
  };
  return {
    box(mat, w, h, d, x, y, z, rot) {
      const g = new BoxGeometry(w, h, d);
      if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
      g.translate(x, y, z);
      add(mat, g);
    },
    // a rounded box (softened edges) — for crates, chests and other deck clutter
    rbox(mat, w, h, d, x, y, z, r = 0.1, rot) {
      const g = new RoundedBoxGeometry(w, h, d, 2, r);
      if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
      g.translate(x, y, z);
      add(mat, g);
    },
    cyl(mat, rt, rb, h, x, y, z, seg = 7, rot) {
      const g = new CylinderGeometry(rt, rb, h, seg);
      if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
      g.translate(x, y, z);
      add(mat, g);
    },
    // a strut/line between two points a=[x,y,z], b=[x,y,z]
    seg(mat, a, b, th = 0.05) {
      const dir = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = dir.length();
      if (len < 1e-4) return;
      const g = new BoxGeometry(th, th, len);
      g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir.normalize()));
      g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      add(mat, g);
    },
    raw(mat, g) { add(mat, g); },
    commit(parent, outlineMats = []) {
      for (const [mat, geos] of buckets) {
        // RoundedBoxGeometry is non-indexed while Box/Cylinder are indexed;
        // mergeGeometries needs all-or-none, so drop everything to non-indexed
        const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
        merged.computeVertexNormals();
        const mesh = new Mesh(merged, mat);
        if (outlineMats.includes(mat)) withOutline(mesh, 0.07);
        parent.add(mesh);
      }
    },
  };
}

export function createShip() {
  const root = new Group();
  root.name = 'ship';
  const B = makeBuilder();

  // --- HULL: a deformed low-poly box (chunky facets) ---
  {
    const segL = 14, segH = 3, segW = 4;
    const g = new BoxGeometry(SHIP_BEAM, HULL_DEPTH, SHIP_LENGTH, segW, segH, segL);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
      const w = widthAt(z01) / (SHIP_BEAM / 2);          // 0..1 taper
      const yk = (y + HULL_DEPTH / 2) / HULL_DEPTH;        // 0 bottom .. 1 top
      const keel = 0.42 + 0.58 * yk;                       // V-section toward keel
      pos.setX(i, x * w * keel);
      // sheer: lift the rail line up toward bow & stern
      const sheer = Math.pow(Math.abs(z01 - 0.5) * 2, 2) * 0.9;
      pos.setY(i, y + (y > 0 ? sheer : 0));
    }
    g.computeVertexNormals();
    const hull = new Mesh(g, MAT.hull);
    withOutline(hull, 0.08);
    root.add(hull);

    // waterline stripe (a thin red band a touch proud of the hull)
    B.box(MAT.red, SHIP_BEAM + 0.06, 0.35, SHIP_LENGTH * 0.62, 0, DECK_Y - 0.55, 0);
  }

  // --- MAIN DECK (a faceted plank surface set just below the rail), with an
  // OPEN HATCH amidships cut out of the geometry so you can climb below ---
  {
    const deck = new PlaneGeometry(SHIP_BEAM * 0.86, SHIP_LENGTH * 0.92, 6, 18);
    deck.rotateX(-Math.PI / 2);
    const p = deck.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const z01 = (z + (SHIP_LENGTH * 0.92) / 2) / (SHIP_LENGTH * 0.92);
      p.setX(i, p.getX(i) * (widthAt(z01) / (SHIP_BEAM / 2)) * 0.92);
    }
    deck.translate(0, DECK_Y, 0);
    // drop the faces over the hatch (the hold opening)
    const idx = deck.index.array, kept = [];
    for (let i = 0; i < idx.length; i += 3) {
      let cx = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += p.getX(idx[i + k]); cz += p.getZ(idx[i + k]); }
      cx /= 3; cz /= 3;
      if (Math.abs(cx) < HATCH_HX && Math.abs(cz) < HATCH_HZ) continue;
      kept.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    deck.setIndex(kept);
    deck.computeVertexNormals();
    B.raw(MAT.deck, deck);
  }

  // --- BELOW-DECK: a lit gun deck / hold reached by the hatch stair ---
  const belowColliders = [];
  {
    const wd = SHIP_BEAM * 0.4, ld = SHIP_LENGTH * 0.46;
    // floor + a walkable collider for it
    B.box(MAT.deck, wd * 1.84, 0.4, ld * 1.56, 0, BELOW_TOP - 0.2, 0);
    // a deep, solid floor BLOCK (top at BELOW_TOP) — nothing can fall past it
    belowColliders.push({ hx: wd * 0.95, hy: 4, hz: ld * 0.82, x: 0, y: BELOW_TOP - 4, z: 0 });
    // hull-interior side walls (headroom up to the deck) + colliders
    const wallY = (BELOW_TOP + DECK_Y) / 2, wallHy = (DECK_Y - BELOW_TOP) / 2 + 0.2;
    for (const sx of [-1, 1]) {
      B.box(MAT.hull, 0.3, DECK_Y - BELOW_TOP, ld * 1.5, sx * (wd - 0.05), wallY, 0);
      belowColliders.push({ hx: 0.25, hy: wallHy, hz: ld * 0.78, x: sx * (wd + 0.05), y: wallY, z: 0 });
    }
    // fore + aft end caps, so you can't walk off the ends of the hold floor
    for (const sz2 of [-1, 1]) {
      B.box(MAT.hull, wd * 1.9, DECK_Y - BELOW_TOP, 0.3, 0, wallY, sz2 * (ld * 0.78));
      belowColliders.push({ hx: wd * 0.95, hy: wallHy, hz: 0.3, x: 0, y: wallY, z: sz2 * (ld * 0.78) });
    }
    // overhead deck beams
    for (const bz of [-7, -2, 4, 9]) B.box(MAT.trim, wd * 1.7, 0.28, 0.4, 0, DECK_Y - 0.35, bz);
    // gun-deck cannons on carriages + powder barrels
    for (const side of [-1, 1]) for (const cz of [-7, -1, 5]) {
      B.cyl(MAT.iron, 0.18, 0.24, 1.5, side * (wd - 0.3), BELOW_TOP + 0.75, cz, 8, [Math.PI / 2, 0, 0]);
      B.box(MAT.trim, 0.8, 0.5, 1.0, side * (wd - 0.55), BELOW_TOP + 0.45, cz);
    }
    for (const [bx, bz] of [[-1.3, -9], [1.3, -9], [0, 9.5], [-1.5, 2.5], [1.6, -4]]) {
      B.cyl(MAT.cask, 0.45, 0.45, 1.0, bx, BELOW_TOP + 0.6, bz, 8);
    }
    // a hanging lantern so the hold glows (a point light is added in main too)
    B.box(MAT.gold, 0.34, 0.16, 0.34, 0, DECK_Y - 0.55, 1);
    B.box(MAT.glass, 0.26, 0.42, 0.26, 0, DECK_Y - 0.92, 1);
  }

  // --- HATCH COAMING + a solid RAMP down into the hold ---
  {
    // coaming on three sides; the FORE side (+z) is left open as the way down
    B.box(MAT.trim, HATCH_HX * 2 + 0.5, 0.32, 0.26, 0, DECK_Y + 0.16, -HATCH_HZ);
    B.box(MAT.trim, 0.26, 0.32, HATCH_HZ * 2, HATCH_HX, DECK_Y + 0.16, 0);
    B.box(MAT.trim, 0.26, 0.32, HATCH_HZ * 2, -HATCH_HX, DECK_Y + 0.16, 0);
    // one solid ramp from the hatch fore edge (deck) down to the hold floor —
    // no gaps or thin treads to slip past
    const z0 = HATCH_HZ, z1 = -1.6;                  // top (deck edge) -> bottom
    const cz = (z0 + z1) / 2, cy = (DECK_Y + BELOW_TOP) / 2;
    const ang = Math.atan2(DECK_Y - BELOW_TOP, z0 - z1);
    const half = Math.hypot(z0 - z1, DECK_Y - BELOW_TOP) / 2;
    B.box(MAT.trim, 2.8, 0.4, half * 2, 0, cy, cz, [-ang, 0, 0]);
    belowColliders.push({ hx: 1.4, hy: 0.2, hz: half, x: 0, y: cy, z: cz, rot: [-ang, 0, 0] });
  }

  // --- BULWARKS (rail walls down each side, following the taper) ---
  {
    const N = 12;
    for (let i = 0; i < N; i++) {
      const z01 = (i + 0.5) / N;
      const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
      const w = widthAt(z01);
      const seg = (SHIP_LENGTH / N) * 1.02;
      B.box(MAT.trim, 0.18, 0.9, seg, w, DECK_Y + 0.45, z);
      B.box(MAT.trim, 0.18, 0.9, seg, -w, DECK_Y + 0.45, z);
    }
  }

  // --- FORECASTLE (raised deck fwd) & QUARTERDECK (raised deck aft) ---
  B.box(MAT.deck, SHIP_BEAM * 0.7, 1.0, 5.0, 0, DECK_Y + 0.5, SHIP_LENGTH * 0.34);   // forecastle
  B.box(MAT.deck, SHIP_BEAM * 0.78, 1.2, 6.5, 0, DECK_Y + 0.6, -SHIP_LENGTH * 0.32); // quarterdeck
  B.box(MAT.trim, SHIP_BEAM * 0.8, 0.25, 0.4, 0, DECK_Y + 1.2, -SHIP_LENGTH * 0.32 + 3.3); // step rail

  // --- STAIRS up to the raised decks, so you can climb to the wheel and
  // forecastle (0.4 risers — within the character's step height). Each tread is
  // both a visible plank and a flat collider, collected for the physics list.
  const stepColliders = [];
  function stair(topY, z, hw) {
    B.box(MAT.trim, hw * 2, 0.3, 0.66, 0, topY - 0.15, z);
    stepColliders.push({ hx: hw, hy: 0.16, hz: 0.36, x: 0, y: topY - 0.16, z });
  }
  // up to the quarterdeck (2.4 -> 3.6): five shallow, realistic risers (~0.24)
  for (let i = 1; i <= 5; i++) stair(DECK_Y + 0.24 * i, -3.7 - 0.42 * i, 1.6);
  // up to the forecastle (2.4 -> 3.4): four shallow risers, climbing forward
  for (let i = 1; i <= 4; i++) stair(DECK_Y + 0.25 * i, 5.55 + 0.42 * i, 1.4);

  // --- CAPSTAN (mid-deck) ---
  const capstanPos = new Vector3(0, DECK_Y, 4.5);
  B.cyl(MAT.trim, 0.55, 0.7, 1.1, 0, DECK_Y + 0.55, 4.5, 8);

  // --- CANNONS: barrels poking through gun ports, 4 a side (visible few) ---
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const z = -6 + k * 4;
      const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
      const w = widthAt(z01);
      B.cyl(MAT.iron, 0.16, 0.2, 1.1, side * (w + 0.1), DECK_Y - 0.1, z, 7, [Math.PI / 2, 0, 0]);
    }
  }

  // --- BOWSPRIT ---
  B.cyl(MAT.trim, 0.12, 0.2, 7, 0, DECK_Y + 1.2, SHIP_LENGTH / 2 + 1.5, 6, [Math.PI / 2.4, 0, 0]);

  // --- WALES (horizontal rub-rails down the hull) + GUNPORT LIDS ---
  for (let i = 0; i < 12; i++) {
    const z01 = (i + 0.5) / 12;
    const z = -SHIP_LENGTH / 2 + z01 * SHIP_LENGTH;
    const w = widthAt(z01);
    const seg = (SHIP_LENGTH / 12) * 1.02;
    for (const wy of [DECK_Y - 1.1, DECK_Y - 2.1]) {
      B.box(MAT.trim, 0.16, 0.28, seg, w, wy, z);
      B.box(MAT.trim, 0.16, 0.28, seg, -w, wy, z);
    }
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const z = -6 + k * 4;
      const z01 = (z + SHIP_LENGTH / 2) / SHIP_LENGTH;
      const w = widthAt(z01);
      B.box(MAT.iron, 0.05, 0.62, 0.62, side * (w + 0.02), DECK_Y - 0.1, z); // port frame
    }
  }

  // --- HATCHES: raised coaming + grating bars (main + fore) ---
  function hatch(cx, cz, w, l) {
    B.box(MAT.trim, w + 0.3, 0.3, 0.18, cx, DECK_Y + 0.15, cz - l / 2);
    B.box(MAT.trim, w + 0.3, 0.3, 0.18, cx, DECK_Y + 0.15, cz + l / 2);
    B.box(MAT.trim, 0.18, 0.3, l, cx - w / 2, DECK_Y + 0.15, cz);
    B.box(MAT.trim, 0.18, 0.3, l, cx + w / 2, DECK_Y + 0.15, cz);
    for (let i = 0; i <= 5; i++) B.box(MAT.iron, w, 0.04, 0.04, cx, DECK_Y + 0.12, cz - l / 2 + (i / 5) * l);
    for (let i = 0; i <= 6; i++) B.box(MAT.iron, 0.04, 0.04, l, cx - w / 2 + (i / 6) * w, DECK_Y + 0.12, cz);
  }
  hatch(0, 2, 2.0, 2.6);
  hatch(0, 6.5, 1.5, 1.8);

  // --- CAPSTAN BARS (radial) ---
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.cyl(MAT.trim, 0.05, 0.05, 2.0, Math.sin(a) * 0.9, DECK_Y + 1.05, 4.5 + Math.cos(a) * 0.9, 5, [0, a, Math.PI / 2]);
  }

  // --- ANCHOR + CATHEAD at the bow (starboard) ---
  {
    const bx = SHIP_BEAM * 0.34, bz = SHIP_LENGTH * 0.4;
    B.box(MAT.trim, 0.4, 0.4, 2.0, bx, DECK_Y + 0.5, bz + 0.6); // cathead beam
    const ay = DECK_Y - 1.4;
    B.box(MAT.iron, 0.16, 2.4, 0.16, bx + 0.4, ay, bz + 1.2);          // shank
    B.box(MAT.iron, 1.7, 0.16, 0.16, bx + 0.4, ay + 1.0, bz + 1.2);    // stock
    B.box(MAT.iron, 0.7, 0.16, 0.16, bx + 0.0, ay - 1.0, bz + 1.2, [0, 0, 0.6]);  // fluke
    B.box(MAT.iron, 0.7, 0.16, 0.16, bx + 0.8, ay - 1.0, bz + 1.2, [0, 0, -0.6]); // fluke
  }

  // --- DECK CLUTTER: barrels, crates, rope coils, ship's boat ---
  for (const [x, z] of [[-2.6, -0.5], [-2.6, 0.6], [2.6, 5.0], [-2.4, -6.2], [2.4, -6.0]]) {
    B.cyl(MAT.cask, 0.42, 0.42, 1.0, x, DECK_Y + 0.5, z, 8);
    B.cyl(MAT.iron, 0.44, 0.44, 0.1, x, DECK_Y + 0.25, z, 8);
    B.cyl(MAT.iron, 0.44, 0.44, 0.1, x, DECK_Y + 0.75, z, 8);
  }
  for (const [x, z, s] of [[2.2, 4.0, 0.8], [2.6, 4.4, 0.6], [1.9, 4.5, 0.7]]) {
    B.rbox(MAT.cask, s, s, s, x, DECK_Y + s / 2, z, 0.08);
  }
  for (const [x, z] of [[-3.0, 3.0], [3.0, 1.0], [-3.0, -3.5]]) {
    B.cyl(MAT.rope, 0.32, 0.36, 0.18, x, DECK_Y + 0.09, z, 10); // coil of line
  }
  // ship's boat stowed over the booms amidships
  B.box(MAT.cask, 1.5, 0.7, 3.6, 0, DECK_Y + 1.7, -1.5);

  // --- STERN LANTERN (the glow source the night sea reads by) ---
  const lanternPos = new Vector3(0, DECK_Y + 3.4, -SHIP_LENGTH / 2 + 0.7);
  B.box(MAT.gold, 0.5, 0.7, 0.5, lanternPos.x, lanternPos.y, lanternPos.z);
  B.box(MAT.glass, 0.34, 0.5, 0.34, lanternPos.x, lanternPos.y, lanternPos.z);
  B.box(MAT.gold, 0.16, 0.16, 0.16, lanternPos.x, lanternPos.y + 0.45, lanternPos.z); // finial

  // --- STERN GALLERY: a row of lit cabin windows across the transom ---
  for (let i = -1; i <= 1; i++) {
    B.box(MAT.trim, 0.5, 0.62, 0.12, i * 0.62, DECK_Y + 0.7, -SHIP_LENGTH * 0.45);   // frame
    B.box(MAT.window, 0.34, 0.46, 0.14, i * 0.62, DECK_Y + 0.7, -SHIP_LENGTH * 0.45); // glass
  }

  // --- STANDING RIGGING: shrouds, ratlines, stays (one rope bucket) ---
  const mastDefs = [
    { z: SHIP_LENGTH * 0.28, top: 11 }, // fore
    { z: 0, top: 15 },                  // main
    { z: -SHIP_LENGTH * 0.3, top: 10 }, // mizzen
  ];
  for (const m of mastDefs) {
    const headY = DECK_Y + m.top - 1.5;
    const z01 = (m.z + SHIP_LENGTH / 2) / SHIP_LENGTH;
    const w = widthAt(z01) * 0.96;
    for (const side of [-1, 1]) {
      const offsets = [-1.3, 0, 1.3];
      // shrouds fan from the masthead to three channel points on the bulwark
      const channels = offsets.map((o) => [side * w, DECK_Y + 0.7, m.z + o]);
      const head = [0, headY, m.z];
      channels.forEach((c) => B.seg(MAT.rope, head, c, 0.045));
      // ratlines: rungs across the outer two shrouds at rising heights
      const a = channels[0], c = channels[2];
      for (let r = 1; r <= 6; r++) {
        const f = r / 7;
        const p1 = [a[0] + (head[0] - a[0]) * f, a[1] + (head[1] - a[1]) * f, a[2] + (head[2] - a[2]) * f];
        const p2 = [c[0] + (head[0] - c[0]) * f, c[1] + (head[1] - c[1]) * f, c[2] + (head[2] - c[2]) * f];
        B.seg(MAT.rope, p1, p2, 0.03);
      }
    }
    // fore-and-aft stay
    B.seg(MAT.rope, [0, headY, m.z], [0, DECK_Y + 1.2, m.z + m.top * 0.9], 0.05);
  }

  // --- SHIP'S BELL on a frame at the break of the quarterdeck ---
  const bz0 = -SHIP_LENGTH * 0.32 + 3.7;
  B.box(MAT.trim, 0.12, 1.3, 0.12, -0.7, DECK_Y + 0.75, bz0);
  B.box(MAT.trim, 0.12, 1.3, 0.12, 0.7, DECK_Y + 0.75, bz0);
  B.box(MAT.trim, 1.7, 0.14, 0.14, 0, DECK_Y + 1.4, bz0);
  B.cyl(MAT.gold, 0.16, 0.26, 0.42, 0, DECK_Y + 1.12, bz0, 8);

  // --- a little more cargo lashed amidships ---
  for (const [x, z, s] of [[-2.0, -3.0, 0.9], [2.4, -2.2, 0.7], [-2.6, 6.4, 0.8]]) {
    B.rbox(MAT.cask, s, s, s, x, DECK_Y + s / 2, z, 0.08);
  }
  for (const [x, z] of [[2.6, -4.5], [-3.0, 5.5]]) B.cyl(MAT.rope, 0.3, 0.34, 0.18, x, DECK_Y + 0.09, z, 10);

  // commit all static merged geometry (outline the rails & castles silhouette)
  B.commit(root, [MAT.trim]);

  // ---------------------------------------------------------------------------
  // RIGGING — live nodes (masts, yards, sails). Kept separate so sails furl and
  // the wheel turns.
  // ---------------------------------------------------------------------------
  const sails = [];
  function mast(x, z, height, sailW, sailH, sailY) {
    const m = new Group();
    m.position.set(x, DECK_Y, z);
    const pole = new Mesh(new CylinderGeometry(0.16, 0.24, height, 7), MAT.trim);
    pole.position.y = height / 2;
    m.add(pole);
    // yard (horizontal spar)
    const yard = new Mesh(new CylinderGeometry(0.1, 0.1, sailW + 1, 6), MAT.trim);
    yard.rotation.z = Math.PI / 2;
    yard.position.y = sailY + sailH / 2;
    m.add(yard);
    // billowed sail
    const sg = new PlaneGeometry(sailW, sailH, 6, 4);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / sailW, v = p.getY(i) / sailH;
      p.setZ(i, Math.cos(u * Math.PI) * 0.9 + 0.5); // belly fwd
    }
    sg.computeVertexNormals();
    const sail = new Mesh(sg, MAT.sail);
    sail.position.y = sailY;
    sail.userData.base = sg.attributes.position.array.slice(); // rest pose for the billow
    sail.userData.w = sailW;
    m.add(sail);
    sails.push(sail);
    root.add(m);
    return m;
  }
  mast(0, SHIP_LENGTH * 0.28, 11, 6.5, 5.5, 7.5);  // foremast
  mast(0, 0, 15, 8.5, 7.5, 9.5);                    // mainmast (tallest)
  mast(0, -SHIP_LENGTH * 0.3, 10, 5, 4.5, 6.5);     // mizzen

  // --- SHIP'S WHEEL (on the quarterdeck) ---
  const helm = new Vector3(0, DECK_Y + 1.2, -SHIP_LENGTH * 0.32 + 2.0);
  const wheel = new Group();
  wheel.position.copy(helm);
  const rim = new Mesh(new TorusGeometry(0.7, 0.08, 6, 12), MAT.trim);
  wheel.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = new Mesh(new CylinderGeometry(0.05, 0.05, 1.7, 5), MAT.trim);
    spoke.rotation.z = (i / 6) * Math.PI * 2;
    wheel.add(spoke);
  }
  wheel.rotation.x = Math.PI / 2.4; // tilt to face the helmsman
  root.add(wheel);

  // --- STERN BANNER ---
  const flagPole = new Mesh(new CylinderGeometry(0.06, 0.06, 4, 5), MAT.trim);
  flagPole.position.set(0, DECK_Y + 2.5, -SHIP_LENGTH / 2 + 0.5);
  root.add(flagPole);
  const flag = new Mesh(new PlaneGeometry(2.4, 1.3, 6, 2), MAT.red);
  flag.position.set(1.2, DECK_Y + 3.8, -SHIP_LENGTH / 2 + 0.5);
  root.add(flag);

  // --- animation ---
  let furl = 1;
  function setSails(d) { furl = Math.max(0, Math.min(1, d)); }
  // wind 0..1 drives how hard the canvas + banner whip
  function update(t, wind = 0) {
    const amp = 1 + wind * 2.6, sp = 1 + wind * 1.4;
    for (const s of sails) {
      s.scale.y = furl;
      s.visible = furl > 0.02;
      if (!s.visible) continue;
      // wind in the canvas: a travelling billow on top of the rest belly, scaled
      // by how far the sail is set (cheap — ~35 verts per sail, no normal rebuild)
      const pos = s.geometry.attributes.position;
      const base = s.userData.base, w = s.userData.w;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
        const u = bx / w + 0.5;
        const ripple = (Math.sin(u * 5.0 + t * 2.4 * sp) * 0.16 + Math.sin(by * 0.7 + t * 1.6 * sp) * 0.1) * amp;
        pos.setZ(i, bz + ripple * furl);
      }
      pos.needsUpdate = true;
    }
    // banner ripple — snaps and cracks harder in a blow
    const fp = flag.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const u = (fp.getX(i) + 1.2) / 2.4;
      fp.setZ(i, Math.sin(u * 6 + t * (4 + wind * 5)) * 0.25 * (1 + wind * 1.8) * u);
    }
    fp.needsUpdate = true;
  }

  // --- physics colliders (static cuboids; ship sits at the world origin so
  // local == world). Deck floor + raised castles + bulwark walls that keep the
  // player aboard. {hx,hy,hz,x,y,z}
  const dfHz = (SHIP_LENGTH * 0.46 - HATCH_HZ) / 2, dfZ = (SHIP_LENGTH * 0.46 + HATCH_HZ) / 2;
  const dfHx = (SHIP_BEAM * 0.4 - HATCH_HX) / 2, dfX = (SHIP_BEAM * 0.4 + HATCH_HX) / 2;
  const colliders = [
    // main deck floor — a frame around the open hatch (top surface at DECK_Y)
    { hx: SHIP_BEAM * 0.4, hy: 0.3, hz: dfHz, x: 0, y: DECK_Y - 0.3, z: dfZ },   // fore of hatch
    { hx: SHIP_BEAM * 0.4, hy: 0.3, hz: dfHz, x: 0, y: DECK_Y - 0.3, z: -dfZ },  // aft of hatch
    { hx: dfHx, hy: 0.3, hz: HATCH_HZ, x: dfX, y: DECK_Y - 0.3, z: 0 },          // starboard strip
    { hx: dfHx, hy: 0.3, hz: HATCH_HZ, x: -dfX, y: DECK_Y - 0.3, z: 0 },         // port strip
    // forecastle deck (raised, fwd)
    { hx: SHIP_BEAM * 0.34, hy: 0.2, hz: 2.5, x: 0, y: DECK_Y + 0.8, z: SHIP_LENGTH * 0.34 },
    // quarterdeck (raised, aft)
    { hx: SHIP_BEAM * 0.38, hy: 0.2, hz: 3.25, x: 0, y: DECK_Y + 1.0, z: -SHIP_LENGTH * 0.32 },
    // bulwark walls (port / starboard / bow / stern)
    { hx: 0.25, hy: 0.9, hz: SHIP_LENGTH * 0.46, x: SHIP_BEAM * 0.42, y: DECK_Y + 0.6, z: 0 },
    { hx: 0.25, hy: 0.9, hz: SHIP_LENGTH * 0.46, x: -SHIP_BEAM * 0.42, y: DECK_Y + 0.6, z: 0 },
    { hx: SHIP_BEAM * 0.4, hy: 0.9, hz: 0.25, x: 0, y: DECK_Y + 0.6, z: SHIP_LENGTH * 0.46, bow: true }, // bow rail — dropped at berth so you can step ashore
    { hx: SHIP_BEAM * 0.4, hy: 0.9, hz: 0.25, x: 0, y: DECK_Y + 0.6, z: -SHIP_LENGTH * 0.46 },
  ];
  colliders.push(...stepColliders);   // the deck stairs
  colliders.push(...belowColliders);  // the hold floor, walls and hatch stair

  // scale the whole vessel up; pre-scale everything main.js consumes so the
  // physics colliders, helm and lantern line up with the enlarged visuals
  const S = SHIP_SCALE;
  root.scale.setScalar(S);
  const scaled = colliders.map((c) => ({
    hx: c.hx * S, hy: c.hy * S, hz: c.hz * S, x: c.x * S, y: c.y * S, z: c.z * S, rot: c.rot, bow: c.bow,
  }));
  return {
    root, deckY: DECK_Y * S, length: SHIP_LENGTH * S, beam: SHIP_BEAM * S,
    sails, wheel,
    helm: helm.clone().multiplyScalar(S),
    capstanPos: capstanPos.clone().multiplyScalar(S),
    lanternPos: lanternPos.clone().multiplyScalar(S),
    colliders: scaled, setSails, update,
    // live refit — recolour the shared merged-mesh materials
    setSailColor: (hex) => MAT.sail.color.set(hex),
    setBannerColor: (hex) => { MAT.red.color.set(hex); },
    setHullColor: (hex) => MAT.hull.color.set(hex),
  };
}
