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
import { createWeather } from './world/weather.js';
import { createAmbiance } from './world/ambiance.js';
import { createSeaLife } from './world/sealife.js';
import { createMinimap } from './ui/minimap.js';
import { createDialogue } from './ui/dialogue.js';
import { getIdentity } from './player/identity.js';
import { createInventory } from './systems/inventory.js';
import { createLore, createInscribePanel } from './systems/lore.js';
import { createAccount } from './systems/account.js';
import { createCannons } from './systems/cannons.js';
import { createSpray } from './systems/spray.js';
import { createCombat } from './systems/combat.js';
import { createRefit } from './systems/refit.js';
import { createMarket } from './systems/market.js';
import { createPurse } from './ui/purse.js';
import { initPhysics } from './core/physics.js';
import { createPlayer } from './player/player.js';
import { createInput } from './player/input.js';
import { createCrew } from './world/crew.js';
import { createTownsfolk } from './world/townsfolk.js';
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
const _peerWorld = new Vector3(); // scratch for scene->world peer broadcast
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
water.setShip(ship.beam, ship.length); // foam collar hugs the hull at the waterline

// warm stern lantern — a local glow the bloom pass picks up at dusk
const lantern = new PointLight(0xffb060, 7, 16, 2.0);
lantern.position.copy(ship.lanternPos);
scene.add(lantern);

// a soft lantern that follows the player — lights the deck around you after
// dark so you can always see where you're walking (fades out by day)
const torch = new PointLight(0xffd6a0, 0, 11, 1.6);
scene.add(torch);

// a warm lamp in the hold, so the below-deck is lit even though it's enclosed
const holdLamp = new PointLight(0xffcf8a, 7, 16, 1.7);
holdLamp.position.set(0, ship.deckY - 1.4, 1.4);
scene.add(holdLamp);

// --- orbital camera ---
const camTarget = new Vector3(0, ship.deckY + 1.4, 2);
const orbit = createOrbitCam(camera, canvas, camTarget);
// camera distance by context: close third-person on foot, pulled back to see
// the whole ship at the helm, right in tight for a conversation
const CAM = { walk: 13, helm: 34, talk: 6.5 };
orbit.setRadius(CAM.walk);

// cinematic post (bloom + warm grade + vignette + grain)
const post = createPost(renderer, scene, camera);

// theme music (starts on first interaction; 🔊 / M to mute)
createAudio('/theme.mp3', 0.4);

// day/night cycle — drives sun, sky, sea, fog, lantern + bloom together
const dayNight = createDayNight({ renderer, sun, hemi, sky, water, scene, post, lantern });
// weather — storms that grey the sky, whip up the sea, rain + lightning
const weather = createWeather({ scene, water, sky, camera });
// fair-weather ambiance — gulls wheeling overhead + a soft sun/moon disc
const ambiance = createAmbiance(scene);
// a pod of dolphins (+ the odd whale) porpoising in calm open water
const sealife = createSeaLife(scene);

// voyage minimap — your position on the crossing relative to both ports
const minimap = createMinimap(built.places, () => ({ x: shipPos.x, z: shipPos.z, yaw: shipYaw }));

// --- physics + player ---
const physics = await initPhysics();
const shipBodies = ship.colliders.map((c) => physics.staticCuboid(c.hx, c.hy, c.hz, c.x, c.y, c.z, c.rot));
// the bow bulwark — removed while berthed so you can step onto the gangway
const bowIdx = ship.colliders.findIndex((c) => c.hz < 0.5 && c.z > 5);
let bowBody = shipBodies[bowIdx];
const SPAWN = new Vector3(0, ship.deckY + 1.6, 3);
const player = createPlayer(physics, scene, SPAWN);

// foam spray off the bow (scales with weather + speed)
const spray = createSpray(scene, ship);

// run out the guns (R) + ring the bell (B)
const cannons = createCannons(scene, physics, ship);
window.addEventListener('keydown', (e) => {
  if (dialogue.isOpen || inscribe.isOpen || player.swimming) return;
  if (e.code === 'KeyR') cannons.fire();
  else if (e.code === 'KeyB') cannons.ringBell();
});

// the ship's company (named crew at their stations)
const crew = createCrew(scene, ship);
// townsfolk ashore — spawned when you berth, cleared when you cast off
const townsfolk = createTownsfolk(scene);

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
// the world chronicle as memory-stones in the keep courtyard
const lore = createLore({ group: built.harbours[0].group, anchor: built.harbours[0].courtyard, handle, key: guestId });
const inscribe = createInscribePanel((t, b) => lore.inscribe(t, b));
// refit — name + recolour the ship (applied live + persisted)
const refit = createRefit({ ship, key: guestId });
// market — buy/sell cargo at the active port (prices differ between ports)
const market = createMarket({ inventory, getPort: () => (activeHarbour ? activeHarbour.name : null) });
// always-visible coin + profit-since-port readout
const purse = createPurse(inventory);
// enemy ships you can sink for loot (needs inventory + cannons)
const combat = createCombat({
  scene, physics, inventory, cannons, ship,
  getStorm: () => weather.storm,
  getBerthed: () => berthed,
  // only in open ocean — well clear of Sevilla (the start) and Santo Domingo
  getOpenWater: () => shipPos.z > built.harbours[1].worldPoint.z + 700 && shipPos.z < built.harbours[0].worldPoint.z - 500,
});
// optional, non-blocking sign-in — upgrades saves to a cross-device account
const account = createAccount();
account.onSignIn(({ session, handle: h, userId }) => {
  inventory.setAccount(userId, h);  // cargo follows the account
  lore.setSession(session, h);      // inscriptions become permanent + world-shared
  refit.setKey('acct:' + userId);   // ship name/colours follow the account
});
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
    mode = 'helm'; moveTarget = null; player.setVisible(false); orbit.setRadius(CAM.helm);
  } else if (mode === 'helm') {
    mode = 'walk'; player.setVisible(true); orbit.setRadius(CAM.walk);
    player.teleport(ship.helm.x, ship.deckY + 1.6, ship.helm.z + 1.5);
  }
});

// hint strip
const hint = document.createElement('div');
hint.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:50;'
  + 'font:600 14px/1.4 system-ui,sans-serif;color:#fff;background:rgba(10,30,45,.55);'
  + 'padding:8px 16px;border-radius:20px;letter-spacing:.3px;pointer-events:none;backdrop-filter:blur(3px)';
document.body.appendChild(hint);

// helm readout (compass heading + sail %) — shown only at the wheel
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const helmHud = document.createElement('div');
helmHud.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:55;display:none;'
  + 'font:600 13px system-ui;color:#f3e8cf;background:rgba(10,30,45,.55);backdrop-filter:blur(3px);'
  + 'padding:8px 16px;border-radius:12px;text-align:center;min-width:190px;letter-spacing:.4px;pointer-events:none';
document.body.appendChild(helmHud);

// branching conversations with the crew
const dialogue = createDialogue();

let nearNpc = null;     // crew member in range this frame
let talkingNpc = null;  // who we're framed on during a conversation
window.addEventListener('keydown', (e) => {
  // while a conversation is open, the keys drive the choices
  if (dialogue.isOpen) {
    if (e.key === 'Escape') dialogue.close();
    else if (e.code === 'KeyF') dialogue.choose(0);
    else { const n = parseInt(e.key, 10); if (n >= 1 && n <= 9) dialogue.choose(n - 1); }
    return;
  }
  if (e.code !== 'KeyF') return;
  if (inscribe.isOpen) { inscribe.hide(); return; }
  if (berthed && mode === 'walk' && activeHarbour?.kind === 'keep' && player.position.distanceTo(keepDoorScene) < 6) { inscribe.show(); return; }
  if (nearNpc && mode === 'walk') { dialogue.open(nearNpc); frameTalk(nearNpc); }
});

// swing the camera in tight over the player's shoulder, looking at the NPC
function frameTalk(npc) {
  talkingNpc = npc;
  npc.frozen = true; // stop them wandering off mid-conversation
  const a = Math.atan2(npc.pos.x - player.position.x, npc.pos.z - player.position.z);
  orbit.setYaw(a + Math.PI + 0.45); // behind the player, angled three-quarter
  orbit.setPitch(0.3);
  orbit.setRadius(CAM.talk);
}

// Space jumps on deck (to get up onto things), or clambers back aboard when
// you're treading water alongside the hull
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (player.swimming) {
    if (nearShipXZ()) { player.setSwim(false); swimT = 0; player.teleport(SPAWN.x, SPAWN.y, SPAWN.z); }
  } else if (mode === 'walk' && !dialogue.isOpen && !inscribe.isOpen) {
    player.jump();
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
// Either port can be visited. When a harbour comes within range we snap the
// ship to that port's approach heading so its quay lands ahead of the bow, then
// drop its walkable colliders (transformed through the world matrix) and open
// the bow. Casting off removes them and restores the bow.
const harbours = built.harbours;
const BERTH_RANGE = 60;
const _hp = new Vector3();
const _cv = new Vector3();
let berthed = false;
let activeHarbour = null;
let berthCooldown = 0; // grace after casting off, so we don't instantly re-berth
let harbourBodies = [];
let swimT = 0; // seconds in the water (auto-rescue fallback)
const keepDoorScene = new Vector3(0, 0, 1e6); // door of the active port, scene space

function harbourScene(h) { return _hp.copy(h.worldPoint).applyMatrix4(worldGroup.matrix); }

function berth(h) {
  if (berthed) return;
  berthed = true; activeHarbour = h;
  shipYaw = h.approachYaw; nav.heading = h.approachYaw; nav.speed = 0;
  // place the ship bowGap back from the quay along the approach heading, so the
  // quay renders just ahead of the (origin-fixed) bow
  shipPos.set(h.worldPoint.x - Math.sin(shipYaw) * h.bowGap, 0, h.worldPoint.z - Math.cos(shipYaw) * h.bowGap);
  syncWorld();
  // colliders: world matrix maps each offset to scene space; the box turns with
  // the world (-shipYaw) to match the rotated quay meshes
  const rot = [0, -shipYaw, 0];
  harbourBodies = h.colliders.map((c) => {
    _cv.set(h.worldPoint.x + c.dx, h.worldPoint.y + c.dy, h.worldPoint.z + c.dz).applyMatrix4(worldGroup.matrix);
    return physics.staticCuboid(c.hx, c.hy, c.hz, _cv.x, _cv.y, _cv.z, rot);
  });
  keepDoorScene.set(h.worldPoint.x + h.keepDoor.dx, h.worldPoint.y + h.keepDoor.dy, h.worldPoint.z + h.keepDoor.dz).applyMatrix4(worldGroup.matrix);
  // people ashore — placed against the now-fixed world matrix, then shadowed
  townsfolk.populate(h, worldGroup.matrix);
  castShadows(townsfolk.group);
  if (bowBody) { physics.world.removeRigidBody(bowBody.body); bowBody = null; }
  mode = 'walk'; player.setVisible(true); orbit.setRadius(CAM.walk);
  player.teleport(0, ship.deckY + 1.6, ship.length * 0.4); // up by the bow / gangway
  purse.setMark(); // profit readout resets each time you make port
  ship.setSails(0.12);
}

function castOff() {
  if (!berthed) return;
  berthed = false; activeHarbour = null;
  berthCooldown = 6; // sail clear before the port can grab us again
  keepDoorScene.set(0, 0, 1e6);
  harbourBodies.forEach((b) => physics.world.removeRigidBody(b.body));
  harbourBodies = [];
  townsfolk.clear();
  const c = ship.colliders[bowIdx];
  bowBody = physics.staticCuboid(c.hx, c.hy, c.hz, c.x, c.y, c.z); // restore bow rail
}

function updateWalk(dt) {
  const ax = dialogue.isOpen ? { x: 0, z: 0 } : input.moveAxis(); // hold still while talking
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
  // back in after a while. Only counts if you're OUTSIDE the hull footprint —
  // otherwise descending into the (near-waterline) hold would read as overboard.
  const overHull = Math.abs(player.position.x) < ship.beam * 0.55 && Math.abs(player.position.z) < ship.length * 0.52;
  if (!player.swimming && player.feetY < -1.2 && !overHull) { player.setSwim(true); swimT = 0; }
  if (player.swimming) {
    swimT += dt;
    if (player.feetY > 0.6) { player.setSwim(false); swimT = 0; }                 // climbed out
    else if (swimT > 25) { player.setSwim(false); player.teleport(SPAWN.x, SPAWN.y, SPAWN.z); swimT = 0; }
  }

  if (dialogue.isOpen && talkingNpc) {
    // frame a two-shot: midpoint of player + NPC, at head height
    const np = talkingNpc.pos;
    camTarget.lerp(new Vector3((player.position.x + np.x) / 2, np.y + 1.1, (player.position.z + np.z) / 2), 0.18);
  } else {
    if (talkingNpc) { talkingNpc.frozen = false; talkingNpc = null; orbit.setRadius(CAM.walk); orbit.setPitch(0.4); } // conversation ended
    camTarget.lerp(new Vector3(player.position.x, player.feetY + 1.3, player.position.z), 0.2);
  }

  // crew + townsfolk proximity (the two are an ocean apart, so at most one is
  // ever in range); walk away to end a chat
  nearNpc = townsfolk.nearest(player.position, 2.6) || crew.nearest(player.position, 2.6);
  if (dialogue.isOpen && !nearNpc) dialogue.close();

  if (dialogue.isOpen) { /* hint stays as the conversation */ }
  else if (player.swimming) {
    hint.textContent = nearShipXZ() ? 'Tread water — press Space to climb aboard'
      : 'Overboard! Swim back to the ship';
  } else if (berthed && player.position.z > 15) {
    // ashore on the quay
    const port = activeHarbour?.name || 'port';
    if (activeHarbour?.kind === 'keep' && player.position.distanceTo(keepDoorScene) < 6) {
      hint.textContent = `The Keep of ${port} — press F to inscribe a memory-stone`;
    } else if (nearNpc) {
      hint.textContent = `Press F to speak with ${nearNpc.name}`;
    } else {
      hint.textContent = `Ashore at ${port} — press T to trade at the market · return to the helm to cast off`;
    }
  } else if (player.position.distanceTo(ship.helm) < 3.5) {
    hint.textContent = berthed ? 'Press E to take the helm · W to cast off' : 'Press E to take the helm';
  } else if (nearNpc) hint.textContent = `Press F to speak with ${nearNpc.name}`;
  else hint.textContent = berthed ? 'Walk forward over the gangway to go ashore' : 'WASD/click move · Space jump · Shift run · R guns · B bell';
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
      hint.textContent = `⚓ Berthed at ${activeHarbour?.name || 'port'} — W to cast off · E to step ashore`;
      return;
    }
  }
  nav.speed = MathUtils.clamp(nav.speed + ax.z * dt * 0.5, 0, 1);
  nav.heading += -ax.x * dt * 0.7;                          // steering sets a target heading…
  // wind: a crosswind nudges the head, and you make more way with the wind
  // astern than beating into it — but gently, so the helm stays in command
  const wind = weather.wind, windDir = weather.windDir;
  const rel = Math.atan2(Math.sin(windDir - shipYaw), Math.cos(windDir - shipYaw)); // -PI..PI off the bow
  nav.heading += Math.sin(rel) * wind * 0.18 * dt;          // subtle weather-helm
  shipYaw = MathUtils.damp(shipYaw, nav.heading, 2.4, dt);  // …the hull eases onto it (no snap)
  ship.setSails(0.18 + 0.82 * nav.speed);                   // canvas fills with way
  ship.wheel.rotation.y += -ax.x * dt * 2.2;                // spin the wheel as you steer

  const windAid = 1 + Math.cos(rel) * wind * 0.3;           // tail-wind boosts, head-wind slows
  shipPos.x += Math.sin(shipYaw) * nav.speed * SAIL_SPEED * windAid * dt;
  shipPos.z += Math.cos(shipYaw) * nav.speed * SAIL_SPEED * windAid * dt;
  syncWorld();

  // camera sits behind the ship looking forward over the bow
  camTarget.lerp(new Vector3(0, ship.deckY + 2.2, 1), 0.15);
  hint.textContent = '⛵ Helm — W/S sail · A/D steer · E to step away';

  // compass + speed + wind readout
  const deg = (((shipYaw * 180) / Math.PI) % 360 + 360) % 360;
  const card = COMPASS[Math.round(deg / 45) % 8];
  const spd = Math.round(nav.speed * 100);
  const windPct = Math.round(wind * 100);
  const windRotDeg = (rel * 180) / Math.PI; // wind heading relative to the bow (up)
  helmHud.innerHTML = `<div>🧭 ${card} · ${Math.round(deg)}°&nbsp;&nbsp;·&nbsp;&nbsp;⛵ ${spd}%</div>`
    + `<div style="margin-top:6px;height:6px;background:rgba(0,0,0,.4);border-radius:3px;overflow:hidden">`
    + `<div style="height:100%;width:${spd}%;background:linear-gradient(90deg,#c9923a,#f0d070);transition:width .15s"></div></div>`
    + `<div style="margin-top:6px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px">`
    + `<span style="display:inline-block;transform:rotate(${windRotDeg.toFixed(0)}deg)">⬆</span> wind ${windPct}%</div>`;
}

// dev hook — lets headless checks jump the ship across the map; harmless in prod
window.brig = {
  get shipPos() { return shipPos; },
  get shipYaw() { return shipYaw; },
  setShip(x, z, yaw) { shipPos.x = x; shipPos.z = z; if (yaw != null) shipYaw = yaw; syncWorld(); },
  player, ship, places: built.places, inv: inventory, lore, inscribe,
  dialogue, crew, townsfolk, peers, dayNight,
  berth, castOff, get berthed() { return berthed; },
  harbours, get activeHarbour() { return activeHarbour; }, water, orbit, cannons, refit, weather, market, sealife,
  spawnEnemy: () => combat.spawn(), get enemy() { return combat.enemy; }, get playerHp() { return combat.playerHp; }, combatDbg: () => combat.dbg(), testFire: () => combat.testFire(),
  // jump to just off a port (default Santo Domingo), ready to auto-berth
  approachHarbour(name) {
    const h = harbours.find((x) => x.name === name) || harbours[0];
    this.setShip(h.worldPoint.x - Math.sin(h.approachYaw) * 38, h.worldPoint.z - Math.cos(h.approachYaw) * 38, h.approachYaw);
  },
  walk(dx, dz, run) { player.walk(dx, dz, run); }, // for headless movement tests
  // map a berthed harbour's design coords -> scene space (QA: place/check things
  // against the baked land); dy defaults to the walkable ground surface
  sceneAt(dx, dz, dy) {
    if (!activeHarbour) return null;
    const h = activeHarbour;
    const v = new Vector3(h.worldPoint.x + dx, h.worldPoint.y + (dy ?? h.walkY), h.worldPoint.z + dz * h.dir).applyMatrix4(worldGroup.matrix);
    return { x: v.x, y: v.y, z: v.z };
  },
};

// start the voyage berthed at Sevilla — you begin in port, step ashore into the
// city, then take the helm and cast off when you're ready to cross
berth(harbours.find((h) => h.name === 'Sevilla') || harbours[1]);

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

  // auto-berth at whichever port comes within range (after the cast-off grace)
  if (berthCooldown > 0) berthCooldown -= dt;
  if (!berthed && berthCooldown <= 0) {
    for (const h of harbours) {
      const p = harbourScene(h);
      if (Math.hypot(p.x, p.z) < BERTH_RANGE) { berth(h); break; }
    }
  }

  physics.step(dt);
  const sd = dayNight.update(dt);
  water.update(t, sd, null, nav.speed); // wake strengthens with sail speed
  weather.update(dt);                   // storms layer over the time of day
  ship.update(t, weather.storm);        // sails + banner whip with the wind
  orbit.setStorm(weather.storm);        // the view rocks in a swell
  spray.update(dt, weather.storm, nav.speed); // foam off the bow
  ambiance.update(dt, t, weather.storm, dayNight.dayAmount, dayNight.sunDir, camera.position);
  sealife.update(dt, t, weather.storm, camera.position, berthed);
  if (mode !== 'helm') ship.wheel.rotation.y = Math.sin(t * 0.6) * 0.05; // gentle idle sway (helm drives it otherwise)
  helmHud.style.display = (mode === 'helm' && !berthed) ? 'block' : 'none';
  crew.update(t, dt);
  townsfolk.update(t, dt);
  peers.update(dt, worldGroup.matrix, shipYaw);
  cannons.update(dt);
  combat.update(dt, t);
  purse.update(dt);

  if (mode === 'walk') updateWalk(dt);
  else updateHelm(dt);

  // the player's lantern lights the deck around them after dark
  torch.position.set(player.position.x, player.feetY + 1.5, player.position.z);
  torch.intensity = 5.5 * (1 - dayNight.dayAmount);

  // broadcast our position to other players in ABSOLUTE WORLD space (scene ->
  // world via the ship anchor), so every client shares one coherent map
  const pp = player.position;
  _peerWorld.set(pp.x, player.feetY, pp.z).applyMatrix4(shipAnchor.matrix);
  world.update({ x: _peerWorld.x, y: _peerWorld.y, z: _peerWorld.z, heading: shipYaw, mode }, performance.now());

  orbit.update();
  post.render();
  stats.update(dt, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
