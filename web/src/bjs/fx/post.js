// Cinematic post-processing for the Babylon build — port of web/src/post.js.
//
// The Three.js original ran an EffectComposer chain: RenderPass -> UnrealBloom
// (gentle, sun-only) -> a custom "CinematicGrade" shader (warm split-tone,
// contrast, saturation, vignette, subtle film grain) -> OutputPass (ACES tone
// map + sRGB). Babylon's DefaultRenderingPipeline gives us MSAA, bloom and
// ACES tone mapping out of the box; we add a small post-process for the warm
// split-tone grade + animated grain that Babylon's image processing can't do.
//
// EXPORT: createPost(scene, camera) -> DefaultRenderingPipeline

import {
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  Color3,
  PostProcess,
  Effect,
} from '@babylonjs/core';

// --- warm cinematic grade + grain (mirrors CinematicGradeShader in post.js) ---
const GRADE_NAME = 'brigCinematicGrade';

Effect.ShadersStore[`${GRADE_NAME}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;

  uniform float vignetteAmount;
  uniform float vignetteSoft;
  uniform vec3  warmShadow;
  uniform vec3  coolHighlight;
  uniform float saturation;
  uniform float contrast;
  uniform float grainAmount;
  uniform float time;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec4 tex = texture2D(textureSampler, vUV);
    vec3 col = tex.rgb;

    // Luminance-based split-tone: warm shadows, warm highlights.
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 graded = mix(col * warmShadow, col * coolHighlight, smoothstep(0.0, 0.85, lum));

    // Contrast around 0.5.
    graded = (graded - 0.5) * contrast + 0.5;

    // Saturation.
    float gray = dot(graded, vec3(0.2126, 0.7152, 0.0722));
    graded = mix(vec3(gray), graded, saturation);

    // Vignette.
    vec2 uv = vUV - 0.5;
    float dist = length(uv) * 1.4142;
    float vignette = smoothstep(vignetteSoft, vignetteSoft + 0.55, dist);
    graded *= 1.0 - vignette * vignetteAmount * 0.45;

    // Subtle animated film grain.
    float grain = (rand(vUV + fract(time)) - 0.5) * grainAmount;
    graded += grain;

    gl_FragColor = vec4(graded, tex.a);
  }
`;

export function createPost(scene, camera) {
  const pipeline = new DefaultRenderingPipeline(
    'brigPipeline',
    true,          // HDR — needed for tone mapping + bloom headroom
    scene,
    [camera],
  );

  // --- Anti-aliasing: FXAA only. MSAA ×4 on the HDR float target was the
  // single most expensive thing in the pipeline; FXAA is a cheap full-screen
  // pass that keeps edges clean at a fraction of the cost.
  pipeline.samples = 1;
  pipeline.fxaaEnabled = true;

  // --- Bloom: gentle, so the sun stays a disc and the warm sky doesn't blow out.
  // Three: UnrealBloom(strength 0.28, radius 0.4, threshold 0.94).
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.92;   // only the brightest (the sun) blooms
  pipeline.bloomWeight = 0.28;      // gentle strength
  pipeline.bloomKernel = 64;        // soft, wide-ish radius
  pipeline.bloomScale = 0.5;

  // --- Image processing: ACES tone mapping + warm contrast grade ---
  pipeline.imageProcessingEnabled = true;
  const ip = pipeline.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.05;        // a touch of lift for golden-hour warmth
  ip.contrast = 1.08;        // matches the grade shader's contrast

  // Built-in vignette as a warm base; the custom pass layers a softer falloff.
  ip.vignetteEnabled = true;
  ip.vignetteWeight = 1.6;
  ip.vignetteStretch = 0.0;
  ip.vignetteColor = new Color3(0.18, 0.10, 0.05).toColor4(1); // warm dark corners

  // --- Custom warm split-tone + grain pass (the bits image processing can't do) ---
  const warmShadow = new Color3(1.0, 0.722, 0.471);    // 0xffb878
  const coolHighlight = new Color3(1.0, 0.898, 0.690); // 0xffe5b0

  const grade = new PostProcess(
    GRADE_NAME,
    GRADE_NAME,
    ['vignetteAmount', 'vignetteSoft', 'warmShadow', 'coolHighlight', 'saturation', 'contrast', 'grainAmount', 'time'],
    null,
    1.0,
    camera,
  );

  let elapsed = 0;
  grade.onApplyObservable.add((effect) => {
    elapsed += scene.getEngine().getDeltaTime() / 1000;
    effect.setFloat('vignetteAmount', 1.15);
    effect.setFloat('vignetteSoft', 0.45);
    effect.setColor3('warmShadow', warmShadow);
    effect.setColor3('coolHighlight', coolHighlight);
    effect.setFloat('saturation', 1.06);
    effect.setFloat('contrast', 1.08);
    effect.setFloat('grainAmount', 0.035);
    effect.setFloat('time', elapsed);
  });

  // Expose the grade pass so callers can tweak/dispose it with the pipeline.
  pipeline.cinematicGrade = grade;
  const originalDispose = pipeline.dispose.bind(pipeline);
  pipeline.dispose = function () {
    grade.dispose(camera);
    originalDispose();
  };

  return pipeline;
}
