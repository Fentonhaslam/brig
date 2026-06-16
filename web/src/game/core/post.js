// Lightweight cinematic post for the toon build.
//
// The flat-but-clean look was the new build's weakness. This is the cheap fix:
// a single composer pass that adds the three things the rich old build had and
// this one didn't — a soft bloom so lanterns / sun / foam glints glow, a warm
// split-tone grade with a vignette, and a whisper of grain so it reads painted
// rather than plastic. Threshold is high so only genuinely bright pixels bloom;
// the toon flats stay crisp.

import {
  Color, Vector2, WebGLRenderTarget, HalfFloatType, Clock,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse:       { value: null },
    warmShadow:     { value: new Color(0xffdcbe) }, // shadows nudged warm (keeps blues)
    coolHighlight:  { value: new Color(0xfff2d8) }, // highlights creamy
    saturation:     { value: 1.05 },
    contrast:       { value: 1.06 },
    vignette:       { value: 0.42 },
    grain:          { value: 0.03 },
    time:           { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 warmShadow; uniform vec3 coolHighlight;
    uniform float saturation; uniform float contrast; uniform float vignette; uniform float grain; uniform float time;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // split-tone: tint shadows warm, highlights cream
      col = mix(col * warmShadow, col * coolHighlight, smoothstep(0.0, 0.85, lum));
      col = (col - 0.5) * contrast + 0.5;                         // contrast about mid
      float g = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(g), col, saturation);                        // saturation
      vec2 uv = vUv - 0.5;                                        // vignette
      float d = length(uv) * 1.4142;
      col *= 1.0 - smoothstep(0.42, 0.98, d) * vignette;
      col += (rand(vUv + fract(time)) - 0.5) * grain;             // film grain
      gl_FragColor = vec4(col, tex.a);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const dpr = renderer.getPixelRatio();
  const rt = new WebGLRenderTarget(
    Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr),
    { type: HalfFloatType, samples: 4 }, // keep MSAA edges through the composer
  );
  const composer = new EffectComposer(renderer, rt);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(dpr);

  composer.addPass(new RenderPass(scene, camera));

  // ground the scene with ambient occlusion — contact shadows in every crevice,
  // under eaves, between cobbles and in corners. The single biggest depth cue
  // the flat-lit build was missing. Radius tuned to the world's metre-ish scale.
  const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  try {
    gtao.updateGtaoMaterial({ radius: 3.0, distanceExponent: 1.0, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false });
  } catch { /* keep defaults if the param shape differs across three versions */ }
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    0.42,  // strength — enough to make lanterns + sun glints glow
    0.6,   // radius
    0.82,  // threshold — toon flats stay crisp; only bright stuff blooms
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const clock = new Clock();
  window.addEventListener('resize', () => {
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.setSize(window.innerWidth, window.innerHeight);
    gtao.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    composer,
    render() {
      grade.material.uniforms.time.value = clock.getElapsedTime();
      composer.render();
    },
    setBloom(strength) { bloom.strength = strength; },
  };
}
