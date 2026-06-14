// Gradient skydome — a single inverted sphere with a vertex-driven gradient and
// a soft sun glow. No procedural atmospheric scattering, no cubemap: one cheap
// draw call that day/night can recolour by swapping three uniforms.

import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  precision mediump float;
  varying vec3 vDir;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.8));
    // sun disc + warm halo
    float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunColor * pow(d, 220.0) * 1.4;          // crisp disc
    col += uSunColor * pow(d, 8.0) * 0.18;           // soft halo
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky(scene) {
  const mat = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new Color(0xf6c79a) },
      uZenith: { value: new Color(0x2c5d8f) },
      uSunDir: { value: new Vector3(0.4, 0.5, -0.8).normalize() },
      uSunColor: { value: new Color(0xffe6b0) },
    },
  });
  const mesh = new Mesh(new SphereGeometry(4000, 24, 16), mat);
  mesh.renderOrder = -1;
  scene.add(mesh);

  function setSun(dir, sunColor, horizon, zenith) {
    mat.uniforms.uSunDir.value.copy(dir);
    if (sunColor) mat.uniforms.uSunColor.value.set(sunColor);
    if (horizon) mat.uniforms.uHorizon.value.set(horizon);
    if (zenith) mat.uniforms.uZenith.value.set(zenith);
  }

  return { mesh, material: mat, setSun };
}
