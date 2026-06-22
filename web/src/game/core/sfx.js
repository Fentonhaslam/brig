// Shared WebAudio context + master SFX gain node.
// Weather and cannons import getAudio() instead of creating their own
// AudioContext, so the dashboard's SFX volume slider controls all game sounds.

let _ctx = null, _gain = null;

export function getAudio() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _gain = _ctx.createGain();
      _gain.connect(_ctx.destination);
      const v = parseFloat(localStorage.getItem('brig:sfx') ?? '1');
      _gain.gain.value = Number.isFinite(v) ? v : 1;
    } catch { return null; }
  }
  return { ctx: _ctx, out: _gain };
}

export function setSfxVolume(v) {
  try { localStorage.setItem('brig:sfx', String(v)); } catch {}
  if (_gain) _gain.gain.value = v;
}

export function getSfxVolume() {
  const v = parseFloat(localStorage.getItem('brig:sfx') ?? '1');
  return Number.isFinite(v) ? v : 1;
}
