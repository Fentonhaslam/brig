// The world beyond the rail — built once and parented to the world group, which
// counter-transforms against the ship so it slides and turns past you as you
// sail. Two pieces:
//
//   * Hispaniola, dead ahead: a low-poly island with a beach, hills, palms, a
//     timber dock, a little port town and the keep (the lore archive from the
//     old build) flying the Cross of Burgundy.
//   * Sevilla, astern: a dark skyline silhouette — the Giralda, the cathedral,
//     the Torre del Oro and the city walls — the port you're departing.
//
// Everything is merged per material into a handful of draw calls, same strategy
// as the ship.

import {
  Group, Mesh, Vector3, BoxGeometry, CylinderGeometry, ConeGeometry,
  IcosahedronGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMaterial, withOutline } from '../core/toon.js';

// per-colour bucket builder -> one merged mesh per material
function makeBuilder() {
  const buckets = new Map();
  const add = (hex, g) => { (buckets.get(hex) || buckets.set(hex, []).get(hex)).push(g); };
  return {
    box(hex, w, h, d, x, y, z) { const g = new BoxGeometry(w, h, d); g.translate(x, y, z); add(hex, g); },
    cyl(hex, rt, rb, h, x, y, z, seg = 7) { const g = new CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); add(hex, g); },
    cone(hex, r, h, x, y, z, seg = 6) { const g = new ConeGeometry(r, h, seg); g.translate(x, y, z); add(hex, g); },
    ico(hex, r, detail, sx, sy, sz, x, y, z) {
      const g = new IcosahedronGeometry(r, detail); g.scale(sx, sy, sz); g.translate(x, y, z); add(hex, g);
    },
    commit(parent, outline = []) {
      for (const [hex, geos] of buckets) {
        // Icosahedron (Polyhedron) is non-indexed while Box/Cone/Cylinder are
        // indexed; mergeGeometries needs all-or-none, so drop everything to
        // non-indexed before merging.
        const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
        merged.computeVertexNormals();
        const mesh = new Mesh(merged, toonMaterial(hex));
        if (outline.includes(hex)) withOutline(mesh, 0.14);
        parent.add(mesh);
      }
    },
  };
}

const C = {
  sand: 0xe3cf94, grass: 0x6fae44, rock: 0x6b6256,
  trunk: 0x6b4a2c, leaf: 0x2f9b46,
  wood: 0x6a4a2c, stone: 0xb9ad8c, wall: 0xcabf9e, roof: 0x8a4a2e,
  red: 0x9c3528, cream: 0xe8dcc0,
};

function buildHispaniola() {
  const g = new Group();
  const B = makeBuilder();

  // landmass: a low island set well INLAND (centre at z=ZC) so its sandy shore
  // begins behind the harbour — the quay reaches out over the water in front of
  // it and the land rises beyond. (Centring it on the harbour buried the quay.)
  const ZC = 75;
  B.ico(C.sand, 95, 1, 1, 0.08, 1, 0, 1.0, ZC);
  B.ico(C.grass, 72, 1, 1, 0.1, 1, 0, 3.0, ZC);
  B.cone(C.grass, 30, 14, -26, 8, ZC + 16, 6);
  B.cone(C.rock, 22, 18, 30, 10, ZC - 4, 6);

  // palms round the shore
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = Math.cos(a) * 70, z = ZC + Math.sin(a) * 70;
    B.cyl(C.trunk, 0.6, 0.9, 7, x, 5, z, 5);
    B.cone(C.leaf, 4.2, 3.6, x, 9.5, z, 6);
  }

  // a little port town on the rise behind the keep
  for (const [hx, hz] of [[10, 60], [18, 66], [2, 70], [24, 58], [-8, 66]]) {
    B.box(C.wall, 6, 5, 6, hx, 5.5, hz);
    B.cone(C.roof, 5.2, 4, hx, 10, hz, 4);
  }

  // the walkable harbour (low quay + gangway + keep) at the seaward edge
  const harbour = buildHarbour(B);
  harbour.group = g; // dynamic props (memory-stones) parent here, riding with the island
  // courtyard anchor (island-local) — where lore stones stand, in front of the keep
  harbour.courtyard = { x: 0, y: 2.5, z: HARBOUR_LOCAL.z + 14 };

  B.commit(g, [C.sand, C.grass, C.stone, C.wood]);
  g.position.copy(HISPANIOLA); // far across the ocean — out of sight until you near it
  return { group: g, harbour };
}

// ---------------------------------------------------------------------------
// The harbour you actually walk on. Built LOW (quay top at the ship's deck
// height) at the island's seaward edge so a gangway lies nearly flat from the
// bow. Everything here is defined relative to Ho (the quay's front-centre,
// island-local); berthing snaps the ship to a known pose so each piece lands
// at scene-space `offset + (0,0,bowGap)` — letting us drop matching static
// colliders without any matrix math. Returns the collider offsets + the world
// berth point so main.js can detect approach, snap, and add the colliders.
// ---------------------------------------------------------------------------
const HARBOUR_LOCAL = new Vector3(0, 0, -72); // Ho: seaward edge, island-local
const BOW_GAP = 18;                            // how far ahead of the bow the quay sits

function buildHarbour(B) {
  const at = (dx, dy, dz) => [HARBOUR_LOCAL.x + dx, HARBOUR_LOCAL.y + dy, HARBOUR_LOCAL.z + dz];
  const colliders = [];
  // a box that is both drawn and walked on (half-extents hx/hy/hz at offset d)
  const solid = (dx, dy, dz, hx, hy, hz, color) => {
    B.box(color, hx * 2, hy * 2, hz * 2, ...at(dx, dy, dz));
    colliders.push({ hx, hy, hz, dx, dy, dz });
  };

  // quay deck — top at y=2.4 (ship deck height); pilings below the front
  solid(0, 1.8, 22, 12, 0.6, 22, C.wood);
  for (const px of [-10, -5, 0, 5, 10]) B.cyl(C.wood, 0.5, 0.6, 4, ...at(px, -0.4, 1), 6);

  // gangway from the bow to the quay front, with side rails
  solid(0, 2.28, -2.5, 1.8, 0.12, 3.2, C.wood);
  B.box(C.wood, 0.16, 0.5, 6.4, ...at(-1.7, 2.6, -2.5));
  B.box(C.wood, 0.16, 0.5, 6.4, ...at(1.7, 2.6, -2.5));

  // THE KEEP at the head of the quay — walls leave a doorway facing the ship
  const ky = 5.0;
  solid(0, ky, 42, 9, 3.6, 0.6, C.stone);     // back wall
  solid(-9, ky, 36, 0.6, 3.6, 6.5, C.stone);  // left wall
  solid(9, ky, 36, 0.6, 3.6, 6.5, C.stone);   // right wall
  solid(-5.5, ky, 30, 3.5, 3.6, 0.6, C.stone);// front, left of door
  solid(5.5, ky, 30, 3.5, 3.6, 0.6, C.stone); // front, right of door
  B.box(C.stone, 13, 1.4, 1.4, ...at(0, 9.0, 30));   // door lintel
  B.box(C.roof, 19, 1.0, 13.5, ...at(0, 9.4, 36));   // roof
  B.cyl(C.stone, 3.0, 3.4, 14, ...at(-11, 9.4, 42), 10); // tower
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.box(C.stone, 1, 1.4, 1, ...at(-11 + Math.cos(a) * 2.8, 16.6, 42 + Math.sin(a) * 2.8));
  }
  B.box(C.cream, 0.35, 4, 0.35, ...at(0, 11, 31));   // flagpole
  B.box(C.red, 2.6, 1.6, 0.18, ...at(1.3, 11.8, 31)); // banner

  // quayside clutter + lamp posts
  for (const [bx, bz] of [[-7, 8], [-6, 9.4], [7, 10], [6, 12]]) B.cyl(C.trunk, 0.5, 0.5, 1.1, ...at(bx, 2.95, bz), 8);
  for (const lz of [6, 24]) for (const lx of [-9.5, 9.5]) {
    B.cyl(C.trunk, 0.16, 0.2, 4.2, ...at(lx, 4.5, lz), 6);
    B.box(C.cream, 0.5, 0.6, 0.5, ...at(lx, 6.9, lz));
  }

  return {
    bowGap: BOW_GAP,
    worldPoint: HISPANIOLA.clone().add(HARBOUR_LOCAL), // worldGroup-local berth point
    keepDoor: { dx: 0, dy: 2.4, dz: 30 },
    colliders,
  };
}

function buildSevilla() {
  const g = new Group();
  const B = makeBuilder();
  const D = 0x2c3850; // hazy dark silhouette

  // city walls + a clutter of rooftops
  B.box(D, 120, 12, 8, 0, 6, 6);
  for (let i = 0; i < 9; i++) B.box(D, 9, 12 + (i % 3) * 5, 9, -50 + i * 12, 9, -2);
  // Torre del Oro (riverside watchtower)
  B.cyl(D, 7, 8, 34, -52, 17, 14, 12);
  B.cyl(D, 4.5, 5, 14, -52, 41, 14, 12);
  // the cathedral mass + La Giralda
  B.box(D, 42, 46, 18, 24, 23, -4);
  B.box(D, 12, 80, 12, 40, 40, 2);        // Giralda shaft
  B.box(D, 8, 18, 8, 40, 88, 2);          // belfry
  B.cone(D, 5, 12, 40, 102, 2, 6);        // crown

  B.commit(g);
  g.position.copy(SEVILLA); // astern at the start — the port you're leaving
  return g;
}

// --- the map ----------------------------------------------------------------
// Absolute world coordinates (the ship moves THROUGH this fixed map; the world
// group counter-transforms so the ship can stay at the origin). Sevilla and
// Hispaniola sit an ocean apart — well beyond the fog distance — so only one is
// ever in view: you depart Sevilla, cross open water, and raise Hispaniola near
// the far end. (Fog far is ~1800; the crossing is ~4400, so each landfall fades
// up over the horizon rather than both hanging in view at once.)
export const SEVILLA = new Vector3(0, 0, -260);
export const HISPANIOLA = new Vector3(160, 0, 4200);

export const PLACES = [
  { name: 'Sevilla', x: SEVILLA.x, z: SEVILLA.z },
  { name: 'Santo Domingo', x: HISPANIOLA.x, z: HISPANIOLA.z },
];

// returns { group, places, harbour } to add into the world group
export function buildWorld() {
  const group = new Group();
  const hisp = buildHispaniola();
  group.add(hisp.group);
  group.add(buildSevilla());
  return { group, places: PLACES, harbour: hisp.harbour };
}
