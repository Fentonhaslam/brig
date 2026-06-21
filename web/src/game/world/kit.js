// A modular building kit — the leap from "box + cone" to architecture.
//
// Binds to the islands.js merge builder (so everything still merges per material
// into a few draw calls) and produces a detailed Andalusian townhouse: a rounded
// plastered wall mass on a darker plinth, stone-surrounded windows with cream
// frames + glazing bars + timber shutters, a recessed arched door, an
// overhanging eave/cornice with a terracotta tile course, a properly-hipped
// terracotta roof with a ridge, and a chimney. Per-house variation (plaster
// tone, roof tone, pitch, balconies, awnings, storey count) is derived
// deterministically from the plot position, so a street reads as many distinct
// houses rather than one repeated box. Crucially it still pushes the SAME single
// wall collider the old house() did, so walkable streets line up exactly — all
// the detail is non-colliding dressing around that one box.
//
// EXPORT: makeKit({ B, at, solid, colliders, C, G, dir, YLIFT }) -> { house }

const DARK_GLASS = 0x241a12; // recessed window opening
const DOOR = 0x2a1c12;

// cheap deterministic hash -> [0,1) so each plot varies but stays stable
const frac = (n) => n - Math.floor(n);
const hash = (a, b) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

export function makeKit({ B, at, solid, colliders, C, G, dir, YLIFT }) {
  // a stone-surrounded, shuttered, paned window centred at (cx,cy,cz) on a face
  // whose outward normal is +z/−z (face 'z') or ±x (face 'x'); `off` is the
  // signed distance from the wall centre to that face.
  function window(cx, cy, cz, face, off) {
    const ow = 0.9, oh = 1.15, s = Math.sign(off);
    const trim = C.cream, stone = C.stone;
    if (face === 'z') {
      const z = cz + off;
      B.box(DARK_GLASS, ow, oh, 0.22, ...at(cx, cy, z - 0.08 * s));            // deep recessed reveal
      B.box(stone, ow + 0.36, 0.16, 0.32, ...at(cx, cy + oh / 2 + 0.13, z));   // stone lintel
      B.box(stone, ow + 0.32, 0.13, 0.3, ...at(cx, cy - oh / 2 - 0.11, z));    // stone sill
      B.box(trim, 0.1, oh + 0.12, 0.18, ...at(cx - (ow / 2 + 0.09), cy, z));   // jamb L
      B.box(trim, 0.1, oh + 0.12, 0.18, ...at(cx + (ow / 2 + 0.09), cy, z));   // jamb R
      B.box(trim, ow, 0.05, 0.05, ...at(cx, cy, z - 0.02 * s));                // glazing bar (h)
      B.box(trim, 0.05, oh, 0.05, ...at(cx, cy, z - 0.02 * s));                // glazing bar (v)
      B.box(C.wood, 0.46, oh + 0.04, 0.07, ...at(cx - 0.56, cy, z + 0.05 * s)); // shutter L
      B.box(C.wood, 0.46, oh + 0.04, 0.07, ...at(cx + 0.56, cy, z + 0.05 * s)); // shutter R
    } else {
      const x = cx + off;
      B.box(DARK_GLASS, 0.22, oh, ow, ...at(x - 0.08 * s, cy, cz));
      B.box(stone, 0.32, 0.16, ow + 0.36, ...at(x, cy + oh / 2 + 0.13, cz));
      B.box(stone, 0.3, 0.13, ow + 0.32, ...at(x, cy - oh / 2 - 0.11, cz));
      B.box(trim, 0.18, oh + 0.12, 0.1, ...at(x, cy, cz - (ow / 2 + 0.09)));
      B.box(trim, 0.18, oh + 0.12, 0.1, ...at(x, cy, cz + (ow / 2 + 0.09)));
      B.box(trim, 0.05, 0.05, ow, ...at(x - 0.02 * s, cy, cz));
      B.box(trim, 0.05, oh, 0.05, ...at(x - 0.02 * s, cy, cz));
      B.box(C.wood, 0.07, oh + 0.04, 0.46, ...at(x + 0.05 * s, cy, cz - 0.56));
      B.box(C.wood, 0.07, oh + 0.04, 0.46, ...at(x + 0.05 * s, cy, cz + 0.56));
    }
  }

  // a wrought-iron balcony projecting from the front (+z) face under a window
  function balcony(cx, cy, cz, off) {
    const z = cz + off, s = Math.sign(off);
    B.box(C.stone, 2.0, 0.14, 0.7, ...at(cx, cy, z + 0.35 * s));               // slab
    B.box(C.iron, 2.0, 0.07, 0.06, ...at(cx, cy + 0.55, z + 0.66 * s));        // top rail
    for (let i = -3; i <= 3; i++) B.box(C.iron, 0.05, 0.55, 0.05, ...at(cx + i * 0.28, cy + 0.3, z + 0.66 * s)); // balusters
    B.box(C.iron, 0.06, 0.55, 0.6, ...at(cx - 0.98, cy + 0.3, z + 0.35 * s));  // end rails
    B.box(C.iron, 0.06, 0.55, 0.6, ...at(cx + 0.98, cy + 0.3, z + 0.35 * s));
  }

  // a flat cloth canopy over the front door
  function awning(cx, cy, cz, off, col) {
    const z = cz + off, s = Math.sign(off);
    B.box(col, 1.9, 0.08, 0.9, ...at(cx, cy, z + 0.45 * s));                   // canopy
    B.box(col, 1.9, 0.32, 0.06, ...at(cx, cy - 0.18, z + 0.86 * s));           // valance
    B.box(C.wood, 0.06, 0.5, 0.06, ...at(cx - 0.9, cy - 0.25, z + 0.86 * s));  // braces
    B.box(C.wood, 0.06, 0.5, 0.06, ...at(cx + 0.9, cy - 0.25, z + 0.86 * s));
  }

  // cols across a span -> 1 window if narrow, else 2
  const cols = (s) => (s > 6 ? [-s * 0.24, s * 0.24] : [0]);

  function house(cx, cz, w, h, d, opt = {}) {
    const r1 = hash(cx, cz), r2 = hash(cz + 3, cx - 1), r3 = hash(cx * 1.7, cz * 0.6);
    // plaster tone + roof tone vary per plot (whitewash/ochre/sand/rose)
    const plasters = [C.plasterA, C.plasterB, C.plasterC, C.plasterD, C.wall];
    const wallC = opt.wall || plasters[(r1 * plasters.length) | 0];
    const roofC = r2 < 0.5 ? C.roof : C.roof2;
    const twoStorey = h > 5;
    const wantBalcony = twoStorey && r3 > 0.55;
    const wantAwning = r3 < 0.4;
    const awnCol = r1 < 0.5 ? C.red : C.cream;

    // wall mass (rounded plaster) + the ONE collider (matches the old footprint)
    B.rbox(wallC, w, h, d, ...at(cx, G + h / 2, cz), 0.26);
    colliders.push({ hx: w / 2, hy: h / 2, hz: d / 2, dx: cx, dy: G + h / 2 + YLIFT, dz: cz * dir });
    // darker plinth / base course
    B.box(C.stone, w + 0.12, 0.5, d + 0.12, ...at(cx, G + 0.25, cz));
    // string course between storeys on two-storey houses
    if (twoStorey) B.box(C.stone, w + 0.14, 0.18, d + 0.14, ...at(cx, G + h * 0.52, cz));
    // eave / cornice overhang + a terracotta tile course just under the roof
    B.box(C.wood, w + 0.6, 0.22, d + 0.6, ...at(cx, G + h + 0.06, cz));
    B.box(roofC, w + 0.9, 0.16, d + 0.9, ...at(cx, G + h + 0.2, cz));

    // roof: a proper hipped terracotta roof sized to the footprint, so the four
    // eaves sit square over the corners. Ridge runs along the longer span; the
    // pitch is a touch steeper on the (slightly taller) "steep" variant.
    const steep = ((cx + cz) | 0) % 2 === 0;
    const eave = 0.5, rise = Math.min(w, d) * (steep ? 0.5 : 0.42);
    const baseY = G + h + 0.28;
    B.roof(roofC, w, d, rise, eave, ...at(cx, baseY, cz));
    if (w >= d) B.box(roofC, Math.abs(w - d) + 0.6, 0.36, 0.62, ...at(cx, baseY + rise, cz));
    else        B.box(roofC, 0.62, 0.36, Math.abs(d - w) + 0.6, ...at(cx, baseY + rise, cz));
    // chimney
    B.box(C.stone, 0.55, 1.3, 0.55, ...at(cx + w * 0.28, baseY + rise * 0.5 + 0.4, cz));
    B.box(0x33291f, 0.62, 0.18, 0.62, ...at(cx + w * 0.28, baseY + rise * 0.5 + 1.05, cz));

    // windows on the front (+z) + the two sides (±x)
    const winY = G + h * 0.56;
    const front = d / 2 + 0.05;
    for (const wx of cols(w)) window(cx + wx, winY, cz, 'z', front);
    if (twoStorey) {
      const upY = G + h * 0.56 + h * 0.32;
      for (const wx of cols(w)) {
        window(cx + wx, upY, cz, 'z', front);
        if (wantBalcony && wx === cols(w)[0]) balcony(cx + wx, G + h * 0.56 + h * 0.32 - 0.66, cz, front);
      }
    }
    for (const wz of cols(d)) { window(cx, winY, cz + wz, 'x', w / 2 + 0.05); window(cx, winY, cz + wz, 'x', -(w / 2 + 0.05)); }

    // door: a recessed timber door under a stone arch lintel, on a step
    B.box(C.stone, 1.5, 0.2, 0.5, ...at(cx, G + 0.12, cz + d / 2 + 0.18)); // step
    B.box(C.cream, 1.3, 2.2, 0.06, ...at(cx, G + 1.05, cz + d / 2 + 0.02)); // surround
    B.box(C.stone, 1.5, 0.34, 0.34, ...at(cx, G + 2.2, cz + d / 2 + 0.04));  // arch lintel
    B.box(DOOR, 1.0, 1.9, 0.14, ...at(cx, G + 0.95, cz + d / 2 + 0.06));     // door leaf
    B.box(C.iron, 0.12, 0.12, 0.06, ...at(cx + 0.3, G + 1.0, cz + d / 2 + 0.14)); // knocker/handle
    if (wantAwning) awning(cx, G + 2.5, cz, d / 2 + 0.05, awnCol);
  }

  return { house };
}
