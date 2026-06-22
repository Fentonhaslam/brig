// The world beyond the rail — built once and parented to the world group, which
// counter-transforms against the ship so it slides and turns past you as you
// sail. Two pieces:
//
//   * Las Verdías, dead ahead: a low-poly island with a beach, hills, palms, a
//     timber dock, a little port town and the keep (the lore archive from the
//     old build) flying the Cross of Burgundy.
//   * Valdara, astern: a dark skyline silhouette — the Mirabela, the cathedral,
//     the Torre Dorada and the city walls — the port you're departing.
//
// Everything is merged per material into a handful of draw calls, same strategy
// as the ship.

import {
  Group, Mesh, Vector3, BoxGeometry, CylinderGeometry, ConeGeometry,
  IcosahedronGeometry, BufferGeometry, Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { withOutline } from '../core/toon.js';
import { surfaceMaterial } from '../core/materials.js';
import { makeKit } from './kit.js';
import { buildTerrain, fbm, smooth, distToPath } from './terrain.js';
import { addGrass, addBarrels, addCrates } from './scatter.js';
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
    // A proper hipped roof sized to the footprint: the eave line is a (w+2·eave)
    // by (d+2·eave) rectangle at y=0, rising to a ridge along the LONGER span at
    // y=rise. The four eaves therefore sit square over the building's corners
    // (a 4-segment cone could only make a 45°-rotated diamond — the old bug).
    // A square footprint degenerates cleanly to a centred pyramid.
    roof(hex, w, d, rise, eave, x, y, z) {
      const hx = w / 2 + eave, hz = d / 2 + eave;
      const P = [], UV = [];
      // tile-tex UVs from the horizontal projection so terracotta tiles across
      const tri = (a, b, c) => { for (const v of [a, b, c]) { P.push(...v); UV.push(v[0] * 0.4, v[2] * 0.4); } };
      const A = [-hx, 0, hz], Bc = [hx, 0, hz], Cc = [hx, 0, -hz], Dc = [-hx, 0, -hz];
      if (hx >= hz) {                       // ridge runs along X
        const r = hx - hz, R0 = [-r, rise, 0], R1 = [r, rise, 0];
        tri(A, Bc, R1); tri(A, R1, R0);     // front slope (+z)
        tri(Cc, Dc, R0); tri(Cc, R0, R1);   // back slope (-z)
        tri(Bc, Cc, R1);                    // right hip (+x)
        tri(Dc, A, R0);                     // left hip (-x)
      } else {                              // ridge runs along Z
        const r = hz - hx, R0 = [0, rise, -r], R1 = [0, rise, r];
        tri(Bc, Cc, R0); tri(Bc, R0, R1);   // right slope (+x)
        tri(Dc, A, R1); tri(Dc, R1, R0);    // left slope (-x)
        tri(A, Bc, R1);                     // front hip (+z)
        tri(Cc, Dc, R0);                    // back hip (-z)
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new Float32BufferAttribute(UV, 2));
      g.computeVertexNormals();
      g.translate(x, y, z);
      add(hex, g);
    },
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
        const mesh = new Mesh(merged, surfaceMaterial(hex, kindFor(hex)));
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
  // plaster tones for per-house variation (whitewash, ochre, sand, faded rose)
  plasterA: 0xe4d9c2, plasterB: 0xcdb079, plasterC: 0xd8c79c, plasterD: 0xceb4a0,
  // a second terracotta for roof variety + ironwork for balconies/rails
  roof2: 0x9c5a34, iron: 0x2b2620,
  earth: 0x9c7c4e, field: 0x8fa44a, olive: 0x5b7a3a, hedge: 0x4f6b34,
  river: 0x2f6d86,
};

// map each palette colour to a PBR surface kind (materials.js) — masonry, lime
// plaster, timber, terracotta tile, earth/foliage, water, metal
function kindFor(hex) {
  switch (hex) {
    case C.stone: case C.rock: return 'stone';
    case C.wall: case C.cream:
    case C.plasterA: case C.plasterB: case C.plasterC: case C.plasterD: return 'wall';
    case C.wood: case C.trunk: return 'wood';
    case C.iron: return 'metal';
    case C.roof: case C.red: case C.roof2: return 'roof';
    case C.sand: case C.earth: case C.grass: case C.field:
    case C.olive: case C.leaf: case C.hedge: return 'ground';
    case C.river: return 'water';
    default: return 'none';
  }
}

// --- characterful natural assets (shared) ----------------------------------
// These replace the old "trunk + one ball" / "single box" props that read as
// fake. Each is a small cluster of varied primitives, built straight into the
// merge buckets (so still cheap). Callers pass an absolute base (x, y=ground, z)
// — spread an at(...) for the lifted harbour space, or raw coords on the island.

// a broadleaf tree: tapered trunk + three overlapping canopy blobs (varied
// size, tone and offset) so the crown reads as foliage rather than a single ball
function broadleaf(B, x, y, z, h) {
  B.cyl(C.trunk, h * 0.05, h * 0.1, h, x, y + h / 2, z, 6);
  const cy = y + h + h * 0.1;
  B.ico(C.hedge, h * 0.44, 0, 1.05, 0.92, 1, x, cy, z);
  B.ico(C.leaf, h * 0.34, 0, 1, 0.9, 1, x + h * 0.2, cy + h * 0.14, z - h * 0.12);
  B.ico(C.olive, h * 0.3, 0, 1, 0.96, 1.06, x - h * 0.18, cy + h * 0.05, z + h * 0.14);
}
// a conifer: tapered trunk + three stacked tiers, darker low and lighter up top
function conifer(B, x, y, z, h) {
  B.cyl(C.trunk, h * 0.04, h * 0.07, h * 0.45, x, y + h * 0.22, z, 6);
  B.cone(C.hedge, h * 0.34, h * 0.42, x, y + h * 0.42, z, 7);
  B.cone(C.leaf, h * 0.27, h * 0.36, x, y + h * 0.66, z, 7);
  B.cone(C.leaf, h * 0.19, h * 0.32, x, y + h * 0.9, z, 7);
}
// an irregular boulder — an angular icosahedron squashed non-uniformly and half
// sunk, optionally with a smaller companion rock, to break up straight shores
function boulder(B, x, y, z, r, seed = 0) {
  const sx = 0.8 + (seed % 3) * 0.16, sz = 0.82 + ((seed >> 1) % 3) * 0.15;
  B.ico(C.rock, r, 0, sx, 0.72, sz, x, y, z);
  if (seed % 2) B.ico(C.rock, r * 0.6, 0, 1, 0.7, 1, x + r * 0.5, y - r * 0.18, z - r * 0.3);
}

// per-active-vessel (set in buildWorld): the quay/world lifts to the vessel's
// deck height so you can berth + walk ashore from whatever boat you sail
let BOW_GAP = HULL_HALF_LEN + 6;                     // quay sits clear of the bow
let YLIFT = DECK_TOP - 2.4;                          // quay top = vessel deck height
const HARBOUR_LOCAL = new Vector3(0, 0, -72);        // Las Verdías quay front (island-local)
const SEVILLA_HARBOUR_LOCAL = new Vector3(0, 0, 38); // Valdara quay front, on its sea (north) edge
const SANLUCAR_LOCAL = new Vector3(0, 0, -30);       // Bocamar quay front, at the river mouth

function buildVerdias() {
  const g = new Group();
  const B = makeBuilder();

  // the continental shore as a HEIGHTFIELD, not flat boxes: a sloping beach, a
  // rolling forested interior and a real snow-capped sierra deep inland, all one
  // vertex-coloured mesh. Props are seated on it via heightAt so nothing floats.
  // (Stylised buildings/people; believable land — the "semi-realistic" target.)
  const PD_PEAKS = [[-360, 980, 90, 260], [-130, 1120, 120, 300], [110, 1020, 105, 260],
    [360, 1160, 110, 280], [-560, 1040, 80, 240], [560, 1000, 85, 240], [-30, 1320, 150, 330]];
  const pdHeight = (x, z) => {
    const shore = -50;
    let h;
    if (z < shore) h = -5 + (z + 260) / (shore + 260) * 6.2;           // seabed -> beach
    else h = 1.2 + fbm(x, z) * (2 + Math.min((z - shore) / 120, 1) * 10) + (z - shore) * 0.006;
    for (const [mx, mz, mh, mr] of PD_PEAKS) { const d = Math.hypot(x - mx, z - mz); if (d < mr) h += mh * smooth(1 - d / mr); }
    // flatten a coastal plateau under the harbour + colony so they sit level
    const t = smooth((Math.hypot(x, z - 10) - 70) / 70);
    return 2.4 * (1 - t) + h * t;
  };
  const pdColor = (x, z, y) => {
    if (y < 1.1) return 0xe3cf94;                                       // sand
    if (y > 96) return 0xeef1f4;                                        // snow
    if (y > 54) return 0x6b6256;                                        // bare rock
    const v = fbm(x * 1.4 + 5, z * 1.4 - 3);
    if (y > 28 && v > 0.25) return 0x6b6256;                            // rocky highland
    return v > 0 ? 0x6fae44 : 0x5d9a3b;                                 // two grass tones
  };
  const { mesh: pdLand, heightAt: pdH } = buildTerrain({
    width: 1500, depth: 1700, segX: 150, segZ: 168, center: { x: 0, z: 550 }, height: pdHeight, colorAt: pdColor,
  });
  g.add(pdLand);
  // forest belt — tiered conifers, seated on the rolling terrain
  for (let i = 0; i < 64; i++) { const cx = -420 + (i * 73) % 840, cz = 120 + ((i * 137) % 640); conifer(B, cx, pdH(cx, cz), cz, 14 + (i % 5) * 3); }
  // boulders along the shore, half-sunk into the sand
  for (let i = 0; i < 22; i++) { const x = -320 + (i * 41) % 660, z = -22 + ((i * 53) % 70); boulder(B, x, pdH(x, z) - 0.3, z, 2 + (i % 3) * 0.8, i); }
  // palms framing the colony
  for (let i = 0; i < 24; i++) {
    const x = -276 + i * 24, z = 22 + Math.sin(i * 1.3) * 6, b = pdH(x, z);
    B.cyl(C.trunk, 0.6, 0.9, 7, x, b + 3.5, z, 5);
    B.cone(C.leaf, 4.2, 3.6, x, b + 8, z, 6);
  }
  // the colonial town, seated on the coastal plateau
  for (const [hx, hz] of [[10, 56], [22, 62], [2, 70], [26, 54], [-10, 64], [-22, 58], [14, 76], [-4, 82]]) {
    const b = pdH(hx, hz);
    B.rbox(C.wall, 6, 5, 6, hx, b + 2.5, hz, 0.3);
    B.roof(C.roof, 6, 6, 2.8, 0.5, hx, b + 5.1, hz);
  }

  const harbour = buildHarbour(B, {
    local: HARBOUR_LOCAL, worldOrigin: HISPANIOLA, dir: 1, kind: 'keep', approachYaw: 0, name: 'Puerto Dorado',
  });
  harbour.group = g;
  harbour.courtyard = { x: 0, y: 2.5, z: HARBOUR_LOCAL.z + 14 }; // lore stones, in front of the keep

  B.commit(g, [C.sand, C.grass, C.stone, C.wood]);
  g.position.copy(HISPANIOLA);
  return { group: g, harbour };
}

function buildValdara() {
  const g = new Group();
  const B = makeBuilder();
  const D = 0x59607a; // city stone — readable up close, hazes to a silhouette far off

  // distant rooftops hazing into the sky beyond the city walls, for depth
  // (the real landmarks — Torre Dorada, Cathedral, Mirabela — are walkable now)
  for (let i = 0; i < 18; i++) {
    B.box(D, 6 + (i % 3) * 2, 7 + (i % 4) * 4, 6, -58 + i * 7, 6, -60 - (i % 3) * 7);
  }

  const harbour = buildHarbour(B, {
    local: SEVILLA_HARBOUR_LOCAL, worldOrigin: SEVILLA, dir: -1, kind: 'city', approachYaw: Math.PI, name: 'Valdara',
  });
  harbour.group = g;
  for (const m of harbour.meshes) g.add(m); // heightfield terrain etc.

  B.commit(g, [C.wood, C.wall, C.stone]);

  // instanced ground detail — a swaying grass field across the campiña + clutter
  // on the quays (group-local space: x=local.x+dx, y=walkY, z=local.z+dz*dir)
  const loc = (dx, dz) => ({ x: SEVILLA_HARBOUR_LOCAL.x + dx, y: harbour.walkY, z: SEVILLA_HARBOUR_LOCAL.z + dz * -1 });
  const grass = [];
  for (let i = 0; i < 320; i++) {
    const dx = -52 + Math.random() * 104, dz = 78 + Math.random() * 34;
    grass.push({ ...loc(dx, dz), ry: Math.random() * 6.28, s: 0.7 + Math.random() * 0.7, sy: 0.8 + Math.random() * 0.7 });
  }
  addGrass(g, grass);
  const barrels = [[-9, 8], [-8, 12], [9, 9], [8, 14], [-50, 24], [-49, 30], [-51, 40], [16, 9], [18, 15]]
    .map(([bx, bz]) => ({ ...loc(bx, bz), ry: Math.random() * 6.28, s: 0.9 + Math.random() * 0.3 }));
  addBarrels(g, barrels);
  const crates = [[-7, 16], [7, 18], [-48, 46], [14, 21], [-6, 17]]
    .map(([cx, cz]) => ({ ...loc(cx, cz), ry: Math.random() * 6.28, s: 0.8 + Math.random() * 0.3 }));
  addCrates(g, crates);

  g.position.copy(SEVILLA);
  return { group: g, harbour };
}

function buildSanlucar() {
  const g = new Group();
  const B = makeBuilder();
  const harbour = buildHarbour(B, {
    local: SANLUCAR_LOCAL, worldOrigin: SANLUCAR, dir: 1, kind: 'port', approachYaw: 0, name: 'Bocamar',
  });
  harbour.group = g;
  B.commit(g, [C.wood, C.wall, C.stone]);
  g.position.copy(SANLUCAR);
  return { group: g, harbour };
}

// ---------------------------------------------------------------------------
// A walkable harbour: a low quay (top at the ship's deck height) + a gangway +
// a landmark structure (Las Verdías's keep, or Valdara's cathedral plaza). Built
// relative to `local` (the quay front, in the island group's frame); `dir`
// flips it front-to-back so each port faces the sea you approach from. Returns
// the world berth point, the approach heading, the door point and the collider
// offsets; main.js transforms those through the world matrix at berth time.
// ---------------------------------------------------------------------------
function buildHarbour(B, { local, worldOrigin, dir = 1, kind, approachYaw, name }) {
  const at = (dx, dy, dz) => [local.x + dx, local.y + dy + YLIFT, local.z + dz * dir];
  const colliders = [];
  const meshes = []; // non-merged meshes (e.g. the heightfield terrain) for the caller to add
  const solid = (dx, dy, dz, hx, hy, hz, color) => {
    B.box(color, hx * 2, hy * 2, hz * 2, ...at(dx, dy, dz));
    colliders.push({ hx, hy, hz, dx, dy: dy + YLIFT, dz: dz * dir });
  };
  const G = 2.4; // ground/deck level (pre-YLIFT), shared by the land branches
  // detailed townhouses from the modular kit (inset windows/shutters/sills, eave,
  // hipped/gabled tiled roof, chimney) — same single wall collider as before, so
  // the walkable streets line up exactly
  const { house } = makeKit({ B, at, solid, colliders, C, G, dir, YLIFT });

  // shared: quay deck + pilings + gangway with rails
  solid(0, 1.8, 22, 12, 0.6, 22, C.wood);
  for (const px of [-10, -5, 0, 5, 10]) B.cyl(C.wood, 0.5, 0.6, 4, ...at(px, -0.4, 1), 6);
  // gangway: thin visual, but physics collider is thick so the player capsule
  // can't tunnel through it when running onto the plank at speed
  B.box(C.wood, 3.6, 0.24, 6.4, ...at(0, 2.28, -2.5));
  colliders.push({ hx: 1.8, hy: 0.6, hz: 3.2, dx: 0, dy: 1.9 + YLIFT, dz: -2.5 * dir });
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

    // --- Puerto Dorado life: palms, colony supplies, torches, a well ---
    const palm = (px, pz) => {
      B.cyl(C.trunk, 0.45, 0.7, 6, ...at(px, G + 3, pz), 6);
      B.cone(C.leaf, 3.4, 3.0, ...at(px, G + 7.5, pz), 7);
      colliders.push({ hx: 0.7, hy: 3, hz: 0.7, dx: px, dy: G + 3 + YLIFT, dz: pz * dir });
    };
    for (const [px, pz] of [[-11, 26], [11, 26], [-11, 16], [11, 16]]) palm(px, pz);
    // colony supplies stacked by the quay (the settlement still half-built)
    for (const [cx, cz] of [[-7, 12], [-6, 14], [7, 13], [8, 11]]) B.box(C.wood, 1.2, 1.2, 1.2, ...at(cx, G + 0.6, cz));
    for (const [bx, bz] of [[-9, 16], [9, 17]]) B.cyl(C.wood, 0.7, 0.8, 1.5, ...at(bx, G + 0.75, bz), 8);
    // torches flanking the keep door
    for (const tx of [-3.5, 3.5]) { B.cyl(C.trunk, 0.12, 0.16, 2.6, ...at(tx, G + 1.3, 30), 6); B.box(0xd9742a, 0.32, 0.4, 0.32, ...at(tx, G + 2.8, 30)); }
    // a well in the courtyard
    B.cyl(C.stone, 0.9, 1.1, 1.4, ...at(0, G + 0.7, 22), 10);
    colliders.push({ hx: 1.0, hy: 0.8, hz: 1.0, dx: 0, dy: G + 0.8 + YLIFT, dz: 22 * dir });
  } else if (kind === 'city') { // a walkable district of 1519 Valdara on the Mansera
    // cobbled ground from the quay back into the city (the streets you walk)
    solid(0, 1.78, 36, 30, 0.6, 37, C.stone);

    // --- walkable ground. Valdara sits on the EAST bank of the Mansera;
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
      broadleaf(B, ...at(ox, G, oz), 5);
      colliders.push({ hx: 0.6, hy: 2.4, hz: 0.6, dx: ox, dy: G + 2.4 + YLIFT, dz: oz * dir });
    };
    for (const [ox, oz] of [[-16, 84], [-23, 97], [-12, 105], [18, 82], [27, 95], [15, 106]]) olive(ox, oz);
    // bounding hedges — east side + the campiña's west edge (the river/Ribalta
    // bound the rest of the west; the quay side stays open). The inland/far edge
    // is now far north, past the farmland — see the hinterland block below.
    solid(56, G + 1.4, 55, 0.9, 1.4, 59, C.hedge);
    solid(-56, G + 1.4, 96, 0.9, 1.4, 18, C.hedge);

    // blocks of houses down both sides — central avenue + side streets stay clear
    for (const cz of [12, 23, 36, 48]) { house(-23, cz, 9, 5 + (cz % 3), 7); house(23, cz, 9, 5 + ((cz + 2) % 3), 7); }
    for (const cz of [16, 30, 44]) { house(-13, cz, 7, 5, 6); house(13, cz, 7, 6, 6); }

    // --- the Mansera + Ribalta (the shipwrights' quarter, west bank) ---
    // sunken river channel (visual; the banks are walled so you cross by bridge)
    B.box(C.river, 16, 0.5, 98, ...at(-38, G - 0.8, 34));
    // boulders along the seaward plaza edge + the riverbanks (break the edges)
    for (let i = 0; i < 8; i++) boulder(B, ...at(-26 + (i * 8) % 56, G - 0.2, -3 + (i * 3) % 9), 1.5 + (i % 3) * 0.5, i);
    for (let i = 0; i < 6; i++) boulder(B, ...at(-29, G - 0.3, 6 + i * 14), 1.4 + (i % 2), i + 3);

    // --- the Mansera traced to its source ---------------------------------
    // The river isn't a stub: it comes down out of the sierra, winds past the
    // inland village and through the farmland, then meets the walled city
    // channel here at the quay — one continuous watercourse, mountains to sea.
    // A meander of axis-aligned segments (each waypoint moves in only one axis),
    // raised slightly so the ribbon reads over the plains; collided only in the
    // walkable stretch so you can't walk on the water there.
    const riverPath = [[-38, 83], [-38, 200], [-30, 200], [-30, 300], [-32, 300],
      [-32, 460], [-10, 460], [-10, 620], [15, 620], [15, 800], [45, 800], [45, 1020]];
    // The inland terrain height — shared by the river carve here AND the
    // heightfield backdrop further down. Design space (dx, dz inland). Flat over
    // the walkable town/farm belt (so the cobbles/earth boxes sit on level
    // ground), then rolling hills and a snow-capped sierra, with the Mansera's
    // own valley carved in past the farmland.
    const VAL_PEAKS = [[-200, 1000, 90, 260], [70, 1080, 115, 300], [-380, 1040, 75, 260],
      [320, 1140, 100, 280], [40, 860, 62, 230]];
    const valHeight = (dx, dz) => {
      const flat = 1 - smooth((dz - 330) / 130);
      const inland = Math.max(0, dz - 330);
      let h = 1.6 * flat + (2.4 + fbm(dx, dz) * (2 + Math.min(inland / 240, 1) * 11) + inland * 0.006) * (1 - flat);
      for (const [mx, mz, mh, mr] of VAL_PEAKS) { const d = Math.hypot(dx - mx, dz - mz); if (d < mr) h += mh * smooth(1 - d / mr); }
      h -= 4.5 * smooth(1 - distToPath(dx, dz, riverPath) / 24) * smooth((dz - 360) / 90); // carve the valley
      return h;
    };
    const valColor = (x, z, y) => {
      if (y > 92) return 0xeef1f4;                          // snow
      if (y > 50) return 0x6b6256;                          // bare rock
      const v = fbm(x * 1.4 + 5, z * 1.4 - 3);
      if (y > 26 && v > 0.25) return 0x6b6256;              // rocky highland
      return v > 0 ? 0x6fae44 : 0x5d9a3b;                   // two grass tones
    };
    const RWID = 13;
    for (let i = 0; i < riverPath.length - 1; i++) {
      const [x1, z1] = riverPath[i], [x2, z2] = riverPath[i + 1];
      let cx, cz, w, d;
      if (x1 === x2) { cx = x1; cz = (z1 + z2) / 2; w = RWID; d = Math.abs(z2 - z1) + RWID; }
      else { cz = z1; cx = (x1 + x2) / 2; d = RWID; w = Math.abs(x2 - x1) + RWID; }
      // walkable stretch: water at grade. backdrop stretch: water tracks the
      // carved valley floor in the terrain so it sits IN the land, not on it.
      const backdrop = Math.min(z1, z2) >= 235;
      B.box(C.river, w, 0.6, d, ...at(cx, backdrop ? valHeight(cx, cz) + 0.3 : G - 0.4, cz));
      if (!backdrop) colliders.push({ hx: w / 2, hy: 1.2, hz: d / 2, dx: cx, dy: G + 0.3 + YLIFT, dz: cz * dir });
      // rocky banks down both sides, seated on the ground (terrain in backdrop)
      const steps = Math.max(1, Math.floor(Math.hypot(x2 - x1, z2 - z1) / 24));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, side = s % 2 ? 1 : -1, off = RWID / 2 + 1.4;
        const bx = x1 === x2 ? x + side * off : x, bz = x1 === x2 ? z : z + side * off;
        boulder(B, ...at(bx, bz >= 235 ? valHeight(bx, bz) - 0.3 : G - 0.5, bz), 1.2 + (s % 2) * 0.4, s + i);
      }
    }
    // stone embankments down both banks, with a gap at the bridge (dz 15..22)
    for (const bx of [-31, -45]) { solid(bx, G + 0.6, 1.5, 0.7, 0.9, 13.5, C.stone); solid(bx, G + 0.6, 51, 0.7, 0.9, 29, C.stone); }
    // the Puente Viejo — a pontoon bridge you walk across into Ribalta
    solid(-38, 1.68, 18.5, 8, 0.6, 3.5, C.wood);
    for (const rz of [15, 22]) B.box(C.wood, 16, 0.6, 0.25, ...at(-38, G + 0.9, rz));
    for (let i = 0; i < 4; i++) B.cyl(C.wood, 0.7, 0.7, 1.4, ...at(-45 + i * 4.5, G - 0.5, 18.5), 6);
    // Ribalta ground (west bank) + a cobbled quay strip along the river
    solid(-66, 1.68, 31, 20, 0.6, 41, C.earth);
    solid(-50, 1.78, 31, 4, 0.6, 41, C.stone);
    // Ribalta bounds (west + the two ends)
    solid(-86, G + 1.4, 31, 0.9, 1.4, 41, C.hedge);
    for (const nz of [-10, 72]) solid(-66, G + 1.4, nz, 20, 1.4, 0.9, C.hedge);
    // sailors' houses
    house(-72, 50, 8, 5, 7); house(-60, 58, 8, 6, 7); house(-76, 20, 8, 5, 7); house(-64, 12, 7, 5, 6);
    // the Castillo de Ribalta by the bridgehead (Ribalta's old castle)
    solid(-55, G + 4, 30, 5, 4, 6, C.stone);
    for (const [tx, tz] of [[-60, 25], [-60, 35], [-50, 25], [-50, 35]]) B.cyl(C.stone, 1.5, 1.8, 10, ...at(tx, G + 5, tz), 8);
    // the shipwright's slipway + a half-built hull — your future skiff begins here
    solid(-60, G + 0.2, 44, 6, 0.3, 7, C.wood);
    B.box(C.wood, 1.1, 0.9, 11, ...at(-60, G + 1.3, 44));            // keel
    for (let i = -4; i <= 4; i += 2) B.box(C.wood, 4.4, 0.3, 0.4, ...at(-60, G + 2.0, 44 + i)); // ribs
    colliders.push({ hx: 2.4, hy: 1.2, hz: 6, dx: -60, dy: G + 1.4 + YLIFT, dz: 44 * dir });
    // a moored rowboat at the Ribalta quay
    B.box(C.wood, 2.2, 0.8, 5, ...at(-49, G - 0.2, 55));

    // --- the campiña fleshed out: a timber wood, a cortijo (farm), a chapel ---
    // a stand of woodland on the west of the road — the timber you'll fell later;
    // trunks are solid so you move between them
    const tree = (tx, tz, h) => {
      broadleaf(B, ...at(tx, G, tz), h);
      colliders.push({ hx: 0.9, hy: h / 2, hz: 0.9, dx: tx, dy: G + h / 2 + YLIFT, dz: tz * dir });
    };
    for (const [tx, tz, h] of [[-46, 86, 8], [-39, 92, 9], [-50, 99, 7], [-42, 105, 8], [-33, 101, 9], [-48, 109, 7], [-36, 110, 8]]) tree(tx, tz, h);

    // the cortijo (a walled Andalusian farmstead) east of the road
    house(46, 92, 11, 6, 9);                                  // farmhouse
    solid(46, G + 2.5, 105, 4, 2.5, 3, C.wall);               // barn
    B.roof(C.roof, 8, 6, 2.6, 0.4, ...at(46, G + 5.1, 105));  // hipped, square over the barn
    solid(33, G + 1, 98, 0.5, 1, 12, C.wall);                 // west yard wall (gate gap to the south)
    solid(45, G + 1, 110, 12, 1, 0.5, C.wall);                // north yard wall
    B.cyl(C.stone, 1.1, 1.3, 1.6, ...at(40, G + 0.8, 100), 8); // well
    for (const [sx, sz] of [[37, 96], [41, 99], [35, 102]]) B.ico(C.cream, 0.95, 0, 1.35, 0.9, 1, ...at(sx, G + 0.95, sz)); // sheep

    // a roadside chapel (ermita) with a bell-gable + cross
    solid(11, G + 2.5, 103, 3, 2.5, 4, C.wall);
    B.box(C.roof, 7.6, 1.2, 9.6, ...at(11, G + 5.4, 103));
    B.box(C.wall, 4, 2.6, 0.5, ...at(11, G + 6.2, 99));        // bell-gable
    B.box(C.cream, 0.3, 1.9, 0.3, ...at(11, G + 8.1, 99));     // cross upright
    B.box(C.cream, 1.1, 0.3, 0.3, ...at(11, G + 7.7, 99));     // cross arm
    colliders.push({ hx: 3, hy: 2.5, hz: 4, dx: 11, dy: G + 2.5 + YLIFT, dz: 103 * dir });

    // a cart on the road + a couple of haystacks
    B.box(C.wood, 3, 1, 2, ...at(3, G + 1.2, 86));
    for (const wz of [-1, 1]) B.cyl(C.wood, 0.8, 0.8, 0.3, ...at(1.4, G + 0.8, 86 + wz * 0.9), 8);
    for (const [hx, hz] of [[-7, 100], [6, 109]]) B.ico(C.field, 2.2, 0, 1, 0.85, 1, ...at(hx, G + 1.4, hz));

    // Torre Dorada on the waterfront (the dodecagonal river watchtower)
    B.cyl(C.stone, 3.2, 3.6, 18, ...at(-25, G + 9, 7), 12);
    B.cyl(C.stone, 2.4, 2.8, 6, ...at(-25, G + 21, 7), 12);
    B.box(C.cream, 0.3, 3, 0.3, ...at(-25, G + 25.5, 7));
    colliders.push({ hx: 3.6, hy: 12, hz: 3.6, dx: -25, dy: G + 12 + YLIFT, dz: 7 * dir });

    // the great Cathedral + La Mirabela — the landmark on the skyline
    const cz0 = 52;
    solid(0, G + 9, cz0, 13, 9, 11, C.wall);          // nave mass
    B.box(C.roof, 28, 2.2, 24, ...at(0, G + 19, cz0));
    B.box(C.stone, 7, 40, 7, ...at(13, G + 20, cz0 - 4));   // Mirabela shaft
    B.box(C.stone, 5, 10, 5, ...at(13, G + 45, cz0 - 4));   // belfry
    B.cone(C.roof, 3.6, 6, ...at(13, G + 53, cz0 - 4), 8); // octagonal belfry spire
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

    // a plaza cross before the cathedral
    B.cyl(C.stone, 1.6, 1.9, 0.8, ...at(0, G + 0.4, 32), 8);
    B.box(C.cream, 0.4, 3.2, 0.4, ...at(0, G + 2.4, 32));
    B.box(C.cream, 1.6, 0.4, 0.4, ...at(0, G + 3.4, 32));
    colliders.push({ hx: 1.0, hy: 0.5, hz: 1.0, dx: 0, dy: G + 0.5 + YLIFT, dz: 32 * dir }); // stone base
    colliders.push({ hx: 0.22, hy: 1.6, hz: 0.22, dx: 0, dy: G + 2.4 + YLIFT, dz: 32 * dir }); // upright

    // the Plaque of Brig — a stone lectern by the cross. Press F here to read the
    // Book of Brig (ideas made real) and to propose / vote on changes.
    B.box(C.stone, 0.7, 1.1, 0.7, ...at(4, G + 0.55, 34));         // plinth
    B.box(C.stone, 1.7, 1.2, 0.35, ...at(4, G + 1.5, 34));         // tablet back
    B.box(C.cream, 1.4, 0.95, 0.08, ...at(4, G + 1.5, 34.2));      // inscribed face
    B.box(C.roof, 1.8, 0.16, 0.5, ...at(4, G + 2.18, 34));         // little tiled cap
    colliders.push({ hx: 0.95, hy: 1.1, hz: 0.45, dx: 4, dy: G + 1 + YLIFT, dz: 34 * dir });

    // --- plaza & avenue life: orange trees, a fountain, market stalls, lamps ---
    // orange trees line Valdara's avenues — solid trunks, so you weave between
    const orange = (ox, oz) => {
      B.cyl(C.trunk, 0.24, 0.34, 2.3, ...at(ox, G + 1.15, oz), 7);
      B.ico(C.hedge, 1.8, 0, 1, 0.85, 1, ...at(ox, G + 3.0, oz));     // dense crown
      B.ico(C.leaf, 1.55, 0, 1, 0.95, 1, ...at(ox, G + 3.3, oz));     // lighter highlight
      colliders.push({ hx: 0.5, hy: 1.6, hz: 0.5, dx: ox, dy: G + 1.6 + YLIFT, dz: oz * dir });
    };
    for (const oz of [15, 22, 29, 42]) { orange(-8, oz); orange(8, oz); }

    // a stone fountain just off the plaza axis (a landmark, not a roadblock)
    const fx = 9, fz = 26;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.box(C.stone, 0.7, 0.7, 0.34, ...at(fx + Math.cos(a) * 2.0, G + 0.4, fz + Math.sin(a) * 2.0)); }
    B.cyl(C.river, 1.9, 1.9, 0.3, ...at(fx, G + 0.5, fz), 16);        // water disc
    B.cyl(C.stone, 0.35, 0.45, 1.7, ...at(fx, G + 1.1, fz), 10);      // central column
    B.cyl(C.stone, 0.95, 0.7, 0.25, ...at(fx, G + 1.85, fz), 12);     // upper basin
    colliders.push({ hx: 2.3, hy: 1, hz: 2.3, dx: fx, dy: G + 1 + YLIFT, dz: fz * dir });

    // market stalls — a table of produce under a striped awning
    const stall = (sx, sz, col) => {
      B.box(C.wood, 2.6, 0.18, 1.6, ...at(sx, G + 1.1, sz));          // table top
      for (const [lx, lz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) B.cyl(C.wood, 0.08, 0.08, 1.1, ...at(sx + lx, G + 0.55, sz + lz), 5);
      B.box(col, 3.0, 0.12, 2.0, ...at(sx, G + 2.4, sz));             // awning
      for (const lx of [-1.3, 1.3]) B.cyl(C.wood, 0.08, 0.08, 1.4, ...at(sx + lx, G + 1.7, sz - 0.9), 5);
      for (const [gx, gz] of [[-0.7, 0], [0, 0.2], [0.7, -0.1]]) B.ico(C.field, 0.4, 0, 1, 0.7, 1, ...at(sx + gx, G + 1.35, sz + gz));
      colliders.push({ hx: 1.4, hy: 0.8, hz: 0.9, dx: sx, dy: G + 0.8 + YLIFT, dz: sz * dir });
    };
    stall(-9, 24, C.red); stall(-8, 35, C.cream);

    // more lamp posts down the avenue (cosmetic; the day/night cycle lights them)
    for (const lz of [18, 32, 44]) for (const lx of [-3.6, 3.6]) {
      B.cyl(C.trunk, 0.14, 0.18, 3.6, ...at(lx, G + 1.8, lz), 6);
      B.box(C.cream, 0.4, 0.5, 0.4, ...at(lx, G + 3.85, lz));
    }

    // === the hinterland as a HEIGHTFIELD (see valHeight above): beyond the
    // walled farmland the land rolls up into forested hills and a snow-capped
    // sierra, with the Mansera carved into a real valley. Built in design space
    // then transformed into the city's lifted, z-flipped frame (scale.z=dir,
    // lifted by YLIFT) so it lines up with everything at() places. The walkable
    // belt is graded flat — the terrain there sits below the cobbles/earth and
    // is hidden — so only the backdrop reads as rolling country.
    const { mesh: valLand } = buildTerrain({
      width: 1180, depth: 1320, segX: 148, segZ: 166, center: { x: 0, z: 770 }, height: valHeight, colorAt: valColor,
    });
    valLand.scale.z = dir; valLand.position.set(local.x, YLIFT, local.z);
    meshes.push(valLand);
    // flat pasture flanking the city's east side at low dz, where the inland
    // terrain grid doesn't reach (keeps land beside the city, not void)
    B.box(C.grass, 360, 4, 240, ...at(210, G - 2.2, 110));

    // walkable farmland north of the campiña — big crop fields split by hedgerows
    solid(0, 1.68, 168, 72, 0.6, 56, C.earth);              // dz 112..224, dx -72..72
    const crops = [[-42, 132, C.field], [40, 134, C.olive], [-44, 176, C.olive],
      [42, 178, C.field], [-40, 214, C.field], [40, 210, C.olive], [0, 156, C.field]];
    for (const [fx, fz, fc] of crops) B.box(fc, 34, 0.24, 34, ...at(fx, G + 0.13, fz));
    for (const hz of [150, 194]) { solid(-26, G + 1.0, hz, 28, 1.0, 0.5, C.hedge); solid(26, G + 1.0, hz, 28, 1.0, 0.5, C.hedge); }
    // the long road inland — continues the gate road out toward the far village
    B.box(C.earth, 8, 0.28, 260, ...at(0, G + 0.16, 210));  // dz 80..340
    // two farmsteads astride the road (farmhouse + barn + sheep + haystacks)
    const farm = (fx, fz, flip) => {
      house(fx, fz, 12, 6, 10);
      solid(fx + 9 * flip, G + 2.5, fz + 7, 4, 2.5, 3, C.wall);
      B.roof(C.roof, 8, 6, 2.6, 0.4, ...at(fx + 9 * flip, G + 5.1, fz + 7));
      for (const [sx, sz] of [[fx - 5 * flip, fz + 5], [fx - 3 * flip, fz + 7], [fx - 6 * flip, fz + 3]]) B.ico(C.cream, 0.95, 0, 1.35, 0.9, 1, ...at(sx, G + 0.95, sz));
      for (const hz of [fz - 4, fz + 9]) B.ico(C.field, 2.0, 0, 1, 0.85, 1, ...at(fx + 12 * flip, G + 1.3, hz));
    };
    farm(-48, 150, 1); farm(50, 188, -1);
    // far bound — a hedgerow with a gap where the road leaves for the village
    solid(-32, G + 1.4, 226, 26, 1.4, 0.9, C.hedge);
    solid(32, G + 1.4, 226, 26, 1.4, 0.9, C.hedge);
    solid(72, G + 1.4, 168, 0.9, 1.4, 58, C.hedge);
    solid(-72, G + 1.4, 168, 0.9, 1.4, 58, C.hedge);

    // --- backdrop beyond the farmland: a forest + a village, seated on the
    // terrain (hills + sierra are the heightfield itself now, not cones) ---
    for (let i = 0; i < 44; i++) { const tx = -190 + (i * 53) % 170, tz = 250 + ((i * 91) % 200); conifer(B, ...at(tx, valHeight(tx, tz), tz), 13 + (i % 4) * 3); }
    // the village at the road's end, beside the wood, seated on the slope
    const vhouse = (vx, vz) => {
      const b = valHeight(vx, vz);
      B.rbox(C.wall, 7, 5, 7, ...at(vx, b + 2.5, vz), 0.3);
      B.roof(C.roof, 7, 7, 3.0, 0.5, ...at(vx, b + 5.1, vz));
      colliders.push({ hx: 3.5, hy: 2.5, hz: 3.5, dx: vx, dy: b + 2.5 + YLIFT, dz: vz * dir });
    };
    for (const [vx, vz] of [[-14, 296], [12, 300], [-6, 314], [16, 318], [-20, 326], [4, 332], [-12, 344], [18, 342], [-2, 356]]) vhouse(vx, vz);
    // the village church with a little spire
    const cb = valHeight(0, 372);
    B.box(C.wall, 5, 8, 5, ...at(0, cb + 4, 372));
    B.box(C.stone, 3, 6, 3, ...at(0, cb + 9, 372));
    B.cone(C.roof, 2.2, 4, ...at(0, cb + 14, 372), 8);

    door = { dx: 0, dy: 2.4, dz: cz0 - 14 };
  } else if (kind === 'port') { // Bocamar — the river-mouth departure town
    // cobbled quayside + earth town behind (just below the cobbles; autostep lip)
    solid(0, 1.78, 22, 26, 0.6, 24, C.stone);     // quay/plaza
    solid(0, 1.68, 46, 40, 0.6, 28, C.earth);     // town earth, inland
    // bounds (back + sides); the quay side stays open to the sea
    solid(0, G + 1.4, 76, 40, 1.4, 0.9, C.hedge);
    solid(-40, G + 1.4, 44, 0.9, 1.4, 32, C.hedge);
    solid(40, G + 1.4, 44, 0.9, 1.4, 32, C.hedge);
    // the shipwright's yard — a slipway + a half-built skiff (you launch from here)
    solid(-20, G + 0.2, 14, 6, 0.3, 8, C.wood);
    B.box(C.wood, 1.1, 0.9, 10, ...at(-20, G + 1.3, 14));        // keel
    for (let i = -3; i <= 3; i += 2) B.box(C.wood, 4, 0.3, 0.4, ...at(-20, G + 1.9, 14 + i)); // ribs
    colliders.push({ hx: 2.2, hy: 1.1, hz: 5.5, dx: -20, dy: G + 1.3 + YLIFT, dz: 14 * dir });
    house(-28, 26, 8, 5, 7);                                     // shipwright's shed
    // fishing quay — moored boats, drying nets on frames, fish barrels
    for (const bz of [6, 12, 18]) B.box(C.wood, 2.2, 0.8, 5, ...at(16, G - 0.2, bz));
    for (const nz of [8, 16]) { B.box(C.wood, 0.16, 2.2, 4, ...at(22, G + 1.2, nz)); B.box(C.cream, 0.1, 2, 3.6, ...at(22.2, G + 1.2, nz)); }
    for (const [bx, bz] of [[20, 22], [23, 24], [18, 26]]) B.cyl(C.wood, 0.7, 0.7, 1.4, ...at(bx, G + 0.7, bz), 8);
    // fisher houses
    house(-12, 40, 8, 5, 7); house(10, 44, 8, 6, 7); house(-30, 52, 8, 5, 7); house(28, 50, 8, 5, 7); house(0, 58, 9, 6, 8);
    // the Castillo de Bocamar — a square keep with corner towers
    solid(30, G + 5, 30, 5, 5, 5, C.stone);
    for (const [tx, tz] of [[26, 26], [26, 34], [34, 26], [34, 34]]) B.cyl(C.stone, 1.6, 2.0, 13, ...at(tx, G + 6.5, tz), 8);
    colliders.push({ hx: 5, hy: 5, hz: 5, dx: 30, dy: G + 5 + YLIFT, dz: 30 * dir });
    // a church with a bell-tower
    solid(-4, G + 3, 64, 4, 3, 6, C.wall);
    B.box(C.roof, 9, 1.4, 13, ...at(-4, G + 6.5, 64));
    B.box(C.stone, 3, 14, 3, ...at(-9, G + 7, 60));
    B.cone(C.roof, 2.4, 4, ...at(-9, G + 16, 60), 8); // octagonal bell-tower spire
    colliders.push({ hx: 4, hy: 3, hz: 6, dx: -4, dy: G + 3 + YLIFT, dz: 64 * dir });
    // a beacon tower at the river mouth — marks where the crossing launches
    B.cyl(C.stone, 1.4, 1.8, 10, ...at(22, G + 5, -6), 8);
    B.box(C.cream, 1, 1.2, 1, ...at(22, G + 11, -6));
    colliders.push({ hx: 1.8, hy: 5, hz: 1.8, dx: 22, dy: G + 5 + YLIFT, dz: -6 * dir });

    // --- Bocamar life: a town well, a fish stall, trees, lamps ---
    // town well with a tiled little roof on two posts
    B.cyl(C.stone, 1.0, 1.2, 1.5, ...at(0, G + 0.75, 30), 10);
    for (const px of [-0.95, 0.95]) B.box(C.wood, 0.12, 1.5, 0.12, ...at(px, G + 2.0, 30));
    B.box(C.roof, 2.4, 0.18, 1.2, ...at(0, G + 2.8, 30));
    colliders.push({ hx: 1.2, hy: 0.9, hz: 1.2, dx: 0, dy: G + 0.9 + YLIFT, dz: 30 * dir });
    // a fish stall on the quay (table of catch under a canopy)
    B.box(C.wood, 2.6, 0.18, 1.6, ...at(11, G + 1.1, 10));
    for (const [lx, lz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) B.cyl(C.wood, 0.08, 0.08, 1.1, ...at(11 + lx, G + 0.55, 10 + lz), 5);
    B.box(C.cream, 3.0, 0.12, 2.0, ...at(11, G + 2.4, 10));
    for (const gx of [-0.7, 0, 0.7]) B.ico(C.stone, 0.34, 0, 1.6, 0.5, 1, ...at(11 + gx, G + 1.32, 10)); // silvery fish
    colliders.push({ hx: 1.4, hy: 0.8, hz: 0.9, dx: 11, dy: G + 0.8 + YLIFT, dz: 10 * dir });
    // trees about the town (solid — weave between)
    const btree = (tx, tz) => {
      broadleaf(B, ...at(tx, G, tz), 6);
      colliders.push({ hx: 0.6, hy: 1.6, hz: 0.6, dx: tx, dy: G + 1.6 + YLIFT, dz: tz * dir });
    };
    for (const [tx, tz] of [[-18, 34], [20, 36], [-22, 62], [18, 64], [6, 48]]) btree(tx, tz);
    // boulders along the river-mouth shore, breaking the straight quay edge
    for (let i = 0; i < 9; i++) boulder(B, ...at(-26 + (i * 7) % 52, G - 0.4, -9 + (i * 5) % 16), 1.4 + (i % 3) * 0.6, i);
    // lamp posts through the town
    for (const [lx, lz] of [[-12, 22], [12, 28], [-8, 52], [10, 58]]) {
      B.cyl(C.trunk, 0.14, 0.18, 3.6, ...at(lx, G + 1.8, lz), 6);
      B.box(C.cream, 0.4, 0.5, 0.4, ...at(lx, G + 3.85, lz));
    }
    door = { dx: 0, dy: 2.4, dz: 58 };
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
    // the Plaque of Brig stands in Valdara's plaza (design 4,34) — its world-space
    // offset, projected to scene at berth time like the keep door
    plaque: kind === 'city' ? { dx: 4, dy: 2.4 + YLIFT, dz: 34 * dir } : null,
    colliders, meshes,
  };
}

// --- the map ----------------------------------------------------------------
// Absolute world coordinates (the ship moves THROUGH this fixed map; the world
// group counter-transforms so the ship can stay at the origin). Valdara and
// Las Verdías sit an ocean apart — well beyond the fog distance — so only one is
// ever in view: you depart Valdara, cross open water, and raise Las Verdías near
// the far end. (Fog far is ~1800; the crossing is ~4400, so each landfall fades
// up over the horizon rather than both hanging in view at once.)
export const SEVILLA = new Vector3(0, 0, -260);
export const HISPANIOLA = new Vector3(160, 0, 4200);
export const SANLUCAR = new Vector3(120, 0, 300); // downriver of Valdara, at the Atlantic mouth

export const PLACES = [
  { name: 'Valdara', x: SEVILLA.x, z: SEVILLA.z },
  { name: 'Bocamar', x: SANLUCAR.x, z: SANLUCAR.z },
  { name: 'Puerto Dorado', x: HISPANIOLA.x, z: HISPANIOLA.z },
];

// returns { group, places, harbours } to add into the world group
export function buildWorld({ deckTop = DECK_TOP, halfLen = HULL_HALF_LEN } = {}) {
  // align the quays + world lift to the vessel you're sailing (nao or skiff)
  YLIFT = deckTop - 2.4;
  BOW_GAP = halfLen + 6;
  const group = new Group();
  const hisp = buildVerdias();
  const sev = buildValdara();
  const san = buildSanlucar();
  group.add(hisp.group);
  group.add(sev.group);
  group.add(san.group);
  // Las Verdías first — its keep carries the lore courtyard; Valdara second
  // (combat open-water gating references harbours[0]/[1] by index)
  return { group, places: PLACES, harbours: [hisp.harbour, sev.harbour, san.harbour] };
}
