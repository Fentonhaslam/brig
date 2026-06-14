import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

// Reflective Atlantic ocean (three.js Water): planar reflections + animated
// normal-map ripples. It stays put in world space (it does NOT scroll with the
// ship) — the sense of sailing comes from the islands sliding past and the bow
// wake, while the ship rides a gentle local swell via buoyancy.
export function createWater(scene, sunDirection) {
  const waterGeo = new THREE.PlaneGeometry(20000, 20000, 1, 1);

  const water = new Water(waterGeo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('/waternormals.jpg', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }),
    sunDirection: sunDirection.clone().normalize(),
    sunColor: 0xffd190,
    waterColor: 0x0c2530,
    distortionScale: 4.0,
    fog: scene.fog !== undefined,
    alpha: 1.0,
  });

  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  // (t) — advance the ripple animation. Extra args are ignored.
  water.userData.update = (t) => { water.material.uniforms['time'].value = t; };
  return water;
}
