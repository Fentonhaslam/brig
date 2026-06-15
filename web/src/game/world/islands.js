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

  // landmass: a low sandy dome with a green crown + a couple of hills
  B.ico(C.sand, 90, 1, 1, 0.16, 1, 0, 1, 0);
  B.ico(C.grass, 70, 1, 1, 0.2, 1, 0, 6, 0);
  B.cone(C.grass, 34, 30, -22, 18, 14, 6);
  B.cone(C.rock, 24, 40, 26, 22, -18, 6);

  // palms round the shore
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = Math.cos(a) * 66, z = Math.sin(a) * 66;
    B.cyl(C.trunk, 0.6, 0.9, 9, x, 9, z, 5);
    B.cone(C.leaf, 4.8, 4.2, x, 15, z, 6);
  }

  // a little port town: scattered cottages with pitched roofs
  for (const [hx, hz] of [[8, 40], [16, 44], [2, 46], [22, 38], [-6, 44]]) {
    B.box(C.wall, 6, 5, 6, hx, 9.5, hz);
    B.cone(C.roof, 5.2, 4, hx, 14, hz, 4);
  }

  // timber dock reaching into the water
  for (let i = 0; i < 9; i++) B.box(C.wood, 7, 1, 5, 0, 7.4, 56 + i * 5.5);
  for (let i = 0; i < 10; i++) { const z = 56 + i * 5; B.box(C.wood, 0.6, 4, 0.6, -3, 5, z); B.box(C.wood, 0.6, 4, 0.6, 3, 5, z); }

  // THE KEEP — hall + crenellated tower flying the colours
  const kx = -34, kz = 30;
  B.box(C.stone, 20, 14, 16, kx, 14, kz);                    // hall
  B.box(C.wood, 4, 7, 1, kx, 10.5, kz + 8.2);                // great doorway
  B.cyl(C.stone, 5.4, 5.8, 26, kx - 12, 20, kz, 10);         // tower
  for (let i = 0; i < 8; i++) {                              // crenellations
    const a = (i / 8) * Math.PI * 2;
    B.box(C.stone, 1.4, 2, 1.4, kx - 12 + Math.cos(a) * 5, 33.5, kz + Math.sin(a) * 5);
  }
  B.box(C.cream, 0.4, 5, 0.4, kx - 12, 39, kz);              // flagpole
  B.box(C.red, 3, 2, 0.2, kx - 10.6, 37.5, kz);              // banner

  B.commit(g, [C.sand, C.grass, C.stone, C.wood]);
  g.position.copy(HISPANIOLA); // far across the ocean — out of sight until you near it
  return g;
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

// returns { group, places } to add into the world group
export function buildWorld() {
  const group = new Group();
  group.add(buildHispaniola());
  group.add(buildSevilla());
  return { group, places: PLACES };
}
