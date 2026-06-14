import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Golden-hour sky with the sun low on the horizon, warm hazy atmosphere
export function createSky(scene, sunOut) {
  const sky = new Sky();
  sky.scale.setScalar(45000);
  scene.add(sky);

  const u = sky.material.uniforms;
  u['turbidity'].value = 2.8;          // clearer air — keeps the disc defined
  u['rayleigh'].value = 1.6;           // less scattering -> sky stays warm but not blown out
  u['mieCoefficient'].value = 0.0035;  // less haze around the sun
  u['mieDirectionalG'].value = 0.985;  // tight sun disc, not a wash

  // Drive the sun for a full day→night cycle. Hazier/warmer near the horizon,
  // clearer at noon; the shared `sunOut` vector is kept in step.
  function setSun(elevationDeg, azimuthDeg) {
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    sunOut.setFromSphericalCoords(1, phi, theta);
    u['sunPosition'].value.copy(sunOut);

    const t = Math.max(0, Math.min(1, elevationDeg / 45)); // 0 horizon .. 1 high
    u['turbidity'].value = 9 - 6 * t;
    u['rayleigh'].value = 3.2 - 1.7 * t;
    u['mieCoefficient'].value = 0.006 - 0.0025 * t;
    u['mieDirectionalG'].value = 0.96 + 0.025 * t;
  }

  setSun(3.2, 152); // initial — low golden-hour sun
  return { sky, setSun };
}
