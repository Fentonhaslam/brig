// The open environment beyond Sevilla: the island of La Española (Hispaniola)
// with the settlement and dock of Santo Domingo, and a distant mainland on
// the far horizon. These live inside a "world group" that the helm slides past
// the ship, so you can sail toward them and drop anchor to make harbour.

import * as THREE from 'three';

const MAT = {
  land:    new THREE.MeshStandardMaterial({ color: 0x4a5a30, roughness: 1.0 }),
  sand:    new THREE.MeshStandardMaterial({ color: 0xcdb585, roughness: 1.0 }),
  hill:    new THREE.MeshStandardMaterial({ color: 0x3a4a26, roughness: 1.0 }),
  rock:    new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 1.0 }),
  wallW:   new THREE.MeshStandardMaterial({ color: 0xd8cdb0, roughness: 0.95 }),
  roof:    new THREE.MeshStandardMaterial({ color: 0x8a4a2e, roughness: 0.9 }),
  fort:    new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.98 }),
  wood:    new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.95 }),
  palmTrunk: new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 1.0 }),
  palmLeaf:  new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 1.0 }),
  cross:   new THREE.MeshStandardMaterial({ color: 0xeae0c8, roughness: 0.9 }),
  mainland: new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 1.0 }),
  skin:    new THREE.MeshStandardMaterial({ color: 0xa9763f, roughness: 0.9 }),
};

function building(grp, x, z, w, d, h, rot = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.wallW);
  b.position.set(x, h / 2, z); b.rotation.y = rot; b.castShadow = true; b.receiveShadow = true;
  grp.add(b);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.5, 4), MAT.roof);
  roof.position.set(x, h + h * 0.24, z); roof.rotation.y = rot + Math.PI / 4;
  grp.add(roof);
}

function palm(grp, x, z) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 9, 6), MAT.palmTrunk);
  t.position.set(x, 4.5, z); t.rotation.z = 0.12; grp.add(t);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.0, 4.5, 4), MAT.palmLeaf);
    leaf.position.set(x + Math.cos(a) * 1.6, 8.6, z + Math.sin(a) * 1.6);
    leaf.rotation.z = Math.cos(a) * 0.9; leaf.rotation.x = Math.sin(a) * 0.9;
    grp.add(leaf);
  }
}

function dockFolk(grp, x, z) {
  const hue = [0x7a4a2a, 0x553a44, 0x6a6048, 0x814038, 0x4a5040][Math.abs((x * 7 + z * 3) | 0) % 5];
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.0, 4, 7),
    new THREE.MeshStandardMaterial({ color: hue, roughness: 0.9 }));
  body.position.set(x, 1.0, z); body.castShadow = true; grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), MAT.skin);
  head.position.set(x, 1.95, z); grp.add(head);
}

export function createIslands() {
  const grp = new THREE.Group();
  grp.name = 'OpenWorld';

  // ---- La Española / Santo Domingo — ahead and to port ----
  const hisp = new THREE.Group();
  hisp.position.set(-110, 0, 380);
  grp.add(hisp);

  // landmass: a broad low island with a sandy fringe
  const land = new THREE.Mesh(new THREE.CylinderGeometry(150, 175, 14, 40), MAT.land);
  land.position.y = 1; land.receiveShadow = true; hisp.add(land);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(168, 182, 4, 40), MAT.sand);
  beach.position.y = -3; hisp.add(beach);
  // green hills inland
  for (const [hx, hz, r, h] of [[-40, 60, 55, 40], [50, 40, 45, 32], [10, 90, 60, 50], [-70, 10, 40, 26]]) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), MAT.hill);
    hill.position.set(hx, 6 + h / 2, hz); hill.castShadow = true; hisp.add(hill);
  }

  // settlement of Santo Domingo near the shore (facing the water, -z side)
  const town = new THREE.Group();
  town.position.set(0, 8, -120);
  hisp.add(town);
  // fort with corner bastions
  const fort = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 22), MAT.fort);
  fort.position.set(-34, 6, -8); fort.castShadow = true; town.add(fort);
  for (const [bx, bz] of [[-46, -18], [-22, -18], [-46, 2], [-22, 2]]) {
    const bast = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 14, 8), MAT.fort);
    bast.position.set(bx, 7, bz); town.add(bast);
  }
  // church with bell tower + cross
  building(town, 18, -6, 12, 20, 12);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 22, 7), MAT.wallW);
  tower.position.set(24, 11, -12); tower.castShadow = true; town.add(tower);
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 0.6), MAT.cross);
  cv.position.set(24, 24, -12); town.add(cv);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.6), MAT.cross);
  ch.position.set(24, 23.4, -12); town.add(ch);
  // a scatter of houses
  const houses = [[-8, 4], [0, 6], [8, 8], [-14, 14], [2, 16], [12, 18], [-4, 24], [16, 26], [-18, 28]];
  let hi = 0;
  for (const [hx, hz] of houses) {
    const s = 5 + (hi % 3) * 1.6;
    building(town, hx, hz, s, s * 0.9, 5 + (hi % 2) * 2, (hi * 0.7) % Math.PI);
    hi++;
  }
  // ---- the Keep — seat of the world's Chronicle, on a rise beside the town ----
  const keep = new THREE.Group();
  keep.position.set(54, 8, -78);
  hisp.add(keep);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 16), MAT.fort);
  hall.position.y = 7; hall.castShadow = true; hall.receiveShadow = true; keep.add(hall);
  const keepTower = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 26, 10), MAT.fort);
  keepTower.position.set(-8, 13, -6); keepTower.castShadow = true; keep.add(keepTower);
  // crenellations
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 1.4), MAT.fort);
    m.position.set(-8 + Math.cos(a) * 5, 27, -6 + Math.sin(a) * 5); keep.add(m);
  }
  // great doorway facing the water (-z)
  const door = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 1), MAT.wood);
  door.position.set(0, 3.5, -8.4); keep.add(door);
  // Cross of Burgundy banner over the door
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3, 5),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, side: THREE.DoubleSide }));
  banner.position.set(0, 9.5, -8.5); keep.add(banner);

  // Court of Chronicles — the ground before the keep where memory-stones stand.
  // Monuments are added here; rotated so their inscriptions face the approach.
  const court = new THREE.Group();
  court.position.set(54, 8.5, -104);
  court.rotation.y = Math.PI;
  hisp.add(court);
  grp.userData.court = court;

  // palms along the shore
  for (let i = 0; i < 14; i++) palm(hisp, -90 + i * 13, -130 - (i % 3) * 6);

  // the dock — a timber pier reaching out into the water toward the ship
  const dock = new THREE.Group();
  dock.position.set(-6, 0, -150);
  hisp.add(dock);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 60), MAT.wood);
  pier.position.set(0, 1.6, -28); pier.castShadow = true; dock.add(pier);
  for (let i = 0; i < 10; i++) {
    for (const px of [-3, 3]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 6, 6), MAT.wood);
      pile.position.set(px, -0.5, -2 - i * 6); dock.add(pile);
    }
  }
  // crates and barrels on the quay
  for (const [cx, cz] of [[-2, -4], [2, -6], [-2.5, -10], [2.5, -2]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), MAT.wood);
    crate.position.set(cx, 2.7, cz); dock.add(crate);
  }
  // dockside crowd — settlers, porters, soldiers awaiting the fleet
  for (const [fx, fz] of [[-2, -4], [2, -8], [-1.5, -14], [1.8, -20], [0, -26],
                          [-9, -52], [9, -52], [-3, -56], [4, -58], [-6, -60], [7, -62], [0, -64]]) {
    dockFolk(dock, fx, fz);
  }

  // ---- Distant mainland (Tierra Firme) on the far horizon ----
  const main = new THREE.Group();
  main.position.set(420, 0, 1050);
  grp.add(main);
  for (let i = 0; i < 9; i++) {
    const r = 120 + (i % 3) * 60;
    const h = 120 + Math.sin(i * 1.7) * 60;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), MAT.mainland);
    m.position.set(-700 + i * 180, h / 2 - 10, Math.sin(i) * 120);
    main.add(m);
  }

  // dock head position (in world-group coordinates) used for docking checks
  grp.userData.dock = new THREE.Vector3(-110 - 6, 0, 380 - 150 - 56);
  return grp;
}
