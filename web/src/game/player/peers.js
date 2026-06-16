// Remote players — renders everyone else on the shared world channel as a
// low-poly figure, interpolated between the ~8/s presence updates so they glide
// instead of teleporting.
//
// Coordinates are ABSOLUTE WORLD space (the fixed map frame), not scene space:
// each client broadcasts its player's world position, and we project every peer
// back into OUR scene through our live world matrix each frame. That gives one
// coherent world — two players berthed at the same port share a frame and see
// each other at the right spots in the city; a player on the far side of the
// ocean maps far off-scene (beyond the fog) rather than ghosting onto our deck.

import { Group, Vector3, MathUtils } from 'three';
import { makeAvatar, animateFigure } from './avatar.js';

export function createPeers(scene, deckY = 2.4) {
  const group = new Group();
  scene.add(group);
  const map = new Map(); // userId -> { node, world, scene, phase, heading, moving, init }
  const _s = new Vector3();

  function sync(peers) {
    for (const [id, s] of peers) {
      let e = map.get(id);
      if (!e) {
        const node = makeAvatar('sailor');
        group.add(node);
        e = { node, world: new Vector3(), scene: new Vector3(), phase: Math.random() * 6, heading: 0, moving: 0, init: false };
        map.set(id, e);
      }
      e.world.set(s.x || 0, (s.y ?? deckY), s.z || 0); // world-space target
      e.heading = s.heading || 0;
    }
    for (const [id, e] of map) {
      if (!peers.has(id)) { group.remove(e.node); map.delete(id); }
    }
  }

  // worldMatrix maps world -> our scene; myYaw is our ship heading (scene is the
  // world rotated by -myYaw), used to orient idle peers correctly.
  function update(dt, worldMatrix, myYaw = 0) {
    for (const e of map.values()) {
      // where this peer should appear in our scene right now
      _s.copy(e.world);
      if (worldMatrix) _s.applyMatrix4(worldMatrix);
      if (!e.init) { e.node.position.copy(_s); e.scene.copy(_s); e.init = true; }

      const before = e.node.position.clone();
      e.node.position.lerp(_s, Math.min(1, dt * 10));
      const moved = e.node.position.distanceTo(before) / Math.max(dt, 1e-3);
      e.moving = MathUtils.damp(e.moving, moved > 0.4 ? 1 : 0, 8, dt);
      e.phase += dt * 11 * e.moving;
      // face travel direction when moving, else the broadcast heading (mapped
      // from world into our scene by subtracting our ship yaw)
      const dir = _s.clone().sub(before);
      if (dir.lengthSq() > 1e-4 && e.moving > 0.3) e.node.rotation.y = Math.atan2(dir.x, dir.z);
      else e.node.rotation.y = MathUtils.damp(e.node.rotation.y, e.heading - myYaw, 6, dt);
      animateFigure(e.node, e.phase, e.moving);
    }
  }

  return { group, sync, update, get count() { return map.size; } };
}
