// Brig — lightweight rebuild (Phase 0 foundation).
//
// Lean three.js: orbital camera, stylized sky + water, flat-shaded low-poly art,
// a perf overlay. No physics engine, no PBR, no reflections, no post stack.
// Built at /game.html so the live Babylon site stays up until this is proven.

import {
  Scene, PerspectiveCamera, Color, Fog, Vector3, Group, Object3D, MathUtils,
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
import { initPhysics } from './core/physics.js';
import { createPlayer } from './player/player.js';
import { createInput } from './player/input.js';

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

// The world (islands + future skyline) lives under a group whose transform is
// the INVERSE of the ship's world pose. The ship stays fixed at the origin
// pointing north — so its deck is a clean static physics collider — while the
// world slides and turns past it as you sail. (A moving deck would make the
// character controller fight a moving platform; this sidesteps that entirely.)
const worldGroup = new Group();
worldGroup.matrixAutoUpdate = false;
worldGroup.add(buildIsland());
scene.add(worldGroup);

const shipAnchor = new Object3D();
let shipYaw = 0;
const shipPos = new Vector3();
function syncWorld() {
  shipAnchor.position.copy(shipPos);
  shipAnchor.rotation.set(0, shipYaw, 0);
  shipAnchor.updateMatrix();
  worldGroup.matrix.copy(shipAnchor.matrix).invert();
}
syncWorld();

// --- the ship, riding at the origin ---
const ship = createShip();
scene.add(ship.root);

// --- orbital camera ---
const camTarget = new Vector3(0, ship.deckY + 1.4, 2);
const orbit = createOrbitCam(camera, canvas, camTarget);
orbit.setRadius(24);

// --- physics + player ---
const physics = await initPhysics();
ship.colliders.forEach((c) => physics.staticCuboid(c.hx, c.hy, c.hz, c.x, c.y, c.z));
const SPAWN = new Vector3(0, ship.deckY + 1.6, 3);
const player = createPlayer(physics, scene, SPAWN);

// --- input + modes ('walk' | 'helm') ---
const input = createInput(canvas, camera);
let mode = 'walk';
let moveTarget = null;

input.onClick((ray) => {
  if (mode !== 'walk') return;
  const hits = ray.intersectObjects([ship.root, worldGroup], true);
  if (hits.length) moveTarget = hits[0].point.clone();
});

// E toggles the helm when you're standing near the wheel
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE') return;
  if (mode === 'walk' && player.position.distanceTo(ship.helm) < 3.5) {
    mode = 'helm'; moveTarget = null; player.setVisible(false);
  } else if (mode === 'helm') {
    mode = 'walk'; player.setVisible(true);
    player.teleport(ship.helm.x, ship.deckY + 1.6, ship.helm.z + 1.5);
  }
});

// hint strip
const hint = document.createElement('div');
hint.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:50;'
  + 'font:600 14px/1.4 system-ui,sans-serif;color:#fff;background:rgba(10,30,45,.55);'
  + 'padding:8px 16px;border-radius:20px;letter-spacing:.3px;pointer-events:none;backdrop-filter:blur(3px)';
document.body.appendChild(hint);

// --- sailing state ---
const nav = { speed: 0, heading: 0 }; // speed 0..1, heading radians
const SAIL_SPEED = 26;

const UP = new Vector3(0, 1, 0);
const fwd = new Vector3();
const right = new Vector3();
const dir = new Vector3();

function updateWalk(dt) {
  const ax = input.moveAxis();
  if (ax.x || ax.z) {
    moveTarget = null;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, UP).normalize();
    dir.copy(fwd).multiplyScalar(ax.z).addScaledVector(right, -ax.x);
    if (dir.lengthSq() > 0) dir.normalize();
    player.walk(dir.x, dir.z, input.running());
  } else if (moveTarget) {
    const p = player.position;
    dir.set(moveTarget.x - p.x, 0, moveTarget.z - p.z);
    if (dir.length() < 0.5) { moveTarget = null; }
    else { dir.normalize(); player.walk(dir.x, dir.z, false); }
  }
  player.update(dt);

  // fell overboard -> respawn on deck
  if (player.feetY < -4) player.teleport(SPAWN.x, SPAWN.y, SPAWN.z);

  camTarget.lerp(new Vector3(player.position.x, player.feetY + 1.3, player.position.z), 0.2);
  hint.textContent = player.position.distanceTo(ship.helm) < 3.5
    ? 'Press E to take the helm'
    : 'Click to move · WASD to walk · Shift to run';
}

function updateHelm(dt) {
  const ax = input.moveAxis();
  nav.speed = MathUtils.clamp(nav.speed + ax.z * dt * 0.5, 0, 1);
  nav.heading += -ax.x * dt * 0.7;
  ship.setSails(nav.speed > 0.02 ? 1 : 0.15);

  if (nav.speed > 0.001) {
    shipYaw = nav.heading;
    shipPos.x += Math.sin(shipYaw) * nav.speed * SAIL_SPEED * dt;
    shipPos.z += Math.cos(shipYaw) * nav.speed * SAIL_SPEED * dt;
    syncWorld();
  }
  // camera sits behind the ship looking forward over the bow
  camTarget.lerp(new Vector3(0, ship.deckY + 2.2, 1), 0.15);
  hint.textContent = `⛵ Helm — W/S sail (${Math.round(nav.speed * 100)}%) · A/D steer · E to step away`;
}

// --- loop ---
let last = performance.now();
let t = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  t += dt;

  physics.step(dt);
  water.update(t, sunDir);
  ship.update(t);
  ship.wheel.rotation.y = Math.sin(t * 0.6) * 0.25 * (mode === 'helm' ? 1 : 0.2);

  if (mode === 'walk') updateWalk(dt);
  else updateHelm(dt);

  orbit.update();
  renderer.render(scene, camera);
  stats.update(dt, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
