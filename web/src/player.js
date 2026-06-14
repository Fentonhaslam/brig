// Third-person walkable character — a period sailor you steer around the ship.
// Movement is WASD relative to the camera; collision is raycast-based against
// the ship's tagged `walkable` (floors/stairs) and `solid` (walls/rails) meshes.

import * as THREE from 'three';
import { createCharacter } from './physics/world.js';

const PLAYER_RADIUS = 0.34;
const CAP_HALF = 0.55;                 // capsule half-height (cylinder part)
const CAP_OFFSET = CAP_HALF + PLAYER_RADIUS; // body centre → feet
const EYE = 1.55;
const STEP_UP = 0.6;         // max ledge/step height the sailor can climb
const GRAVITY = 20;
const WALK_SPEED = 4.4;
const RUN_SPEED = 8.5;
const CAM_DIST = 5.0;

// ---------------------------------------------------------------------------
// The sailor avatar — simple jointed figure with a walk cycle
// ---------------------------------------------------------------------------
const SKIN   = new THREE.MeshStandardMaterial({ color: 0xb07a52, roughness: 0.78 });
const TUNIC  = new THREE.MeshStandardMaterial({ color: 0x8a4a26, roughness: 0.85 });
const JERKIN = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7,  metalness: 0.05 });
const HOSE   = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.9 });
const BOOT   = new THREE.MeshStandardMaterial({ color: 0x251710, roughness: 0.6 });
const CAPM   = new THREE.MeshStandardMaterial({ color: 0x6a1f18, roughness: 0.85 });
const SHIRT  = new THREE.MeshStandardMaterial({ color: 0xd8c6a2, roughness: 0.85 });
const BELT   = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 });
const HAIR   = new THREE.MeshStandardMaterial({ color: 0x2a1b10, roughness: 0.95 });
const STEEL  = new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.35, metalness: 0.85 });
const GOLD   = new THREE.MeshStandardMaterial({ color: 0xc89030, roughness: 0.35, metalness: 0.7 });

function buildAvatar() {
  const g = new THREE.Group();

  // Pelvis / breeches block the legs hang from
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.26), HOSE);
  pelvis.position.y = 0.92;
  pelvis.castShadow = true;
  g.add(pelvis);

  // Legs — hip pivot groups: thigh, knee, shin (slack hose), cuffed boot
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.86, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.32, 4, 7), HOSE);
    thigh.position.y = -0.24;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), HOSE);
    knee.position.y = -0.46;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 7), HOSE);
    shin.position.y = -0.66;
    shin.castShadow = true;
    hip.add(shin);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.12, 8), BOOT);
    cuff.position.y = -0.78;
    hip.add(cuff);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.3), BOOT);
    boot.position.set(0, -0.9, 0.05);
    boot.castShadow = true;
    hip.add(boot);
    g.add(hip);
    legs.push(hip);
  }

  // Linen shirt under everything (shows at the neck and below the jerkin hem)
  const shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.52, 5, 10), SHIRT);
  shirt.position.y = 1.2;
  shirt.scale.z = 0.74;
  g.add(shirt);

  // Russet tunic skirt (hangs below the jerkin)
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.34, 12), TUNIC);
  skirt.position.y = 0.98;
  skirt.scale.z = 0.78;
  skirt.castShadow = true;
  g.add(skirt);

  // Leather jerkin — the main torso piece (the part that swings = "torso")
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.215, 0.46, 6, 12), JERKIN);
  torso.position.y = 1.2;
  torso.scale.z = 0.74;
  torso.castShadow = true;
  g.add(torso);
  // jerkin lacing down the front
  for (let i = 0; i < 4; i++) {
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), BELT);
    lace.position.set(0, 1.36 - i * 0.12, 0.17);
    g.add(lace);
  }
  // open collar showing the shirt
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 14, Math.PI * 1.3), JERKIN);
  collar.position.set(0, 1.46, 0.02);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI;
  g.add(collar);

  // Wide belt + buckle, a sheathed dagger, and a coiled pouch
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.11, 14), BELT);
  belt.position.y = 0.98;
  belt.scale.z = 0.76;
  g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.03), GOLD);
  buckle.position.set(0, 0.98, 0.19);
  g.add(buckle);
  // dagger on the right hip
  const sheath = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.32, 8), BELT);
  sheath.position.set(0.22, 0.78, 0.06);
  sheath.rotation.x = 0.25;
  g.add(sheath);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), STEEL);
  hilt.position.set(0.22, 0.96, 0.04);
  g.add(hilt);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), GOLD);
  pommel.position.set(0.22, 1.01, 0.03);
  g.add(pommel);
  // leather pouch on the left hip
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), JERKIN);
  pouch.position.set(-0.2, 0.82, 0.08);
  pouch.scale.set(1, 1.1, 0.7);
  g.add(pouch);

  // Arms — shoulder pivot groups: tunic sleeve, elbow, rolled-up forearm, hand
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.27, 1.44, 0);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), JERKIN);
    sh.add(cap);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 7), TUNIC);
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    sh.add(sleeve);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 6), SKIN);
    elbow.position.y = -0.36;
    sh.add(elbow);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, 4, 7), SKIN);
    forearm.position.y = -0.5;
    forearm.castShadow = true;
    sh.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), SKIN);
    hand.position.y = -0.66;
    hand.scale.set(1, 0.8, 1.2);
    sh.add(hand);
    g.add(sh);
    arms.push(sh);
  }

  // Neck, weathered head, beard, hair, knit Monmouth cap, gold earring
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.12, 8), SKIN);
  neck.position.y = 1.55;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), SKIN);
  head.position.y = 1.68;
  head.scale.set(0.92, 1.08, 1);
  head.castShadow = true;
  g.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 6), SKIN);
  nose.position.set(0, 1.67, 0.14);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);
  // brow/beard mass
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), HAIR);
  beard.position.set(0, 1.62, 0.03);
  beard.scale.set(0.95, 1.1, 0.95);
  g.add(beard);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), SKIN);
    ear.position.set(s * 0.14, 1.68, 0);
    g.add(ear);
  }
  const earring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 5, 10), GOLD);
  earring.position.set(-0.15, 1.64, 0.01);
  earring.rotation.y = Math.PI / 2;
  g.add(earring);
  // hair at the back under the cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), HAIR);
  hair.position.set(0, 1.69, -0.02);
  g.add(hair);
  // knit cap with a rolled brim
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), CAPM);
  cap.position.y = 1.73;
  cap.castShadow = true;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 7, 16), CAPM);
  brim.position.y = 1.74;
  brim.rotation.x = Math.PI / 2;
  g.add(brim);

  g.userData.legs = legs;
  g.userData.arms = arms;
  g.userData.torso = torso;
  return g;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export function createPlayer(scene, ship, camera, renderer, hooks = {}, phys = null) {
  let char = null; // Rapier kinematic capsule + controller (created on enable)
  const avatar = buildAvatar();
  avatar.visible = false;
  scene.add(avatar);

  const colliders = ship.userData.colliders || { walkable: [], solid: [] };
  const SCALE = ship.userData.scale || 1;

  // amidships on the weather deck (ship-local point scaled into world space)
  const SPAWN = new THREE.Vector3(2.6, 2.5, 0).multiplyScalar(SCALE);
  const pos = SPAWN.clone();
  let velY = 0;
  let yaw = Math.PI;    // camera behind, looking forward down the deck
  let pitch = 0.18;
  let facing = 0;       // sailor faces the bow
  let walkPhase = 0;
  let enabled = false;

  // helm state
  let helmActive = false;
  let heading = 0;
  let headingVel = 0;
  let deploy = ship.userData.sailDeploy ?? 1;
  let shipSpeed = 0;        // normalized throttle 0..1 (slight reverse allowed)
  let tAccum = 0;
  const hint = document.getElementById('hint');

  // interaction / dialogue state
  const npcs = ship.userData.npcs || [];
  const crew = ship.userData.crew || [];
  const bell = ship.userData.bell || null;
  const capstan = ship.userData.capstan || null;
  const capstanStation = ship.userData.capstanStation || null;
  const gunStation = ship.userData.gunStation || null;
  const anchor = ship.userData.anchor || null;
  let talking = null;       // the npc currently in dialogue
  let dlgMode = 'intro';    // 'intro' | 'choices' | 'reply'
  let dlgLines = [];
  let dlgIndex = 0;
  let bellSwing = 0;
  let capstanSpin = 0;
  const dlg = document.getElementById('dialogue');
  const dlgName = dlg?.querySelector('.speaker');
  const dlgLine = dlg?.querySelector('.line');
  const dlgCont = dlg?.querySelector('.cont');
  const worldOf = (local) => ship.localToWorld(local.clone());

  const keys = new Set();
  const down = new THREE.Raycaster();
  const horiz = new THREE.Raycaster();
  const camRay = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);

  // -- input ----------------------------------------------------------------
  const onKeyDown = (e) => {
    if (e.code === 'KeyE' && !e.repeat) handleInteract();
    else if (talking && dlgMode === 'choices' && !e.repeat &&
             (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
      selectChoice(parseInt(e.code.slice(5), 10) - 1);
    }
    else if (e.code === 'Space' && helmActive && !e.repeat && anchor) {
      anchor.up = !anchor.up; // weigh / let go the anchor from the helm
    }
    keys.add(e.code);
  };
  const onKeyUp = (e) => { keys.delete(e.code); };
  const onMouseMove = (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.0024;
    pitch -= e.movementY * 0.0024;
    pitch = Math.max(-0.25, Math.min(1.2, pitch));
  };
  const onCanvasClick = () => {
    if (enabled && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock?.();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onCanvasClick);
  window.addEventListener('blur', () => keys.clear());

  // -- collision helpers -----------------------------------------------------
  // Highest walkable surface within [feet - 6, feet + STEP_UP] under (x,z)
  function sampleGround(x, z) {
    down.set(new THREE.Vector3(x, pos.y + STEP_UP + 0.05, z), DOWN);
    down.far = STEP_UP + 8;
    const hits = down.intersectObjects(colliders.walkable, false);
    return hits.length ? hits[0].point.y : null;
  }

  // Block a horizontal move if a solid surface is within reach in that dir
  function blocked(dx, dz) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return false;
    const dir = new THREE.Vector3(dx / len, 0, dz / len);
    for (const h of [0.3, 0.95, 1.45]) {
      horiz.set(new THREE.Vector3(pos.x, pos.y + h, pos.z), dir);
      horiz.far = PLAYER_RADIUS + len;
      if (horiz.intersectObjects(colliders.solid, false).length) return true;
    }
    return false;
  }

  function respawn() {
    pos.copy(SPAWN);
    velY = 0;
    if (char) char.body.setTranslation({ x: SPAWN.x, y: SPAWN.y + CAP_OFFSET, z: SPAWN.z }, true);
  }

  // -- the helm --------------------------------------------------------------
  const helm = ship.userData.helmStand || new THREE.Vector3(0, 5.5, -8);
  function helmWorld() { return ship.localToWorld(helm.clone()); }
  function nearHelm() {
    return pos.distanceTo(helmWorld()) < 2.4;
  }
  // All the things you can walk up to and press E on. Distances are in world
  // metres (the helm/npc/bell points are ship-local, transformed to world).
  function interactables() {
    const list = [{
      world: helmWorld(), range: 2.6,
      prompt: '⚓ Press E to take the helm',
      activate: enterHelm,
    }];
    for (const npc of npcs) {
      list.push({
        world: worldOf(npc.local), range: 2.8,
        prompt: `Press E to speak with ${npc.title} ${npc.name}`,
        activate: () => startDialogue(npc),
      });
    }
    if (bell) {
      list.push({
        world: worldOf(bell.local), range: 2.4,
        prompt: "Press E to ring the ship's bell",
        activate: ringBell,
      });
    }
    if (capstanStation) {
      // anchor.up === true means stowed → next action is to LET GO (lower it)
      const stowed = anchor && anchor.up;
      list.push({
        world: worldOf(capstanStation), range: 2.6,
        prompt: anchor
          ? `Press E to ${stowed ? 'let go the' : 'weigh the'} anchor (man the capstan)`
          : 'Press E to man the capstan',
        activate: () => {
          capstanSpin = 4.5; hooks.onCapstan?.();
          if (anchor) anchor.up = !anchor.up;
        },
      });
    }
    if (gunStation) {
      list.push({
        world: worldOf(gunStation), range: 2.8,
        prompt: '🔥 Press E to fire a broadside',
        activate: () => hooks.onBroadside?.(),
      });
    }
    for (const c of crew) {
      list.push({
        world: worldOf(c.object.position), range: 2.2,
        prompt: `Press E to hail ${c.role.replace(/^A /, 'a ').replace(/^An /, 'an ')}`,
        activate: () => startCrewTalk(c),
      });
    }
    return list;
  }

  function nearestInteractable() {
    let best = null, bestD = Infinity;
    for (const it of interactables()) {
      const d = pos.distanceTo(it.world);
      if (d < it.range && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }

  function handleInteract() {
    if (!enabled) return;
    if (helmActive) { exitHelm(); return; }
    if (talking) { advanceDialogue(); return; }
    const it = nearestInteractable();
    if (it) it.activate();
  }

  function startCrewTalk(c) {
    c.object.userData.talking = true;
    startDialogue({
      title: c.role, name: '', lines: [c.line], choices: [],
      object: c.object, local: c.object.position, _crew: c,
    });
  }

  // --- dialogue (branching) -------------------------------------------------
  function startDialogue(npc) {
    talking = npc;
    dlgMode = 'intro';
    dlgLines = npc.lines;
    dlgIndex = 0;
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
    render();
  }
  function render() {
    if (dlgName) dlgName.textContent = `${talking.title} ${talking.name}`;
    if (dlgMode === 'choices') {
      const opts = talking.choices.map((c, i) => `${i + 1}.  ${c.q}`).join('<br>');
      if (dlgLine) dlgLine.innerHTML = opts;
      if (dlgCont) dlgCont.textContent = 'press 1–' + talking.choices.length + ' · E to take your leave';
    } else {
      if (dlgLine) dlgLine.textContent = `“${dlgLines[dlgIndex]}”`;
      if (dlgCont) dlgCont.textContent = '▾ press E';
    }
    dlg?.classList.add('show');
  }
  function advanceDialogue() {
    if (dlgMode === 'choices') { endDialogue(); return; } // E leaves the choice menu
    dlgIndex++;
    if (dlgIndex < dlgLines.length) { render(); return; }
    const hasChoices = talking.choices && talking.choices.length;
    if ((dlgMode === 'intro' || dlgMode === 'reply') && hasChoices) {
      dlgMode = 'choices'; render();   // offer the questions again
    } else {
      endDialogue();
    }
  }
  function selectChoice(n) {
    if (!talking || dlgMode !== 'choices' || !talking.choices[n]) return;
    dlgMode = 'reply';
    dlgLines = talking.choices[n].reply;
    dlgIndex = 0;
    render();
  }
  function endDialogue() {
    if (talking && talking._crew) talking._crew.object.userData.talking = false;
    talking = null;
    dlg?.classList.remove('show');
  }

  // --- bell -----------------------------------------------------------------
  function ringBell() {
    bellSwing = 1.4;
    hooks.onBell?.();
  }
  function enterHelm() {
    helmActive = true;
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
    headingVel = 0;
    ship.userData.helm = { active: true, anchorUp: anchor ? anchor.up : true };
  }
  function exitHelm() {
    helmActive = false;
    ship.rotation.set(0, 0, 0);
    ship.position.set(0, 0, 0);
    ship.updateMatrixWorld(true);
    if (ship.userData.helm) ship.userData.helm.active = false;
    pos.copy(helmWorld()); pos.z += 0.4;
    velY = 0; yaw = Math.PI; pitch = 0.18;
  }

  function updateHelm(dt) {
    const nav = ship.userData.nav;
    // A/D steer — turns sharper with way on, but can still pivot slowly at rest
    const turn = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    headingVel += turn * dt * 0.5;
    headingVel *= 0.94;
    headingVel = Math.max(-0.6, Math.min(0.6, headingVel));
    nav.heading += headingVel * dt * (0.4 + 0.6 * Math.min(1, Math.abs(nav.speed)));

    // W/S drive the throttle; the sails set themselves to match the way she makes
    const anchorUp = anchor ? anchor.up : true;
    if (!anchorUp) {
      nav.speed -= Math.sign(nav.speed) * Math.min(Math.abs(nav.speed), 1.5 * dt);
    } else if (keys.has('KeyW')) {
      nav.speed += 0.4 * dt;
    } else if (keys.has('KeyS')) {
      nav.speed -= 0.5 * dt;
    } else {
      nav.speed -= Math.sign(nav.speed) * Math.min(Math.abs(nav.speed), 0.3 * dt);
    }
    nav.speed = Math.max(-0.25, Math.min(1, nav.speed));

    deploy = Math.max(0, Math.min(1, nav.speed));
    ship.userData.setSails?.(deploy);
    const speed = nav.speed;
    ship.userData.helm = { active: true, anchorUp };

    // cosmetic heel/bob only — the WORLD turns around us, the ship stays put so
    // the deck (and anyone walking it) keeps its frame.
    ship.rotation.y = 0;
    ship.rotation.z = -headingVel * 0.5;
    ship.rotation.x = -0.012 * speed + Math.sin(tAccum * 0.6) * 0.01;
    ship.position.y = Math.sin(tAccum * 0.7) * 0.1 * (0.4 + 0.6 * speed);
    ship.updateMatrixWorld(true);

    // wheel reflects steering input (returns to centre), not absolute heading
    if (ship.userData.wheel) ship.userData.wheel.rotation.z = -headingVel * 6;

    // helmsman stands at the wheel, facing the bow, hands on the spokes
    const stand = helm.clone(); ship.localToWorld(stand);
    avatar.position.copy(stand);
    avatar.rotation.y = 0;
    avatar.userData.legs[0].rotation.x = 0.05;
    avatar.userData.legs[1].rotation.x = -0.05;
    avatar.userData.arms[0].rotation.x = -1.1;
    avatar.userData.arms[1].rotation.x = -1.1;

    // commanding camera high over the poop, angled down the deck so the
    // sightline passes UNDER the main course to the sea and landfalls beyond
    const camL = new THREE.Vector3(0, helm.y + 5.0, helm.z - 1.2);
    const tgtL = new THREE.Vector3(0, helm.y - 3.2, helm.z + 13);
    camera.position.copy(ship.localToWorld(camL.clone()));
    camera.lookAt(ship.localToWorld(tgtL.clone()));
    // HUD (heading / sail / anchor / range to port) is set by main.js
  }

  // -- per-frame update ------------------------------------------------------
  function updateDialogue(dt) {
    const np = worldOf(talking.local);
    // the patron turns to face the sailor
    const toP = new THREE.Vector3(pos.x - np.x, 0, pos.z - np.z);
    if (toP.lengthSq() > 1e-4) talking.object.rotation.y = Math.atan2(toP.x, toP.z);
    // ...and gestures with one hand while he speaks (skip in the choice menu)
    const o = talking.object;
    if (o.userData.arms && o.userData.armBase) {
      const g = dlgMode === 'choices' ? 0 : Math.sin(tAccum * 5.5) * 0.18 + 0.1;
      o.userData.arms[1].rotation.x = o.userData.armBase[1] + g;
      o.userData.arms[0].rotation.x = o.userData.armBase[0] + g * 0.3;
    }
    // the sailor faces the patron, standing at ease
    avatar.position.copy(pos);
    avatar.rotation.y = Math.atan2(np.x - pos.x, np.z - pos.z);
    for (const l of avatar.userData.legs) l.rotation.x = 0;
    for (const a of avatar.userData.arms) a.rotation.x = 0;
    // over-the-shoulder framing: camera by the sailor's head, on the patron's face
    const dir = new THREE.Vector3(np.x - pos.x, 0, np.z - pos.z).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const camPos = pos.clone();
    camPos.y = pos.y + 1.62;
    camPos.addScaledVector(dir, -0.6).addScaledVector(side, 0.9);
    camera.position.lerp(camPos, Math.min(1, dt * 7));
    camera.lookAt(np.x, np.y + 1.55, np.z);
    if (hint) hint.textContent = 'Press E to continue';
  }

  function update(dt) {
    if (!enabled) return;
    dt = Math.min(dt, 0.05);
    tAccum += dt;

    if (bell && bellSwing > 0) {
      bellSwing = Math.max(0, bellSwing - dt * 2.0);
      bell.object.rotation.z = Math.sin(bellSwing * 28) * 0.3 * bellSwing;
    }
    if (capstan && capstanSpin > 0) {
      capstanSpin -= dt;
      capstan.rotation.y += dt * 1.7;
    }
    if (anchor) {
      const ty = anchor.up ? anchor.upY : anchor.downY;
      anchor.object.position.y += (ty - anchor.object.position.y) * Math.min(1, dt * 1.6);
    }
    if (helmActive) { updateHelm(dt); return; }
    if (talking) { updateDialogue(dt); return; }

    // desired horizontal direction in camera space
    const mf = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const mr = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    // forward (toward where the camera looks), right
    let dx = (-sinY) * mf + (cosY) * mr;
    let dz = (-cosY) * mf + (-sinY) * mr;
    const mlen = Math.hypot(dx, dz);
    const moving = mlen > 1e-4;

    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    if (moving) { dx = dx / mlen * speed * dt; dz = dz / mlen * speed * dt; }

    // Drive the kinematic capsule through Rapier's character controller:
    // it resolves walls, slopes, auto-steps stairs and snaps to the deck.
    if (char) {
      velY -= GRAVITY * dt;
      char.controller.computeColliderMovement(char.collider, { x: dx, y: velY * dt, z: dz });
      const mv = char.controller.computedMovement();
      const tr = char.body.translation();
      char.body.setNextKinematicTranslation({ x: tr.x + mv.x, y: tr.y + mv.y, z: tr.z + mv.z });
      phys.step();
      if (char.controller.computedGrounded()) velY = 0;
      const c = char.body.translation();
      pos.set(c.x, c.y - CAP_OFFSET, c.z); // pos tracks the feet
      if (pos.y < -14) respawn();
    } else {
      pos.x += dx; pos.z += dz; // physics unavailable — flat fallback
    }

    // orient + animate the avatar
    if (moving) {
      facing = Math.atan2(dx, dz);
      walkPhase += dt * speed * 1.9;
    }
    let df = facing - avatar.rotation.y;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    avatar.rotation.y += df * Math.min(1, dt * 12);
    avatar.position.copy(pos);

    const amp = moving ? 0.7 : 0;
    const sw = Math.sin(walkPhase) * amp;
    avatar.userData.legs[0].rotation.x = sw;
    avatar.userData.legs[1].rotation.x = -sw;
    avatar.userData.arms[0].rotation.x = -sw * 0.8;
    avatar.userData.arms[1].rotation.x = sw * 0.8;
    avatar.userData.torso.position.y = 1.2 + Math.abs(Math.sin(walkPhase)) * 0.03 * amp;

    // third-person camera, pulled in if the hull would block the view
    const target = new THREE.Vector3(pos.x, pos.y + EYE, pos.z);
    const cp = Math.cos(pitch);
    const dirBack = new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
    let dist = CAM_DIST;
    camRay.set(target, dirBack);
    camRay.far = CAM_DIST;
    const obstr = camRay.intersectObjects(colliders.solid, false);
    if (obstr.length) dist = Math.max(1.6, obstr[0].distance - 0.3);
    camera.position.copy(target).addScaledVector(dirBack, dist);
    if (camera.position.y < 0.6) camera.position.y = 0.6;
    camera.lookAt(target);

    const near = nearestInteractable();
    if (hint) hint.textContent = near
      ? near.prompt
      : 'WASD move · shift run · mouse look · F torch · C exit';
  }

  function enable() {
    enabled = true;
    avatar.visible = true;
    if (phys && !char) {
      char = createCharacter(phys, { x: SPAWN.x, y: SPAWN.y + CAP_OFFSET, z: SPAWN.z });
    }
    respawn();
  }
  function disable() {
    enabled = false;
    avatar.visible = false;
    keys.clear();
    if (talking) endDialogue();
    if (helmActive) { helmActive = false; ship.rotation.set(0, 0, 0); ship.position.set(0, 0, 0); }
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
  }

  function takeHelm() {
    pos.copy(helmWorld());
    enterHelm();
  }

  return {
    avatar,
    update,
    enable,
    disable,
    takeHelm,
    talkTo(i) { if (npcs[i]) { pos.copy(worldOf(npcs[i].local)); pos.x += 2.0; startDialogue(npcs[i]); } },
    // snapshot of where this player is, for broadcasting to other clients
    sample() {
      if (enabled) return { x: pos.x, y: pos.y, z: pos.z, heading: avatar.rotation.y, mode: helmActive ? 'helm' : 'walk' };
      return { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, heading: 0, mode: 'aboard' };
    },
    get enabled() { return enabled; },
    get atHelm() { return helmActive; },
  };
}
