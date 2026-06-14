// Cel-shading toolkit — the heart of the Wind Waker look.
//
//   * a shared toon ramp (banded lighting instead of smooth shading)
//   * toonMaterial(color)  -> MeshToonMaterial using that ramp
//   * withOutline(mesh)    -> adds a cheap inverted-hull ink outline
//
// All cheap: toon shading is one extra texture lookup; outlines are one extra
// back-face pass per hero object. No post-processing, no render targets.

import {
  DataTexture, RedFormat, NearestFilter,
  MeshToonMaterial, Mesh, BackSide, ShaderMaterial, Color,
} from 'three';

// --- the toon ramp: 4 hard steps from shadow to light ---
let _ramp = null;
export function toonRamp() {
  if (_ramp) return _ramp;
  // Four graded bands — a more painterly, grounded cel look (Fable rather than
  // hard-cartoon Wind Waker): still stepped, but with form-revealing midtones
  // so the detail reads as "serious" stylised, not flat toy.
  const steps = new Uint8Array([110, 158, 205, 255]);
  _ramp = new DataTexture(steps, steps.length, 1, RedFormat);
  _ramp.minFilter = NearestFilter;
  _ramp.magFilter = NearestFilter;
  _ramp.generateMipmaps = false;
  _ramp.needsUpdate = true;
  return _ramp;
}

export function toonMaterial(color, opts = {}) {
  return new MeshToonMaterial({
    color: new Color(color),
    gradientMap: toonRamp(),
    ...opts,
  });
}

// --- ink outline via inverted hull -----------------------------------------
// A back-facing shell pushed out along the vertex normals by a constant
// world-space amount, drawn solid dark. Reads as a hand-inked outline and
// costs one extra draw call. Constant offset (not scale) keeps the line an
// even thickness regardless of the object's size.
const outlineVert = /* glsl */ `
  uniform float uThickness;
  void main() {
    vec3 p = position + normalize(normal) * uThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const outlineFrag = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }
`;

export function outlineMaterial(thickness = 0.06, color = 0x150d07) {
  return new ShaderMaterial({
    vertexShader: outlineVert,
    fragmentShader: outlineFrag,
    side: BackSide,
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new Color(color) },
    },
  });
}

// Add an ink outline to a mesh by attaching an inverted-hull shell as a child
// (shares the same geometry, follows every transform for free).
export function withOutline(mesh, thickness = 0.06, color = 0x150d07) {
  const shell = new Mesh(mesh.geometry, outlineMaterial(thickness, color));
  shell.frustumCulled = mesh.frustumCulled;
  mesh.add(shell);
  return mesh;
}
