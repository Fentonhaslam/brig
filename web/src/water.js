import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

// Atlantic ocean — wide plane with classic Three.js water shader.
// Reflects the sky, accepts a sun direction for the specular highlight.
export function createWater(scene, sunDirection) {
  const waterGeo = new THREE.PlaneGeometry(20000, 20000, 256, 256);

  const normalsURL = '/waternormals.jpg'; // vendored — no external dependency

  const water = new Water(waterGeo, {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: new THREE.TextureLoader().load(normalsURL, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }),
    sunDirection: sunDirection.clone().normalize(),
    sunColor: 0xffd190,
    waterColor: 0x0c2530,       // deep teal — Atlantic at sunset
    distortionScale: 4.5,
    fog: scene.fog !== undefined,
    alpha: 1.0,
  });

  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);
  return water;
}
