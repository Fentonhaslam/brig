// Brig — lightweight rebuild (Phase 0 foundation).
//
// Lean three.js: orbital camera, stylized sky + water, flat-shaded low-poly art,
// a perf overlay. No physics engine, no PBR, no reflections, no post stack.
// Built at /game.html so the live Babylon site stays up until this is proven.

import {
  Scene, PerspectiveCamera, Color, Fog, Vector3,
  HemisphereLight, DirectionalLight,
  Mesh, ConeGeometry, CylinderGeometry, IcosahedronGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { createRenderer } from './core/renderer.js';
import { createStats } from './core/stats.js';
import { createOrbitCam } from './camera/orbit.js';
import { createSky } from './world/sky.js';
import { createWater } from './world/water.js';
import { createShip } from './world/ship.js';
import { toonMaterial, withOutline } from './core/toon.js';

const canvas = document.getElementById('c');
const renderer = createRenderer(canvas);
const stats = createStats();

const scene = new Scene();
const FOG = 0xcfe8ef; // bright hazy horizon
scene.background = new Color(FOG);
scene.fog = new Fog(FOG, 300, 1700);

const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 6000);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// --- light direction shared by sky + water + the sun lamp ---
const sunDir = new Vector3(0.45, 0.55, -0.8).normalize();

// bright, saturated, Wind Waker key light + a restrained skylight fill so the
// toon ramp's shadow band stays visible (a strong fill washes the cel look out)
const hemi = new HemisphereLight(0xcdefff, 0x4a6b3a, 0.6);
scene.add(hemi);
const sun = new DirectionalLight(0xfff2cf, 2.1);
sun.position.copy(sunDir).multiplyScalar(200);
scene.add(sun);

const sky = createSky(scene);
sky.setSun(sunDir, 0xfff2cf, 0xfde6b8, 0x49b6e0);
const water = createWater(scene);
water.update(0, sunDir);
water.material.uniforms.uFogColor.value.set(FOG);
water.material.uniforms.uFogFar.value = 1700;

// --- a low-poly island, MERGED into one draw call per material -------------
// Demonstrates the geometry strategy for the whole rebuild: build modular
// primitives, merge by material, end up with a handful of draw calls.
function buildIsland() {
  const sandGeos = [];
  const rockGeos = [];
  const leafGeos = [];
  const trunkGeos = [];

  // beach mound
  const base = new IcosahedronGeometry(60, 1);
  base.scale(1, 0.18, 1); base.translate(0, 1, 0);
  sandGeos.push(base);

  // a couple of hills
  for (const [x, z, r, h] of [[-12, 8, 26, 22], [18, -10, 20, 30]]) {
    const hill = new ConeGeometry(r, h, 6, 1);
    hill.translate(x, h / 2, z);
    rockGeos.push(hill);
  }

  // palm trees scattered around
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = Math.cos(a) * 42, z = Math.sin(a) * 42;
    const trunk = new CylinderGeometry(0.6, 0.9, 9, 5);
    trunk.translate(x, 5, z);
    trunkGeos.push(trunk);
    const fronds = new ConeGeometry(4.5, 4, 6, 1);
    fronds.translate(x, 11, z);
    leafGeos.push(fronds);
  }

  const group = new Mesh();
  const parts = [
    [sandGeos, 0xe8d49a, true],   // sand — outline the silhouette
    [rockGeos, 0x5fae3f, true],   // bright grass hills
    [trunkGeos, 0x6b4a2c, false],
    [leafGeos, 0x2f9b46, false],
  ];
  for (const [geos, color, outline] of parts) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    merged.computeVertexNormals();
    const mesh = new Mesh(merged, toonMaterial(color, { flatShading: true }));
    if (outline) withOutline(mesh, 0.18);
    group.add(mesh);
  }
  group.position.set(150, 0, -170);
  return group;
}
scene.add(buildIsland());

// --- the ship, riding at the origin ---
const ship = createShip();
scene.add(ship.root);

// --- orbital camera framing the ship ---
const orbit = createOrbitCam(camera, canvas, new Vector3(0, ship.deckY + 2, 0));
orbit.setRadius(34);

// --- loop ---
let last = performance.now();
let t = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  t += dt;

  water.update(t, sunDir);
  ship.update(t);
  orbit.update();

  renderer.render(scene, camera);
  stats.update(dt, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
