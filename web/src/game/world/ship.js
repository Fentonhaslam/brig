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
  Group, Mesh, Vector3, DoubleSide,
  BoxGeometry, CylinderGeometry, PlaneGeometry, TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMaterial, withOutline } from '../core/toon.js';

export const SHIP_LENGTH = 28;
export const SHIP_BEAM = 8;
const HULL_DEPTH = 4.2;
const DECK_Y = 2.4;

// --- toon palette ---
const MAT = {
  hull: toonMaterial(0x5a3a20),   // dark oiled wood
  deck: toonMaterial(0xb07c3e),   // sun-bleached planking
  trim: toonMaterial(0x7a4d28),   // rails / beams
  iron: toonMaterial(0x2b2b30),   // cannons, fittings
  gold: toonMaterial(0xd6a637),   // gilding
  red:  toonMaterial(0xb23a2c),   // banners / trim stripe
  sail: toonMaterial(0xefe4cb, { side: DoubleSide }),
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
    cyl(mat, rt, rb, h, x, y, z, seg = 7, rot) {
      const g = new CylinderGeometry(rt, rb, h, seg);
      if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
      g.translate(x, y, z);
      add(mat, g);
    },
    raw(mat, g) { add(mat, g); },
    commit(parent, outlineMats = []) {
      for (const [mat, geos] of buckets) {
        const merged = mergeGeometries(geos, false);
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

  // --- MAIN DECK (a faceted plank surface set just below the rail) ---
  {
    const deck = new PlaneGeometry(SHIP_BEAM * 0.86, SHIP_LENGTH * 0.92, 4, 12);
    deck.rotateX(-Math.PI / 2);
    // taper the deck to follow the hull
    const p = deck.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const z01 = (z + (SHIP_LENGTH * 0.92) / 2) / (SHIP_LENGTH * 0.92);
      p.setX(i, p.getX(i) * (widthAt(z01) / (SHIP_BEAM / 2)) * 0.92);
    }
    deck.translate(0, DECK_Y, 0);
    deck.computeVertexNormals();
    B.raw(MAT.deck, deck);
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
  function update(t) {
    for (const s of sails) {
      s.scale.y = furl;
      s.visible = furl > 0.02;
    }
    // banner ripple
    const fp = flag.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const u = (fp.getX(i) + 1.2) / 2.4;
      fp.setZ(i, Math.sin(u * 6 + t * 4) * 0.25 * u);
    }
    fp.needsUpdate = true;
  }

  return {
    root, deckY: DECK_Y, length: SHIP_LENGTH, beam: SHIP_BEAM,
    sails, wheel, helm, capstanPos, setSails, update,
  };
}
