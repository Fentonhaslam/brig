// Weather. A slow-drifting storm factor (0 fair .. 1 full gale) rolls the sky
// grey, thickens and closes in the fog, whips up the sea (wave chop + foam via
// the water uniforms), draws driving rain around the camera, and — at the
// height of it — throws lightning with a beat of thunder. Self-contained: it
// reads the camera each frame and writes the shared sky/fog/water state after
// the day/night pass, so storms layer on top of the time of day.

import {
  BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial, Color, MathUtils,
} from 'three';

const GREY = new Color(0x6b7178);

let actx = null;
function thunder(dist = 0.5) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const a = actx, t = a.currentTime + dist; // a touch after the flash
    const len = (a.sampleRate * 1.6) | 0;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const n = a.createBufferSource(); n.buffer = buf;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    n.connect(lp).connect(g).connect(a.destination); n.start(t);
  } catch {}
}

// a low wind-howl loop whose volume rises with the storm (armed on first gesture)
let windGain = null;
function initWind() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const a = actx, len = (a.sampleRate * 2) | 0;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    windGain = a.createGain(); windGain.gain.value = 0;
    src.connect(lp).connect(windGain).connect(a.destination); src.start();
  } catch {}
}

export function createWeather({ scene, water, sky, camera }) {
  let storm = 0, target = 0, timer = 12, flash = 0, strikeTimer = 3;
  const armWind = () => { if (!windGain) initWind(); };
  window.addEventListener('pointerdown', armWind);
  window.addEventListener('keydown', armWind);

  // --- driving rain: short vertical line streaks in a box that rides the camera
  const N = 2600, RANGE = 70, HBOX = 60, L = 1.5;
  const arr = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = (Math.random() - 0.5) * RANGE, y = (Math.random() - 0.5) * HBOX, z = (Math.random() - 0.5) * RANGE;
    arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z;
    arr[i * 6 + 3] = x + 0.1; arr[i * 6 + 4] = y - L; arr[i * 6 + 5] = z;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(arr, 3));
  const rainMat = new LineBasicMaterial({ color: 0xaeb8c2, transparent: true, opacity: 0, depthWrite: false });
  const rain = new LineSegments(geo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // --- lightning flash overlay (cheap, dramatic)
  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:fixed;inset:0;z-index:40;background:#dfe8ff;opacity:0;pointer-events:none';
  document.body.appendChild(flashEl);

  // --- weather label
  const label = document.createElement('div');
  label.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:54;'
    + 'font:600 12px system-ui;color:#dfe6ee;text-shadow:0 1px 3px rgba(0,0,0,.7);letter-spacing:.5px;pointer-events:none';
  document.body.appendChild(label);

  const _c = new Color();

  function update(dt) {
    // drift the weather: mostly fair, sometimes a blow
    timer -= dt;
    if (timer <= 0) {
      target = Math.random() < 0.45 ? 0.55 + Math.random() * 0.45 : Math.random() * 0.22;
      timer = 35 + Math.random() * 55;
    }
    storm = MathUtils.damp(storm, target, 0.5, dt);

    // sea
    water.material.uniforms.uChop.value = 1 + storm * 2.4;
    water.material.uniforms.uStorm.value = storm;

    // fog closes in + greys; sky greys (layered over the day/night colours)
    scene.fog.color.lerp(GREY, storm * 0.7);
    scene.background.lerp(GREY, storm * 0.7);
    scene.fog.far = MathUtils.lerp(1800, 620, storm);
    water.material.uniforms.uFogColor.value.copy(scene.fog.color);
    water.material.uniforms.uFogFar.value = scene.fog.far;
    sky.material.uniforms.uHorizon.value.lerp(GREY, storm * 0.6);
    sky.material.uniforms.uZenith.value.lerp(_c.set(0x3a4048), storm * 0.7);

    // rain rides the camera and falls; opacity scales in past a threshold
    rainMat.opacity = MathUtils.clamp((storm - 0.25) / 0.4, 0, 1) * 0.75;
    rain.visible = rainMat.opacity > 0.01;
    if (rain.visible) {
      rain.position.copy(camera.position);
      const p = geo.attributes.position.array;
      const fall = (55 + storm * 25) * dt, slant = storm * 6 * dt;
      for (let i = 0; i < N; i++) {
        p[i * 6 + 1] -= fall; p[i * 6 + 4] -= fall;
        p[i * 6] += slant; p[i * 6 + 3] += slant;
        if (p[i * 6 + 1] < -HBOX / 2) {
          p[i * 6 + 1] += HBOX; p[i * 6 + 4] += HBOX;
          const nx = (Math.random() - 0.5) * RANGE;
          p[i * 6] = nx; p[i * 6 + 3] = nx + 0.1;
        }
      }
      geo.attributes.position.needsUpdate = true;
    }

    // lightning at the height of the storm
    if (storm > 0.55) {
      strikeTimer -= dt;
      if (strikeTimer <= 0) {
        flash = 1;
        thunder(0.3 + Math.random() * 1.2);
        strikeTimer = 4 + Math.random() * 9;
      }
    }
    if (flash > 0) { flash = Math.max(0, flash - dt * 3.5); }
    // a double-tick flicker reads as a real strike
    flashEl.style.opacity = (flash * (0.55 + 0.45 * Math.sin(flash * 40))).toFixed(3);

    if (windGain) windGain.gain.value = storm * storm * 0.28; // howl rises with the gale

    label.textContent = storm > 0.6 ? '⛈ Storm' : storm > 0.3 ? '🌧 Squally' : storm > 0.12 ? '⛅ Overcast' : '☀ Fair';
  }

  return {
    update,
    get storm() { return storm; },
    setStorm(v) { target = v; storm = v; timer = 60; },
  };
}
