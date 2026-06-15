// Procedural detail textures, drawn once to small canvases. They're kept near
// WHITE with darker accents and used as a MeshToonMaterial `map`, which
// MULTIPLIES the material colour — so they add grain / weave / stonework on top
// of the flat toon colours without changing the palette or breaking the refit
// recolouring (which still drives material.color). Cheap: a handful of 128px
// canvases, tiled with RepeatWrapping.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function make(draw, repeatX = 2, repeatY = 2, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

// planked, grainy wood — seams across, fine streaks along
export function woodGrain(repeatX = 2, repeatY = 3) {
  return make((x, s) => {
    x.fillStyle = '#f3efe9'; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(70,50,32,0.30)'; x.lineWidth = 2.5;
    for (let i = 1; i < 4; i++) { const y = (s / 4) * i; x.beginPath(); x.moveTo(0, y); x.lineTo(s, y); x.stroke(); }
    for (let i = 0; i < 150; i++) {
      x.strokeStyle = `rgba(60,42,26,${0.03 + Math.random() * 0.06})`;
      x.lineWidth = 1; const y = Math.random() * s;
      x.beginPath(); x.moveTo(0, y);
      x.bezierCurveTo(s * 0.3, y + (Math.random() - 0.5) * 7, s * 0.6, y + (Math.random() - 0.5) * 7, s, y);
      x.stroke();
    }
  }, repeatX, repeatY);
}

// woven canvas — fine warp + weft
export function weave(repeatX = 3, repeatY = 2) {
  return make((x, s) => {
    x.fillStyle = '#f7f4ec'; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(120,108,86,0.16)'; x.lineWidth = 1;
    for (let i = 0; i < s; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); }
    for (let i = 0; i < s; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
    // a few seam panels
    x.strokeStyle = 'rgba(90,80,60,0.22)'; x.lineWidth = 2;
    for (let i = 1; i < 3; i++) { const xx = (s / 3) * i; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, s); x.stroke(); }
  }, repeatX, repeatY);
}

// coursed stone / masonry
export function stone(repeatX = 2, repeatY = 2) {
  return make((x, s) => {
    x.fillStyle = '#f0eee9'; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(60,58,54,0.30)'; x.lineWidth = 2;
    const rows = 5, rh = s / rows;
    for (let r = 0; r <= rows; r++) {
      const y = r * rh; x.beginPath(); x.moveTo(0, y); x.lineTo(s, y); x.stroke();
      const off = (r % 2) * (s / 6);
      for (let cx = off; cx <= s; cx += s / 3) { x.beginPath(); x.moveTo(cx, y); x.lineTo(cx, y + rh); x.stroke(); }
    }
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(70,68,62,${Math.random() * 0.05})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }, repeatX, repeatY);
}

// soft mottle (sand / cloth / generic) — gentle speckle
export function mottle(repeatX = 3, repeatY = 3) {
  return make((x, s) => {
    x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 600; i++) {
      const v = Math.random() < 0.5 ? 0 : 255;
      x.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.05})`;
      x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 0, 7); x.fill();
    }
  }, repeatX, repeatY);
}
