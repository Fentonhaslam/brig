// Rapier physics — a lightweight WASM engine. We build static trimesh colliders
// from the ship's tagged geometry and drive the player with a kinematic capsule
// + Rapier's character controller (real footing, slopes, auto-step, no clipping).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

let R = null;

export async function initPhysics() {
  if (!R) { await RAPIER.init(); R = RAPIER; }
  return R;
}

export function createWorld() {
  return new R.World({ x: 0, y: -22, z: 0 });
}

// Build fixed trimesh colliders from meshes, baked in world space (so the
// ship's scale/position are included). Returns the collider count.
export function addStaticColliders(world, meshes) {
  let n = 0;
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const geo = m.geometry;
    if (!geo || !geo.attributes.position) continue;
    m.updateWorldMatrix(true, false);
    const pos = geo.attributes.position;
    const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      verts[i * 3] = v.x; verts[i * 3 + 1] = v.y; verts[i * 3 + 2] = v.z;
    }
    let indices;
    if (geo.index) indices = new Uint32Array(geo.index.array);
    else { indices = new Uint32Array(pos.count); for (let i = 0; i < pos.count; i++) indices[i] = i; }
    try {
      world.createCollider(R.ColliderDesc.trimesh(verts, indices));
      n++;
    } catch (e) { /* skip degenerate geometry */ }
  }
  return n;
}

// A big level "sea floor" plane far below, so a player who walks off the ship
// falls into the water and is caught (then we respawn them on deck).
export function addSeaPlane(world, y = -30) {
  world.createCollider(R.ColliderDesc.cuboid(5000, 0.5, 5000).setTranslation(0, y, 0));
}

export function createCharacter(world, start, radius = 0.34, halfHeight = 0.55) {
  const bodyDesc = R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(start.x, start.y, start.z);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = R.ColliderDesc.capsule(halfHeight, radius);
  const collider = world.createCollider(colDesc, body);

  const controller = world.createCharacterController(0.02);
  controller.enableAutostep(0.7, 0.3, true);   // climb steps up to 0.7m
  controller.enableSnapToGround(0.5);           // stick to deck on small drops
  controller.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((40 * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(false);

  return { body, collider, controller, radius, halfHeight };
}
