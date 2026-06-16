// Lightweight physics via Rapier (Rust/WASM, ~120KB gz) — not Havok's 2MB.
//
// We use it for the things that genuinely need physics: a kinematic character
// controller that walks/steps/slides on the deck, and dynamic bodies for
// cannonballs and floating cargo later. Buoyancy stays analytic (the wave
// math), so there's no fluid sim cost.
//
// EXPORT: await initPhysics() -> {
//   R, world, step(dt),
//   staticCuboid(hx,hy,hz, x,y,z, euler?),
//   dynamicBall(r, x,y,z, restitution?),
//   makeCharacter({radius, halfHeight, x,y,z})
// }

import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Euler } from 'three';

export async function initPhysics(gravityY = -20) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: gravityY, z: 0 });
  world.timestep = 1 / 60;

  const _q = new Quaternion();
  function quatFromEuler(e) {
    _q.setFromEuler(new Euler(e[0] || 0, e[1] || 0, e[2] || 0));
    return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
  }

  function staticCuboid(hx, hy, hz, x, y, z, euler) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (euler) bodyDesc.setRotation(quatFromEuler(euler));
    const body = world.createRigidBody(bodyDesc);
    const col = world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
    return { body, collider: col };
  }

  // Bake an arbitrary mesh as a fixed collider — for walkable terrain, slopes,
  // riverbanks and other irregular ground the character controller then walks on
  // (it handles slopes/steps/snap itself). `vertices` is a flat Float32Array of
  // xyz triples and `indices` a Uint32Array; the body can be posed in the world.
  function staticTrimesh(vertices, indices, x = 0, y = 0, z = 0, euler) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (euler) bodyDesc.setRotation(quatFromEuler(euler));
    const body = world.createRigidBody(bodyDesc);
    const col = world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices), body);
    return { body, collider: col };
  }

  function dynamicBall(r, x, y, z, restitution = 0.25) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z),
    );
    const col = world.createCollider(
      RAPIER.ColliderDesc.ball(r).setRestitution(restitution).setDensity(2.5),
      body,
    );
    return { body, collider: col };
  }

  // Kinematic capsule + character controller. computeColliderMovement handles
  // collisions, autostep and ground-snap; we just feed it a desired move.
  function makeCharacter({ radius = 0.42, halfHeight = 0.55, x = 0, y = 4, z = 0 }) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
    );
    const collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius), body,
    );
    const controller = world.createCharacterController(0.02);
    // modest auto-step: climbs the deck stairs (0.4 risers) but not the rails
    controller.enableAutostep(0.6, 0.25, true);
    controller.enableSnapToGround(0.5);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setMaxSlopeClimbAngle((55 * Math.PI) / 180);

    function move(desired) {
      controller.computeColliderMovement(collider, desired);
      const dm = controller.computedMovement();
      const p = body.translation();
      body.setNextKinematicTranslation({ x: p.x + dm.x, y: p.y + dm.y, z: p.z + dm.z });
      return { grounded: controller.computedGrounded(), dm };
    }
    function translation() { return body.translation(); }
    function teleport(px, py, pz) { body.setTranslation({ x: px, y: py, z: pz }, true); }

    return { body, collider, controller, move, translation, teleport };
  }

  let acc = 0;
  function step(dt) {
    // fixed-step accumulator so physics is frame-rate independent
    acc += Math.min(dt, 0.05);
    let n = 0;
    while (acc >= world.timestep && n < 5) { world.step(); acc -= world.timestep; n++; }
  }

  return { R: RAPIER, world, step, staticCuboid, staticTrimesh, dynamicBall, makeCharacter };
}
