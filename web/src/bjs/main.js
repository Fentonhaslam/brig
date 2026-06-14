// Brig — Babylon.js build (in progress, parallel to the Three.js version).
// Boot scaffold: reuses the Supabase login, then stands up a Babylon scene
// (sky, reflective sea, sun + shadows) with a Babylon GUI HUD. Subsystems get
// filled in part-by-part per the migration design.

import {
  Engine, Scene, Color3, Color4, Vector2, Vector3,
  ArcRotateCamera, HemisphericLight, DirectionalLight, ShadowGenerator,
  MeshBuilder, StandardMaterial, PBRMaterial, Texture,
} from '@babylonjs/core';
import { SkyMaterial, WaterMaterial } from '@babylonjs/materials';
import * as GUI from '@babylonjs/gui';

import { mountAuth, currentProfile } from '../net/auth.js';

const { session } = await mountAuth();           // reuse the Supabase login screen
const profile = await currentProfile(session);
const me = profile?.handle || session?.user?.email?.split('@')[0] || 'Wanderer';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { antialias: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.05, 0.07, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogColor = new Color3(0.85, 0.63, 0.44);
scene.fogDensity = 0.0016;

// camera — orbit for now (cinematic)
const camera = new ArcRotateCamera('cam', Math.PI * 1.15, Math.PI * 0.42, 70, new Vector3(0, 8, 0), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 18; camera.upperRadiusLimit = 320;
camera.upperBetaLimit = Math.PI * 0.495;

// lights + sun shadows
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.5; hemi.diffuse = new Color3(0.5, 0.62, 0.78); hemi.groundColor = new Color3(0.16, 0.1, 0.05);
const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.35, -0.8), scene);
sun.position = new Vector3(60, 80, 120); sun.intensity = 3.2; sun.diffuse = new Color3(1, 0.84, 0.63);
const shadow = new ShadowGenerator(2048, sun);
shadow.useBlurExponentialShadowMap = true; shadow.blurKernel = 16;

// sky
const skybox = MeshBuilder.CreateBox('sky', { size: 12000 }, scene);
const skyMat = new SkyMaterial('skyMat', scene);
skyMat.backFaceCulling = false; skyMat.turbidity = 6; skyMat.luminance = 1.0;
skyMat.inclination = 0.49; skyMat.azimuth = 0.42; skyMat.rayleigh = 1.6;
skybox.material = skyMat; skybox.infiniteDistance = true;

// reflective sea (Babylon WaterMaterial)
const sea = MeshBuilder.CreateGround('sea', { width: 20000, height: 20000, subdivisions: 8 }, scene);
const water = new WaterMaterial('water', scene, new Vector2(512, 512));
water.bumpTexture = new Texture('/waternormals.jpg', scene);
water.windForce = -6; water.waveHeight = 0.5; water.bumpHeight = 0.3;
water.waterColor = new Color3(0.05, 0.16, 0.2); water.colorBlendFactor = 0.25;
water.windDirection = new Vector2(1, 0.4);
sea.material = water;
water.addToRenderList(skybox);

// placeholder hull (replaced by the procedural ship port)
const hull = MeshBuilder.CreateBox('hullPlaceholder', { width: 9, height: 5, depth: 36 }, scene);
const hullMat = new PBRMaterial('hullMat', scene);
hullMat.albedoColor = new Color3(0.42, 0.26, 0.14); hullMat.metallic = 0.0; hullMat.roughness = 0.85;
hull.material = hullMat; hull.position.y = 2; hull.receiveShadows = true;
shadow.addShadowCaster(hull);
water.addToRenderList(hull);

// --- Babylon GUI HUD (the UI win) ---
const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('ui', true, scene);
const title = new GUI.TextBlock();
title.text = 'BRIG'; title.color = '#f1e3c4'; title.fontSize = 30; title.fontStyle = 'bold';
title.fontFamily = 'Cormorant Garamond, serif'; title.top = '24px'; title.left = '28px';
title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
title.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
ui.addControl(title);

const hud = new GUI.TextBlock();
hud.text = `Babylon build · welcome, ${me}`;
hud.color = 'rgba(241,227,196,0.8)'; hud.fontSize = 14; hud.fontFamily = 'Cormorant Garamond, serif';
hud.top = '-24px'; hud.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
ui.addControl(hud);

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
