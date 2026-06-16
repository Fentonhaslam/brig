// A modular building kit — the leap from "box + cone" to architecture.
//
// Binds to the islands.js merge builder (so everything still merges per material
// into a few draw calls) and produces a detailed Andalusian townhouse: a rounded
// plastered wall mass on a darker plinth, inset windows with cream frames +
// timber shutters + sills, a recessed door, an overhanging eave/cornice, a
// hipped or gabled terracotta roof with a ridge, and a chimney. Crucially it
// pushes the SAME single wall collider the old house() did, so walkable streets
// line up exactly — the detail is all non-colliding dressing around it.
//
// EXPORT: makeKit({ B, at, solid, colliders, C, G, dir, YLIFT }) -> { house }

const DARK_GLASS = 0x241a12; // recessed window opening
const DOOR = 0x2a1c12;

export function makeKit({ B, at, solid, colliders, C, G, dir, YLIFT }) {
  // a framed, shuttered window centred at (x,y) on a face whose outward normal is
  // +z (fz>0) or ±x (side); `face` is 'z' or 'x'
  function window(cx, cy, cz, face, off) {
    const ow = 0.9, oh = 1.15;
    if (face === 'z') {
      const z = cz + off;
      B.box(C.cream, ow + 0.2, oh + 0.2, 0.06, ...at(cx, cy, z - 0.03 * Math.sign(off))); // frame
      B.box(DARK_GLASS, ow, oh, 0.12, ...at(cx, cy, z));                                  // recessed glass
      B.box(C.wood, 0.46, oh, 0.07, ...at(cx - 0.56, cy, z + 0.04 * Math.sign(off)));     // shutter L
      B.box(C.wood, 0.46, oh, 0.07, ...at(cx + 0.56, cy, z + 0.04 * Math.sign(off)));     // shutter R
      B.box(C.stone, ow + 0.3, 0.12, 0.28, ...at(cx, cy - 0.66, z));                      // sill
    } else {
      const x = cx + off;
      B.box(C.cream, 0.06, oh + 0.2, ow + 0.2, ...at(x - 0.03 * Math.sign(off), cy, cz));
      B.box(DARK_GLASS, 0.12, oh, ow, ...at(x, cy, cz));
      B.box(C.wood, 0.07, oh, 0.46, ...at(x + 0.04 * Math.sign(off), cy, cz - 0.56));
      B.box(C.wood, 0.07, oh, 0.46, ...at(x + 0.04 * Math.sign(off), cy, cz + 0.56));
      B.box(C.stone, 0.28, 0.12, ow + 0.3, ...at(x, cy - 0.66, cz));
    }
  }

  // cols across a span -> 1 window if narrow, else 2
  const cols = (s) => (s > 6 ? [-s * 0.24, s * 0.24] : [0]);

  function house(cx, cz, w, h, d, opt = {}) {
    const wallC = opt.wall || C.wall;
    // wall mass (rounded plaster) + the ONE collider (matches the old footprint)
    B.rbox(wallC, w, h, d, ...at(cx, G + h / 2, cz), 0.16);
    colliders.push({ hx: w / 2, hy: h / 2, hz: d / 2, dx: cx, dy: G + h / 2 + YLIFT, dz: cz * dir });
    // darker plinth / base course
    B.box(C.stone, w + 0.12, 0.5, d + 0.12, ...at(cx, G + 0.25, cz));
    // eave / cornice overhang just under the roof
    B.box(C.wood, w + 0.6, 0.22, d + 0.6, ...at(cx, G + h + 0.06, cz));
    // roof: hipped pyramid or gabled prism (terracotta), with a ridge cap
    const gable = ((cx + cz) | 0) % 2 === 0;
    if (gable) {
      B.cone(C.roof, Math.max(w, d) * 0.66, h * 0.4, ...at(cx, G + h + h * 0.2 + 0.2, cz), 4);
    } else {
      B.cone(C.roof, Math.max(w, d) * 0.7, h * 0.46, ...at(cx, G + h + h * 0.23 + 0.2, cz), 4);
    }
    B.box(C.roof, 0.5, 0.4, d * 0.5, ...at(cx, G + h + h * 0.42, cz)); // ridge cap
    // chimney
    B.box(C.stone, 0.55, 1.3, 0.55, ...at(cx + w * 0.28, G + h + 0.85, cz));
    B.box(0x33291f, 0.62, 0.18, 0.62, ...at(cx + w * 0.28, G + h + 1.5, cz)); // chimney cap

    // windows on the front (+z) + the two sides (±x); door on the front
    const winY = G + h * 0.56;
    for (const wx of cols(w)) window(cx + wx, winY, cz, 'z', d / 2 + 0.05);
    if (h > 5) for (const wx of cols(w)) window(cx + wx, G + h * 0.56 + h * 0.32, cz, 'z', d / 2 + 0.05); // upper storey
    for (const wz of cols(d)) { window(cx, winY, cz + wz, 'x', w / 2 + 0.05); window(cx, winY, cz + wz, 'x', -(w / 2 + 0.05)); }
    // door, recessed with a frame, on the front
    B.box(C.cream, 1.2, 2.1, 0.06, ...at(cx, G + 1.0, cz + d / 2 + 0.02));
    B.box(DOOR, 1.0, 1.9, 0.12, ...at(cx, G + 0.95, cz + d / 2 + 0.06));
  }

  return { house };
}
