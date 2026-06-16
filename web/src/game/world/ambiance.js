// Fair-weather ambiance: gulls wheeling above in calm daylight, and a soft
// sun/moon disc out along the day/night sun direction that the bloom catches.
// Both cheap and recycled — the same meshes are reused, opacity just fades.

import {
  Group, Mesh, BufferGeometry, BufferAttribute, MeshBasicMaterial, DoubleSide,
  Sprite, SpriteMaterial, CanvasTexture, Vector3,
  Points, PointsMaterial, AdditiveBlending, Float32BufferAttribute,
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

// a soft puffy cloud — a few overlapping radial blobs
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 10; i++) {
    const cx = 18 + Math.random() * 92, cy = 26 + Math.random() * 16, r = 12 + Math.random() * 22;
    const g = x.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  }
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

  // --- sun shafts: a broad warm glow at the sun, peaking at dawn/dusk ---
  const sunGlow = new Sprite(new SpriteMaterial({ map: discTexture(), transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, color: 0xffce8c, opacity: 0 }));
  sunGlow.scale.set(900, 900, 1); sunGlow.renderOrder = -1; scene.add(sunGlow);

  // --- soft cloud billboards drifting across the sky ---
  const cloudTex = cloudTexture();
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const s = new Sprite(new SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0, color: 0xfdf6ec }));
    s.userData = { a: Math.random() * 6.28, r: 700 + Math.random() * 520, h: 220 + Math.random() * 180, sp: 0.004 + Math.random() * 0.006, sc: 260 + Math.random() * 240 };
    s.renderOrder = -1; scene.add(s); clouds.push(s);
  }

  // --- drifting dust motes near the camera ---
  const DUST = 90; const dpos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dpos[i * 3] = (Math.random() - 0.5) * 60; dpos[i * 3 + 1] = Math.random() * 22; dpos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
  const dustGeo = new BufferGeometry(); dustGeo.setAttribute('position', new Float32BufferAttribute(dpos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({ size: 0.12, color: 0xffe9c4, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  scene.add(dust);

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

    // sun shafts peak when the sun is low (dawn/dusk), fade out in storm
    const lowSun = Math.max(0, 1 - Math.max(0, sunDir.y) * 2.2);
    sunGlow.position.copy(_p);
    sunGlow.material.color.set(day > 0.4 ? 0xffce8c : 0xbcd0ff);
    sunGlow.material.opacity = lowSun * Math.max(0, day - 0.05) * (1 - storm) * 0.6;

    // clouds drift slowly, follow the camera, fade in for calmer skies
    const cloudWant = (1 - storm * 0.5) * (0.3 + day * 0.45);
    for (const s of clouds) {
      const u = s.userData; u.a += u.sp * dt;
      s.position.set(camPos.x + Math.cos(u.a) * u.r, u.h, camPos.z + Math.sin(u.a) * u.r);
      s.scale.set(u.sc, u.sc * 0.5, 1);
      s.material.opacity += (cloudWant - s.material.opacity) * Math.min(1, dt * 0.6);
    }

    // dust motes drift up near the camera, daylight only
    dust.position.set(camPos.x, 0, camPos.z);
    const dp = dustGeo.attributes.position;
    for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.3; if (y > 22) y -= 22; dp.setY(i, y); }
    dp.needsUpdate = true;
    dust.material.opacity = Math.max(0, day - 0.2) * (1 - storm) * 0.45;
  }

  return { update };
}
