// RuneScape-style orbital camera — ~70 lines, no external controls dependency.
//
// Left-drag (or right-drag) rotates around the focus target; wheel zooms; the
// target is a point we move to follow the player. Pitch is clamped so you can't
// flip under the world or stare straight down.

import { Vector3, MathUtils } from 'three';

export function createOrbitCam(camera, dom, target = new Vector3(0, 1.5, 0)) {
  let radius = 30;
  let yaw = Math.PI * 0.15;   // around Y
  let pitch = 0.4;            // up/down, radians — a low cinematic hero angle
  const minR = 6, maxR = 90;
  const minPitch = 0.1, maxPitch = 1.35;

  let dragging = false;
  let lastX = 0, lastY = 0;

  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    // left OR right drag orbits; left is also used for click-to-move, so the
    // game layer decides a click was a "move" only if the pointer barely moved.
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    dom.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointerup', (e) => {
    dragging = false; dom.releasePointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw -= (e.clientX - lastX) * 0.006;
    pitch = MathUtils.clamp(pitch + (e.clientY - lastY) * 0.005, minPitch, maxPitch);
    lastX = e.clientX; lastY = e.clientY;
  });
  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    radius = MathUtils.clamp(radius * (1 + Math.sign(e.deltaY) * 0.1), minR, maxR);
  }, { passive: false });

  const tmp = new Vector3();
  function update() {
    const h = Math.sin(pitch) * radius;
    const r = Math.cos(pitch) * radius;
    tmp.set(
      target.x + Math.sin(yaw) * r,
      target.y + h,
      target.z + Math.cos(yaw) * r,
    );
    camera.position.lerp(tmp, 0.18); // gentle smoothing
    camera.lookAt(target);
  }

  return {
    update,
    target,
    get yaw() { return yaw; },
    get radius() { return radius; },
    setRadius(r) { radius = MathUtils.clamp(r, minR, maxR); },
    setYaw(y) { yaw = y; },
    setPitch(pp) { pitch = MathUtils.clamp(pp, minPitch, maxPitch); },
  };
}
