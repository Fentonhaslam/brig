// Heightfield terrain — the move from flat coloured boxes to believable land.
//
// One subdivided plane displaced by a height function and shaded with VERTEX
// COLOURS (sand at the waterline, grass on the rolling interior, bare rock and
// snow up the peaks), so a whole continent — sloping beach, rolling hills, a
// real sierra, even a carved river valley — is a SINGLE mesh / one draw call,
// staying true to the merged-geometry, browser-light approach. The same height
// function is returned as heightAt(x,z) so trees, rocks and buildings can be
// seated on the surface instead of floating above a flat slab.

import {
  PlaneGeometry, Mesh, MeshStandardMaterial, Color, Float32BufferAttribute, DoubleSide,
} from 'three';

// cheap deterministic value-noise (layered sin/cos) → roughly [-1, 1]
export function fbm(x, z) {
  return (
    Math.sin(x * 0.012) * Math.cos(z * 0.010) * 1.0 +
    Math.sin(x * 0.028 + 1.7) * Math.cos(z * 0.024 - 0.6) * 0.5 +
    Math.sin(x * 0.062 - 0.3) * Math.cos(z * 0.055 + 2.1) * 0.25
  ) / 1.75;
}

// smoothstep 0..1
export function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

// distance from point (px,pz) to the polyline `pts` ([[x,z],...]) — for carving
// a river valley into the terrain along its course
export function distToPath(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((px - ax) * dx + (pz - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t, cz = az + dz * t;
    const d = Math.hypot(px - cx, pz - cz);
    if (d < best) best = d;
  }
  return best;
}

// Build a heightfield terrain.
//   width/depth   — extent in x / z (local space)
//   segX/segZ     — grid resolution (verts-1)
//   center {x,z}  — where the patch sits
//   height(x,z)   — surface height (y)
//   colorAt(x,z,y)-> hex colour for that vertex
// returns { mesh, heightAt }
export function buildTerrain({ width, depth, segX, segZ, center = { x: 0, z: 0 }, height, colorAt }) {
  const geo = new PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);              // lie flat: plane x→x, plane y→z
  geo.translate(center.x, 0, center.z);   // positions are now absolute local coords
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const _c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = height(x, z);
    pos.setY(i, y);
    _c.set(colorAt(x, z, y));
    colors[i * 3] = _c.r; colors[i * 3 + 1] = _c.g; colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // DoubleSide: when a caller mirrors the mesh (scale.z = -1, as the z-flipped
  // harbours do) the winding inverts, so we must not back-face cull it
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: DoubleSide });
  mat.envMapIntensity = 0.4;
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, heightAt: height };
}
