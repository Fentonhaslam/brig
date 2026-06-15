// Fair-weather ambiance: gulls wheeling above in calm daylight, and a soft
// sun/moon disc out along the day/night sun direction that the bloom catches.
// Both cheap and recycled — the same meshes are reused, opacity just fades.

import {
  Group, Mesh, BufferGeometry, BufferAttribute, MeshBasicMaterial, DoubleSide,
  Sprite, SpriteMaterial, CanvasTexture, Vector3,
} from 'three';

function gullGeometry() {
  // a shallow V (two wings) lying roughly flat — reads as a bird from below
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0, -0.7, 0.14, 0.5, -0.28, 0, 0.16,
    0, 0, 0, 0.28, 0, 0.16, 0.7, 0.14, 0.5,
  ]), 3));
  return g;
}

function discTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,252,238,0.75)');
  g.addColorStop(1, 'rgba(255,252,238,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function createAmbiance(scene) {
  // --- gulls ---
  const gullGroup = new Group();
  scene.add(gullGroup);
  const gullMat = new MeshBasicMaterial({ color: 0xfbfbff, side: DoubleSide, transparent: true, opacity: 0, depthWrite: false });
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const m = new Mesh(gullGeometry(), gullMat);
    m.userData = { r: 20 + Math.random() * 20, h: 24 + Math.random() * 14, a: Math.random() * 6.28, sp: 0.1 + Math.random() * 0.12, ph: Math.random() * 10 };
    gullGroup.add(m); gulls.push(m);
  }

  // --- sun / moon disc ---
  const disc = new Sprite(new SpriteMaterial({ map: discTexture(), transparent: true, depthWrite: false, depthTest: false, color: 0xfff0d0 }));
  disc.scale.set(90, 90, 1);
  disc.renderOrder = -1; // behind the world, with the sky
  scene.add(disc);

  const _p = new Vector3();

  function update(dt, t, storm, day, sunDir, camPos) {
    // gulls fade in for calm daylight, fade out otherwise
    const want = (storm < 0.3 && day > 0.4) ? 0.85 : 0;
    gullMat.opacity += (want - gullMat.opacity) * Math.min(1, dt * 1.5);
    gullGroup.visible = gullMat.opacity > 0.02;
    if (gullGroup.visible) {
      gullGroup.position.set(camPos.x, 0, camPos.z); // wheel above wherever you are
      for (const m of gulls) {
        const u = m.userData; u.a += u.sp * dt;
        m.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t * 0.5 + u.ph) * 2.5, Math.sin(u.a) * u.r);
        m.rotation.y = -u.a + Math.PI / 2;            // bank into the turn
        m.rotation.z = Math.sin(t * 3 + u.ph) * 0.18;  // a lazy wing tilt
      }
    }
    // disc sits far out along the sun direction; warm by day, pale by night
    _p.copy(sunDir).multiplyScalar(2400).add(camPos);
    disc.position.copy(_p);
    disc.material.color.set(day > 0.45 ? 0xfff0cf : 0xc2cce6);
    disc.scale.setScalar(day > 0.45 ? 95 : 62);
    disc.material.opacity = 0.6 + day * 0.35;
  }

  return { update };
}
