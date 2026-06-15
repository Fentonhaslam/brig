// Day/night cycle — the atmosphere the old build had and this one didn't.
//
// A slow sun arc drives everything at once: the sun lamp's direction, colour
// and intensity, the hemisphere fill, the skydome gradient, the sea's sun/fog
// tint, the scene fog + background, and — the payoff — the stern lantern and
// the bloom, which swell as the light fails so the ship carries its own glow
// into the dusk and night. Starts at a warm late afternoon rolling into dusk.

import { Color, Vector3, MathUtils } from 'three';

const DAY_LENGTH = 300; // seconds for a full sun-to-sun cycle

// night / golden / day stops for each thing we recolour. Night is lifted to a
// moonlit blue (rather than near-black) so the deck stays readable after dark.
const STOPS = {
  sun:    [0x3a4a6a, 0xff7a3c, 0xfff0d0],
  hemiSky:[0x415585, 0xc98a5a, 0xdfe6d2],
  hemiGnd:[0x2a3346, 0x4a3a2a, 0x55503a],
  skyHor: [0x2c3a5c, 0xff9a5a, 0xf6c79a],
  skyZen: [0x18244a, 0x3a4a7a, 0x2c5d8f],
  fog:    [0x1c2a44, 0xca8a5a, 0xd7dcc8],
};

export function createDayNight({ renderer, sun, hemi, sky, water, scene, post, lantern }) {
  const cols = {};
  for (const k in STOPS) cols[k] = STOPS[k].map((h) => new Color(h));
  const sunDir = new Vector3();
  const _a = new Color(), _b = new Color(), _c = new Color();

  let phase = 0.46; // start: low warm sun, about to dip into dusk

  // three-stop lerp keyed on a 0(night)..0.5(gold)..1(day) factor
  function tri(out, stops, t) {
    if (t < 0.5) out.lerpColors(stops[0], stops[1], t / 0.5);
    else out.lerpColors(stops[1], stops[2], (t - 0.5) / 0.5);
    return out;
  }

  function update(dt) {
    phase = (phase + dt / DAY_LENGTH) % 1;
    const a = phase * Math.PI * 2;
    const el = Math.sin(a) * 0.9;            // elevation, radians
    const az = a + Math.PI * 0.25;
    sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();

    const h = sunDir.y;                       // sun height, -0.78..0.78
    const day = MathUtils.smoothstep(h, -0.16, 0.36); // 0 night .. 1 full day

    // sun lamp
    sun.position.copy(sunDir).multiplyScalar(200);
    tri(sun.color, cols.sun, day);
    sun.intensity = 0.1 + day * 2.1;
    sun.castShadow = h > 0.08;                // no shadows from a sub-horizon sun

    // fill — keep a strong moonlit floor at night so you can still see the deck
    tri(hemi.color, cols.hemiSky, day);
    tri(hemi.groundColor, cols.hemiGnd, day);
    hemi.intensity = 0.72 + day * 0.4;
    // lift exposure after dark (moonlight), ease it back by day
    if (renderer) renderer.toneMappingExposure = 1.02 + (1 - day) * 0.34;

    // sky
    tri(_a, cols.skyHor, day);
    tri(_b, cols.skyZen, day);
    sky.setSun(sunDir, sun.color.getHex(), _a.getHex(), _b.getHex());

    // fog + background + sea tint
    tri(_c, cols.fog, day);
    scene.fog.color.copy(_c);
    scene.background.copy(_c);
    const u = water.material.uniforms;
    u.uFogColor.value.copy(_c);
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(sun.color);
    u.uSky.value.copy(_b).lerp(_a, 0.4);

    // the payoff: lantern + bloom carry the scene as the light fails (bloom
    // eased down a bit now the night ambient is brighter, so it won't blow out)
    lantern.intensity = 2 + (1 - day) * 9;
    post.setBloom(0.3 + (1 - day) * 0.5);

    return sunDir;
  }

  return {
    update, sunDir,
    setPhase(ph) { phase = ph; }, // for testing: 0≈dawn, .25 noon, .5 dusk, .72 night
    get dayAmount() { return MathUtils.smoothstep(sunDir.y, -0.16, 0.36); },
  };
}
