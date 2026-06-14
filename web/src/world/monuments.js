// Memory-stones: every Chronicle entry manifests as a carved standing stone in
// the keep's Court of Chronicles on the island. They persist (loaded from the
// DB) and rise live as new lore is written by anyone.

import * as THREE from 'three';

const STONE = new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 0.95 });
const BASE = new THREE.MeshStandardMaterial({ color: 0x5f5a52, roughness: 1.0 });

function plaqueTexture(title, author) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = '#d8cdb0'; x.fillRect(0, 0, 256, 320);
  x.fillStyle = 'rgba(60,45,25,0.25)'; x.fillRect(0, 0, 256, 320);
  x.strokeStyle = '#3a2c18'; x.lineWidth = 6; x.strokeRect(10, 10, 236, 300);
  x.fillStyle = '#241a0e'; x.textAlign = 'center';
  // title (wrapped)
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createMonuments(court) {
  const seen = new Set();
  let count = 0;

  function place(entry) {
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);

    const g = new THREE.Group();
    // explicit world placement, else auto-arrange in a courtyard grid
    if (entry.pos_x != null && entry.pos_z != null) {
      g.position.set(entry.pos_x, 0, entry.pos_z);
    } else {
      const i = count++;
      const col = i % 6, row = Math.floor(i / 6);
      g.position.set((col - 2.5) * 7, 0, -row * 7);
    }

    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), BASE);
    base.position.y = 0.5; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6, 0.9), STONE);
    shaft.position.y = 4; shaft.castShadow = true; g.add(shaft);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 4), STONE);
    cap.position.y = 7.6; cap.rotation.y = Math.PI / 4; g.add(cap);
    // inscribed plaque facing out of the court (+z)
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.1),
      new THREE.MeshStandardMaterial({ map: plaqueTexture(entry.title, entry.author_handle), roughness: 0.9 })
    );
    plaque.position.set(0, 4.2, 0.46); g.add(plaque);

    // rise out of the ground when freshly written
    g.scale.y = 0.02;
    court.add(g);
    g.userData.grow = () => {
      g.scale.y = Math.min(1, g.scale.y + 0.03);
      return g.scale.y < 1;
    };
    growing.push(g);
  }

  const growing = [];
  function update() {
    for (let i = growing.length - 1; i >= 0; i--) {
      if (!growing[i].userData.grow()) growing.splice(i, 1);
    }
  }

  return { place, update, get count() { return seen.size; } };
}
