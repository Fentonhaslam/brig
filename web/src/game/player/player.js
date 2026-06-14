// The player: a low-poly toon conquistador + a controller that drives the
// Rapier kinematic capsule. Click-to-move and WASD both feed walk(); gravity
// and collisions are handled by the character controller.

import {
  Group, Mesh, Vector3, MathUtils,
  BoxGeometry, CylinderGeometry, SphereGeometry,
} from 'three';
import { toonMaterial, withOutline } from '../core/toon.js';

const SKIN = toonMaterial(0xc98d63);
const STEEL = toonMaterial(0x9aa3ad);   // armour / morion
const CLOTH = toonMaterial(0x3a4a6b);   // doublet
const SASH = toonMaterial(0xb23a2c);    // red sash
const BOOT = toonMaterial(0x4a3422);

// build the figure ~1.8 units tall, feet at y=0
function makeAvatar() {
  const g = new Group();
  const add = (geo, mat, x, y, z, outline = false) => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    if (outline) withOutline(m, 0.04);
    g.add(m);
    return m;
  };

  // legs
  add(new BoxGeometry(0.26, 0.7, 0.3), BOOT, -0.16, 0.35, 0, true);
  add(new BoxGeometry(0.26, 0.7, 0.3), BOOT, 0.16, 0.35, 0, true);
  // torso (cuirass) + red sash
  add(new BoxGeometry(0.62, 0.75, 0.42), STEEL, 0, 1.05, 0, true);
  add(new BoxGeometry(0.66, 0.16, 0.46), SASH, 0, 0.86, 0);
  // arms
  add(new BoxGeometry(0.18, 0.66, 0.22), CLOTH, -0.4, 1.05, 0, true);
  add(new BoxGeometry(0.18, 0.66, 0.22), CLOTH, 0.4, 1.05, 0, true);
  // head + neck
  add(new SphereGeometry(0.2, 8, 6), SKIN, 0, 1.62, 0, true);
  // morion helmet: dome + comb crest + brim
  const dome = add(new SphereGeometry(0.24, 8, 5), STEEL, 0, 1.74, 0);
  dome.scale.set(1, 0.7, 1);
  const brim = add(new CylinderGeometry(0.34, 0.34, 0.05, 10), STEEL, 0, 1.66, 0);
  brim.scale.z = 1.5;
  const comb = add(new BoxGeometry(0.05, 0.18, 0.5), STEEL, 0, 1.86, 0, true);
  comb.rotation.x = 0; // fore-aft crest

  return g;
}

export function createPlayer(physics, scene, spawn = new Vector3(0, 4, 0)) {
  const RADIUS = 0.42, HALF = 0.55;
  const FOOT = HALF + RADIUS; // capsule centre -> feet

  const group = makeAvatar();
  scene.add(group);

  const char = physics.makeCharacter({ radius: RADIUS, halfHeight: HALF, x: spawn.x, y: spawn.y, z: spawn.z });

  let vy = 0;
  let facing = 0;
  let stride = 0;
  const desired = new Vector3();
  let moving = false;

  // dir: world-space horizontal direction (length<=1); running scales speed
  function walk(dirX, dirZ, running) {
    const speed = running ? 9 : 5;
    desired.set(dirX * speed, 0, dirZ * speed);
    moving = (dirX || dirZ) ? true : false;
  }

  function update(dt) {
    // gravity
    vy += -20 * dt;
    const disp = { x: desired.x * dt, y: vy * dt, z: desired.z * dt };
    const { grounded } = char.move(disp);
    if (grounded && vy < 0) vy = -1; // keep glued to the deck

    // sync mesh (feet at capsule bottom)
    const p = char.translation();
    group.position.set(p.x, p.y - FOOT, p.z);

    // face travel direction + leg/arm swing
    if (moving) {
      facing = MathUtils.damp(facing, Math.atan2(desired.x, desired.z), 12, dt);
      stride += dt * (desired.length() > 6 ? 16 : 11);
    } else {
      stride = MathUtils.damp(stride, 0, 8, dt);
    }
    group.rotation.y = facing;
    const sw = Math.sin(stride) * (moving ? 0.5 : 0);
    group.children[0].rotation.x = sw;   // left leg
    group.children[1].rotation.x = -sw;  // right leg
    group.children[4].rotation.x = -sw;  // left arm
    group.children[5].rotation.x = sw;   // right arm

    desired.set(0, 0, 0); // consumed; re-set each frame by the controller
    moving = false;
  }

  return {
    group, char,
    walk, update,
    get position() { const p = char.translation(); return new Vector3(p.x, p.y, p.z); },
    get feetY() { return char.translation().y - FOOT; },
    teleport: (x, y, z) => { char.teleport(x, y, z); vy = 0; },
    setVisible: (v) => { group.visible = v; },
    setFacing: (a) => { facing = a; },
  };
}
