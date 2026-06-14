// Memory-stones (Babylon.js port): every Chronicle entry manifests as a carved
// standing stone in the keep's Court of Chronicles. They persist (loaded from
// the DB) and rise live as new lore is written by anyone.
//
// Port of web/src/world/monuments.js. Babylon is LEFT-HANDED. Each entry becomes
// a TransformNode group (base + shaft + 4-sided pyramid cap + inscribed plaque
// drawn with a DynamicTexture canvas). Stones grow in from the ground on place().

import {
  Color3, Vector3, MeshBuilder, PBRMaterial, TransformNode, DynamicTexture,
} from '@babylonjs/core';

// Draw the plaque text onto a DynamicTexture (canvas-style), faithful to the
// Three.js CanvasTexture original: parchment fill, dark border, wrapped title,
// italic author line.
function makePlaqueTexture(scene, title, author) {
  const W = 256, H = 320;
  const tex = new DynamicTexture('plaque', { width: W, height: H }, scene, true);
  const x = tex.getContext();

  x.fillStyle = '#d8cdb0'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(60,45,25,0.25)'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#3a2c18'; x.lineWidth = 6; x.strokeRect(10, 10, 236, 300);
  x.fillStyle = '#241a0e'; x.textAlign = 'center';

  // title (wrapped at ~14 chars)
  x.font = 'bold 26px Georgia, serif';
  const words = (title || 'Untitled').split(' ');
  let line = '', y = 70; const lines = [];
  for (const w of words) {
    if ((line + w).length > 14) { lines.push(line.trim()); line = ''; }
    line += w + ' ';
  }
  lines.push(line.trim());
  for (const ln of lines.slice(0, 5)) { x.fillText(ln, 128, y); y += 32; }

  x.font = 'italic 18px Georgia, serif';
  x.fillText('— ' + (author || 'unknown'), 128, 290);

  tex.hasAlpha = false;
  tex.update();
  return tex;
}

export function createMonuments(parent) {
  const scene = parent.getScene();
  const seen = new Set();
  let count = 0;             // index used only for auto grid arrangement
  const growing = [];

  // Shared stone materials (cinematic PBR look).
  const stoneMat = new PBRMaterial('memStone', scene);
  stoneMat.albedoColor = new Color3(0.545, 0.514, 0.471); // 0x8b8378
  stoneMat.metallic = 0; stoneMat.roughness = 0.95;

  const baseMat = new PBRMaterial('memBase', scene);
  baseMat.albedoColor = new Color3(0.373, 0.353, 0.322);  // 0x5f5a52
  baseMat.metallic = 0; baseMat.roughness = 1.0;

  function place(entry) {
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);

    const g = new TransformNode('memory_' + entry.id, scene);
    g.parent = parent;

    // explicit world placement, else auto-arrange in a courtyard grid
    if (entry.pos_x != null && entry.pos_z != null) {
      g.position.set(entry.pos_x, 0, entry.pos_z);
    } else {
      const i = count++;
      const col = i % 6, row = Math.floor(i / 6);
      g.position.set((col - 2.5) * 7, 0, -row * 7);
    }

    // base
    const base = MeshBuilder.CreateBox('memBaseMesh', { width: 3, height: 1, depth: 3 }, scene);
    base.material = baseMat; base.parent = g; base.position.y = 0.5;
    base.receiveShadows = true;
    base.metadata = { solid: true };

    // shaft (obelisk body)
    const shaft = MeshBuilder.CreateBox('memShaft', { width: 1.8, height: 6, depth: 0.9 }, scene);
    shaft.material = stoneMat; shaft.parent = g; shaft.position.y = 4;
    shaft.receiveShadows = true;
    shaft.metadata = { solid: true };

    // cap — 4-sided pyramid (cylinder with 4 tessellation, top radius 0).
    // Rotated 45deg so its faces align with the shaft, matching the Three.js cone.
    const cap = MeshBuilder.CreateCylinder('memCap', {
      diameterTop: 0, diameterBottom: 3, height: 1.2, tessellation: 4,
    }, scene);
    cap.material = stoneMat; cap.parent = g;
    cap.position.y = 7.6; cap.rotation.y = Math.PI / 4;

    // inscribed plaque facing out of the court (+z)
    const plaque = MeshBuilder.CreatePlane('memPlaque', { width: 1.7, height: 2.1 }, scene);
    plaque.parent = g; plaque.position.set(0, 4.2, 0.46);
    // Left-handed: plane front faces -Z by default; rotate to face +Z (out of court).
    plaque.rotation.y = Math.PI;
    const plaqueMat = new PBRMaterial('memPlaqueMat', scene);
    plaqueMat.albedoTexture = makePlaqueTexture(scene, entry.title, entry.author_handle);
    plaqueMat.unlit = false; plaqueMat.metallic = 0; plaqueMat.roughness = 0.9;
    plaqueMat.emissiveColor = new Color3(0.12, 0.12, 0.1); // gentle legibility lift
    plaque.material = plaqueMat;

    // rise out of the ground when freshly written
    g.scaling.y = 0.02;
    g.metadata = {
      grow() {
        g.scaling.y = Math.min(1, g.scaling.y + 0.03);
        return g.scaling.y < 1;
      },
    };
    growing.push(g);
  }

  function update() {
    for (let i = growing.length - 1; i >= 0; i--) {
      if (!growing[i].metadata.grow()) growing.splice(i, 1);
    }
  }

  return { place, update, get count() { return seen.size; } };
}
