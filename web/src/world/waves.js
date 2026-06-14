// Shared ocean wave field — a sum of directional sine swells. One source of
// truth for the sea surface, consumed by: the water mesh (visual displacement),
// ship buoyancy (heave/pitch/roll), the swimming surface, and the bow wake.
// Cheap, analytic, deterministic — runs everywhere.

// [dirX, dirZ, amplitude(m), wavelength(m), speed]
const COMPONENTS = [
  [1.0, 0.25, 0.55, 64, 0.9],
  [0.55, 1.0, 0.32, 33, 1.15],
  [-0.8, 0.5, 0.16, 19, 1.5],
  [0.25, -1.0, 0.09, 12, 1.9],
];

// precompute normalized direction, wavenumber k, angular speed w
const W = COMPONENTS.map(([dx, dz, amp, len, speed]) => {
  const l = Math.hypot(dx, dz) || 1;
  const k = (2 * Math.PI) / len;
  return { dx: dx / l, dz: dz / l, amp, k, w: speed * ((2 * Math.PI) / len) };
});

export const SEA_LEVEL = 0;

// vertical height of the sea surface at world (x,z) and time t
export function waveHeight(x, z, t) {
  let h = 0;
  for (let i = 0; i < W.length; i++) {
    const c = W[i];
    h += c.amp * Math.sin((c.dx * x + c.dz * z) * c.k + t * c.w);
  }
  return h;
}

// approximate surface normal (analytic gradient of the height field)
export function waveNormal(x, z, t, out = { x: 0, y: 1, z: 0 }) {
  let dhdx = 0, dhdz = 0;
  for (let i = 0; i < W.length; i++) {
    const c = W[i];
    const d = Math.cos((c.dx * x + c.dz * z) * c.k + t * c.w) * c.amp * c.k;
    dhdx += c.dx * d;
    dhdz += c.dz * d;
  }
  const inv = 1 / Math.hypot(dhdx, 1, dhdz);
  out.x = -dhdx * inv; out.y = 1 * inv; out.z = -dhdz * inv;
  return out;
}

// sample heave + pitch/roll for a body of given half-extents centered at (x,z)
// facing +z; returns { y, pitch, roll } to lay a hull onto the swell.
export function sampleBuoyancy(x, z, t, halfLen = 9, halfBeam = 4) {
  const fore = waveHeight(x, z + halfLen, t);
  const aft = waveHeight(x, z - halfLen, t);
  const port = waveHeight(x - halfBeam, z, t);
  const stbd = waveHeight(x + halfBeam, z, t);
  const y = (fore + aft + port + stbd) * 0.25;
  const pitch = Math.atan2(aft - fore, halfLen * 2);   // bow up/down
  const roll = Math.atan2(stbd - port, halfBeam * 2);  // lean port/stbd
  return { y, pitch, roll };
}
