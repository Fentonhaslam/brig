// Dev-only perf overlay: fps, draw calls, triangles. Zero dependencies.
//
// This is the budget enforcer for the lightweight rebuild — if draw calls drift
// into the thousands or fps drops below 60, it shows up here immediately. Hidden
// in production unless the URL has #stats.

export function createStats() {
  const dom = document.createElement('div');
  dom.style.cssText = [
    'position:fixed', 'top:8px', 'left:8px', 'z-index:9999',
    'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'color:#9fe', 'background:rgba(6,16,26,.72)', 'padding:6px 8px',
    'border:1px solid rgba(120,200,255,.25)', 'border-radius:5px',
    'pointer-events:none', 'white-space:pre', 'letter-spacing:.3px',
  ].join(';');
  const visible = location.hash.includes('stats') || import.meta.env?.DEV;
  if (visible) document.body.appendChild(dom);

  let frames = 0;
  let acc = 0;
  let fps = 0;
  let worst = 0; // worst (longest) frame in the window, ms

  // Call once per frame with (dtSeconds, renderer).
  function update(dt, renderer) {
    frames++;
    acc += dt;
    worst = Math.max(worst, dt * 1000);
    if (acc >= 0.5) {
      fps = Math.round(frames / acc);
      const info = renderer.info.render;
      if (visible) {
        dom.textContent =
          `${fps} fps   (peak frame ${worst.toFixed(1)}ms)\n` +
          `draw calls  ${info.calls}\n` +
          `triangles   ${(info.triangles / 1000).toFixed(1)}k\n` +
          `geometries  ${renderer.info.memory.geometries}   textures ${renderer.info.memory.textures}`;
      }
      frames = 0; acc = 0; worst = 0;
    }
  }

  return { dom, update, get fps() { return fps; } };
}
