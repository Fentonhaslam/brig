import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createShip } from './ship.js';
import { createSkyline } from './skyline.js';
import { createIslands } from './islands.js';
import { createPostProcessing } from './post.js';
import { createPlayer } from './player.js';

import { online } from './net/supabase.js';
import { mountAuth, currentProfile } from './net/auth.js';
import { joinWorld } from './net/presence.js';
import { listLore, addLore, subscribeLore } from './net/lore.js';
import { createMonuments } from './world/monuments.js';
import { mountChronicle } from './net/chronicle.js';

// ---------------------------------------------------------------------------
// Enlist / sign in before the world is built (RuneScape-style account gate).
// Resolves immediately to offline play if Supabase isn't configured.
// ---------------------------------------------------------------------------
const { session } = await mountAuth();
const profile = await currentProfile(session);
const me = profile?.handle || (session?.user?.email?.split('@')[0]) || 'Wanderer';

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.42;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd8a070, 0.0018);

// ---------------------------------------------------------------------------
// Camera — 35mm cinematic, low hero angle
// ---------------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.5,
  50000
);
camera.position.set(-46, 10, -32);
camera.lookAt(0, 12, 0);

// ---------------------------------------------------------------------------
// Sun position (shared between sky and water for visual consistency)
// ---------------------------------------------------------------------------
const sun = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Lights — sun + ambient warm fill + cool sky bounce
// ---------------------------------------------------------------------------
const sunLight = new THREE.DirectionalLight(0xffd6a0, 4.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 260;
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);
scene.add(sunLight.target);

const ambient = new THREE.AmbientLight(0xb89070, 0.35);
scene.add(ambient);

const skyFill = new THREE.HemisphereLight(0x80a0c8, 0x2a1a0c, 0.5);
scene.add(skyFill);

// Faint cool moonlight that takes over after sundown
const moon = new THREE.DirectionalLight(0x9fb0d8, 0.0);
moon.position.set(-60, 90, 40);
scene.add(moon);

// Hand torch — a warm spotlight aimed wherever the camera (the player) looks
const torch = new THREE.SpotLight(0xffd9a0, 0, 75, Math.PI * 0.3, 0.5, 1.1);
const torchTarget = new THREE.Object3D();
scene.add(torch, torchTarget);
torch.target = torchTarget;
let torchOn = true;

// ---------------------------------------------------------------------------
// World pieces
// ---------------------------------------------------------------------------
const { sky, setSun } = createSky(scene, sun);
const water = createWater(scene, sun);
const ship = createShip(scene);

// The "world group" holds everything that should slide past the ship as she
// sails — Sevilla astern, La Española and the mainland ahead. The ship stays
// at the origin; steering rotates this group and making way translates it.
const worldGroup = new THREE.Group();
scene.add(worldGroup);
const skyline = createSkyline(scene);
worldGroup.add(skyline);          // reparent Sevilla into the moving world
const islands = createIslands();
worldGroup.add(islands);

const shipPosV = new THREE.Vector3();   // virtual position on the sea
const _yAxis = new THREE.Vector3(0, 1, 0);
let docked = false;
const MAX_SPEED = 30;                    // units/sec at full sail

// --- bow & stern wake — foam on the water that grows with the ship's speed --
const BOW_Z = 18, STERN_Z = -18;
const wake = new THREE.Group();
scene.add(wake);
const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
function wakeStrip(w, l) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), foamMat.clone());
  m.rotation.x = -Math.PI / 2; m.renderOrder = 3;
  return m;
}
// two spreading bow waves, a bright "mustache" right at the stem, a stern wash
const bowL = wakeStrip(5, 30); bowL.position.set(-4, 0.6, BOW_Z - 12);
const bowR = wakeStrip(5, 30); bowR.position.set(4, 0.6, BOW_Z - 12);
const mustache = wakeStrip(11, 7); mustache.position.set(0, 0.62, BOW_Z - 1);
const sternWash = wakeStrip(13, 60); sternWash.position.set(0, 0.55, STERN_Z - 28);
wake.add(bowL, bowR, mustache, sternWash);
function updateWake(speed) {
  const s = Math.max(0, Math.min(1, speed));
  const op = s > 0.02 ? Math.min(0.95, 0.5 + s * 0.5) : 0;
  bowL.material.opacity = op; bowL.scale.set(0.6 + 0.7 * s, 0.5 + s, 1);
  bowR.material.opacity = op; bowR.scale.set(0.6 + 0.7 * s, 0.5 + s, 1);
  mustache.material.opacity = op; mustache.scale.set(0.7 + 0.6 * s, 0.6 + 0.8 * s, 1);
  sternWash.material.opacity = op * 0.9; sternWash.scale.set(0.5 + 1.1 * s, 0.4 + 1.6 * s, 1);
}

// --- driving from the cinematic view: WASD steers/throttles the ship ---------
const navKeys = new Set();
let oHeadingVel = 0;
window.addEventListener('keydown', (e) => {
  navKeys.add(e.code);
  if (e.code === 'Space' && !player.enabled && ship.userData.anchor) {
    ship.userData.anchor.up = !ship.userData.anchor.up;     // weigh / let go from orbit
  }
});
window.addEventListener('keyup', (e) => navKeys.delete(e.code));

function driveShip(dt) {
  const nav = ship.userData.nav;
  if (navKeys.has('KeyW') || navKeys.has('KeyS') || navKeys.has('KeyA') || navKeys.has('KeyD')) {
    controls.autoRotate = false;
  }
  const turn = (navKeys.has('KeyD') ? 1 : 0) - (navKeys.has('KeyA') ? 1 : 0);
  oHeadingVel += turn * dt * 0.5;
  oHeadingVel *= 0.94;
  oHeadingVel = Math.max(-0.6, Math.min(0.6, oHeadingVel));
  nav.heading += oHeadingVel * dt * (0.4 + 0.6 * Math.min(1, Math.abs(nav.speed)));
  const anchorUp = ship.userData.anchor ? ship.userData.anchor.up : true;
  if (!anchorUp) nav.speed -= Math.sign(nav.speed) * Math.min(Math.abs(nav.speed), 1.5 * dt);
  else if (navKeys.has('KeyW')) nav.speed += 0.4 * dt;
  else if (navKeys.has('KeyS')) nav.speed -= 0.5 * dt;
  else nav.speed -= Math.sign(nav.speed) * Math.min(Math.abs(nav.speed), 0.3 * dt);
  nav.speed = Math.max(-0.25, Math.min(1, nav.speed));
  ship.userData.setSails?.(Math.max(0, Math.min(1, nav.speed)));
}

function updateSailing(dt) {
  const nav = ship.userData.nav;
  const atHelm = player.enabled && player.atHelm;
  const orbit = !player.enabled;
  if (orbit) driveShip(dt);   // drive the ship with WASD from the cinematic view

  // integrate virtual position and render the world relative to the fixed ship
  const v = nav.speed * MAX_SPEED;
  if (Math.abs(v) > 0.01) {
    shipPosV.x += Math.sin(nav.heading) * v * dt;
    shipPosV.z += Math.cos(nav.heading) * v * dt;
  }
  worldGroup.rotation.y = -nav.heading;
  worldGroup.position.copy(shipPosV).multiplyScalar(-1).applyAxisAngle(_yAxis, -nav.heading);
  updateWake(nav.speed);

  // HUD — when at the helm or driving from orbit
  if (atHelm || orbit) {
    const dock = islands.userData.dock;
    const range = dock ? Math.hypot(dock.x - shipPosV.x, dock.z - shipPosV.z) : 9999;
    const anchorUp = ship.userData.anchor ? ship.userData.anchor.up : true;
    docked = range < 70 && !anchorUp;
    if (hint) {
      const kn = (nav.speed * 11).toFixed(1);
      const hdg = (((nav.heading * 180 / Math.PI) % 360) + 360) % 360;
      if (docked) {
        hint.textContent = '⚓ Anchored at Santo Domingo — ashore lies the keep · press K to open the Chronicle';
      } else if (atHelm || Math.abs(nav.speed) > 0.01 || navKeys.has('KeyW') || navKeys.has('KeyS') || navKeys.has('KeyA') || navKeys.has('KeyD')) {
        hint.textContent = `⚓ heading ${hdg.toFixed(0)}° · ${kn} kn · anchor ${anchorUp ? 'UP' : 'DOWN'} · `
          + `Santo Domingo ${range > 9000 ? '—' : Math.round(range) + 'm'}  ·  W/S throttle · A/D steer · Space anchor`
          + (atHelm ? ' · E leave' : '');
      } else if (orbit) {
        hint.textContent = 'drag · scroll · WASD to sail · press C to walk aboard';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Day → night cycle. `frac` runs 0..1 over DAY_LENGTH seconds (a full cycle in
// ~30 min). We start mid-morning so it's bright enough to see straight away,
// then it rolls through noon, golden dusk and night and back round.
// ---------------------------------------------------------------------------
const DAY_LENGTH = 1800;     // seconds for a complete day-night cycle
let dayFrac = 0.16;          // start: warm mid-morning, plenty of light
const C_LOW = new THREE.Color(0xffb070);
const C_HIGH = new THREE.Color(0xfff3e2);
const FOG_NIGHT = new THREE.Color(0x0e1320);
const FOG_DAY = new THREE.Color(0xd8a070);

function setTimeOfDay(frac) {
  const phase = frac * Math.PI * 2;
  const elevation = 54 * Math.sin(phase);
  const azimuth = 130 + 90 * frac;
  setSun(elevation, azimuth);                 // updates the shared `sun` vector

  const d = Math.max(0, Math.sin(phase));      // daylight 0 (night) .. 1 (noon)

  sunLight.position.copy(sun).multiplyScalar(160);
  sunLight.target.position.set(0, 8, 0);
  sunLight.target.updateMatrixWorld();
  sunLight.intensity = 0.1 + 4.7 * d;
  sunLight.color.copy(C_LOW).lerp(C_HIGH, d);
  sunLight.castShadow = d > 0.04;

  ambient.intensity = 0.12 + 0.5 * Math.pow(d, 0.7);
  skyFill.intensity = 0.12 + 0.62 * d;
  moon.intensity = 0.32 * (1 - d);

  renderer.toneMappingExposure = 0.5 + 0.3 * d;
  scene.fog.color.copy(FOG_NIGHT).lerp(FOG_DAY, d);
  scene.fog.density = 0.0016 + 0.0007 * (1 - d);

  if (water.material.uniforms['sunDirection']) {
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();
  }
}
setTimeOfDay(dayFrac);

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 12, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 16;
controls.maxDistance = 300;
controls.maxPolarAngle = Math.PI * 0.49; // don't dip below the waterline
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;

// Stop auto-rotate on first interaction so user takes control naturally
renderer.domElement.addEventListener('pointerdown', () => {
  controls.autoRotate = false;
}, { once: true });

// ---------------------------------------------------------------------------
// Walkable character + mode toggle (C = step aboard / cinematic orbit)
// ---------------------------------------------------------------------------
// Ship's bell — a metallic clang synthesised from inharmonic partials
let audioCtx = null;
function playBell() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.value = 0.5; master.connect(audioCtx.destination);
    for (const [mult, amp] of [[1, 1.0], [2.76, 0.55], [5.4, 0.28], [8.9, 0.14]]) {
      const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = 540 * mult;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(amp, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 2.0);
    }
  } catch (e) { /* no audio */ }
}

// Cannon boom — filtered noise burst + a low body thud
function playBoom() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const dur = 1.1;
    const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(120, t0 + 0.5);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.85, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
    src.connect(lp); lp.connect(g); g.connect(audioCtx.destination); src.start(t0);
    const o = audioCtx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.4);
    const og = audioCtx.createGain(); og.gain.setValueAtTime(0.7, t0); og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    o.connect(og); og.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.7);
  } catch (e) { /* no audio */ }
}

// Capstan creak
function playCreak() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(72, t0); o.frequency.linearRampToValueAtTime(55, t0 + 1.0);
    const lp = audioCtx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 300; lp.Q.value = 6;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.1, t0 + 0.15); g.gain.linearRampToValueAtTime(0, t0 + 1.1);
    o.connect(lp); lp.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 1.2);
  } catch (e) { /* no audio */ }
}

// Broadside — muzzle flashes + drifting powder smoke out the starboard ports
const effects = [];
function onBroadside() {
  playBoom();
  const ports = ship.userData.gunports || [];
  const S = ship.userData.scale || 1;
  const out = new THREE.Vector3(1, 0, 0).applyQuaternion(ship.quaternion); // starboard
  for (const local of ports) {
    const world = ship.localToWorld(local.clone());
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffa830, emissiveIntensity: 7, transparent: true, opacity: 1, depthWrite: false }));
    flash.position.copy(world).addScaledVector(out, 0.5 * S);
    scene.add(flash); effects.push({ mesh: flash, t: 0, life: 0.15, kind: 'flash' });
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x707070, transparent: true, opacity: 0.7, depthWrite: false }));
    smoke.position.copy(world).addScaledVector(out, 0.9 * S);
    scene.add(smoke);
    effects.push({ mesh: smoke, t: 0, life: 2.8, kind: 'smoke',
      vel: out.clone().multiplyScalar(0.7 * S).add(new THREE.Vector3(0, 0.5 * S, 0)) });
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = e.t / e.life;
    if (k >= 1) { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); effects.splice(i, 1); continue; }
    if (e.kind === 'flash') {
      e.mesh.material.opacity = 1 - k;
      e.mesh.material.emissiveIntensity = 7 * (1 - k);
      e.mesh.scale.setScalar(1 + k * 1.8);
    } else {
      e.mesh.scale.setScalar(1 + k * 4.5);
      e.mesh.material.opacity = 0.7 * (1 - k);
      e.mesh.position.addScaledVector(e.vel, dt);
    }
  }
}

const player = createPlayer(scene, ship, camera, renderer,
  { onBell: playBell, onBroadside, onCapstan: playCreak });
const hint = document.getElementById('hint');

function setOrbitMode() {
  player.disable();
  controls.enabled = true;
  torch.intensity = 0;
  camera.position.set(-46, 10, -32);
  controls.target.set(0, 12, 0);
  controls.update();
  if (hint) hint.textContent = 'drag · scroll · press C to walk aboard';
}

function setWalkMode() {
  controls.enabled = false;
  controls.autoRotate = false;
  // freeze the ship level so the deck the sailor stands on stays put
  ship.position.set(0, 0, 0);
  ship.rotation.set(0, 0, 0);
  player.enable();
  if (hint) hint.textContent = 'WASD move · shift run · mouse look (click to lock) · C to exit';
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') {
    player.enabled ? setOrbitMode() : setWalkMode();
  }
});

if (hint) hint.textContent = 'drag · scroll · press C to walk aboard';

// Allow deep-linking straight into walk mode (e.g. for a quick look)
if (location.hash.includes('walk')) setWalkMode();
if (location.hash.includes('helm')) { setWalkMode(); player.takeHelm(); }
if (location.hash.includes('talk')) { setWalkMode(); player.talkTo(0); }
if (location.hash.includes('fire')) { onBroadside(); }
if (location.hash.includes('sail')) {
  ship.userData.nav.speed = 0.7; controls.autoRotate = false;
  camera.position.set(34, 13, 40); controls.target.set(0, 3, 14); controls.update();
}
if (location.hash.includes('dock')) {
  setWalkMode(); player.takeHelm();
  const d = islands.userData.dock;
  shipPosV.set(d.x, 0, d.z - 45);
  if (ship.userData.anchor) ship.userData.anchor.up = false;
}

// ---------------------------------------------------------------------------
// Music — Spanish guitar behind the departure (autoplay needs a user gesture)
// ---------------------------------------------------------------------------
const music = new Audio('/theme.mp3');
music.loop = true;
music.volume = 0.5;
let musicStarted = false;
function startMusic() {
  if (musicStarted) return;
  music.play().then(() => { musicStarted = true; }).catch(() => {});
}
window.addEventListener('pointerdown', startMusic);
window.addEventListener('keydown', (e) => {
  startMusic();
  if (e.code === 'KeyM') music.muted = !music.muted;
  if (e.code === 'KeyF') torchOn = !torchOn;
});

// ---------------------------------------------------------------------------
// Online world — the Chronicle (keep archive), lore-monuments, co-presence
// ---------------------------------------------------------------------------
const monuments = createMonuments(islands.userData.court);
const chronicle = mountChronicle({ session, handle: me, online, onInscribe: (e) => monuments.place(e) });

function ingest(entry, prepend = true) { monuments.place(entry); chronicle.addToList(entry, prepend); }
listLore().then((rows) => rows.forEach((e) => ingest(e, false)));
subscribeLore((e) => ingest(e, true));

// always-available way into the keep's Chronicle (also prompted when docked)
const chronBtn = document.createElement('div');
chronBtn.textContent = '📜 The Chronicle';
chronBtn.style.cssText = 'position:absolute;top:24px;right:28px;z-index:30;cursor:pointer;' +
  'color:#e8b860;font-family:"Cormorant Garamond",serif;letter-spacing:2px;font-size:15px;text-shadow:0 2px 8px #000;';
chronBtn.onclick = () => chronicle.open();
document.body.appendChild(chronBtn);
window.addEventListener('keydown', (e) => { if (e.code === 'KeyK') chronicle.open(); });
if (location.hash.includes('chron')) setTimeout(() => chronicle.open(), 700);

// live co-presence — render the other signed-in players moving in real time
const world = joinWorld({ handle: me, userId: session?.user?.id || ('guest-' + Math.floor(Math.random() * 1e6)) });
const peerGroup = new THREE.Group();
scene.add(peerGroup);
const peerAvatars = new Map();

function makeNameSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, 0, 256, 64);
  x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.fillStyle = '#f0dca8';
  x.fillText((text || 'sailor').slice(0, 18), 128, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(2.6, 0.65, 1); s.position.y = 2.1; return s;
}
function buildPeer(handle) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a6a8a, roughness: 0.85 }));
  body.position.y = 0.85; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xb07a52, roughness: 0.8 }));
  head.position.y = 1.4; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ color: 0x1d5a7a, roughness: 0.85 }));
  cap.position.y = 1.46; g.add(cap);
  g.add(makeNameSprite(handle));
  return g;
}
world.onPeers((peers) => {
  for (const [k, av] of peerAvatars) {
    if (!peers.has(k)) { peerGroup.remove(av); peerAvatars.delete(k); }
  }
  for (const [k, meta] of peers) {
    let av = peerAvatars.get(k);
    if (!av) { av = buildPeer(meta.handle); peerGroup.add(av); peerAvatars.set(k, av); }
    av.userData.meta = meta;
  }
});

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------
const composer = createPostProcessing(renderer, scene, camera);

// ---------------------------------------------------------------------------
// Hide loading screen
// ---------------------------------------------------------------------------
requestAnimationFrame(() => {
  setTimeout(() => {
    document.getElementById('loading')?.classList.add('hidden');
  }, 400);
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

const _fwd = new THREE.Vector3();

function animate() {
  const dt = clock.getDelta();
  elapsed += dt;

  // Advance the day → night cycle
  dayFrac = (dayFrac + dt / DAY_LENGTH) % 1;
  setTimeOfDay(dayFrac);

  // Cannon-smoke / muzzle-flash effects
  updateEffects(dt);

  // Sailing — slide the world past the ship when under way at the helm
  updateSailing(dt);

  // Ocean shader time
  if (water.material.uniforms['time']) {
    water.material.uniforms['time'].value = elapsed * 0.6;
  }

  if (player.enabled) {
    // Walking aboard — keep the deck level and steady underfoot
    player.update(dt);

    // Torch follows the look direction so you can light dark corners
    if (torchOn) {
      camera.getWorldDirection(_fwd);
      torch.position.copy(camera.position).addScaledVector(_fwd, 0.4);
      torch.target.position.copy(camera.position).addScaledVector(_fwd, 40);
      torch.target.updateMatrixWorld();
      torch.intensity = 55;
    } else {
      torch.intensity = 0;
    }
  } else {
    // Cinematic — ship gently rides the swell (pitch + roll)
    ship.rotation.z = Math.sin(elapsed * 0.45) * 0.018;
    ship.rotation.x = Math.sin(elapsed * 0.38 + 1.1) * 0.012;
    ship.position.y = Math.sin(elapsed * 0.5) * 0.18 - 0.05;
    controls.update();
  }

  // Sail flutter / flag wave handled inside ship.update()
  if (ship.userData.update) ship.userData.update(elapsed);

  // Online world: grow new memory-stones, broadcast our position, move peers
  monuments.update();
  const now = performance.now();
  world.update(player.sample(), now);
  for (const [, av] of peerAvatars) {
    const m = av.userData.meta;
    if (!m) continue;
    av.position.x += (m.x - av.position.x) * 0.18;
    av.position.y += ((m.y ?? 3.1) - av.position.y) * 0.18;
    av.position.z += (m.z - av.position.z) * 0.18;
    if (typeof m.heading === 'number') av.rotation.y = m.heading;
  }

  composer.render();
}

renderer.setAnimationLoop(animate);

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
