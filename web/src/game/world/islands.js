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
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonMaterial, withOutline } from '../core/toon.js';
import { woodGrain, stone, mottle } from '../core/textures.js';
import { DECK_TOP, HULL_HALF_LEN } from './ship.js';

// per-colour bucket builder -> one merged mesh per material
function makeBuilder() {
  const buckets = new Map();
  const add = (hex, g) => { (buckets.get(hex) || buckets.set(hex, []).get(hex)).push(g); };
  return {
    box(hex, w, h, d, x, y, z) { const g = new BoxGeometry(w, h, d); g.translate(x, y, z); add(hex, g); },
    rbox(hex, w, h, d, x, y, z, r = 0.18) { const g = new RoundedBoxGeometry(w, h, d, 2, r); g.translate(x, y, z); add(hex, g); },
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
        const mesh = new Mesh(merged, toonMaterial(hex, texFor(hex)));
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
  earth: 0x9c7c4e, field: 0x8fa44a, olive: 0x5b7a3a, hedge: 0x4f6b34,
  river: 0x2f6d86,
};

// detail map per palette colour — stonework on masonry, grain on timber, a
// soft mottle on sand/grass (fresh texture per material so repeats are its own)
function texFor(hex) {
  switch (hex) {
    case C.stone: return { map: stone(3, 3) };
    case C.wall: return { map: stone(2, 2) };
    case C.rock: return { map: stone(3, 4) };
    case C.wood: return { map: woodGrain(2, 3) };
    case C.roof: return { map: woodGrain(2, 2) };
    case C.trunk: return { map: woodGrain(1, 3) };
    case C.sand: return { map: mottle(6, 6) };
    case C.grass: return { map: mottle(6, 6) };
    case C.earth: return { map: mottle(8, 8) };
    case C.field: return { map: mottle(8, 8) };
    case C.olive: return { map: mottle(2, 2) };
    case C.hedge: return { map: mottle(3, 3) };
    case C.leaf: return { map: mottle(2, 2) };
    default: return {};
  }
}

const BOW_GAP = HULL_HALF_LEN + 6;                   // quay sits clear of the (scaled) bow
const YLIFT = DECK_TOP - 2.4;                        // raise the quay to the scaled deck height
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
    B.rbox(C.wall, 6, 5, 6, hx, 5.5, hz, 0.3);
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

  // distant rooftops hazing into the sky beyond the city walls, for depth
  // (the real landmarks — Torre del Oro, Cathedral, Giralda — are walkable now)
  for (let i = 0; i < 18; i++) {
    B.box(D, 6 + (i % 3) * 2, 7 + (i % 4) * 4, 6, -58 + i * 7, 6, -60 - (i % 3) * 7);
  }

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
  const at = (dx, dy, dz) => [local.x + dx, local.y + dy + YLIFT, local.z + dz * dir];
  const colliders = [];
  const solid = (dx, dy, dz, hx, hy, hz, color) => {
    B.box(color, hx * 2, hy * 2, hz * 2, ...at(dx, dy, dz));
    colliders.push({ hx, hy, hz, dx, dy: dy + YLIFT, dz: dz * dir });
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
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.rbox(C.stone, 1, 1.4, 1, ...at(-11 + Math.cos(a) * 2.8, 16.6, 42 + Math.sin(a) * 2.8)); }
    B.box(C.cream, 0.35, 4, 0.35, ...at(0, 11, 31));
    B.box(C.red, 2.6, 1.6, 0.18, ...at(1.3, 11.8, 31));
  } else { // 'city' — a walkable district of 1519 Sevilla on the Guadalquivir
    const G = 2.4; // ground/deck level (pre-YLIFT)
    // cobbled ground from the quay back into the city (the streets you walk)
    solid(0, 1.78, 36, 30, 0.6, 37, C.stone);

    // --- walkable ground. Sevilla sits on the EAST bank of the Guadalquivir;
    // the ground is notched on the west for the river, while the campiña inland
    // is full-width (the river bends away west, off-map). Sits just below the
    // cobbles (autostep handles the lip) so the whole plot is walkable.
    solid(13, 1.68, 38, 43, 0.6, 42, C.earth);   // east bank: dx -30..56, dz -4..80
    solid(0, 1.68, 96, 56, 0.6, 18, C.earth);    // campiña inland: dx -56..56, dz 78..114
    // grass field patches + a dirt road running inland from the gate
    for (const [fx, fz] of [[-34, 92], [33, 96], [-22, 104], [24, 86]]) B.box(C.field, 22, 0.22, 17, ...at(fx, G + 0.12, fz));
    B.box(C.earth, 7.5, 0.26, 40, ...at(0, G + 0.14, 92));
    // an olive grove — trunks are solid so you weave between them
    const olive = (ox, oz) => {
      B.cyl(C.wood, 0.4, 0.55, 4.6, ...at(ox, G + 2.1, oz), 6);
      B.ico(C.olive, 2.6, 0, 1, 0.82, 1, ...at(ox, G + 5.2, oz));
      colliders.push({ hx: 0.6, hy: 2.4, hz: 0.6, dx: ox, dy: G + 2.4 + YLIFT, dz: oz * dir });
    };
    for (const [ox, oz] of [[-16, 84], [-23, 97], [-12, 105], [18, 82], [27, 95], [15, 106]]) olive(ox, oz);
    // bounding hedges — far edge, east side, and the campiña's west edge (the
    // river/Triana bound the rest of the west; the quay side stays open)
    solid(0, G + 1.4, 113, 56, 1.4, 0.9, C.hedge);
    solid(56, G + 1.4, 55, 0.9, 1.4, 59, C.hedge);
    solid(-56, G + 1.4, 96, 0.9, 1.4, 18, C.hedge);

    // a terracotta house (walls collide; roof is decorative)
    const house = (cx, cz, w, h, d) => {
      solid(cx, G + h / 2, cz, w / 2, h / 2, d / 2, C.wall);
      B.cone(C.roof, w * 0.62, h * 0.5, ...at(cx, G + h + h * 0.18, cz), 4);
    };
    // blocks of houses down both sides — central avenue + side streets stay clear
    for (const cz of [12, 23, 36, 48]) { house(-23, cz, 9, 5 + (cz % 3), 7); house(23, cz, 9, 5 + ((cz + 2) % 3), 7); }
    for (const cz of [16, 30, 44]) { house(-13, cz, 7, 5, 6); house(13, cz, 7, 6, 6); }

    // --- the Guadalquivir + Triana (the shipwrights' quarter, west bank) ---
    // sunken river channel (visual; the banks are walled so you cross by bridge)
    B.box(C.river, 16, 0.5, 98, ...at(-38, G - 0.8, 34));
    // stone embankments down both banks, with a gap at the bridge (dz 15..22)
    for (const bx of [-31, -45]) { solid(bx, G + 0.6, 1.5, 0.7, 0.9, 13.5, C.stone); solid(bx, G + 0.6, 51, 0.7, 0.9, 29, C.stone); }
    // the Puente de Barcas — a pontoon bridge you walk across into Triana
    solid(-38, 1.68, 18.5, 8, 0.6, 3.5, C.wood);
    for (const rz of [15, 22]) B.box(C.wood, 16, 0.6, 0.25, ...at(-38, G + 0.9, rz));
    for (let i = 0; i < 4; i++) B.cyl(C.wood, 0.7, 0.7, 1.4, ...at(-45 + i * 4.5, G - 0.5, 18.5), 6);
    // Triana ground (west bank) + a cobbled quay strip along the river
    solid(-66, 1.68, 31, 20, 0.6, 41, C.earth);
    solid(-50, 1.78, 31, 4, 0.6, 41, C.stone);
    // Triana bounds (west + the two ends)
    solid(-86, G + 1.4, 31, 0.9, 1.4, 41, C.hedge);
    for (const nz of [-10, 72]) solid(-66, G + 1.4, nz, 20, 1.4, 0.9, C.hedge);
    // sailors' houses
    house(-72, 50, 8, 5, 7); house(-60, 58, 8, 6, 7); house(-76, 20, 8, 5, 7); house(-64, 12, 7, 5, 6);
    // the Castillo de San Jorge by the bridgehead (Triana's old castle)
    solid(-55, G + 4, 30, 5, 4, 6, C.stone);
    for (const [tx, tz] of [[-60, 25], [-60, 35], [-50, 25], [-50, 35]]) B.cyl(C.stone, 1.5, 1.8, 10, ...at(tx, G + 5, tz), 8);
    // the shipwright's slipway + a half-built hull — your future skiff begins here
    solid(-60, G + 0.2, 44, 6, 0.3, 7, C.wood);
    B.box(C.wood, 1.1, 0.9, 11, ...at(-60, G + 1.3, 44));            // keel
    for (let i = -4; i <= 4; i += 2) B.box(C.wood, 4.4, 0.3, 0.4, ...at(-60, G + 2.0, 44 + i)); // ribs
    colliders.push({ hx: 2.4, hy: 1.2, hz: 6, dx: -60, dy: G + 1.4 + YLIFT, dz: 44 * dir });
    // a moored rowboat at the Triana quay
    B.box(C.wood, 2.2, 0.8, 5, ...at(-49, G - 0.2, 55));

    // Torre del Oro on the waterfront (the dodecagonal river watchtower)
    B.cyl(C.stone, 3.2, 3.6, 18, ...at(-25, G + 9, 7), 12);
    B.cyl(C.stone, 2.4, 2.8, 6, ...at(-25, G + 21, 7), 12);
    B.box(C.cream, 0.3, 3, 0.3, ...at(-25, G + 25.5, 7));
    colliders.push({ hx: 3.6, hy: 12, hz: 3.6, dx: -25, dy: G + 12 + YLIFT, dz: 7 * dir });

    // the great Cathedral + La Giralda — the landmark on the skyline
    const cz0 = 52;
    solid(0, G + 9, cz0, 13, 9, 11, C.wall);          // nave mass
    B.box(C.roof, 28, 2.2, 24, ...at(0, G + 19, cz0));
    B.box(C.stone, 7, 40, 7, ...at(13, G + 20, cz0 - 4));   // Giralda shaft
    B.box(C.stone, 5, 10, 5, ...at(13, G + 45, cz0 - 4));   // belfry
    B.cone(C.roof, 3.6, 6, ...at(13, G + 53, cz0 - 4), 4);
    B.box(C.cream, 0.35, 3.5, 0.35, ...at(13, G + 57, cz0 - 4)); // weather-vane
    colliders.push({ hx: 3.5, hy: 22, hz: 3.5, dx: 13, dy: G + 20 + YLIFT, dz: (cz0 - 4) * dir });

    // the Alcázar — a walled palace to the east, with corner towers
    solid(27, G + 3.5, 44, 0.8, 3.5, 9, C.wall);
    solid(27, G + 3.5, 62, 0.8, 3.5, 9, C.wall);
    solid(22, G + 3.5, 67, 6, 3.5, 0.8, C.wall);
    for (const [tx, tz] of [[27, 36], [27, 70], [34, 53]]) B.cyl(C.stone, 1.8, 2.2, 11, ...at(tx, G + 5.5, tz), 8);

    // the outer city wall + a central gate, merlons along the top
    const wz = 72;
    solid(-17, G + 4, wz, 13, 4, 0.9, C.stone);
    solid(17, G + 4, wz, 13, 4, 0.9, C.stone);
    B.box(C.stone, 10, 2, 1.8, ...at(0, G + 9, wz)); // gate arch
    for (let i = -29; i <= 29; i += 3.6) B.rbox(C.stone, 1.1, 1.3, 1.1, ...at(i, G + 8.3, wz));

    // a plaza cross + market stall in the square before the cathedral
    B.cyl(C.stone, 1.6, 1.9, 0.8, ...at(0, G + 0.4, 32), 8);
    B.box(C.cream, 0.4, 3.2, 0.4, ...at(0, G + 2.4, 32));
    B.box(C.cream, 1.6, 0.4, 0.4, ...at(0, G + 3.4, 32));

    door = { dx: 0, dy: 2.4, dz: cz0 - 14 };
  }

  // shared: quayside clutter + lamp posts
  for (const [bx, bz] of [[-7, 8], [-6, 9.4], [7, 10], [6, 12]]) B.cyl(C.trunk, 0.5, 0.5, 1.1, ...at(bx, 2.95, bz), 8);
  for (const lz of [6, 24]) for (const lx of [-9.5, 9.5]) {
    B.cyl(C.trunk, 0.16, 0.2, 4.2, ...at(lx, 4.5, lz), 6);
    B.box(C.cream, 0.5, 0.6, 0.5, ...at(lx, 6.9, lz));
  }

  return {
    name, kind, bowGap: BOW_GAP, approachYaw, dir,
    worldPoint: worldOrigin.clone().add(local),
    keepDoor: { dx: door.dx, dy: door.dy + YLIFT, dz: door.dz * dir },
    walkY: 2.4 + YLIFT, // top of the quay/cobbles, relative to worldPoint — where folk stand
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
