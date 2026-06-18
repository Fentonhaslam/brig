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
  // Positioned ONLY via CSS `transform` (compositor, no layout) and updated only
  // when a value actually changes — so tracking the target every frame while you
  // walk never forces a synchronous reflow (the thing that made walking jank).
  const ptr = document.createElement('div');
  ptr.style.cssText = 'position:fixed;left:0;top:0;z-index:57;display:none;pointer-events:none;'
    + 'width:46px;height:46px;margin:-23px 0 0 -23px;text-align:center;will-change:transform';
  ptr.innerHTML = '<div id="wp-arrow" style="font:700 26px system-ui;color:#ffd36a;line-height:46px;'
    + 'text-shadow:0 2px 6px rgba(0,0,0,.85);will-change:transform">▲</div>'
    + '<div id="wp-dist" style="position:absolute;left:50%;top:46px;transform:translateX(-50%);'
    + 'font:700 11px system-ui;color:#ffe6a8;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9)"></div>';
  document.body.appendChild(ptr);
  const arrowEl = ptr.querySelector('#wp-arrow');
  const distEl = ptr.querySelector('#wp-dist');

  // cache the viewport size (read on resize, never per frame)
  let W = window.innerWidth, H = window.innerHeight;
  window.addEventListener('resize', () => { W = window.innerWidth; H = window.innerHeight; });

  let target = null;
  let shown = false;
  const _v = new Vector3();
  const _d = new Vector3();
  // last-written DOM state, so we only touch the DOM on change
  let lastTx = null, lastTy = null, lastRot = null, lastGlyph = null, lastDist = -1;

  function setTarget(v) {
    target = v || null;
    group.visible = !!target;
    if (target) group.position.set(target.x, target.y || 0, target.z);
    if (!target && shown) { ptr.style.display = 'none'; shown = false; }
  }

  function update(dt, t) {
    if (!target) return;
    // animate the shiny (cheap; transforms on the GPU side)
    gem.rotation.y += dt * 1.6;
    gem.rotation.x += dt * 0.7;
    gem.position.y = 3 + Math.sin(t * 2.2) * 0.28;
    ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.1);

    if (!shown) { ptr.style.display = 'block'; shown = true; }

    // project the target (a little above the gem) to screen
    _v.set(target.x, (target.y || 0) + 3.4, target.z).project(camera);
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * W;
    let y = (-_v.y * 0.5 + 0.5) * H;
    const margin = 54;
    const onScreen = !behind && x >= margin && x <= W - margin && y >= margin && y <= H - margin;

    let tx, ty, rot, glyph;
    if (onScreen) {
      glyph = '▼'; rot = 0; tx = x; ty = y - 26;
    } else {
      let dx = x - W / 2, dy = y - H / 2;
      if (behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const sc = Math.min((W / 2 - margin) / (Math.abs(Math.cos(ang)) || 1e-3), (H / 2 - margin) / (Math.abs(Math.sin(ang)) || 1e-3));
      glyph = '▲'; rot = ang + Math.PI / 2; tx = W / 2 + Math.cos(ang) * sc; ty = H / 2 + Math.sin(ang) * sc;
    }

    // write only what changed, and only via transform (no layout)
    const itx = Math.round(tx), ity = Math.round(ty);
    if (itx !== lastTx || ity !== lastTy) { ptr.style.transform = `translate(${itx}px,${ity}px)`; lastTx = itx; lastTy = ity; }
    if (glyph !== lastGlyph) { arrowEl.textContent = glyph; lastGlyph = glyph; }
    const ideg = Math.round(rot * 57.2958);
    if (ideg !== lastRot) { arrowEl.style.transform = `rotate(${ideg}deg)`; lastRot = ideg; }
    const dist = Math.round(camera.position.distanceTo(_d.set(target.x, target.y || 0, target.z)));
    if (dist !== lastDist) { distEl.textContent = dist + ' paces'; lastDist = dist; }
  }

  return { setTarget, update };
}
