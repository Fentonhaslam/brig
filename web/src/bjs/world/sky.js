// Brig (Babylon.js) — sky. Port of web/src/sky.js (Three.js `Sky` shader) onto
// Babylon's SkyMaterial. Golden-hour atmosphere with the sun driven through a
// full day→night cycle: hazier/warmer near the horizon, clearer & brighter high.
//
// Babylon is LEFT-HANDED. SkyMaterial parameterises the sun by `inclination`
// (0 = horizon, ~0.5 = zenith) and `azimuth` (0..1, full turn). We map the
// elevation/azimuth degrees used by the Three.js build onto those, and ALSO
// return an explicit sun *direction* Vector3 so the caller can aim the
// DirectionalLight (which points from the sun toward the scene).

import { MeshBuilder, Vector3, Scalar } from '@babylonjs/core';
import { SkyMaterial } from '@babylonjs/materials';

const DEG = Math.PI / 180;

export function createSky(scene) {
  // Large box, drawn at infinite distance so it never clips the world.
  const mesh = MeshBuilder.CreateBox('sky', { size: 12000 }, scene);
  mesh.infiniteDistance = true;

  const skyMat = new SkyMaterial('skyMat', scene);
  skyMat.backFaceCulling = false;        // we view it from the inside
  skyMat.useSunPosition = false;         // drive the sun via inclination/azimuth
  // Clearer-air golden-hour baseline (mirrors the Three.js tuning).
  skyMat.turbidity = 2.8;
  skyMat.luminance = 1.0;
  skyMat.rayleigh = 1.6;
  skyMat.mieCoefficient = 0.0035;        // less haze around the disc
  skyMat.mieDirectionalG = 0.985;        // tight, defined sun disc
  mesh.material = skyMat;

  // Drive the sun for a full day→night cycle and report its world direction.
  //   elevationDeg: 0 = on the horizon, 90 = straight overhead.
  //   azimuthDeg:   compass-style bearing, matching the Three.js build.
  // Returns the unit sun direction (sky → ground): the vector a directional
  // light should point along.
  function setSun(elevationDeg, azimuthDeg) {
    // SkyMaterial: inclination 0 = horizon, 0.5 = zenith.
    skyMat.inclination = Scalar.Clamp(elevationDeg / 180, -0.5, 0.5);
    // azimuth 0..1 over a full turn.
    let az = (azimuthDeg / 360) % 1;
    if (az < 0) az += 1;
    skyMat.azimuth = az;

    // Day/night-friendly atmosphere: hazier & warmer low, clearer high.
    const t = Scalar.Clamp(elevationDeg / 45, 0, 1); // 0 horizon .. 1 high
    skyMat.turbidity = 9 - 6 * t;
    skyMat.rayleigh = 3.2 - 1.7 * t;
    skyMat.mieCoefficient = 0.006 - 0.0025 * t;
    skyMat.mieDirectionalG = 0.96 + 0.025 * t;
    // Sink luminance as the sun drops below the horizon → soft dusk/night.
    skyMat.luminance = Scalar.Clamp(0.35 + 0.85 * t, 0.05, 1.0);

    // Sun position from spherical coords (Three.js: phi = 90 - elevation,
    // theta = azimuth). Babylon is left-handed; build the same world point.
    const phi = (90 - elevationDeg) * DEG;
    const theta = azimuthDeg * DEG;
    const sunPos = new Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    // Direction a directional light travels (sun → ground) is the negation.
    return sunPos.negate().normalize();
  }

  setSun(3.2, 152); // initial — low golden-hour sun

  return { setSun, mesh };
}
