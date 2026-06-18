// Waypoint guidance — shows the player WHERE TO GO for the current objective.
// Two cues that work together:
//   * a 3D "shiny": a glowing beam + a bobbing, spinning gem + a ground ring
//     planted at the target, visible across the town;
//   * an on-screen pointer: a gold chevron that hovers over the target when it's
//     in view, or pins to the screen edge and points toward it when it's off
//     screen — with the distance in paces.
// The target is a scene-space point (set by main from the active quest step).
// Cheap: MeshBasic everything, one DOM node, scratch vector reused.

import {
  Group, Mesh, Vector3, DoubleSide, AdditiveBlending,
  CylinderGeometry, OctahedronGeometry, RingGeometry, MeshBasicMaterial,
} from 'three';

export function createWaypoint({ scene, camera }) {
  const GOLD = 0xffd36a;

  // --- the 3D beacon ---
  const group = new Group();
  group.visible = false;
  scene.add(group);

  const beam = new Mesh(
    new CylinderGeometry(0.45, 0.7, 18, 14, 1, true),
    new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.14, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }),
  );
  beam.position.y = 9; group.add(beam);

  const gem = new Mesh(
    new OctahedronGeometry(0.55),
    new MeshBasicMaterial({ color: 0xfff1c0 }),
  );
  gem.position.y = 3; group.add(gem);

  const ring = new Mesh(
    new RingGeometry(1.0, 1.5, 28),
    new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; group.add(ring);

  // --- the on-screen pointer ---
  const ptr = document.createElement('div');
  ptr.style.cssText = 'position:fixed;left:0;top:0;z-index:57;display:none;pointer-events:none;'
    + 'width:46px;height:46px;margin:-23px 0 0 -23px;text-align:center';
  ptr.innerHTML = '<div id="wp-arrow" style="font:700 26px system-ui;color:#ffd36a;line-height:46px;'
    + 'text-shadow:0 2px 6px rgba(0,0,0,.85);transition:transform .08s linear">▲</div>'
    + '<div id="wp-dist" style="position:absolute;left:50%;top:46px;transform:translateX(-50%);'
    + 'font:700 11px system-ui;color:#ffe6a8;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9)"></div>';
  document.body.appendChild(ptr);
  const arrowEl = ptr.querySelector('#wp-arrow');
  const distEl = ptr.querySelector('#wp-dist');

  let target = null;
  const _v = new Vector3();

  function setTarget(v) {
    const changed = !!v !== !!target;
    target = v || null;
    group.visible = !!target;
    ptr.style.display = target ? 'block' : 'none';
    if (target) group.position.set(target.x, target.y || 0, target.z);
    if (changed && target && gem.material) { /* pop on (re)appear handled in update */ }
  }

  function update(dt, t) {
    if (!target) return;
    // animate the shiny
    gem.rotation.y += dt * 1.6;
    gem.rotation.x += dt * 0.7;
    gem.position.y = 3 + Math.sin(t * 2.2) * 0.28;
    const pulse = 1 + Math.sin(t * 2.2) * 0.1;
    ring.scale.setScalar(pulse);

    // project the target (a little above the gem) to screen space
    const W = window.innerWidth, H = window.innerHeight;
    _v.set(target.x, (target.y || 0) + 3.4, target.z).project(camera);
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * W;
    let y = (-_v.y * 0.5 + 0.5) * H;
    const margin = 54;
    const onScreen = !behind && x >= margin && x <= W - margin && y >= margin && y <= H - margin;

    const dist = Math.round(camera.position.distanceTo(_vDist(target)));
    distEl.textContent = dist + ' paces';

    if (onScreen) {
      arrowEl.textContent = '▼'; // point down onto the target
      arrowEl.style.transform = 'rotate(0deg)';
      ptr.style.left = x + 'px';
      ptr.style.top = (y - 26) + 'px';
    } else {
      // pin to the screen edge, chevron rotated toward the target
      let dx = x - W / 2, dy = y - H / 2;
      if (behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const hx = (W / 2) - margin, hy = (H / 2) - margin;
      const scale = Math.min(hx / (Math.abs(Math.cos(ang)) || 1e-3), hy / (Math.abs(Math.sin(ang)) || 1e-3));
      const ex = W / 2 + Math.cos(ang) * scale;
      const ey = H / 2 + Math.sin(ang) * scale;
      arrowEl.textContent = '▲';
      arrowEl.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
      ptr.style.left = ex + 'px';
      ptr.style.top = ey + 'px';
    }
  }

  // distance uses the raw target point (not the projected one)
  const _d = new Vector3();
  function _vDist(tg) { return _d.set(tg.x, tg.y || 0, tg.z); }

  return { setTarget, update };
}
