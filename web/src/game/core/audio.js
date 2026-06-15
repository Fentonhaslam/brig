// Theme music. The lightweight rebuild shipped without any audio — this brings
// back theme.mp3 from the old build. Browsers block autoplay until the player
// interacts, so we arm playback on the first pointer/key gesture, and wire a
// mute toggle (top-right speaker, or the M key).

export function createAudio(src = '/theme.mp3', volume = 0.4) {
  const el = new Audio(src);
  el.loop = true;
  el.volume = volume;
  el.preload = 'auto';

  let armed = false;
  function start() {
    el.play().then(() => { armed = true; }).catch(() => {/* gesture needed */});
  }
  // first interaction unlocks audio
  const arm = () => { if (!armed) start(); };
  window.addEventListener('pointerdown', arm);
  window.addEventListener('keydown', arm);

  // top-right mute toggle
  const btn = document.createElement('button');
  btn.textContent = '🔊';
  btn.title = 'Music (M)';
  btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:80;width:38px;height:38px;'
    + 'border:none;border-radius:50%;font-size:17px;cursor:pointer;color:#f3e8cf;'
    + 'background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  document.body.appendChild(btn);

  function toggle() {
    if (el.paused) { start(); btn.textContent = '🔊'; }
    else { el.pause(); btn.textContent = '🔇'; }
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') toggle(); });

  return { el, start, toggle, setVolume: (v) => { el.volume = v; } };
}
