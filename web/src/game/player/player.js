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
  let grounded = false;
  const desired = new Vector3();
  let moving = false;
  let swimming = false;

  function jump() { if (grounded && !swimming) { vy = 8.6; grounded = false; } } // ~1.8 units up
  let swimClock = 0;
  const SWIM_CENTER = 0.25; // capsule centre at the surface → head & shoulders out

  // dir: world-space horizontal direction (length<=1); running scales speed
  function walk(dirX, dirZ, running) {
    const speed = swimming ? 3.4 : (running ? 9 : 5);
    desired.set(dirX * speed, 0, dirZ * speed);
    moving = (dirX || dirZ) ? true : false;
  }

  function setSwim(on) {
    swimming = on;
    vy = 0;
    if (!on) group.rotation.x = 0;
  }

  function update(dt) {
    if (swimming) {
      swimClock += dt;
      const p = char.translation();
      const surface = SWIM_CENTER + Math.sin(swimClock * 1.6) * 0.15; // gentle bob
      // buoyancy ease toward the surface, with a hard clamp so the swimmer can
      // never sink — head and shoulders always stay out of the water
      let ny = p.y + (surface - p.y) * Math.min(1, dt * 6);
      if (ny < surface - 0.25) ny = surface - 0.25;
      char.move({ x: desired.x * dt, y: ny - p.y, z: desired.z * dt });
      const q = char.translation();
      group.position.set(q.x, q.y - FOOT, q.z);
      if (moving) { facing = MathUtils.damp(facing, Math.atan2(desired.x, desired.z), 10, dt); stride += dt * 9; }
      else stride = MathUtils.damp(stride, 0, 6, dt);
      group.rotation.y = facing;
      group.rotation.x = -0.18; // a slight forward lean as you stroke
      animateFigure(group, stride, moving ? 1 : 0.4); // arms keep treading water
      desired.set(0, 0, 0); moving = false;
      return;
    }

    // gravity
    vy += -20 * dt;
    const disp = { x: desired.x * dt, y: vy * dt, z: desired.z * dt };
    grounded = char.move(disp).grounded;
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
    walk, update, setSwim, jump,
    get swimming() { return swimming; },
    get position() { const p = char.translation(); return new Vector3(p.x, p.y, p.z); },
    get feetY() { return char.translation().y - FOOT; },
    teleport: (x, y, z) => { char.teleport(x, y, z); vy = 0; },
    setVisible: (v) => { group.visible = v; },
    setFacing: (a) => { facing = a; },
  };
}
