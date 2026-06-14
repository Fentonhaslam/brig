// Lean WebGL renderer for the lightweight build.
//
// Deliberately minimal: no shadow maps, no post-processing, capped pixel ratio.
// ACES tone mapping is free in three and gives the warm cinematic punch without
// any of the post-processing passes that tanked the Babylon build.

import {
  WebGLRenderer,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  PCFSoftShadowMap,
} from 'three';

export function createRenderer(canvas) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });

  // Cap at 1.5x device pixels — retina at full 2x quadruples fragment work for
  // a difference nobody sees on a stylized low-poly scene. This alone is a big
  // win on Mac/high-DPI displays.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Shadows OFF by default (we fake them with cheap blob decals). Left wired so
  // a single low-res shadow can be enabled later if it's worth the cost.
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = PCFSoftShadowMap;

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  }
  window.addEventListener('resize', resize);

  return renderer;
}
