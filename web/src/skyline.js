// Sevilla skyline silhouette in the deep background.
// Geometric primitives composing recognizable landmarks: Torre del Oro,
// Sevilla Cathedral + Giralda, city walls, scattered rooftops.

import * as THREE from 'three';

const SILHOUETTE_MAT = new THREE.MeshBasicMaterial({
  color: 0x0a0608,
  fog: true,
});

// Skyline center — far behind the ship, slightly offset along camera bearing
const SKYLINE_DISTANCE = 280;     // meters from origin
const SKYLINE_BEARING_DEG = 60;    // degrees yaw — where the city lies

function skylinePos(lateral, forward, height) {
  const bearing = THREE.MathUtils.degToRad(SKYLINE_BEARING_DEG);
  const fwd = [Math.cos(bearing), Math.sin(bearing)];
  const right = [Math.cos(bearing + Math.PI / 2), Math.sin(bearing + Math.PI / 2)];
  const x = SKYLINE_DISTANCE * fwd[0] + lateral * right[0] + forward * fwd[0];
  const z = SKYLINE_DISTANCE * fwd[1] + lateral * right[1] + forward * fwd[1];
  return [x, height / 2, z];
}

function box(lateral, forward, w, d, h, group) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), SILHOUETTE_MAT);
  const [x, y, z] = skylinePos(lateral, forward, h);
  m.position.set(x, y, z);
  m.rotation.y = THREE.MathUtils.degToRad(SKYLINE_BEARING_DEG + 90);
  group.add(m);
  return m;
}

function cylinder(lateral, forward, diameter, h, group) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(diameter / 2, diameter / 2, h, 16),
    SILHOUETTE_MAT
  );
  const [x, y, z] = skylinePos(lateral, forward, h);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

export function createSkyline(scene) {
  const grp = new THREE.Group();
  grp.name = 'SevillaSkyline';

  // City walls — long low masses
  box(-80, 4, 110, 6, 14, grp);   // west wall
  box(45, 4, 95, 6, 13, grp);     // east wall

  // Scattered rooftops in front of the walls
  box(-35, -6, 18, 8, 18, grp);
  box(-12, -7, 14, 7, 21, grp);
  box(22, -6, 16, 7, 19, grp);
  box(65, -5, 14, 7, 17, grp);
  box(-50, -5, 12, 6, 15, grp);
  box(8, -8, 10, 6, 16, grp);

  // Torre del Oro — dodecagonal riverside watchtower (~36m)
  cylinder(-65, -12, 15, 36, grp);
  cylinder(-65, -12, 9, 45, grp);  // crown

  // Sevilla Cathedral — massive nave + crossing tower
  box(2, -9, 42, 16, 48, grp);     // nave bulk
  box(6, -9, 12, 12, 62, grp);     // crossing

  // La Giralda — bell tower with belfry and crown
  box(19, -9.5, 13.5, 13.5, 82, grp);  // shaft
  box(19, -9.5, 9, 9, 100, grp);       // belfry
  box(19, -9.5, 5, 5, 104, grp);       // crown

  // A handful of low spires breaking up the skyline
  for (let i = 0; i < 6; i++) {
    const lat = -75 + i * 25;
    const h = 22 + Math.sin(i * 1.3) * 6;
    box(lat, -2, 4, 4, h, grp);
  }

  scene.add(grp);
  return grp;
}
