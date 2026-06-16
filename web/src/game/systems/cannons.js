// Run out the guns. Pressing fire launches a broadside: a cannonball (a real
// Rapier dynamic body) leaves each gun with outward + a little upward velocity,
// arcs over the sea and is cleaned up after a few seconds. A short WebAudio
// boom sells it; ringing the bell is here too (a quick clang). The ship rides
// at the origin facing +z, so muzzles + shots are all in scene space.

import { Mesh, SphereGeometry } from 'three';
import { pbrMaterial } from '../core/materials.js';

let actx = null;
function ctx() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  return actx;
}
function boom() {
  const a = ctx(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  const g = a.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.45);
  const len = (a.sampleRate * 0.18) | 0;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
  const n = a.createBufferSource(); n.buffer = buf;
  const ng = a.createGain(); ng.gain.value = 0.4;
  n.connect(ng).connect(a.destination); n.start(t);
}
function clang() {
  const a = ctx(); if (!a) return;
  const t = a.currentTime;
  for (const [f, gain] of [[1180, 0.25], [1760, 0.18], [2640, 0.1]]) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 1.1);
  }
}

export function createCannons(scene, physics, ship) {
  const balls = [];
  const ballMat = pbrMaterial(0x1b1b20);
  const ballGeo = new SphereGeometry(0.32, 10, 8);

  function fire() {
    const dy = ship.deckY - 0.2;       // about the gun-port line
    const x0 = ship.beam * 0.5;         // just outside the rail
    for (const side of [-1, 1]) {
      for (const z of [-7, -1, 5]) {
        const { body } = physics.dynamicBall(0.32, side * x0, dy, z, 0.2);
        body.setLinvel({ x: side * 36, y: 6.5, z: 0 }, true);
        const m = new Mesh(ballGeo, ballMat);
        m.castShadow = true;
        scene.add(m);
        balls.push({ m, body, life: 4 });
      }
    }
    boom();
  }

  function update(dt) {
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.life -= dt;
      const p = b.body.translation();
      b.m.position.set(p.x, p.y, p.z);
      if (b.life <= 0 || p.y < -10) {
        scene.remove(b.m);
        physics.world.removeRigidBody(b.body);
        balls.splice(i, 1);
      }
    }
  }

  return { fire, ringBell: clang, update, get count() { return balls.length; }, get balls() { return balls; } };
}
