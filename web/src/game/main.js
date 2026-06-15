// Brig — lightweight rebuild (Phase 0 foundation).
//
// Lean three.js: orbital camera, stylized sky + water, flat-shaded low-poly art,
// a perf overlay. No physics engine, no PBR, no reflections, no post stack.
// Built at /game.html so the live Babylon site stays up until this is proven.

import {
  Scene, PerspectiveCamera, Color, Fog, Vector3, Group, Object3D, MathUtils,
  HemisphereLight, DirectionalLight, PointLight,
} from 'three';

import { createRenderer } from './core/renderer.js';
import { createPost } from './core/post.js';
import { createAudio } from './core/audio.js';
import { createStats } from './core/stats.js';
import { createOrbitCam } from './camera/orbit.js';
import { createSky } from './world/sky.js';
import { createWater } from './world/water.js';
import { createShip } from './world/ship.js';
import { buildWorld } from './world/islands.js';
import { initPhysics } from './core/physics.js';
import { createPlayer } from './player/player.js';
import { createInput } from './player/input.js';
import { createCrew } from './world/crew.js';
import { createPeers } from './player/peers.js';
import { joinWorld } from '../net/presence.js';

const canvas = document.getElementById('c');
const renderer = createRenderer(canvas);
const stats = createStats();

const scene = new Scene();
const FOG = 0xd7dcc8; // warm, slightly green haze — grounded Fable mood
scene.background = new Color(FOG);
scene.fog = new Fog(FOG, 320, 1800);

const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 6000);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// --- light direction shared by sky + water + the sun lamp ---
const sunDir = new Vector3(0.45, 0.55, -0.8).normalize();

// warm golden key light + soft earthy fill — grounded, not bright-cartoon
const hemi = new HemisphereLight(0xdfe6d2, 0x55503a, 0.7);
scene.add(hemi);
const sun = new DirectionalLight(0xffe4b0, 1.9);
sun.position.copy(sunDir).multiplyScalar(200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 120;
sun.shadow.camera.far = 330;
{
  const S = 28; // ortho half-extent — frames the ship + a little water around it
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
}
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target); // target stays at the origin, where the ship rides

const sky = createSky(scene);
sky.setSun(sunDir, 0xffe9c0, 0xf0dcae, 0x6f9ec2);
const water = createWater(scene);
// a believable toon sea: deep blue troughs, teal-blue crests (not green)
water.material.uniforms.uDeep.value.set(0x0d3a55);
water.material.uniforms.uShallow.value.set(0x227d92);
water.material.uniforms.uSky.value.set(0xb2d2da);
water.update(0, sunDir);
water.material.uniforms.uFogColor.value.set(FOG);
water.material.uniforms.uFogFar.value = 1800;

// The world (Hispaniola ahead, Sevilla astern) lives under a group whose
// transform is the INVERSE of the ship's world pose. The ship stays fixed at
// the origin pointing north — so its deck is a clean static physics collider —
// while the world slides and turns past it as you sail. (A moving deck would
// make the character controller fight a moving platform; this sidesteps that
// entirely.)
const worldGroup = new Group();
worldGroup.matrixAutoUpdate = false;
worldGroup.add(buildWorld());
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

// warm stern lantern — a local glow the bloom pass picks up at dusk
const lantern = new PointLight(0xffb060, 7, 16, 2.0);
lantern.position.copy(ship.lanternPos);
scene.add(lantern);

// --- orbital camera ---
const camTarget = new Vector3(0, ship.deckY + 1.4, 2);
const orbit = createOrbitCam(camera, canvas, camTarget);
orbit.setRadius(32);

// cinematic post (bloom + warm grade + vignette + grain)
const post = createPost(renderer, scene, camera);

// theme music (starts on first interaction; 🔊 / M to mute)
createAudio('/theme.mp3', 0.4);

// --- physics + player ---
const physics = await initPhysics();
ship.colliders.forEach((c) => physics.staticCuboid(c.hx, c.hy, c.hz, c.x, c.y, c.z));
const SPAWN = new Vector3(0, ship.deckY + 1.6, 3);
const player = createPlayer(physics, scene, SPAWN);

// the ship's company (named crew at their stations)
const crew = createCrew(scene, ship);

// shadow flags — everything solid casts + receives, but the inverted-hull ink
// outlines (ShaderMaterial back-face shells) must NOT, or they'd bleed a fat
// dark halo into the shadow map.
function castShadows(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const isOutline = o.material && o.material.isShaderMaterial;
    o.castShadow = !isOutline;
    o.receiveShadow = !isOutline;
  });
}
castShadows(ship.root);
castShadows(crew.group);
castShadows(player.group);
castShadows(worldGroup);

// other live players over Supabase Realtime (guest co-presence, no login gate)
const peers = createPeers(scene, ship.deckY);
const guestId = 'guest-' + Math.floor(Math.random() * 1e7);
const handle = 'Sailor ' + (1000 + Math.floor(Math.random() * 9000));
const world = joinWorld({ handle, userId: guestId });
world.onPeers((p) => peers.sync(p));

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

// dialogue box (talk to the crew)
const dlg = document.createElement('div');
dlg.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:60;'
  + 'max-width:520px;display:none;font:15px/1.5 Georgia,serif;color:#f3e8cf;'
  + 'background:linear-gradient(180deg,rgba(28,22,14,.93),rgba(18,14,9,.95));'
  + 'padding:14px 20px;border:1px solid rgba(180,150,90,.5);border-radius:8px;'
  + 'box-shadow:0 10px 30px rgba(0,0,0,.5)';
document.body.appendChild(dlg);
let talking = null;
function showDialogue(npc) {
  talking = npc;
  dlg.innerHTML = `<div style="color:#d8b46a;font:600 13px system-ui;letter-spacing:.5px;margin-bottom:6px">`
    + `${npc.name.toUpperCase()} · ${npc.title}</div><div>${npc.lines[0]}</div>`
    + `<div style="color:#9a8a66;font:11px system-ui;margin-top:8px">F to close</div>`;
  dlg.style.display = 'block';
}
function hideDialogue() { talking = null; dlg.style.display = 'none'; }

let nearNpc = null; // crew member in range this frame
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyF') return;
  if (talking) hideDialogue();
  else if (nearNpc && mode === 'walk') showDialogue(nearNpc);
});

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

  // crew proximity / interaction
  nearNpc = crew.nearest(player.position, 2.6);
  if (talking && (!nearNpc || nearNpc !== talking)) hideDialogue();

  if (player.position.distanceTo(ship.helm) < 3.5) hint.textContent = 'Press E to take the helm';
  else if (nearNpc) hint.textContent = `Press F to speak with ${nearNpc.name}`;
  else hint.textContent = 'Click to move · WASD to walk · Shift to run';
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
  crew.update(t);
  peers.update(dt);

  if (mode === 'walk') updateWalk(dt);
  else updateHelm(dt);

  // broadcast our position to other players (throttled inside)
  const pp = player.position;
  world.update({ x: pp.x, y: player.feetY, z: pp.z, heading: 0, mode }, performance.now());

  orbit.update();
  post.render();
  stats.update(dt, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
