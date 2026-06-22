// Remote players — renders everyone else on the shared world channel as a
// low-poly figure with proper ENTITY INTERPOLATION so they glide smoothly
// instead of glitching between the ~10/s presence updates.
//
// The fix vs the old "lerp toward the latest position": we keep a short buffer
// of timestamped snapshots per peer and render each peer ~130 ms IN THE PAST,
// interpolating between the two snapshots that bracket that render time. With
// network updates arriving irregularly (presence batches them), rendering a
// little behind the newest data means we almost always have a real sample on
// both sides to interpolate between — so motion is continuous, not steppy.
//
// Coordinates are ABSOLUTE WORLD space (the fixed map frame): each client
// broadcasts its player's world position; we interpolate in world space and
// project the result into OUR scene through the live world matrix every frame,
// so two players at the same port share a coherent frame.

import { Group, Vector3, MathUtils } from 'three';
import { makeAvatar, animateFigure } from './avatar.js';

const INTERP_DELAY = 0.13; // seconds we render peers behind the freshest snapshot
const BUF_MAX = 16;        // snapshots kept per peer

const now = () => performance.now() / 1000;

export function createPeers(scene, deckY = 2.4) {
  const group = new Group();
  scene.add(group);
  const map = new Map(); // userId -> { node, buf, prevWorld, moving, phase, heading, init }
  const _w = new Vector3(), _s = new Vector3();

  // ingest the latest presence state: append a fresh, timestamped snapshot for
  // each peer (deduping unchanged ones so the buffer holds real motion samples)
  function sync(peers) {
    const t = now();
    for (const [id, s] of peers) {
      let e = map.get(id);
      if (!e) {
        const node = makeAvatar('sailor');
        group.add(node);
        e = { node, buf: [], prevWorld: new Vector3(), moving: 0, phase: Math.random() * 6, heading: 0, init: false };
        map.set(id, e);
      }
      const x = s.x || 0, y = (s.y ?? deckY), z = s.z || 0, h = s.heading || 0;
      const last = e.buf[e.buf.length - 1];
      if (!last || last.x !== x || last.y !== y || last.z !== z || last.heading !== h) {
        e.buf.push({ t, x, y, z, heading: h });
        if (e.buf.length > BUF_MAX) e.buf.shift();
      }
    }
    for (const [id, e] of map) {
      if (!peers.has(id)) { group.remove(e.node); map.delete(id); }
    }
  }

  // sample a peer's world pos/heading at the (past) render time from its buffer
  function sampleAt(buf, rt, out) {
    const n = buf.length;
    if (n === 1) { out.set(buf[0].x, buf[0].y, buf[0].z); return buf[0].heading; }
    // newest sample older than rt → buffer starved; hold the newest
    if (buf[n - 1].t <= rt) { const b = buf[n - 1]; out.set(b.x, b.y, b.z); return b.heading; }
    // oldest sample newer than rt → not enough history yet; hold the oldest
    if (buf[0].t >= rt) { const a = buf[0]; out.set(a.x, a.y, a.z); return a.heading; }
    let i = n - 1;
    while (i > 0 && buf[i - 1].t > rt) i--;
    const a = buf[i - 1], b = buf[i];
    const f = MathUtils.clamp((rt - a.t) / ((b.t - a.t) || 1e-3), 0, 1);
    out.set(MathUtils.lerp(a.x, b.x, f), MathUtils.lerp(a.y, b.y, f), MathUtils.lerp(a.z, b.z, f));
    // shortest-arc heading lerp
    let dh = (b.heading - a.heading) % (Math.PI * 2);
    if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
    return a.heading + dh * f;
  }

  // worldMatrix maps world -> our scene; myYaw is our ship heading (scene is the
  // world rotated by -myYaw), so peer headings map in by subtracting it.
  function update(dt, worldMatrix, myYaw = 0) {
    const rt = now() - INTERP_DELAY;
    for (const e of map.values()) {
      if (!e.buf.length) continue;
      const worldHeading = sampleAt(e.buf, rt, _w); // _w = interpolated WORLD pos

      // movement measured in WORLD space, so our own ship moving/turning doesn't
      // fake a walk cycle on a standing peer
      const dwx = _w.x - e.prevWorld.x, dwz = _w.z - e.prevWorld.z;
      const speed = e.init ? Math.hypot(dwx, dwz) / Math.max(dt, 1e-3) : 0;
      e.prevWorld.copy(_w);
      e.moving = MathUtils.damp(e.moving, speed > 0.4 ? 1 : 0, 8, dt);
      e.phase += dt * 11 * e.moving;

      // face travel direction when moving, else the broadcast heading
      const face = (e.moving > 0.3 && (dwx * dwx + dwz * dwz) > 1e-5) ? Math.atan2(dwx, dwz) : worldHeading;

      _s.copy(_w);
      if (worldMatrix) _s.applyMatrix4(worldMatrix);
      if (!e.init) { e.node.position.copy(_s); e.node.rotation.y = face - myYaw; e.init = true; }
      else {
        e.node.position.copy(_s); // interpolation is the smoothing; copy straight
        e.node.rotation.y = MathUtils.damp(e.node.rotation.y, face - myYaw, 10, dt);
      }
      animateFigure(e.node, e.phase, e.moving);
    }
  }

  return { group, sync, update, get count() { return map.size; } };
}
