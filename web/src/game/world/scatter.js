// Instanced ground detail — the cheap richness pass. Tufts of grass that sway in
// a breeze across the campiña, and scattered barrels/crates along the quays. Each
// kind is ONE InstancedMesh (one draw call for hundreds of pieces). Grass sways
// via a tiny vertex tweak (onBeforeCompile) driven by a uTime uniform updated in
// onBeforeRender — no per-frame matrix work, no wiring through main.
//
// Positions are given in the island group's LOCAL space (same frame the merged
// geometry is built in), so the InstancedMesh rides with the world group.

import {
  InstancedMesh, Matrix4, Vector3, Euler, Quaternion,
  PlaneGeometry, CylinderGeometry, BoxGeometry, MeshStandardMaterial, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new Matrix4(), _p = new Vector3(), _q = new Quaternion(), _e = new Euler(), _s = new Vector3();

// a tuft = a few thin upright blades, crossed
function tuftGeometry() {
  const blade = new PlaneGeometry(0.28, 0.8, 1, 2);
  blade.translate(0, 0.4, 0); // base at y=0, tip at y=0.8
  const a = blade.clone();
  const c = blade.clone(); c.rotateY(Math.PI / 3);
  const d = blade.clone(); d.rotateY(-Math.PI / 3);
  return mergeGeometries([a, c, d]);
}

function grassMaterial(color) {
  const m = new MeshStandardMaterial({ color, side: DoubleSide, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float bladeH = position.y;
       transformed.x += sin(uTime * 1.8 + transformed.z * 0.6 + transformed.x * 0.4) * bladeH * 0.16;
       transformed.z += cos(uTime * 1.5 + transformed.x * 0.5) * bladeH * 0.08;`,
    );
    m.userData.shader = shader;
  };
  return m;
}

function instanced(geo, mat, placements) {
  const mesh = new InstancedMesh(geo, mat, placements.length);
  mesh.castShadow = true; mesh.receiveShadow = true;
  placements.forEach((pl, i) => {
    _p.set(pl.x, pl.y, pl.z);
    _e.set(0, pl.ry || 0, 0); _q.setFromEuler(_e);
    const sc = pl.s || 1;
    _s.set(sc, sc * (pl.sy || 1), sc);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// add a swaying grass field. `placements` = [{x,y,z,ry,s,sy}] in group-local space
export function addGrass(group, placements, color = 0x6f8a3c) {
  if (!placements.length) return null;
  const mat = grassMaterial(color);
  const mesh = instanced(tuftGeometry(), mat, placements);
  mesh.onBeforeRender = () => { const sh = mat.userData.shader; if (sh) sh.uniforms.uTime.value = performance.now() * 0.001; };
  group.add(mesh);
  return mesh;
}

// add scattered barrels (instanced). `placements` in group-local space
export function addBarrels(group, placements, color = 0x6f4a28) {
  if (!placements.length) return null;
  const geo = new CylinderGeometry(0.42, 0.46, 1.1, 8);
  const mat = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const mesh = instanced(geo, mat, placements);
  group.add(mesh);
  return mesh;
}

// add scattered crates (instanced)
export function addCrates(group, placements, color = 0x7a5a34) {
  if (!placements.length) return null;
  const geo = new BoxGeometry(1.1, 1.0, 1.1);
  const mat = new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 });
  const mesh = instanced(geo, mat, placements);
  group.add(mesh);
  return mesh;
}
