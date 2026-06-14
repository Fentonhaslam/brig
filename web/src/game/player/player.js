// The player: a low-poly toon conquistador + a controller that drives the
// Rapier kinematic capsule. Click-to-move and WASD both feed walk(); gravity
// and collisions are handled by the character controller.

import { Vector3, MathUtils } from 'three';
import { makeAvatar, animateFigure } from './avatar.js';

export function createPlayer(physics, scene, spawn = new Vector3(0, 4, 0)) {
  const RADIUS = 0.42, HALF = 0.55;
  const FOOT = HALF + RADIUS; // capsule centre -> feet

  const group = makeAvatar('player');
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
    animateFigure(group, stride, moving ? 1 : 0);

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
