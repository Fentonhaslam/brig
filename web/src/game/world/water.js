// Stylized ocean — ONE draw call, ONE pass, NO render-target reflections.
//
// This is the deliberate answer to "the water looks like an engine but isn't
// thought through". Instead of a generic planar mirror we art-direct it:
//   * a few summed sine waves wobble the surface (cheap vertex displacement)
//   * an analytic normal from those waves drives a fresnel sky-tint at glancing
//     angles and a Blinn sun glint
//   * depth-ish colour mix from deep teal to a brighter shallow tone
//   * a faint moving sparkle band so it reads as alive, not plastic
//
// It costs a fraction of the WaterMaterial RTT approach and looks intentional.

import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';

const vert = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vH;

  // wave: dir.xy, frequency, speed, amplitude packed as we go
  float waveH(vec2 p, vec2 dir, float freq, float speed, float amp, out vec2 grad) {
    float phase = dot(dir, p) * freq + uTime * speed;
    grad = dir * (freq * amp * cos(phase));
    return amp * sin(phase);
  }

  void main() {
    vec3 pos = position;
    // world XZ for stable waves regardless of the mesh's own origin
    vec4 wp0 = modelMatrix * vec4(position, 1.0);
    vec2 p = wp0.xz;

    vec2 g, gsum = vec2(0.0);
    float h = 0.0;
    h += waveH(p, normalize(vec2( 1.0, 0.3)), 0.060, 1.1, 0.42, g); gsum += g;
    h += waveH(p, normalize(vec2(-0.6, 1.0)), 0.110, 1.6, 0.22, g); gsum += g;
    h += waveH(p, normalize(vec2( 0.8,-0.5)), 0.230, 2.3, 0.09, g); gsum += g;

    pos.y += h;
    vH = h;
    vNormal = normalize(vec3(-gsum.x, 1.0, -gsum.y));

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec2 uHull;   // hull half-extents (beam/2, length/2); ship is at origin facing +z
  uniform float uSpeed; // 0..1 sail speed, for the wake
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vH;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 toCam = cameraPosition - vWorldPos;
    vec3 V = normalize(toCam);

    // depth tone driven by WAVE HEIGHT: troughs sit deep, crests lift a touch
    // lighter. (Driving it off the normal made almost the whole flat surface
    // read as the bright "shallow" tone — the hard green slab.)
    float lift = smoothstep(-0.35, 0.5, vH);
    vec3 base = mix(uDeep, uShallow, lift);

    // fresnel: glancing angles pick up the sky colour, softly banded for cel
    float fres = pow(1.0 - max(dot(V, N), 0.0), 4.0);
    fres = floor(fres * 4.0) / 4.0;
    vec3 col = mix(base, uSky, fres * 0.5);

    // toon whitecap foam only on the very tops of the larger waves
    float foam = smoothstep(0.55, 0.72, vH);
    col = mix(col, vec3(0.92, 0.97, 1.0), foam * 0.85);

    // crisp toon sun glint (hard-edged, not a soft Blinn falloff)
    vec3 H = normalize(V + normalize(uSunDir));
    float spec = step(0.96, dot(N, H));
    col += uSunColor * spec * 0.6;

    // --- the sea breaking against the hull + the wake astern ---
    // (the ship is pinned at the origin facing +z, so this is all in world XZ)
    vec2 q = vWorldPos.xz;
    vec3 FOAM = vec3(0.96, 0.99, 1.0);

    // foam collar: a churned band hugging the hull at the waterline. e=1 is the
    // hull edge of the beam/length ellipse; the band sits just outside it and
    // surges with a little noise (livelier at the bow and with speed).
    float e = length(q / uHull);
    float collar = smoothstep(0.96, 1.08, e) * smoothstep(1.7, 1.08, e);
    float surge = 0.55 + 0.45 * noise(q * 0.5 + uTime * 1.3);
    float bowBias = 1.0 + 0.7 * smoothstep(0.0, 1.0, q.y / uHull.y) * uSpeed; // more spray forward when moving
    col = mix(col, FOAM, clamp(collar * surge * bowBias * 0.9, 0.0, 1.0));

    // wake: a widening, churned V trailing astern (z < 0), scrolling back and
    // fading with distance; only when under way.
    float bz = -q.y;                       // distance behind the stern
    if (uSpeed > 0.01 && bz > 0.0 && bz < 95.0) {
      float halfW = uHull.x + 0.9 + bz * 0.13;
      float across = abs(q.x) / halfW;     // 0 centre .. 1 the diverging edge
      float vlines = smoothstep(0.14, 0.0, abs(across - 1.0));        // the two bow-wave lines
      float churn = noise(vec2(q.x * 0.35, (q.y + uTime * 9.0) * 0.28));
      float core = smoothstep(1.05, 0.0, across) * (0.35 + 0.65 * churn); // turbulent centre
      float wake = (vlines + core) * smoothstep(95.0, 4.0, bz) * uSpeed;
      col = mix(col, FOAM, clamp(wake * 0.9, 0.0, 1.0));
    }

    // self-contained linear distance fog so the sea melts into the horizon
    // (handled here rather than via scene fog to keep the material independent
    // of three's fog-uniform injection).
    float dist = length(toCam);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    col = mix(col, uFogColor, fog);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createWater(scene, size = 6000) {
  const mat = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color(0x12707e) },
      uShallow: { value: new Color(0x49cbc2) },
      uSky: { value: new Color(0xbfeaf2) },
      uSunDir: { value: new Vector3(0.4, 0.5, -0.8).normalize() },
      uSunColor: { value: new Color(0xffe6b0) },
      uFogColor: { value: new Color(0xf3c79a) },
      uFogNear: { value: 220 },
      uFogFar: { value: 1400 },
      uHull: { value: new Vector2(4, 14) }, // ship beam/2, length/2 (set by main)
      uSpeed: { value: 0 },
    },
    transparent: false,
  });
  // Moderate tessellation: enough for the wobble to read near the camera,
  // cheap enough to stay one fast draw call. (180k tris at most.)
  const geo = new PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function update(t, sunDir, sky, speed) {
    mat.uniforms.uTime.value = t;
    if (sunDir) mat.uniforms.uSunDir.value.copy(sunDir);
    if (sky) mat.uniforms.uSky.value.set(sky);
    if (speed != null) mat.uniforms.uSpeed.value = speed;
  }
  function setShip(beam, length) { mat.uniforms.uHull.value.set(beam / 2, length / 2); }

  return { mesh, material: mat, update, setShip };
}
