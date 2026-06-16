// The player's first boat — a little single-mast sailing skiff, built at the
// Triana shipwright's. Tiny, open and solo: no crew, no castles, no hold. It
// exposes the SAME interface as createShip() (root, deckY, length, beam, sails,
// wheel, helm, colliders, setSails, update, set*Color) so main.js can sail it
// at the origin in place of the great nao. Lighter and faster to turn — but
// fragile (see SKIFF_PROFILE; the crossing in Phase 3 will punish a weak hull).

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, Vector3, DoubleSide,
} from 'three';
import { withOutline } from '../core/toon.js';
import { pbrMaterial } from '../core/materials.js';
import { woodGrain, weave } from '../core/textures.js';

const LEN = 9, BEAM = 3.2, DECK = 1.0;

// how the skiff sails vs the nao — lighter, nimbler, but fragile
export const SKIFF_PROFILE = { topSpeed: 30, turn: 1.1, windInfluence: 1.9, fragile: true };

export function createSkiff() {
  const root = new Group();
  const hullMat = pbrMaterial(0x7a5230, { map: woodGrain(2, 4) });
  const trimMat = pbrMaterial(0x5e3c20);
  const sailMat = pbrMaterial(0xe8e0cc, { side: DoubleSide, map: weave(2, 2) });
  const bannerMat = pbrMaterial(0x9c3528, { side: DoubleSide });

  // --- hull: a box tapered to a point at bow + stern ---
  const hg = new BoxGeometry(BEAM, 1.5, LEN, 2, 1, 8);
  const pos = hg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const z01 = (z + LEN / 2) / LEN, t = Math.abs(z01 - 0.5) * 2; // 0 mid .. 1 ends
    pos.setX(i, x * (1 - t * t * 0.7));
    if (y < 0) pos.setY(i, y * (1 - t * 0.3)); // shallower toward the ends
  }
  hg.computeVertexNormals();
  const hull = new Mesh(hg, hullMat); hull.position.y = DECK - 0.4; withOutline(hull, 0.08); root.add(hull);

  // deck floor (the walkable sole) + a thwart bench
  const floor = new Mesh(new BoxGeometry(BEAM * 0.86, 0.2, LEN * 0.88), trimMat);
  floor.position.y = DECK; root.add(floor);
  const bench = new Mesh(new BoxGeometry(BEAM * 0.7, 0.18, 0.7), trimMat);
  bench.position.set(0, DECK + 0.35, 0.5); root.add(bench);

  // low bulwark rails (match the colliders below)
  for (const sx of [-1, 1]) {
    const r = new Mesh(new BoxGeometry(0.18, 0.55, LEN * 0.8), trimMat);
    r.position.set(sx * BEAM * 0.44, DECK + 0.5, 0); withOutline(r, 0.05); root.add(r);
  }

  // --- mast + a single sail + a rudder/tiller (the "wheel") ---
  const mast = new Mesh(new CylinderGeometry(0.13, 0.17, 7, 6), trimMat);
  mast.position.set(0, DECK + 3.0, 0.6); withOutline(mast, 0.05); root.add(mast);
  const boom = new Mesh(new CylinderGeometry(0.08, 0.08, LEN * 0.6, 5), trimMat);
  boom.rotation.x = Math.PI / 2; boom.position.set(0, DECK + 1.0, 0.6); root.add(boom);

  const sail = new Mesh(new PlaneGeometry(3.4, 4.6, 6, 6), sailMat);
  sail.position.set(0, DECK + 3.2, 0.72);
  // cache base verts + width so update() can billow it like the nao's sails
  sail.userData.base = sail.geometry.attributes.position.array.slice();
  sail.userData.w = 3.4;
  root.add(sail);
  const sails = [sail];

  // a small stern banner
  const flagPole = new Mesh(new CylinderGeometry(0.05, 0.05, 2.4, 5), trimMat);
  flagPole.position.set(0, DECK + 1.6, -LEN * 0.46); root.add(flagPole);
  const flag = new Mesh(new PlaneGeometry(1.4, 0.9, 5, 2), bannerMat);
  flag.position.set(0.7, DECK + 2.4, -LEN * 0.46); root.add(flag);

  // the tiller — used as the "wheel" node (main rotates it while steering)
  const wheel = new Group();
  const tiller = new Mesh(new CylinderGeometry(0.06, 0.06, 1.4, 5), trimMat);
  tiller.rotation.z = Math.PI / 2.6;
  wheel.add(tiller);
  wheel.position.set(0, DECK + 0.7, -LEN * 0.4);
  root.add(wheel);

  // a small stern lantern
  const lanternPos = new Vector3(0, DECK + 1.1, -LEN * 0.44);

  // --- animation: furl + billow the sail, snap the banner ---
  let furl = 1;
  function setSails(d) { furl = Math.max(0, Math.min(1, d)); }
  function update(t, wind = 0) {
    const amp = 1 + wind * 2.4, sp = 1 + wind * 1.4;
    const p = sail.geometry.attributes.position, base = sail.userData.base, w = sail.userData.w;
    sail.scale.y = Math.max(0.04, furl);
    for (let i = 0; i < p.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const u = bx / w + 0.5;
      const ripple = (Math.sin(u * 4.5 + t * 2.4 * sp) * 0.18 + Math.sin(by * 0.7 + t * 1.6 * sp) * 0.1) * amp;
      p.setZ(i, bz + ripple * furl);
    }
    p.needsUpdate = true;
    const fp = flag.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const u = (fp.getX(i) + 0.7) / 1.4;
      fp.setZ(i, Math.sin(u * 6 + t * (4 + wind * 5)) * 0.2 * (1 + wind * 1.6) * u);
    }
    fp.needsUpdate = true;
  }

  // --- physics colliders (ship rides at the origin; local == world) ---
  const colliders = [
    { hx: BEAM * 0.43, hy: 0.2, hz: LEN * 0.44, x: 0, y: DECK - 0.2, z: 0 },   // deck sole
    { hx: 0.2, hy: 0.5, hz: LEN * 0.45, x: BEAM * 0.44, y: DECK + 0.5, z: 0 }, // starboard rail
    { hx: 0.2, hy: 0.5, hz: LEN * 0.45, x: -BEAM * 0.44, y: DECK + 0.5, z: 0 }, // port rail
    { hx: BEAM * 0.42, hy: 0.5, hz: 0.2, x: 0, y: DECK + 0.5, z: -LEN * 0.45 }, // stern rail
    { hx: BEAM * 0.42, hy: 0.5, hz: 0.2, x: 0, y: DECK + 0.5, z: LEN * 0.46 },  // bow rail (z>5*? no — small boat)
  ];

  return {
    root, deckY: DECK, length: LEN, beam: BEAM,
    sails, wheel,
    helm: new Vector3(0, DECK + 1.0, -LEN * 0.36),
    capstanPos: new Vector3(0, DECK, 0.6),
    lanternPos,
    colliders, setSails, update,
    setSailColor: (hex) => sailMat.color.set(hex),
    setBannerColor: (hex) => bannerMat.color.set(hex),
    setHullColor: (hex) => hullMat.color.set(hex),
    isSkiff: true,
  };
}
