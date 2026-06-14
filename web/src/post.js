// Cinematic post-processing: bloom + warm color grade + vignette.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CinematicGradeShader = {
  uniforms: {
    tDiffuse:        { value: null },
    vignetteAmount:  { value: 1.15 },
    vignetteSoft:    { value: 0.45 },
    warmShadow:      { value: new THREE.Color(0xffb878) },
    coolHighlight:   { value: new THREE.Color(0xffe5b0) },
    saturation:      { value: 1.06 },
    contrast:        { value: 1.08 },
    grainAmount:     { value: 0.035 },
    time:            { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignetteAmount;
    uniform float vignetteSoft;
    uniform vec3 warmShadow;
    uniform vec3 coolHighlight;
    uniform float saturation;
    uniform float contrast;
    uniform float grainAmount;
    uniform float time;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;

      // Luminance-based split-tone: warm shadows, warm highlights (cinematic warm grade)
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 graded = mix(col * warmShadow, col * coolHighlight, smoothstep(0.0, 0.85, lum));

      // Contrast around 0.5
      graded = (graded - 0.5) * contrast + 0.5;

      // Saturation
      float gray = dot(graded, vec3(0.2126, 0.7152, 0.0722));
      graded = mix(vec3(gray), graded, saturation);

      // Vignette
      vec2 uv = vUv - 0.5;
      float dist = length(uv) * 1.4142;
      float vignette = smoothstep(vignetteSoft, vignetteSoft + 0.55, dist);
      graded *= 1.0 - vignette * vignetteAmount * 0.45;

      // Subtle film grain
      float grain = (rand(vUv + fract(time)) - 0.5) * grainAmount;
      graded += grain;

      gl_FragColor = vec4(graded, tex.a);
    }
  `,
};

export function createPostProcessing(renderer, scene, camera) {
  // Multisampled render target so the composer keeps MSAA edges (WebGL2),
  // instead of discarding the renderer's antialiasing.
  const dpr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(
    Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr),
    { type: THREE.HalfFloatType, samples: 4 }
  );
  const composer = new EffectComposer(renderer, rt);
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.28,    // strength — gentle, so the sun stays a disc
    0.4,     // radius
    0.94     // threshold — only the sun itself blooms, not the warm sky
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(CinematicGradeShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  // Animate time uniform for grain
  const clock = new THREE.Clock();
  const originalRender = composer.render.bind(composer);
  composer.render = function () {
    grade.material.uniforms.time.value = clock.getElapsedTime();
    originalRender();
  };

  return composer;
}
