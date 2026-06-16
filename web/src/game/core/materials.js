// The PBR material library — the core of the "grounded stylized" look.
//
// Replaces the flat MeshToonMaterial world surfaces with MeshStandardMaterial:
// physically lit by the sun + the image-based environment (scene.environment),
// grounded by the AO pass, and stylised by the colour grade. The procedural
// detail textures (textures.js) double as BOTH a subtle albedo `map` and a
// `bumpMap` (no tangents/uv2 needed — cheap relief on plaster, stone, planking,
// tile). One material per palette colour keeps the merged-draw-call batching.

import { MeshStandardMaterial, Color } from 'three';
import { woodGrain, weave, stone, mottle } from './textures.js';

// per-surface recipe: a detail texture + how rough it reads + bump strength
const KIND = {
  stone:  () => ({ tex: stone(3, 3),     roughness: 0.93, bump: 0.05, metal: 0.0 }),
  wall:   () => ({ tex: stone(2, 2),     roughness: 0.96, bump: 0.035, metal: 0.0 }), // lime plaster
  wood:   () => ({ tex: woodGrain(2, 3), roughness: 0.82, bump: 0.06, metal: 0.0 }),
  roof:   () => ({ tex: woodGrain(2, 2), roughness: 0.74, bump: 0.07, metal: 0.0 }), // terracotta tile
  cloth:  () => ({ tex: weave(2, 2),     roughness: 1.0,  bump: 0.02, metal: 0.0 }),
  ground: () => ({ tex: mottle(6, 6),    roughness: 0.99, bump: 0.04, metal: 0.0 }),
  water:  () => ({ tex: null,            roughness: 0.22, bump: 0.0,  metal: 0.0, env: 1.4 }),
  metal:  () => ({ tex: null,            roughness: 0.4,  bump: 0.0,  metal: 0.85, env: 1.0 }),
  none:   () => ({ tex: null,            roughness: 0.9,  bump: 0.0,  metal: 0.0 }),
};

export function surfaceMaterial(hex, kind = 'none') {
  const k = (KIND[kind] || KIND.none)();
  const m = new MeshStandardMaterial({
    color: new Color(hex),
    roughness: k.roughness,
    metalness: k.metal,
  });
  if (k.tex) { m.map = k.tex; m.bumpMap = k.tex; m.bumpScale = k.bump; }
  m.envMapIntensity = k.env != null ? k.env : 0.55; // env is a soft fill; sun still leads
  return m;
}
