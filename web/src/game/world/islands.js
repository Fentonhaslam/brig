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

const BOW_GAP = 18;                                  // how far ahead of the bow the quay sits
const HARBOUR_LOCAL = new Vector3(0, 0, -72);        // Hispaniola quay front (island-local)
const SEVILLA_HARBOUR_LOCAL = new Vector3(0, 0, 38); // Sevilla quay front, on its sea (north) edge

function buildHispaniola() {
  const g = new Group();
  const B = makeBuilder();

  // landmass: a low island set well INLAND (centre at z=ZC) so its sandy shore
  // begins behind the harbour — the quay reaches out over the water in front of
  // it and the land rises beyond.
  const ZC = 75;
  B.ico(C.sand, 95, 1, 1, 0.08, 1, 0, 1.0, ZC);
  B.ico(C.grass, 72, 1, 1, 0.1, 1, 0, 3.0, ZC);
  B.cone(C.grass, 30, 14, -26, 8, ZC + 16, 6);
  B.cone(C.rock, 22, 18, 30, 10, ZC - 4, 6);

  for (let i = 0; i < 14; i++) { // palms round the shore
    const a = (i / 14) * Math.PI * 2;
    const x = Math.cos(a) * 70, z = ZC + Math.sin(a) * 70;
    B.cyl(C.trunk, 0.6, 0.9, 7, x, 5, z, 5);
    B.cone(C.leaf, 4.2, 3.6, x, 9.5, z, 6);
  }
  for (const [hx, hz] of [[10, 60], [18, 66], [2, 70], [24, 58], [-8, 66]]) { // town on the rise
    B.box(C.wall, 6, 5, 6, hx, 5.5, hz);
    B.cone(C.roof, 5.2, 4, hx, 10, hz, 4);
  }

  const harbour = buildHarbour(B, {
    local: HARBOUR_LOCAL, worldOrigin: HISPANIOLA, dir: 1, kind: 'keep', approachYaw: 0, name: 'Santo Domingo',
  });
  harbour.group = g;
  harbour.courtyard = { x: 0, y: 2.5, z: HARBOUR_LOCAL.z + 14 }; // lore stones, in front of the keep

  B.commit(g, [C.sand, C.grass, C.stone, C.wood]);
  g.position.copy(HISPANIOLA);
  return { group: g, harbour };
}

function buildSevilla() {
  const g = new Group();
  const B = makeBuilder();
  const D = 0x59607a; // city stone — readable up close, hazes to a silhouette far off

  // the grand skyline, set SOUTH (behind the walkable plaza you arrive at)
  B.box(D, 120, 12, 8, 0, 6, -52);
  for (let i = 0; i < 9; i++) B.box(D, 9, 12 + (i % 3) * 5, 9, -50 + i * 12, 9, -60);
  B.cyl(D, 7, 8, 34, -52, 17, -44, 12);     // Torre del Oro
  B.cyl(D, 4.5, 5, 14, -52, 41, -44, 12);
  B.box(D, 42, 46, 18, 24, 23, -62);        // cathedral mass
  B.box(D, 12, 80, 12, 40, 40, -56);        // Giralda shaft
  B.box(D, 8, 18, 8, 40, 88, -56);          // belfry
  B.cone(D, 5, 12, 40, 102, -56, 6);        // crown

  const harbour = buildHarbour(B, {
    local: SEVILLA_HARBOUR_LOCAL, worldOrigin: SEVILLA, dir: -1, kind: 'city', approachYaw: Math.PI, name: 'Sevilla',
  });
  harbour.group = g;

  B.commit(g, [C.wood, C.wall, C.stone]);
  g.position.copy(SEVILLA);
  return { group: g, harbour };
}

// ---------------------------------------------------------------------------
// A walkable harbour: a low quay (top at the ship's deck height) + a gangway +
// a landmark structure (Hispaniola's keep, or Sevilla's cathedral plaza). Built
// relative to `local` (the quay front, in the island group's frame); `dir`
// flips it front-to-back so each port faces the sea you approach from. Returns
// the world berth point, the approach heading, the door point and the collider
// offsets; main.js transforms those through the world matrix at berth time.
// ---------------------------------------------------------------------------
function buildHarbour(B, { local, worldOrigin, dir = 1, kind, approachYaw, name }) {
  const at = (dx, dy, dz) => [local.x + dx, local.y + dy, local.z + dz * dir];
  const colliders = [];
  const solid = (dx, dy, dz, hx, hy, hz, color) => {
    B.box(color, hx * 2, hy * 2, hz * 2, ...at(dx, dy, dz));
    colliders.push({ hx, hy, hz, dx, dy, dz: dz * dir });
  };

  // shared: quay deck + pilings + gangway with rails
  solid(0, 1.8, 22, 12, 0.6, 22, C.wood);
  for (const px of [-10, -5, 0, 5, 10]) B.cyl(C.wood, 0.5, 0.6, 4, ...at(px, -0.4, 1), 6);
  solid(0, 2.28, -2.5, 1.8, 0.12, 3.2, C.wood);
  B.box(C.wood, 0.16, 0.5, 6.4, ...at(-1.7, 2.6, -2.5));
  B.box(C.wood, 0.16, 0.5, 6.4, ...at(1.7, 2.6, -2.5));

  let door = { dx: 0, dy: 2.4, dz: 30 };
  if (kind === 'keep') {
    const ky = 5.0;
    solid(0, ky, 42, 9, 3.6, 0.6, C.stone);
    solid(-9, ky, 36, 0.6, 3.6, 6.5, C.stone);
    solid(9, ky, 36, 0.6, 3.6, 6.5, C.stone);
    solid(-5.5, ky, 30, 3.5, 3.6, 0.6, C.stone);
    solid(5.5, ky, 30, 3.5, 3.6, 0.6, C.stone);
    B.box(C.stone, 13, 1.4, 1.4, ...at(0, 9.0, 30));
    B.box(C.roof, 19, 1.0, 13.5, ...at(0, 9.4, 36));
    B.cyl(C.stone, 3.0, 3.4, 14, ...at(-11, 9.4, 42), 10);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.box(C.stone, 1, 1.4, 1, ...at(-11 + Math.cos(a) * 2.8, 16.6, 42 + Math.sin(a) * 2.8)); }
    B.box(C.cream, 0.35, 4, 0.35, ...at(0, 11, 31));
    B.box(C.red, 2.6, 1.6, 0.18, ...at(1.3, 11.8, 31));
  } else { // 'city' — a walkable plaza with flanking houses + a cathedral facade
    for (const sx of [-1, 1]) {
      solid(sx * 8.5, 3.0, 16, 3, 2.6, 4, C.wall);
      B.cone(C.roof, 4.6, 3.2, ...at(sx * 8.5, 7.6, 16), 4);
      solid(sx * 9, 3.0, 28, 3, 2.6, 3.5, C.wall);
      B.cone(C.roof, 4.4, 3.0, ...at(sx * 9, 7.4, 28), 4);
    }
    B.cyl(C.stone, 1.4, 1.6, 1.2, ...at(0, 3.0, 13), 8);   // a plaza well/cross
    B.box(C.cream, 0.4, 3.2, 0.4, ...at(0, 5.4, 13));
    B.box(C.cream, 1.8, 0.4, 0.4, ...at(0, 6.0, 13));
    const cy = 6.0;                                         // cathedral facade
    solid(0, cy, 42, 11, 5.0, 0.7, C.wall);
    solid(-11, cy, 35, 0.7, 5.0, 7, C.wall);
    solid(11, cy, 35, 0.7, 5.0, 7, C.wall);
    solid(-6, cy, 28, 4, 5.0, 0.7, C.wall);
    solid(6, cy, 28, 4, 5.0, 0.7, C.wall);
    B.box(C.stone, 16, 1.6, 1.6, ...at(0, 11.4, 28));
    B.box(C.roof, 24, 1.2, 15, ...at(0, 11.8, 36));
    B.box(C.stone, 5, 22, 5, ...at(-13, 11, 44));          // a bell tower
    B.cone(C.roof, 3.5, 5, ...at(-13, 24, 44), 4);
    door = { dx: 0, dy: 2.4, dz: 28 };
  }

  // shared: quayside clutter + lamp posts
  for (const [bx, bz] of [[-7, 8], [-6, 9.4], [7, 10], [6, 12]]) B.cyl(C.trunk, 0.5, 0.5, 1.1, ...at(bx, 2.95, bz), 8);
  for (const lz of [6, 24]) for (const lx of [-9.5, 9.5]) {
    B.cyl(C.trunk, 0.16, 0.2, 4.2, ...at(lx, 4.5, lz), 6);
    B.box(C.cream, 0.5, 0.6, 0.5, ...at(lx, 6.9, lz));
  }

  return {
    name, kind, bowGap: BOW_GAP, approachYaw,
    worldPoint: worldOrigin.clone().add(local),
    keepDoor: { dx: door.dx, dy: door.dy, dz: door.dz * dir },
    colliders,
  };
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

// returns { group, places, harbours } to add into the world group
export function buildWorld() {
  const group = new Group();
  const hisp = buildHispaniola();
  const sev = buildSevilla();
  group.add(hisp.group);
  group.add(sev.group);
  // Hispaniola first — its keep carries the lore courtyard
  return { group, places: PLACES, harbours: [hisp.harbour, sev.harbour] };
}
