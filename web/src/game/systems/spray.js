// Bow spray — foam thrown up where the bow cuts the sea. A small recycled
// Points pool (no allocations per frame, no leaks): each particle spawns at the
// bow, arcs up/out/forward and falls back, fading as it goes. Emission and
// force scale with the weather and how much way the ship is making. The ship is
// pinned at the origin facing +z, so the bow is at +z and this all lives in
// scene space.

import { Points, BufferGeometry, BufferAttribute, PointsMaterial } from 'three';

export function createSpray(scene, ship) {
  const N = 160;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -9999; // park the dead far below

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({ color: 0xeef4f8, size: 0.55, transparent: true, opacity: 0.9, depthWrite: false });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  const bowZ = ship.length * 0.46;
  let emit = 0, cursor = 0;

  function spawn(storm, speed) {
    // find a free slot (round-robin scan)
    let i = -1;
    for (let k = 0; k < N; k++) { const j = (cursor + k) % N; if (life[j] <= 0) { i = j; cursor = (j + 1) % N; break; } }
    if (i < 0) return;
    const sx = (Math.random() - 0.5) * ship.beam * 0.5;
    pos[i * 3] = sx;
    pos[i * 3 + 1] = ship.deckY - 1.4;
    pos[i * 3 + 2] = bowZ + (Math.random() - 0.5) * 1.6;
    vel[i * 3] = sx * 0.7 + (Math.random() - 0.5) * 2.5;
    vel[i * 3 + 1] = 3 + Math.random() * 3 + storm * 3.5;
    vel[i * 3 + 2] = 1.5 + Math.random() * 2 + speed * 5;
    life[i] = 0.6 + Math.random() * 0.5;
  }

  function update(dt, storm, speed) {
    const active = storm > 0.08 || speed > 0.05;
    if (active) {
      emit += (storm * 0.8 + speed * 0.6) * 90 * dt; // particles/sec
      while (emit >= 1) { emit -= 1; spawn(storm, speed); }
    }
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      vel[i * 3 + 1] -= 12 * dt; // gravity
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (life[i] <= 0 || pos[i * 3 + 1] < -2) { life[i] = 0; pos[i * 3 + 1] = -9999; }
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { update };
}
