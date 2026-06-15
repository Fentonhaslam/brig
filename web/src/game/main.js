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
import { createDayNight } from './world/daynight.js';
import { createMinimap } from './ui/minimap.js';
import { getIdentity } from './player/identity.js';
import { createInventory } from './systems/inventory.js';
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
const built = buildWorld();
worldGroup.add(built.group);
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

// day/night cycle — drives sun, sky, sea, fog, lantern + bloom together
const dayNight = createDayNight({ sun, hemi, sky, water, scene, post, lantern });

// voyage minimap — your position on the crossing relative to both ports
const minimap = createMinimap(built.places, () => ({ x: shipPos.x, z: shipPos.z, yaw: shipYaw }));

// --- physics + player ---
const physics = await initPhysics();
const shipBodies = ship.colliders.map((c) => physics.staticCuboid(c.hx, c.hy, c.hz, c.x, c.y, c.z));
// the bow bulwark — removed while berthed so you can step onto the gangway
const bowIdx = ship.colliders.findIndex((c) => c.hz < 0.5 && c.z > 5);
let bowBody = shipBodies[bowIdx];
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
const { key: guestId, handle } = getIdentity();   // stable across sessions
const inventory = createInventory({ key: guestId, handle }); // cargo + coin, persisted
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

// Space clambers back aboard when treading water alongside the hull
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && player.swimming && nearShipXZ()) {
    player.setSwim(false); swimT = 0;
    player.teleport(SPAWN.x, SPAWN.y, SPAWN.z);
  }
});

// --- sailing state ---
const nav = { speed: 0, heading: 0 }; // speed 0..1, heading radians
const SAIL_SPEED = 44; // faster, so the ocean-spanning crossing isn't a slog

const UP = new Vector3(0, 1, 0);
const fwd = new Vector3();
const right = new Vector3();
const dir = new Vector3();

// --- making landfall ------------------------------------------------------
// When the harbour comes within range we snap the ship to a clean pose (yaw 0)
// so the quay lands at a known scene-space spot, then drop matching walkable
// colliders and open the bow. Casting off removes them and restores the bow.
const harbour = built.harbour;
const BERTH_RANGE = 55;
const _hp = new Vector3();
let berthed = false;
let harbourBodies = [];
let swimT = 0; // seconds in the water (auto-rescue fallback)

function harbourScenePos() { return _hp.copy(harbour.worldPoint).applyMatrix4(worldGroup.matrix); }
const keepDoorScene = new Vector3(harbour.keepDoor.dx, harbour.keepDoor.dy, harbour.keepDoor.dz + harbour.bowGap);

function berth() {
  if (berthed) return;
  berthed = true;
  shipYaw = 0; nav.heading = 0; nav.speed = 0;
  shipPos.set(harbour.worldPoint.x, 0, harbour.worldPoint.z - harbour.bowGap);
  syncWorld();
  // walkable colliders: yaw is 0, so each is just offset + (0,0,bowGap)
  harbourBodies = harbour.colliders.map((c) =>
    physics.staticCuboid(c.hx, c.hy, c.hz, c.dx, c.dy, c.dz + harbour.bowGap));
  if (bowBody) { physics.world.removeRigidBody(bowBody.body); bowBody = null; }
  mode = 'walk'; player.setVisible(true);
  player.teleport(0, ship.deckY + 1.6, 11); // on the bow, by the gangway
  ship.setSails(0.12);
}

function castOff() {
  if (!berthed) return;
  berthed = false;
  harbourBodies.forEach((b) => physics.world.removeRigidBody(b.body));
  harbourBodies = [];
  const c = ship.colliders[bowIdx];
  bowBody = physics.staticCuboid(c.hx, c.hy, c.hz, c.x, c.y, c.z); // restore bow rail
}

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

  // overboard -> swim at the surface; climb aboard near the ship, or be hauled
  // back in after a while if you can't make it
  if (!player.swimming && player.feetY < -1.0) { player.setSwim(true); swimT = 0; }
  if (player.swimming) {
    swimT += dt;
    if (player.feetY > 0.6) { player.setSwim(false); swimT = 0; }                 // climbed out
    else if (swimT > 25) { player.setSwim(false); player.teleport(SPAWN.x, SPAWN.y, SPAWN.z); swimT = 0; }
  }

  camTarget.lerp(new Vector3(player.position.x, player.feetY + 1.3, player.position.z), 0.2);

  // crew proximity / interaction
  nearNpc = crew.nearest(player.position, 2.6);
  if (talking && (!nearNpc || nearNpc !== talking)) hideDialogue();

  if (player.swimming) {
    hint.textContent = nearShipXZ() ? 'Tread water — press Space to climb aboard'
      : 'Overboard! Swim back to the ship';
  } else if (berthed && player.position.z > 15) {
    // ashore on the quay
    hint.textContent = player.position.distanceTo(keepDoorScene) < 6
      ? 'The Keep of Santo Domingo — its chronicles await'
      : 'Ashore at Santo Domingo — walk to the keep · return to the helm to cast off';
  } else if (player.position.distanceTo(ship.helm) < 3.5) {
    hint.textContent = berthed ? 'Press E to take the helm · W to cast off' : 'Press E to take the helm';
  } else if (nearNpc) hint.textContent = `Press F to speak with ${nearNpc.name}`;
  else hint.textContent = berthed ? 'Walk forward over the gangway to go ashore' : 'Click to move · WASD to walk · Shift to run';
}

// is the swimmer alongside the hull (close enough to clamber back aboard)?
function nearShipXZ() {
  return Math.hypot(player.position.x, player.position.z) < ship.beam * 0.7 + 3;
}

function updateHelm(dt) {
  const ax = input.moveAxis();
  if (berthed) {
    if (ax.z > 0.1) castOff();          // push forward to weigh anchor and stand out to sea
    else {
      camTarget.lerp(new Vector3(0, ship.deckY + 2.2, 1), 0.15);
      hint.textContent = '⚓ Berthed at Santo Domingo — W to cast off · E to step ashore';
      return;
    }
  }
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

// dev hook — lets headless checks jump the ship across the map; harmless in prod
window.brig = {
  get shipPos() { return shipPos; },
  get shipYaw() { return shipYaw; },
  setShip(x, z, yaw) { shipPos.x = x; shipPos.z = z; if (yaw != null) shipYaw = yaw; syncWorld(); },
  player, ship, places: built.places, inv: inventory,
  berth, castOff, get berthed() { return berthed; },
  // jump to just off Santo Domingo, ready to auto-berth next frame
  approachHarbour() { this.setShip(harbour.worldPoint.x, harbour.worldPoint.z - 40, 0); },
};

// --- loop ---
let last = performance.now();
let t = 0;
let mapAcc = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  t += dt;

  mapAcc += dt;
  if (mapAcc > 0.15) { minimap.update(); mapAcc = 0; } // ~6 Hz, cheap

  // auto-berth once the harbour comes within range
  if (!berthed) {
    const hp = harbourScenePos();
    if (Math.hypot(hp.x, hp.z) < BERTH_RANGE) berth();
  }

  physics.step(dt);
  const sd = dayNight.update(dt);
  water.update(t, sd);
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
