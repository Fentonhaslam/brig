// Brig — Babylon.js water (port of web/src/water.js).
//
// Reflective Atlantic ocean. The Three.js original used the `Water` addon
// (planar reflections + an animated normal map). Babylon's WaterMaterial gives
// us the same look: a reflective/refractive plane with scrolling bump ripples.
//
// It stays put in WORLD SPACE — it does NOT scroll with the ship. The sense of
// sailing comes from islands sliding past + the bow wake, while the ship rides
// a gentle local swell via buoyancy (handled elsewhere by world/waves.js).
//
// Babylon is LEFT-HANDED. A ground lies in the XZ plane at y=0 already, so no
// rotation is needed (the Three.js plane needed rotation.x = -PI/2).

import { Vector2, Vector3, Color3, MeshBuilder, Texture } from '@babylonjs/core';
import { WaterMaterial } from '@babylonjs/materials';

export function createWater(scene) {
  // Large world-static ground. Matches the 20000×20000 plane of the original.
  // A few subdivisions let the vertex-displacement waves read at the horizon
  // without being expensive.
  const mesh = MeshBuilder.CreateGround(
    'sea',
    { width: 20000, height: 20000, subdivisions: 8 },
    scene,
  );
  mesh.position.y = 0; // SEA_LEVEL — world-static, never scrolled with the ship.

  // 256² reflection/refraction targets (down from 512²) — the surface is
  // rippled and tinted, so the mirror never needs to be crisp. Quarter the
  // pixels of every reflection pass.
  const material = new WaterMaterial('water', scene, new Vector2(256, 256));

  // Animated ripple normal map (wraps/repeats across the surface).
  const bump = new Texture('/waternormals.jpg', scene);
  bump.wrapU = Texture.WRAP_ADDRESSMODE;
  bump.wrapV = Texture.WRAP_ADDRESSMODE;
  material.bumpTexture = bump;

  // Deep teal water (Three.js waterColor 0x0c2530 ≈ 0.047, 0.145, 0.188),
  // warm sun tint (sunColor 0xffd190) for the cinematic horizon glint.
  material.waterColor = new Color3(0.047, 0.145, 0.188);
  material.colorBlendFactor = 0.25;
  material.specularColor = new Color3(1.0, 0.82, 0.565);

  // Gentle swell + ripple — keep it calm to match the original's small
  // distortionScale (4.0) and soft motion.
  material.windForce = -6;          // ripple scroll speed (sign sets direction)
  material.windDirection = new Vector2(1, 0.4);
  material.waveHeight = 0.5;        // subtle vertex displacement
  material.bumpHeight = 0.3;        // normal-map ripple strength
  material.waveLength = 0.12;
  material.waveSpeed = 12.0;

  mesh.material = material;

  // The reflection/refraction passes each re-render the whole world. Refreshing
  // them every other frame (reflection) / every third (refraction, barely
  // visible behind the tint) roughly halves the water's cost with no visible
  // change on a gently-moving sea.
  if (material._reflectionRTT) material._reflectionRTT.refreshRate = 2;
  if (material._refractionRTT) material._refractionRTT.refreshRate = 3;

  // Reflections/refractions: callers add the sky, ship, islands, monuments,
  // etc. so they appear in the mirrored surface.
  const addToRenderList = (m) => {
    if (m) material.addToRenderList(m);
  };

  // (t) — advance the ripple animation. WaterMaterial normally ticks itself off
  // the scene clock, but we drive `_lastTime` explicitly so the surface stays
  // in lockstep with the rest of the world's time-based motion (and so it keeps
  // animating even if something pauses the scene's internal timer). t is in
  // seconds; WaterMaterial's internal time is in milliseconds.
  const update = (t) => {
    material._lastTime = t * 1000;
  };

  return { mesh, material, addToRenderList, update };
}
