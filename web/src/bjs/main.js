// Brig — Babylon.js build. Boots the world and wires every subsystem:
// sky/water/ship/islands/monuments/HUD/post + a Havok character controller with
// modes (walk / orbit-sail / helm / swim / dialogue), sailing + dock/berth, and
// the reused Supabase login / Chronicle / realtime presence.

import {
  Engine, Scene, Color3, Color4, Vector3, Matrix,
  ArcRotateCamera, HemisphericLight, DirectionalLight, ShadowGenerator,
  MeshBuilder, PBRMaterial,
  HavokPlugin, PhysicsAggregate, PhysicsShapeType,
  PhysicsCharacterController, CharacterSupportedState,
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

import { mountAuth, currentProfile } from '../net/auth.js';
import { joinWorld } from '../net/presence.js';
import { listLore, subscribeLore } from '../net/lore.js';
import { mountChronicle } from '../net/chronicle.js';
import { online } from '../net/supabase.js';
import { waveHeight, SEA_LEVEL } from '../world/waves.js';

import { createSky } from './world/sky.js';
import { createWater } from './world/water.js';
import { createShip } from './world/ship.js';
import { createIslands } from './world/islands.js';
import { createMonuments } from './world/monuments.js';
import { createHUD } from './ui/hud.js';
import { createPost } from './fx/post.js';
import { createAvatars } from './player/avatars.js';

// ---- login (reused Supabase) ----
const { session } = await mountAuth();
const profile = await currentProfile(session);
const me = profile?.handle || session?.user?.email?.split('@')[0] || 'Wanderer';

// ---- engine + scene + physics ----
const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { antialias: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.05, 0.07, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogColor = new Color3(0.85, 0.63, 0.44);
scene.fogDensity = 0.0016;
scene.skipPointerMovePicking = true; // interactions use proximity + the E key, not mouse picking

const havok = await HavokPhysics({ locateFile: () => '/HavokPhysics.wasm' });
scene.enablePhysics(new Vector3(0, -22, 0), new HavokPlugin(true, havok));

// ---- camera ----
const camera = new ArcRotateCamera('cam', Math.PI * 1.15, Math.PI * 0.42, 70, new Vector3(0, 8, 0), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 6; camera.upperRadiusLimit = 320;
camera.upperBetaLimit = Math.PI * 0.495; camera.wheelDeltaPercentage = 0.02;

// ---- lights ----
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.45; hemi.diffuse = new Color3(0.5, 0.62, 0.78); hemi.groundColor = new Color3(0.16, 0.1, 0.05);
const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.4, -0.8), scene);
sun.position = new Vector3(60, 90, 120); sun.intensity = 3.2;
// 1024 map with a plain exponential filter — the blurred ESM variant ran extra
// blur passes every frame for a soft edge nobody studies on a moving ship.
const shadow = new ShadowGenerator(1024, sun);
shadow.useExponentialShadowMap = true; shadow.darkness = 0.45;
shadow.getShadowMap().refreshRate = 2; // sun barely moves frame-to-frame

// ---- world ----
const sky = createSky(scene);
const water = createWater(scene);
const post = createPost(scene, camera);
const ship = createShip(scene);
ship.root.getChildMeshes(false).forEach((m) => { if (m.receiveShadows !== undefined) m.receiveShadows = true; shadow.addShadowCaster(m); });

// world group (islands + skyline) slides past the fixed ship while sailing
const islands = createIslands(scene);
const worldGroup = islands.root;          // islands.root acts as the moving world
const monuments = createMonuments(islands.court);
water.addToRenderList(sky.mesh);
ship.root.getChildMeshes(false).forEach((m) => water.addToRenderList(m));

// ---- static physics colliders from the ship ----
function bake(meshes) {
  const handles = [];
  for (const m of meshes) {
    try { handles.push(new PhysicsAggregate(m, PhysicsShapeType.MESH, { mass: 0 }, scene)); }
    catch (e) { /* skip */ }
  }
  return handles;
}
bake([...ship.colliders.walkable, ...ship.colliders.solid]);
// sea catch floor far below
const seaFloor = MeshBuilder.CreateBox('seafloor', { width: 6000, height: 1, depth: 6000 }, scene);
seaFloor.position.y = -40; seaFloor.isVisible = false;
new PhysicsAggregate(seaFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

// ---- HUD + avatars ----
const hud = createHUD(scene, { handle: me });
const avatars = createAvatars(scene);
hud.openChronicleButton?.(() => chronicle.open());

// ---- Chronicle + lore monuments (reused Supabase) ----
const chronicle = mountChronicle({ session, handle: me, online, onInscribe: (e) => monuments.place(e) });
function ingest(e) { monuments.place(e); chronicle.addToList?.(e); }
listLore().then((rows) => rows.forEach(ingest));
subscribeLore(ingest);
window.addEventListener('keydown', (e) => { if (e.code === 'KeyK') chronicle.open(); });

// ---- presence ----
const world = joinWorld({ handle: me, userId: session?.user?.id || ('guest-' + Math.floor(Math.random() * 1e6)) });
world.onPeers((peers) => avatars.sync(peers));

// ===========================================================================
// Navigation / sailing (ship fixed at origin; worldGroup slides past it)
// ===========================================================================
const nav = { heading: 0, speed: 0 };
const shipPosV = new Vector3(0, 0, 0);
const MAX_SPEED = 30;
let docked = false, parked = false, islandHandles = null, gangway = null;
ship.userData = { seaPos: shipPosV };

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function applyWorldTransform() {
  worldGroup.rotation.y = -nav.heading;
  const p = Vector3.TransformCoordinates(shipPosV.scale(-1), Matrix.RotationY(-nav.heading));
  worldGroup.position.copyFrom(p);
}

let oHeadingVel = 0;
function driveShip(dt) {
  const turn = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  oHeadingVel += turn * dt * 0.5; oHeadingVel *= 0.94;
  oHeadingVel = Math.max(-0.6, Math.min(0.6, oHeadingVel));
  nav.heading += oHeadingVel * dt * (0.4 + 0.6 * Math.min(1, Math.abs(nav.speed)));
  const anchorUp = ship.anchor ? ship.anchor.up : true;
  if (!anchorUp) nav.speed -= Math.sign(nav.speed) * Math.min(Math.abs(nav.speed), 1.5 * dt);
  else if (keys.has('KeyW')) nav.speed += 0.4 * dt;
  else if (keys.has('KeyS')) nav.speed -= 0.5 * dt;
  else nav.speed -= Math.sign(nav.speed) * Math.min(Math.abs(nav.speed), 0.3 * dt);
  nav.speed = Math.max(-0.25, Math.min(1, nav.speed));
  ship.setSails(Math.max(0, Math.min(1, nav.speed)));
}

function updateSailing(dt) {
  const v = nav.speed * MAX_SPEED;
  if (Math.abs(v) > 0.01) {
    shipPosV.x += Math.sin(nav.heading) * v * dt;
    shipPosV.z += Math.cos(nav.heading) * v * dt;
  }
  applyWorldTransform();
  const range = Math.hypot(islands.dock.x - shipPosV.x, islands.dock.z - shipPosV.z);
  const anchorUp = ship.anchor ? ship.anchor.up : true;
  docked = range < 70 && !anchorUp;
  if (docked && !parked) parkWorld();
  else if (!docked && parked) unparkWorld();
  return range;
}

function parkWorld() {
  parked = true;
  nav.speed = 0; nav.heading = 0;
  shipPosV.set(-124, 0, 202);
  applyWorldTransform();
  worldGroup.computeWorldMatrix(true);
  islandHandles = bake([...islands.colliders.walkable, ...islands.colliders.solid]);
  buildGangway();
}
function unparkWorld() {
  parked = false;
  if (islandHandles) { islandHandles.forEach((h) => { try { h.dispose(); } catch (e) {} }); islandHandles = null; }
  if (gangway) { gangway.forEach((g) => { try { g.agg.dispose(); g.mesh.dispose(); } catch (e) {} }); gangway = null; }
}
function buildGangway() {
  if (gangway) return;
  const mat = new PBRMaterial('gwmat', scene); mat.albedoColor = new Color3(0.42, 0.29, 0.16); mat.roughness = 0.9;
  const ramp = MeshBuilder.CreateBox('gwramp', { width: 2.4, height: 0.22, depth: 2.4 }, scene);
  ramp.position.set(3.8, 3.95, 0); ramp.rotation.z = 0.77; ramp.material = mat; ramp.metadata = { walkable: true };
  const plank = MeshBuilder.CreateBox('gwplank', { width: 4.8, height: 0.22, depth: 2.2 }, scene);
  plank.position.set(6.6, 3.5, 0); plank.rotation.z = -0.5; plank.material = mat; plank.metadata = { walkable: true };
  gangway = [ramp, plank].map((mesh) => ({ mesh, agg: new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, scene) }));
}

// ===========================================================================
// Player controller + modes
// ===========================================================================
const DOWN = new Vector3(0, -1, 0);
const ZERO = new Vector3(0, 0, 0);
const CAP_OFFSET = 0.89;
const WALK_SPEED = 4.4, RUN_SPEED = 8.5, SWIM_SPEED = 3.0;
const SPAWN = new Vector3(3.5, 4.4, 0);

let mode = 'orbit';        // orbit | walk | helm | swim | dialogue
let cc = null, vy = 0, walkVisible = false;
let talking = null, dlgMode = 'intro', dlgLines = [], dlgIndex = 0;

const avatarBody = MeshBuilder.CreateCapsule('player', { height: 1.78, radius: 0.34 }, scene);
const avMat = new PBRMaterial('pmat', scene); avMat.albedoColor = new Color3(0.6, 0.28, 0.18); avMat.roughness = 0.85;
avatarBody.material = avMat; avatarBody.isVisible = false; shadow.addShadowCaster(avatarBody);

function ensureChar() {
  if (!cc) cc = new PhysicsCharacterController(SPAWN.clone(), { capsuleHeight: 1.78, capsuleRadius: 0.34 }, scene);
}
function setMode(m) {
  mode = m;
  walkVisible = (m === 'walk' || m === 'swim' || m === 'dialogue');
  avatarBody.isVisible = walkVisible;
  if (m === 'walk' || m === 'swim') { ensureChar(); }
  if (m === 'orbit') { camera.attachControl(canvas, true); }
}
function enterWalk() { setMode('walk'); ensureChar(); cc.setVelocity(ZERO); }
function moveDir() {
  const f = camera.getDirection(Vector3.Forward()); f.y = 0; f.normalize();
  const r = camera.getDirection(Vector3.Right()); r.y = 0; r.normalize();
  const d = new Vector3(0, 0, 0);
  if (keys.has('KeyW')) d.addInPlace(f);
  if (keys.has('KeyS')) d.subtractInPlace(f);
  if (keys.has('KeyD')) d.addInPlace(r);
  if (keys.has('KeyA')) d.subtractInPlace(r);
  return d;
}

function updateWalk(dt) {
  const support = cc.checkSupport(dt, DOWN);
  const grounded = support.supportedState === CharacterSupportedState.SUPPORTED;
  const d = moveDir();
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? RUN_SPEED : WALK_SPEED;
  if (d.lengthSquared() > 0) d.normalize().scaleInPlace(speed);
  if (grounded) vy = keys.has('Space') ? 8 : -1; else vy -= 22 * dt;
  cc.setVelocity(new Vector3(d.x, vy, d.z));
  cc.integrate(dt, support, ZERO);
  const p = cc.getPosition();
  // fell into the sea -> swim
  if (!grounded && p.y - CAP_OFFSET < SEA_LEVEL + 0.4) { setMode('swim'); }
  placeAvatar(p, d);
  followCam(p, 1.5);
}

function updateSwim(dt) {
  const d = moveDir();
  if (d.lengthSquared() > 0) d.normalize().scaleInPlace(SWIM_SPEED);
  const support = cc.checkSupport(dt, DOWN);
  const grounded = support.supportedState === CharacterSupportedState.SUPPORTED;
  const cpos = cc.getPosition();
  const feet = cpos.y - CAP_OFFSET;
  const surf = waveHeight(cpos.x + shipPosV.x, cpos.z + shipPosV.z, clock);
  const diving = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const targetFeet = diving ? Math.max(-6, feet - 1.4) : surf - 0.45;
  const dy = Math.max(-3, Math.min(3, (targetFeet - feet) * 4));
  cc.setVelocity(new Vector3(d.x, dy, d.z));
  cc.integrate(dt, support, ZERO);
  const p = cc.getPosition();
  if (grounded && p.y - CAP_OFFSET > SEA_LEVEL + 0.3) setMode('walk');
  placeAvatar(p, d);
  followCam(p, 0.9);
  hud.setHint?.('Swimming · WASD swim · hold Shift to dive · reach the beach to climb ashore');
}

let facing = 0;
function placeAvatar(p, d) {
  avatarBody.position.set(p.x, p.y, p.z);
  if (d && d.lengthSquared() > 0.001) facing = Math.atan2(d.x, d.z);
  avatarBody.rotation.y = facing;
}
function followCam(p, eye) {
  camera.setTarget(new Vector3(p.x, p.y + eye, p.z));
}

// ---- helm ----
let helmActive = false;
function helmWorldStand() {
  return Vector3.TransformCoordinates(ship.helmStand, ship.root.getWorldMatrix());
}
function enterHelm() { helmActive = true; setMode('helm'); camera.detachControl(); }
function exitHelm() { helmActive = false; setMode('orbit'); ship.root.rotation.set(0, 0, 0); ship.root.position.y = 0; }
function updateHelm(dt) {
  const turn = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  oHeadingVel += turn * dt * 0.5; oHeadingVel *= 0.94;
  oHeadingVel = Math.max(-0.6, Math.min(0.6, oHeadingVel));
  nav.heading += oHeadingVel * dt * (0.4 + 0.6 * Math.min(1, Math.abs(nav.speed)));
  if (keys.has('KeyW')) nav.speed += 0.4 * dt;
  if (keys.has('KeyS')) nav.speed -= 0.5 * dt;
  nav.speed = Math.max(-0.25, Math.min(1, nav.speed));
  ship.setSails(Math.max(0, Math.min(1, nav.speed)));
  if (ship.wheel) ship.wheel.rotation.z = -oHeadingVel * 6;
  // commanding camera over the poop, looking forward
  const stand = helmWorldStand();
  camera.setTarget(new Vector3(stand.x, stand.y + 1, stand.z + 9));
  camera.setPosition(new Vector3(stand.x, stand.y + 6, stand.z - 6));
}

// ---- anchor visual ----
function updateAnchor(dt) {
  if (!ship.anchor) return;
  const ty = ship.anchor.up ? ship.anchor.upY : ship.anchor.downY;
  ship.anchor.node.position.y += (ty - ship.anchor.node.position.y) * Math.min(1, dt * 1.6);
}

// ===========================================================================
// Interactions (E) — nearest of helm / npcs / crew / bell / capstan / gun
// ===========================================================================
const npcs = ship.npcs || [];
function worldOf(local) { return Vector3.TransformCoordinates(local, ship.root.getWorldMatrix()); }
function interactables() {
  const list = [{ world: helmWorldStand(), range: 3.0, prompt: '⚓ Press E to take the helm', go: enterHelm }];
  for (const npc of npcs) {
    list.push({ world: worldOf(npc.local), range: 3.0, prompt: `Press E to speak with ${npc.title} ${npc.name}`, go: () => startDialogue(npc) });
  }
  if (ship.capstanStation) {
    const stowed = ship.anchor && ship.anchor.up;
    list.push({ world: worldOf(ship.capstanStation), range: 3.0, prompt: `Press E to ${stowed ? 'let go the' : 'weigh the'} anchor`, go: () => { if (ship.anchor) ship.anchor.up = !ship.anchor.up; } });
  }
  return list;
}
function nearest() {
  if (!walkVisible || !cc) return null;
  const p = cc.getPosition();
  let best = null, bd = Infinity;
  for (const it of interactables()) {
    const d = Vector3.Distance(p, it.world);
    if (d < it.range && d < bd) { best = it; bd = d; }
  }
  return best;
}

function startDialogue(npc) {
  talking = npc; dlgMode = 'intro'; dlgLines = npc.lines; dlgIndex = 0;
  setMode('dialogue');
  renderDialogue();
}
function renderDialogue() {
  const name = `${talking.title} ${talking.name}`.trim();
  if (dlgMode === 'choices') hud.dialogue.showChoices(name, talking.choices.map((c) => c.q));
  else hud.dialogue.show(name, dlgLines[dlgIndex]);
}
function advanceDialogue() {
  if (dlgMode === 'choices') { endDialogue(); return; }
  dlgIndex++;
  if (dlgIndex < dlgLines.length) { renderDialogue(); return; }
  if ((dlgMode === 'intro' || dlgMode === 'reply') && talking.choices && talking.choices.length) { dlgMode = 'choices'; renderDialogue(); }
  else endDialogue();
}
function selectChoice(n) {
  if (dlgMode !== 'choices' || !talking.choices[n]) return;
  dlgMode = 'reply'; dlgLines = talking.choices[n].reply; dlgIndex = 0; renderDialogue();
}
function endDialogue() { talking = null; hud.dialogue.hide(); setMode('walk'); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && !e.repeat) {
    if (mode === 'orbit') enterWalk();
    else { if (helmActive) exitHelm(); else { setMode('orbit'); camera.setTarget(new Vector3(0, 8, 0)); } }
  } else if (e.code === 'KeyE' && !e.repeat) {
    if (helmActive) { exitHelm(); return; }
    if (talking) { advanceDialogue(); return; }
    const it = nearest(); if (it) it.go();
  } else if (talking && dlgMode === 'choices' && /Digit[123]/.test(e.code) && !e.repeat) {
    selectChoice(parseInt(e.code.slice(5), 10) - 1);
  } else if (e.code === 'Space' && (mode === 'orbit' || helmActive) && !e.repeat && ship.anchor) {
    ship.anchor.up = !ship.anchor.up;
  }
});

// ===========================================================================
// Day / night
// ===========================================================================
const DAY_LENGTH = 1800;
let dayFrac = 0.16;
const C_LOW = new Color3(1.0, 0.69, 0.44), C_HIGH = new Color3(1.0, 0.95, 0.88);
const FOG_NIGHT = new Color3(0.05, 0.07, 0.12), FOG_DAY = new Color3(0.85, 0.63, 0.44);
function setTimeOfDay(frac) {
  const phase = frac * Math.PI * 2;
  const elev = 54 * Math.sin(phase);
  const sunDir = sky.setSun(elev, 130 + 90 * frac);
  if (sunDir) sun.direction = sunDir.scale(-1);
  const d = Math.max(0, Math.sin(phase));
  sun.intensity = 0.1 + 3.4 * d;
  Color3.LerpToRef(C_LOW, C_HIGH, d, sun.diffuse);
  hemi.intensity = 0.12 + 0.5 * Math.pow(d, 0.7);
  Color3.LerpToRef(FOG_NIGHT, FOG_DAY, d, scene.fogColor);
  scene.fogDensity = 0.0016 + 0.0007 * (1 - d);
  if (post && post.imageProcessing) post.imageProcessing.exposure = 0.7 + 0.5 * d;
}

// ===========================================================================
// Render loop
// ===========================================================================
let clock = 0;
// Realtime is meant for a few messages/sec, not 60. Broadcasting our position
// every frame floods the channel and makes everyone feel laggy. Send at ~12 Hz
// — avatars.js interpolates between updates so motion still looks smooth.
const NET_INTERVAL = 1 / 12;
let netAccum = 0;
function broadcast(dt) {
  netAccum += dt;
  if (netAccum < NET_INTERVAL) return;
  netAccum = 0;
  const p = cc ? cc.getPosition() : SPAWN;
  world.update?.({ x: p.x, y: p.y - CAP_OFFSET, z: p.z, heading: facing, mode }, performance.now());
}
scene.onBeforeRenderObservable.add(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.033);
  if (dt <= 0) return;
  clock += dt;
  dayFrac = (dayFrac + dt / DAY_LENGTH) % 1;
  setTimeOfDay(dayFrac);
  water.update?.(clock);
  monuments.update?.();
  updateAnchor(dt);
  avatars.update?.(dt);

  if (helmActive) { driveShipHelmActive(dt); }
  else if (mode === 'walk') { updateWalk(dt); }
  else if (mode === 'swim') { updateSwim(dt); }
  else if (mode === 'dialogue') { /* frozen; camera held */ }
  else { driveShip(dt); ship.root.rotation.set(0, 0, 0); } // orbit: WASD sails

  const range = updateSailing(dt);

  // HUD
  if (mode === 'orbit' || helmActive) {
    const anchorUp = ship.anchor ? ship.anchor.up : true;
    if (docked) hud.setHint?.('⚓ Berthed at Santo Domingo — press C to walk the deck and down the gangway · K for the Chronicle');
    else hud.setHelm?.({ heading: ((nav.heading * 180 / Math.PI) % 360 + 360) % 360, knots: (nav.speed * 11), sail: Math.round(Math.max(0, nav.speed) * 100), anchor: anchorUp ? 'UP' : 'DOWN', range: range > 9000 ? '—' : Math.round(range) + 'm' });
  } else if (mode === 'walk') {
    const it = nearest();
    if (it) { hud.showPrompt?.(it.prompt); hud.reticle?.show?.(); }
    else { hud.hidePrompt?.(); hud.setHint?.('WASD move · shift run · space jump · E interact · C exit'); }
  }
  broadcast(dt);
});
function driveShipHelmActive(dt) { updateHelm(dt); }

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
setTimeOfDay(dayFrac);

// deep-links for quick testing
if (location.hash.includes('walk')) enterWalk();
