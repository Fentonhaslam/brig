import * as THREE from 'three';
import { WAVES } from './world/waves.js';

// GLSL height + gradient functions with the wave constants baked in, generated
// from the SAME table the CPU uses (waves.js) so the visible surface, the ship
// buoyancy, the swimmer and the wake all agree on where the sea is.
function waveGLSL() {
  let h = 'float brigWaveH(vec2 p){float y=0.0;';
  let dx = 'float brigDX(vec2 p){float d=0.0;';
  let dz = 'float brigDZ(vec2 p){float d=0.0;';
  for (const w of WAVES) {
    const dir = `vec2(${w.dx.toFixed(5)},${w.dz.toFixed(5)})`;
    const a = w.amp.toFixed(5), k = w.k.toFixed(6), om = w.w.toFixed(6);
    h += `y+=${a}*sin(dot(${dir},p)*${k}+uTime*${om});`;
    dx += `d+=${dir}.x*cos(dot(${dir},p)*${k}+uTime*${om})*${a}*${k};`;
    dz += `d+=${dir}.y*cos(dot(${dir},p)*${k}+uTime*${om})*${a}*${k};`;
  }
  return `${h}return y;}\n${dx}return d;}\n${dz}return d;}`;
}

// Ocean — a wave-displaced MeshStandardMaterial. Keeps three.js lighting, fog,
// shadows and IBL reflections; gains real geometric swell + a detail normal map.
export function createWater(scene, sunDirection) {
  const geo = new THREE.PlaneGeometry(20000, 20000, 200, 200);
  geo.rotateX(-Math.PI / 2);   // lie in the XZ plane (object space == world XZ)

  const normals = new THREE.TextureLoader().load('/waternormals.jpg', (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(180, 180);
  });

  const mat = new THREE.MeshStandardMaterial({
    color: 0x12303a, roughness: 0.22, metalness: 0.0,
    normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35),
  });

  const uTime = { value: 0 };
  const uOcean = { value: new THREE.Vector2() };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uOcean = uOcean;
    shader.vertexShader =
      `uniform float uTime; uniform vec2 uOcean;\n${waveGLSL()}\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\n vec2 wpn=position.xz+uOcean; objectNormal=normalize(vec3(-brigDX(wpn),1.0,-brigDZ(wpn)));'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n transformed.y += brigWaveH(position.xz+uOcean);'
    );
  };

  const water = new THREE.Mesh(geo, mat);
  water.position.y = 0;
  scene.add(water);

  // (t, oceanX, oceanZ) — oceanXZ scrolls the swell under the fixed ship
  water.userData.update = (t, ox = 0, oz = 0) => {
    uTime.value = t;
    uOcean.value.set(ox, oz);
  };
  return water;
}
