// WebGL renderer for the build.
//
// Pixel ratio is capped at 1.5x (the big high-DPI win). ACES tone mapping is
// applied here; one tightly-framed PCFSoft shadow map covers the deck. NOTE:
// the heavier frame cost lives downstream — core/post.js runs a full
// EffectComposer (GTAO + bloom + grade + SMAA). This file is no longer
// "no shadows, no post"; see post.js for the passes and the quality levers.

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
  renderer.toneMappingExposure = 1.02;

  // One soft directional shadow, tightly framed on the ship. Cheap because the
  // shadow camera only covers the deck (~30 units), not the whole sea — masts,
  // rigging and crew drop real shadows onto the planking, which is most of what
  // sells depth. PCF keeps the edges from crawling.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  }
  window.addEventListener('resize', resize);

  return renderer;
}
