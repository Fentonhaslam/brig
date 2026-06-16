// Enemy ships. A pirate holds station off the starboard beam, bobbing on the
// swell within cannon range; your broadside (cannons.balls) chews her hull down
// and she founders, spilling loot (coin + plunder) into your hold. Built with
// its own materials (the player ship's are module-shared, so reusing createShip
// would recolour your own deck). Scene-space — the player ship is at the origin.

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry, DoubleSide, Vector3,
} from 'three';
import { withOutline } from '../core/toon.js';
import { pbrMaterial } from '../core/materials.js';
import { woodGrain, weave } from '../core/textures.js';

function buildEnemyShip() {
  const g = new Group();
  const hullMat = pbrMaterial(0x26242b, { map: woodGrain(2, 5) });
  const trimMat = pbrMaterial(0x3a2f28);
  const sailMat = pbrMaterial(0x47434f, { side: DoubleSide, map: weave(2, 2) });
  const L = 30, B = 9, D = 4.2;

  const hg = new BoxGeometry(B, D, L, 2, 2, 6);
  const pos = hg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const z01 = (z + L / 2) / L, t = Math.abs(z01 - 0.5) * 2;
    pos.setX(i, x * (1 - t * t * 0.55));
  }
  hg.computeVertexNormals();
  const hull = new Mesh(hg, hullMat); hull.position.y = 2.2; withOutline(hull, 0.1); g.add(hull);

  const deck = new Mesh(new BoxGeometry(B * 0.78, 0.4, L * 0.86), trimMat); deck.position.y = 4.1; g.add(deck);
  for (const sx of [-1, 1]) { const w = new Mesh(new BoxGeometry(0.3, 1.0, L * 0.8), trimMat); w.position.set(sx * B * 0.42, 4.6, 0); g.add(w); }

  for (const [mz, sw, sh] of [[L * 0.28, 6, 6.5], [0, 7.5, 8], [-L * 0.3, 5, 5.5]]) {
    const pole = new Mesh(new CylinderGeometry(0.2, 0.3, 15, 6), trimMat); pole.position.set(0, 9, mz); g.add(pole);
    const sail = new Mesh(new PlaneGeometry(sw, sh), sailMat); sail.position.set(0, 10, mz + 0.15); g.add(sail);
  }
  // black flag
  const flag = new Mesh(new PlaneGeometry(2.2, 1.3), pbrMaterial(0x121016, { side: DoubleSide }));
  flag.position.set(0.9, 17, 0); g.add(flag);

  g.scale.setScalar(1.25);
  return g;
}

export function createCombat({ scene, physics, inventory, cannons, ship, getStorm, getBerthed, getOpenWater, onHit }) {
  let enemy = null;
  let spawnTimer = 25;
  let playerHp = 5; const maxHp = 5;
  const hostile = []; // enemy cannonballs in flight
  let flashV = 0;
  const _v = new Vector3();
  const ballGeo = new SphereGeometry(0.34, 8, 6);
  const ballMat = pbrMaterial(0x14131a);

  // HUD: enemy health bar (top centre, under the helm HUD)
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:78px;left:50%;transform:translateX(-50%);z-index:56;display:none;'
    + 'font:600 12px system-ui;color:#f3e8cf;background:rgba(40,12,12,.55);backdrop-filter:blur(3px);'
    + 'padding:6px 14px;border-radius:10px;text-align:center;min-width:170px;pointer-events:none';
  document.body.appendChild(hud);

  // player hull bar (shows in a fight or when damaged) + a red hit-flash + a toast
  const hullHud = document.createElement('div');
  hullHud.style.cssText = 'position:fixed;top:108px;left:50%;transform:translateX(-50%);z-index:56;display:none;'
    + 'font:600 12px system-ui;color:#f3e8cf;background:rgba(12,30,40,.55);backdrop-filter:blur(3px);'
    + 'padding:6px 14px;border-radius:10px;text-align:center;min-width:170px;pointer-events:none';
  document.body.appendChild(hullHud);
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;z-index:41;background:#c0392b;opacity:0;pointer-events:none';
  document.body.appendChild(flash);
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:40%;left:50%;transform:translateX(-50%);z-index:90;display:none;'
    + 'font:700 22px Georgia,serif;color:#ffdca8;text-shadow:0 2px 8px rgba(0,0,0,.8);pointer-events:none';
  document.body.appendChild(toast);
  let toastT = 0;
  function say(msg) { toast.textContent = msg; toast.style.display = 'block'; toastT = 2.6; }

  function spawn() {
    if (enemy) return;
    const root = buildEnemyShip();
    scene.add(root);
    enemy = { root, hp: 6, maxHp: 6, t: Math.random() * 6, sink: 0, fireT: 5 };
  }

  function loot() {
    inventory.add('coin', 60 + Math.floor(Math.random() * 90));
    inventory.add('gold', 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.5) inventory.add('spice', 1 + Math.floor(Math.random() * 2));
  }

  function enemyFire() {
    const e = enemy.root.position;
    const { body } = physics.dynamicBall(0.34, e.x, e.y + 6, e.z, 0.2);
    const dx = -e.x, dz = -e.z, d = Math.hypot(dx, dz) || 1;
    body.setLinvel({ x: (dx / d) * 30, y: 13, z: (dz / d) * 30 }, true); // a lobbed shot that lands on deck
    const m = new Mesh(ballGeo, ballMat); scene.add(m);
    hostile.push({ m, body, life: 5 });
  }

  function hitPlayer() {
    playerHp -= 1; flashV = 1;
    if (onHit) onHit(); // a cannonball that lands also gouges the vessel hull
    if (playerHp <= 0) {
      const goods = ['cloth', 'tools', 'wine', 'oil', 'spice', 'gold', 'timber', 'biscuit'].filter((g) => inventory.count(g) > 0);
      if (goods.length) { const g = goods[(Math.random() * goods.length) | 0]; inventory.take(g, Math.max(1, Math.ceil(inventory.count(g) * 0.3))); }
      playerHp = maxHp;
      if (enemy) { scene.remove(enemy.root); enemy = null; }
      say('⚔ Boarded! Cargo lost.');
    }
  }

  function update(dt, t) {
    // hit-flash + toast decay
    if (flashV > 0) flashV = Math.max(0, flashV - dt * 2.4);
    flash.style.opacity = (flashV * 0.5).toFixed(3);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.display = 'none'; }

    // hostile cannonballs in flight (continue even after the enemy is gone)
    for (let i = hostile.length - 1; i >= 0; i--) {
      const h = hostile[i]; h.life -= dt;
      const p = h.body.translation(); h.m.position.set(p.x, p.y, p.z);
      // a generous sphere around the deck centre catches the shot however it
      // arcs in (aimed at the origin, so it passes close)
      const hit = Math.hypot(p.x, p.y - ship.deckY, p.z) < 9;
      if (hit || h.life <= 0 || p.y < -12) {
        scene.remove(h.m); physics.world.removeRigidBody(h.body); hostile.splice(i, 1);
        if (hit) hitPlayer();
      }
    }

    // player hull bar — shown in a fight or while damaged
    if (enemy || playerHp < maxHp) {
      const hp = Math.max(0, playerHp) / maxHp;
      hullHud.style.display = 'block';
      hullHud.innerHTML = '⚔ Boarding'
        + `<div style="margin-top:5px;height:6px;width:150px;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden">`
        + `<div style="height:100%;width:${(hp * 100).toFixed(0)}%;background:linear-gradient(90deg,#2e7d4f,#7ad0a0)"></div></div>`;
    } else hullHud.style.display = 'none';

    if (!enemy) {
      hud.style.display = 'none';
      if (!getBerthed() && getStorm() < 0.7 && getOpenWater()) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawn(); spawnTimer = 70 + Math.random() * 50; }
      } else spawnTimer = Math.max(spawnTimer, 12); // re-arm a little once back in open water
      return;
    }

    if (enemy.sink > 0) { // foundering
      enemy.sink += dt;
      enemy.root.position.y -= dt * 1.6;
      enemy.root.rotation.z += dt * 0.35;
      hud.style.display = 'none';
      if (enemy.sink > 3.2) { scene.remove(enemy.root); enemy = null; }
      return;
    }

    // hold station off the starboard beam, drifting + bobbing, facing the player
    enemy.t += dt;
    const x = 44 + Math.sin(enemy.t * 0.12) * 7;
    const z = Math.sin(enemy.t * 0.08) * 22;
    enemy.root.position.set(x, Math.sin(t * 0.7) * 0.5, z);
    enemy.root.rotation.y = Math.atan2(-x, -z) + Math.PI / 2; // broadside to us
    enemy.root.rotation.z = Math.sin(t * 0.9) * 0.04;

    // player broadside hits
    for (const b of cannons.balls) {
      if (b.life <= 0) continue;
      const p = b.body.translation();
      if (_v.set(p.x, p.y, p.z).distanceTo(enemy.root.position) < 11) {
        b.life = 0; // consume the shot
        enemy.hp -= 1;
        if (enemy.hp <= 0) { enemy.sink = 0.001; loot(); say('⚓ Enemy sunk — plunder taken!'); }
      }
    }

    // the enemy fires back, slowly
    enemy.fireT -= dt;
    if (enemy.fireT <= 0) { enemyFire(); enemy.fireT = 4.5 + Math.random() * 3; }

    const pct = Math.max(0, enemy.hp) / enemy.maxHp;
    hud.style.display = 'block';
    hud.innerHTML = '⚔ Pirate ship'
      + `<div style="margin-top:5px;height:6px;width:150px;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden">`
      + `<div style="height:100%;width:${(pct * 100).toFixed(0)}%;background:linear-gradient(90deg,#c0392b,#e07a5a)"></div></div>`;
  }

  return {
    update, spawn, get enemy() { return enemy; }, get playerHp() { return playerHp; },
    dbg() { return { n: hostile.length, hp: playerHp, pos: hostile.map((h) => { const p = h.body.translation(); return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]; }) }; },
    testFire() { if (enemy) enemyFire(); },
  };
}
