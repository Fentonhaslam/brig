// Remote co-presence avatars (Babylon.js port of the Three.js peer rendering in
// web/src/main.js). One simple sailor per peer: a capsule body + sphere head +
// a small cap dome, topped with a billboarded name tag. Parented to the scene
// root in world space; main.js wires net/presence.js's peers Map to sync().
//
// Babylon is LEFT-HANDED. Heading is the same yaw convention as the ship/net
// (rotation about +Y), applied directly to rotation.y.

import {
  Vector3, Color3, MeshBuilder, PBRMaterial, StandardMaterial,
  TransformNode, DynamicTexture, Mesh, Space,
} from '@babylonjs/core';

// Tunables (ported faithfully from the Three.js originals).
const BODY_RADIUS = 0.17;
const BODY_HEIGHT = 0.94;   // CapsuleGeometry(0.17 radius, 0.6 cylinder) ≈ 0.94 total
const BODY_Y = 0.85;
const HEAD_RADIUS = 0.14;
const HEAD_Y = 1.4;
const CAP_RADIUS = 0.16;
const CAP_Y = 1.46;
const TAG_Y = 2.1;
const TAG_W = 2.6;
const TAG_H = 0.65;

const DEFAULT_Y = 3.5;      // matches the Three.js fallback for peer.y
const LERP_RATE = 11;       // per-second smoothing; ~0.18/frame at 60fps

// Shared materials — every peer looks the same, so build the PBR materials once
// and reuse them across all avatars to keep things cheap.
let _mats = null;
function materials(scene) {
  if (_mats && _mats.scene === scene) return _mats;
  const body = new PBRMaterial('peerBody', scene);
  body.albedoColor = Color3.FromHexString('#3a6a8a');
  body.metallic = 0; body.roughness = 0.85;

  const head = new PBRMaterial('peerHead', scene);
  head.albedoColor = Color3.FromHexString('#b07a52');
  head.metallic = 0; head.roughness = 0.8;

  const cap = new PBRMaterial('peerCap', scene);
  cap.albedoColor = Color3.FromHexString('#1d5a7a');
  cap.metallic = 0; cap.roughness = 0.85;

  _mats = { scene, body, head, cap };
  return _mats;
}

// Painted name tag on a billboarded plane (the Babylon analogue of the
// Three.js CanvasTexture sprite: dark backing + gold serif text).
function makeNameTag(scene, text, parent) {
  const label = (text || 'sailor').slice(0, 18);
  const plane = MeshBuilder.CreatePlane('peerTag', { width: TAG_W, height: TAG_H }, scene);
  plane.parent = parent;
  plane.position.y = TAG_Y;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const dt = new DynamicTexture('peerTagTex', { width: 256, height: 64 }, scene, false);
  dt.hasAlpha = true;
  const ctx = dt.getContext();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f0dca8';
  ctx.fillText(label, 128, 44);
  dt.update(false);

  const mat = new StandardMaterial('peerTagMat', scene);
  mat.diffuseTexture = dt;
  mat.opacityTexture = dt;
  mat.emissiveColor = new Color3(1, 1, 1);  // unlit — readable in any light
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.diffuseTexture.getAlphaFromRGB = false;
  plane.material = mat;

  return { plane, mat, texture: dt };
}

function buildPeer(scene, mats, meta) {
  const root = new TransformNode('peer', scene);

  const body = MeshBuilder.CreateCapsule('peerBodyMesh', {
    radius: BODY_RADIUS, height: BODY_HEIGHT, tessellation: 8, subdivisions: 1,
  }, scene);
  body.material = mats.body;
  body.position.y = BODY_Y;
  body.parent = root;
  body.isPickable = false;

  const head = MeshBuilder.CreateSphere('peerHeadMesh', {
    diameter: HEAD_RADIUS * 2, segments: 10,
  }, scene);
  head.material = mats.head;
  head.position.y = HEAD_Y;
  head.parent = root;
  head.isPickable = false;

  // Cap: a hemisphere dome (slice = top portion of a sphere).
  const cap = MeshBuilder.CreateSphere('peerCapMesh', {
    diameter: CAP_RADIUS * 2, segments: 10, slice: 0.6,
  }, scene);
  cap.material = mats.cap;
  cap.position.y = CAP_Y;
  cap.parent = root;
  cap.isPickable = false;

  const tag = makeNameTag(scene, meta?.handle, root);

  const tx = meta?.x ?? 0;
  const ty = meta?.y ?? DEFAULT_Y;
  const tz = meta?.z ?? 0;
  root.position.set(tx, ty, tz);
  root.rotation.y = typeof meta?.heading === 'number' ? meta.heading : 0;

  return {
    root,
    meshes: [body, head, cap, tag.plane],
    tag,
    meta,
    target: new Vector3(tx, ty, tz),
    heading: root.rotation.y,
  };
}

function disposePeer(peer) {
  peer.tag.texture.dispose();
  peer.tag.mat.dispose();
  for (const m of peer.meshes) m.dispose();
  peer.root.dispose();
}

export function createAvatars(scene) {
  const mats = materials(scene);
  const avatars = new Map();   // userId -> peer record

  function sync(peersMap) {
    const peers = peersMap || new Map();

    // Remove avatars whose peer has left.
    for (const [id, peer] of avatars) {
      if (!peers.has(id)) {
        disposePeer(peer);
        avatars.delete(id);
      }
    }

    // Create new avatars + refresh targets/handles for existing ones.
    for (const [id, meta] of peers) {
      let peer = avatars.get(id);
      if (!peer) {
        peer = buildPeer(scene, mats, meta);
        avatars.set(id, peer);
      }
      peer.meta = meta;
      peer.target.set(meta?.x ?? 0, meta?.y ?? DEFAULT_Y, meta?.z ?? 0);
      if (typeof meta?.heading === 'number') peer.heading = meta.heading;
    }
  }

  function update(dt) {
    // Frame-rate-independent exponential smoothing toward each target.
    const a = 1 - Math.exp(-LERP_RATE * Math.max(0, dt || 0));
    for (const peer of avatars.values()) {
      const p = peer.root.position;
      p.x += (peer.target.x - p.x) * a;
      p.y += (peer.target.y - p.y) * a;
      p.z += (peer.target.z - p.z) * a;
      peer.root.rotation.y = peer.heading;
    }
  }

  function dispose() {
    for (const peer of avatars.values()) disposePeer(peer);
    avatars.clear();
  }

  return { sync, update, dispose };
}
