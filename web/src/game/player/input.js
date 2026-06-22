// Input: keyboard state + click-to-move raycasting + interact key.
//
// Click-to-move and orbit-drag share the left button, so we only treat a press
// as a "move/interact" click if the pointer barely moved between down and up
// (a drag is a camera orbit, handled by the orbit cam).

import { Raycaster, Vector2 } from 'three';

export function createInput(dom, camera) {
  const keys = new Set();
  // ignore keystrokes while the player is typing in a form field (feedback,
  // chronicle, name entry) so WASD doesn't drive the ship as you write
  const typing = (e) => { const t = e.target && e.target.tagName; return t === 'INPUT' || t === 'TEXTAREA'; };
  window.addEventListener('keydown', (e) => { if (!typing(e)) keys.add(e.code); });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  const ray = new Raycaster();
  const ndc = new Vector2();
  let downX = 0, downY = 0, downT = 0;
  const clickListeners = [];

  dom.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    downX = e.clientX; downY = e.clientY; downT = performance.now();
  });
  dom.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 6) return; // it was a drag-orbit, not a click
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    clickListeners.forEach((fn) => fn(ray));
  });

  // axis helpers (WASD / arrows)
  function moveAxis() {
    let x = 0, z = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;
    return { x, z };
  }

  return {
    keys,
    isDown: (code) => keys.has(code),
    running: () => keys.has('ShiftLeft') || keys.has('ShiftRight'),
    moveAxis,
    onClick: (fn) => clickListeners.push(fn),
  };
}
