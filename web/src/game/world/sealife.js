// Sea life: a small pod of dolphins (and the occasional whale) that porpoise in
// calm open water. Each animal orbits the ship at its own radius and arcs out of
// the sea on a leap cycle — body rising along a parabola, nose following the
// tangent — then slips back under. Like the gulls, everything is cheap and
// recycled: shared geometry + one material per kind, a fixed head-count, opacity
// faded by weather + whether you're in port. No outlines (keeps the fade clean
// and the draw count down). Scene-space, anchored to wherever the player is.

import {
  Group, Mesh, SphereGeometry, ConeGeometry, BufferAttribute,
  Sprite, SpriteMaterial, CanvasTexture, MathUtils,
} from 'three';
import { pbrMaterial } from '../core/materials.js';

// A tapered, slightly arched body from a sphere: stretched along +z (the nose),
// pinched toward the tail and the snout so it reads as a cetacean, not an egg.
function bodyGeometry(len, girth) {
  const g = new SphereGeometry(1, 12, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (z + 1) / 2;                       // 0 tail .. 1 nose
    const taper = 0.30 + 0.70 * Math.sin(Math.PI * MathUtils.clamp(t, 0, 1)) ** 0.7;
    p.setX(i, x * girth * taper);
    p.setY(i, y * girth * taper + Math.sin(Math.PI * t) * girth * 0.12); // a little back-arch
    p.setZ(i, z * len);
  }
  g.computeVertexNormals();
  return g;
}

function spoutTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 40, 1, 32, 40, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(228,240,245,0.5)');
  g.addColorStop(1, 'rgba(228,240,245,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function createSeaLife(scene) {
  const group = new Group();
  scene.add(group);

  // shared assets — built once, reused by every animal
  const dolMat = pbrMaterial(0x5b7488, { transparent: true, opacity: 0, depthWrite: false });
  const dolBelly = pbrMaterial(0xd7dde2, { transparent: true, opacity: 0, depthWrite: false });
  const whaleMat = pbrMaterial(0x37414f, { transparent: true, opacity: 0, depthWrite: false });
  const dolBody = bodyGeometry(2.2, 0.8);
  const whaleBody = bodyGeometry(7.0, 2.3);
  const finGeo = new ConeGeometry(0.42, 1.0, 5);
  const flukeGeo = (() => { const g = new ConeGeometry(0.9, 0.5, 4); return g; })();

  function buildDolphin() {
    const d = new Group();
    const body = new Mesh(dolBody, dolMat); d.add(body);
    const belly = new Mesh(dolBody, dolBelly); belly.scale.set(0.96, 0.62, 0.99); belly.position.y = -0.34; d.add(belly);
    const fin = new Mesh(finGeo, dolMat); fin.position.set(0, 0.7, -0.1); fin.rotation.x = -0.5; d.add(fin);
    const fluke = new Mesh(flukeGeo, dolMat); fluke.scale.set(1, 0.28, 0.7); fluke.position.set(0, 0, -2.2); fluke.rotation.x = Math.PI / 2; d.add(fluke);
    return d;
  }

  function buildWhale() {
    const w = new Group();
    const body = new Mesh(whaleBody, whaleMat); w.add(body);
    const fin = new Mesh(finGeo, whaleMat); fin.scale.setScalar(1.6); fin.position.set(0, 2.0, -0.6); fin.rotation.x = -0.5; w.add(fin);
    const fluke = new Mesh(flukeGeo, whaleMat); fluke.scale.set(3.4, 0.5, 2.0); fluke.position.set(0, 0, -7.2); fluke.rotation.x = Math.PI / 2; w.add(fluke);
    // the blow — a soft sprite puff over the blowhole, shown only as it surfaces
    const spout = new Sprite(new SpriteMaterial({ map: spoutTexture(), transparent: true, opacity: 0, depthWrite: false }));
    spout.scale.set(4, 6, 1); spout.position.set(0, 4, 2.4);
    w.add(spout); w.userData.spout = spout;
    return w;
  }

  const animals = [];
  for (let i = 0; i < 5; i++) {
    const m = buildDolphin();
    m.userData = {
      kind: 'dolphin', r: 30 + Math.random() * 46, ang: Math.random() * 6.28,
      angVel: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.09),
      ph: Math.random(), cyc: 2.8 + Math.random() * 1.8, air: 0.40 + Math.random() * 0.12,
      lift: 1.6 + Math.random() * 1.1,
    };
    group.add(m); animals.push(m);
  }
  {
    const w = buildWhale();
    w.userData = {
      kind: 'whale', r: 70 + Math.random() * 36, ang: Math.random() * 6.28,
      angVel: (Math.random() < 0.5 ? -1 : 1) * 0.022,
      ph: Math.random(), cyc: 13 + Math.random() * 6, air: 0.34,
      lift: 0.9, spout: w.children.find((c) => c.isSprite),
    };
    group.add(w); animals.push(w);
  }

  let vis = 0; // eased visibility — calm open water only

  function update(dt, t, storm, camPos, berthed) {
    const want = (storm < 0.4 && !berthed) ? 1 : 0;
    vis += (want - vis) * Math.min(1, dt * 1.2);
    group.visible = vis > 0.02;
    dolMat.opacity = vis * 0.96; dolBelly.opacity = vis; whaleMat.opacity = vis;
    if (!group.visible) return;

    group.position.set(camPos.x, 0, camPos.z); // travel with the player

    for (const m of animals) {
      const u = m.userData;
      u.ang += u.angVel * dt;
      const bx = Math.cos(u.ang) * u.r, bz = Math.sin(u.ang) * u.r;
      // tangent to the orbit = the swimming heading
      const dx = -Math.sin(u.ang) * Math.sign(u.angVel), dz = Math.cos(u.ang) * Math.sign(u.angVel);

      u.ph += dt / u.cyc;
      const frac = u.ph % 1;
      if (frac < u.air) {
        const a = frac / u.air;                       // 0..1 over the arc
        const dy = Math.cos(Math.PI * a) * Math.PI * u.lift; // vertical tangent
        m.visible = true;
        m.position.set(bx, Math.sin(Math.PI * a) * u.lift - 0.15, bz);
        m.rotation.y = Math.atan2(dx, dz);
        m.rotation.x = -Math.atan2(dy, 6);            // nose up out, down on the dive
        if (u.spout) u.spout.material.opacity = vis * Math.max(0, Math.sin(Math.PI * a)) * 0.9; // blow at the crest
      } else {
        m.visible = false; // slipped under — skip drawing entirely
      }
    }
  }

  // dev peek — how many animals are above the surface this frame, and where the
  // highest one is (scene space), for framing/headless checks
  function peek() {
    let up = 0, top = null, topY = -1;
    for (const m of animals) {
      if (!m.visible) continue;
      up++;
      const wy = group.position.y + m.position.y;
      if (wy > topY) { topY = wy; top = { x: group.position.x + m.position.x, y: wy, z: group.position.z + m.position.z, kind: m.userData.kind }; }
    }
    return { up, top, vis: +vis.toFixed(2) };
  }

  return { update, group, peek };
}
