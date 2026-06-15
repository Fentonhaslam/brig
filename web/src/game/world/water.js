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

import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';

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
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vH;

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
    },
  });
  // Moderate tessellation: enough for the wobble to read near the camera,
  // cheap enough to stay one fast draw call. (180k tris at most.)
  const geo = new PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function update(t, sunDir, sky) {
    mat.uniforms.uTime.value = t;
    if (sunDir) mat.uniforms.uSunDir.value.copy(sunDir);
    if (sky) mat.uniforms.uSky.value.set(sky);
  }

  return { mesh, material: mat, update };
}
