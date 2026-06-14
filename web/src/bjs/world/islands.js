// The open environment beyond Sevilla: the island of La Española (Hispaniola)
// with the settlement and dock of Santo Domingo, and a distant mainland on
// the far horizon. Babylon.js port of web/src/islands.js.
//
// These live inside a "world" TransformNode (root) that the helm slides past
// the ship, so you can sail toward them and drop anchor to make harbour.
//
// Babylon is LEFT-HANDED. We keep the same numeric coordinates as the Three.js
// original; the world transform handled in main.js positions the whole group
// relative to the ship. Cones in Babylon point +Y (cap up) like Three's, so the
// hill/roof/mainland geometry maps directly.

import {
  Vector3, Color3, MeshBuilder, StandardMaterial, PBRMaterial, TransformNode,
} from '@babylonjs/core';

// --- shared materials -------------------------------------------------------
// PBR for the big cinematic surfaces (land/sand/fort/buildings), Standard for
// the cheap decorative scatter (foliage, banners, NPCs).
function makeMaterials(scene) {
  const pbr = (name, rgb, rough) => {
    const m = new PBRMaterial(name, scene);
    m.albedoColor = Color3.FromHexString(rgb);
    m.metallic = 0.0;
    m.roughness = rough;
    return m;
  };
  const std = (name, rgb, rough) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(rgb);
    m.specularColor = new Color3(0.02, 0.02, 0.02);
    m.roughness = rough;
    return m;
  };
  return {
    land:      pbr('isl_land', '#4a5a30', 1.0),
    sand:      pbr('isl_sand', '#cdb585', 1.0),
    hill:      pbr('isl_hill', '#3a4a26', 1.0),
    rock:      pbr('isl_rock', '#5a5048', 1.0),
    wallW:     pbr('isl_wallW', '#d8cdb0', 0.95),
    roof:      pbr('isl_roof', '#8a4a2e', 0.9),
    fort:      pbr('isl_fort', '#b8a888', 0.98),
    wood:      pbr('isl_wood', '#5a3a1e', 0.95),
    palmTrunk: std('isl_palmTrunk', '#6a4a28', 1.0),
    palmLeaf:  std('isl_palmLeaf', '#3a6a2a', 1.0),
    cross:     pbr('isl_cross', '#eae0c8', 0.9),
    mainland:  pbr('isl_mainland', '#2a3340', 1.0),
    skin:      std('isl_skin', '#a9763f', 0.9),
  };
}

export function createIslands(scene) {
  const MAT = makeMaterials(scene);
  const root = new TransformNode('OpenWorld', scene);

  const walkable = [];
  const solid = [];

  // local helpers (capture scene + MAT) --------------------------------------

  // a townhouse: a walled box with a low pyramidal (4-sided cone) roof.
  function building(parent, x, z, w, d, h, rot = 0) {
    const b = MeshBuilder.CreateBox('house', { width: w, height: h, depth: d }, scene);
    b.position.set(x, h / 2, z);
    b.rotation.y = rot;
    b.parent = parent;
    b.receiveShadows = true;
    b.metadata = { solid: true };
    solid.push(b);

    const roof = MeshBuilder.CreateCylinder('roof', {
      diameterTop: 0,
      diameterBottom: Math.max(w, d) * 0.75 * 2,
      height: h * 0.5,
      tessellation: 4,
    }, scene);
    roof.position.set(x, h + h * 0.24, z);
    roof.rotation.y = rot + Math.PI / 4;
    roof.material = MAT.roof;
    roof.parent = parent;
    b.material = MAT.wallW;
  }

  function palm(parent, x, z) {
    const t = MeshBuilder.CreateCylinder('palmTrunk', {
      diameterTop: 0.4 * 2, diameterBottom: 0.7 * 2, height: 9, tessellation: 6,
    }, scene);
    t.position.set(x, 4.5, z);
    t.rotation.z = 0.12;
    t.material = MAT.palmTrunk;
    t.parent = parent;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = MeshBuilder.CreateCylinder('palmLeaf', {
        diameterTop: 0, diameterBottom: 1.0 * 2, height: 4.5, tessellation: 4,
      }, scene);
      leaf.position.set(x + Math.cos(a) * 1.6, 8.6, z + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = Math.sin(a) * 0.9;
      leaf.material = MAT.palmLeaf;
      leaf.parent = parent;
    }
  }

  function dockFolk(parent, x, z) {
    const hues = ['#7a4a2a', '#553a44', '#6a6048', '#814038', '#4a5040'];
    const hue = hues[Math.abs((x * 7 + z * 3) | 0) % 5];
    const bodyMat = new StandardMaterial('folkBody', scene);
    bodyMat.diffuseColor = Color3.FromHexString(hue);
    bodyMat.specularColor = new Color3(0.02, 0.02, 0.02);

    const body = MeshBuilder.CreateCapsule('folk', { radius: 0.32, height: 1.0 + 0.32 * 2 }, scene);
    body.position.set(x, 1.0, z);
    body.material = bodyMat;
    body.parent = parent;

    const head = MeshBuilder.CreateSphere('folkHead', { diameter: 0.26 * 2, segments: 8 }, scene);
    head.position.set(x, 1.95, z);
    head.material = MAT.skin;
    head.parent = parent;
  }

  // ---- La Española / Santo Domingo — ahead and to port ----
  const hisp = new TransformNode('Hispaniola', scene);
  hisp.parent = root;
  hisp.position.set(-110, 0, 380);

  // landmass: a broad low island with a sandy fringe
  const land = MeshBuilder.CreateCylinder('land', {
    diameterTop: 150 * 2, diameterBottom: 175 * 2, height: 14, tessellation: 40,
  }, scene);
  land.position.y = 1;
  land.material = MAT.land;
  land.receiveShadows = true;
  land.parent = hisp;

  const beach = MeshBuilder.CreateCylinder('beach', {
    diameterTop: 168 * 2, diameterBottom: 182 * 2, height: 4, tessellation: 40,
  }, scene);
  beach.position.y = -3;
  beach.material = MAT.sand;
  beach.parent = hisp;

  // green hills inland
  for (const [hx, hz, r, h] of [[-40, 60, 55, 40], [50, 40, 45, 32], [10, 90, 60, 50], [-70, 10, 40, 26]]) {
    const hill = MeshBuilder.CreateCylinder('hill', {
      diameterTop: 0, diameterBottom: r * 2, height: h, tessellation: 12,
    }, scene);
    hill.position.set(hx, 6 + h / 2, hz);
    hill.material = MAT.hill;
    hill.parent = hisp;
  }

  // settlement of Santo Domingo near the shore (facing the water, -z side)
  const town = new TransformNode('SantoDomingo', scene);
  town.parent = hisp;
  town.position.set(0, 8, -120);

  // fort with corner bastions
  const fort = MeshBuilder.CreateBox('fort', { width: 26, height: 12, depth: 22 }, scene);
  fort.position.set(-34, 6, -8);
  fort.material = MAT.fort;
  fort.parent = town;
  fort.metadata = { solid: true };
  solid.push(fort);
  for (const [bx, bz] of [[-46, -18], [-22, -18], [-46, 2], [-22, 2]]) {
    const bast = MeshBuilder.CreateCylinder('bastion', {
      diameterTop: 4 * 2, diameterBottom: 4.5 * 2, height: 14, tessellation: 8,
    }, scene);
    bast.position.set(bx, 7, bz);
    bast.material = MAT.fort;
    bast.parent = town;
    bast.metadata = { solid: true };
    solid.push(bast);
  }

  // church with bell tower + cross
  building(town, 18, -6, 12, 20, 12);
  const tower = MeshBuilder.CreateBox('churchTower', { width: 7, height: 22, depth: 7 }, scene);
  tower.position.set(24, 11, -12);
  tower.material = MAT.wallW;
  tower.parent = town;
  tower.metadata = { solid: true };
  solid.push(tower);
  const cv = MeshBuilder.CreateBox('crossV', { width: 0.6, height: 3, depth: 0.6 }, scene);
  cv.position.set(24, 24, -12);
  cv.material = MAT.cross;
  cv.parent = town;
  const ch = MeshBuilder.CreateBox('crossH', { width: 1.8, height: 0.6, depth: 0.6 }, scene);
  ch.position.set(24, 23.4, -12);
  ch.material = MAT.cross;
  ch.parent = town;

  // a scatter of houses
  const houses = [[-8, 4], [0, 6], [8, 8], [-14, 14], [2, 16], [12, 18], [-4, 24], [16, 26], [-18, 28]];
  let hi = 0;
  for (const [hx, hz] of houses) {
    const s = 5 + (hi % 3) * 1.6;
    building(town, hx, hz, s, s * 0.9, 5 + (hi % 2) * 2, (hi * 0.7) % Math.PI);
    hi++;
  }

  // ---- the Keep — seat of the world's Chronicle, on a rise beside the town ----
  const keep = new TransformNode('Keep', scene);
  keep.parent = hisp;
  keep.position.set(54, 8, -78);

  const hall = MeshBuilder.CreateBox('keepHall', { width: 20, height: 14, depth: 16 }, scene);
  hall.position.y = 7;
  hall.material = MAT.fort;
  hall.receiveShadows = true;
  hall.parent = keep;
  hall.metadata = { solid: true };
  solid.push(hall);

  const keepTower = MeshBuilder.CreateCylinder('keepTower', {
    diameterTop: 5 * 2, diameterBottom: 5.5 * 2, height: 26, tessellation: 10,
  }, scene);
  keepTower.position.set(-8, 13, -6);
  keepTower.material = MAT.fort;
  keepTower.parent = keep;
  keepTower.metadata = { solid: true };
  solid.push(keepTower);

  // crenellations
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = MeshBuilder.CreateBox('crenel', { width: 1.4, height: 2, depth: 1.4 }, scene);
    m.position.set(-8 + Math.cos(a) * 5, 27, -6 + Math.sin(a) * 5);
    m.material = MAT.fort;
    m.parent = keep;
  }

  // great doorway facing the water (-z)
  const door = MeshBuilder.CreateBox('keepDoor', { width: 4, height: 7, depth: 1 }, scene);
  door.position.set(0, 3.5, -8.4);
  door.material = MAT.wood;
  door.parent = keep;

  // Cross of Burgundy banner over the door
  const bannerMat = new StandardMaterial('keepBanner', scene);
  bannerMat.diffuseColor = Color3.FromHexString('#e8dcc0');
  bannerMat.backFaceCulling = false; // double-sided
  bannerMat.specularColor = new Color3(0.02, 0.02, 0.02);
  const banner = MeshBuilder.CreatePlane('banner', { width: 3, height: 5, sideOrientation: 2 }, scene);
  banner.position.set(0, 9.5, -8.5);
  banner.material = bannerMat;
  banner.parent = keep;

  // Court of Chronicles — the ground before the keep where memory-stones stand.
  // Monuments are added here; rotated so their inscriptions face the approach.
  const court = new TransformNode('Court', scene);
  court.parent = hisp;
  court.position.set(54, 8.5, -104);
  court.rotation.y = Math.PI;

  // palms along the shore
  for (let i = 0; i < 14; i++) palm(hisp, -90 + i * 13, -130 - (i % 3) * 6);

  // the dock — a timber pier reaching out into the water toward the ship
  const dockGrp = new TransformNode('Dock', scene);
  dockGrp.parent = hisp;
  dockGrp.position.set(-6, 0, -150);

  const pier = MeshBuilder.CreateBox('pier', { width: 7, height: 1.2, depth: 60 }, scene);
  pier.position.set(0, 1.6, -28);
  pier.material = MAT.wood;
  pier.receiveShadows = true;
  pier.parent = dockGrp;
  pier.metadata = { walkable: true };
  walkable.push(pier);

  for (let i = 0; i < 10; i++) {
    for (const px of [-3, 3]) {
      const pile = MeshBuilder.CreateCylinder('pile', {
        diameter: 0.4 * 2, height: 6, tessellation: 6,
      }, scene);
      pile.position.set(px, -0.5, -2 - i * 6);
      pile.material = MAT.wood;
      pile.parent = dockGrp;
    }
  }

  // crates and barrels on the quay
  for (const [cx, cz] of [[-2, -4], [2, -6], [-2.5, -10], [2.5, -2]]) {
    const crate = MeshBuilder.CreateBox('crate', { width: 2, height: 2, depth: 2 }, scene);
    crate.position.set(cx, 2.7, cz);
    crate.material = MAT.wood;
    crate.parent = dockGrp;
  }

  // dockside crowd — settlers, porters, soldiers awaiting the fleet
  for (const [fx, fz] of [[-2, -4], [2, -8], [-1.5, -14], [1.8, -20], [0, -26],
                          [-9, -52], [9, -52], [-3, -56], [4, -58], [-6, -60], [7, -62], [0, -64]]) {
    dockFolk(dockGrp, fx, fz);
  }

  // ---- Distant mainland (Tierra Firme) on the far horizon ----
  const main = new TransformNode('Mainland', scene);
  main.parent = root;
  main.position.set(420, 0, 1050);
  for (let i = 0; i < 9; i++) {
    const r = 120 + (i % 3) * 60;
    const h = 120 + Math.sin(i * 1.7) * 60;
    const m = MeshBuilder.CreateCylinder('peak', {
      diameterTop: 0, diameterBottom: r * 2, height: h, tessellation: 8,
    }, scene);
    m.position.set(-700 + i * 180, h / 2 - 10, Math.sin(i) * 120);
    m.material = MAT.mainland;
    m.parent = main;
  }

  // ---- WALKABLE LAND: a gentle beach you can swim onto + the town plateau ----
  // a broad, gentle beach ramp from below the waterline up to the town plateau
  const ramp = MeshBuilder.CreateBox('beachRamp', { width: 46, height: 1, depth: 56 }, scene);
  ramp.position.set(0, 3.5, -138);
  ramp.rotation.x = -0.175;                 // -z (seaward) low, +z (inland) high
  ramp.material = MAT.sand;
  ramp.receiveShadows = true;
  ramp.parent = hisp;
  ramp.metadata = { walkable: true };
  walkable.push(ramp);

  // flat walkable plateau under the whole settlement
  const plateau = MeshBuilder.CreateBox('townPlateau', { width: 190, height: 1, depth: 170 }, scene);
  plateau.position.set(18, 7.45, -70);      // top at ~7.95, meets building bottoms (y8)
  plateau.material = MAT.sand;
  plateau.receiveShadows = true;
  plateau.parent = hisp;
  plateau.metadata = { walkable: true };
  walkable.push(plateau);

  // where the player is set down when going ashore (worldGroup-local; top of beach)
  const shore = new Vector3(-110 + 0, 8.4, 380 - 118);

  // dock head position (in world-group coordinates) used for docking checks
  const dock = new Vector3(-110 - 6, 0, 380 - 150 - 56);

  return { root, colliders: { walkable, solid }, dock, shore, court };
}
