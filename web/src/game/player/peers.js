// Remote players — renders everyone else on the shared world channel as a
// low-poly figure, interpolated between the ~8/s presence updates so they glide
// instead of teleporting. The ship sits at the world origin for every client,
// so a peer's broadcast deck position maps straight into our scene.

import { Group, Vector3, MathUtils } from 'three';
import { makeAvatar, animateFigure } from './avatar.js';

export function createPeers(scene, deckY = 2.4) {
  const group = new Group();
  scene.add(group);
  const map = new Map(); // userId -> { node, target, last, phase, moving }

  function sync(peers) {
    // add / update
    for (const [id, s] of peers) {
      let e = map.get(id);
      if (!e) {
        const node = makeAvatar('sailor');
        group.add(node);
        e = { node, target: new Vector3(), last: new Vector3(), phase: Math.random() * 6, heading: 0, moving: 0 };
        e.node.position.set(s.x || 0, (s.y ?? deckY), s.z || 0);
        e.last.copy(e.node.position);
        map.set(id, e);
      }
      e.target.set(s.x || 0, (s.y ?? deckY), s.z || 0);
      e.heading = s.heading || 0;
    }
    // remove the departed
    for (const [id, e] of map) {
      if (!peers.has(id)) { group.remove(e.node); map.delete(id); }
    }
  }

  function update(dt) {
    for (const e of map.values()) {
      const before = e.node.position.clone();
      e.node.position.lerp(e.target, Math.min(1, dt * 10));
      const moved = e.node.position.distanceTo(before) / Math.max(dt, 1e-3);
      e.moving = MathUtils.damp(e.moving, moved > 0.4 ? 1 : 0, 8, dt);
      e.phase += dt * 11 * e.moving;
      // face travel direction when moving, else use broadcast heading
      const dir = e.target.clone().sub(before);
      if (dir.lengthSq() > 1e-4 && e.moving > 0.3) e.node.rotation.y = Math.atan2(dir.x, dir.z);
      else e.node.rotation.y = MathUtils.damp(e.node.rotation.y, e.heading, 6, dt);
      animateFigure(e.node, e.phase, e.moving);
    }
  }

  return { group, sync, update, get count() { return map.size; } };
}
