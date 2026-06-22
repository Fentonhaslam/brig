// Quality / performance manager — the lever that makes Brig run on a weaker
// laptop. One place that owns the GPU-cost knobs and three presets over them:
//
//   low    — composer BYPASSED (no GTAO/bloom/grade), no shadows, 1.0x pixels.
//            Renders the scene straight to screen: by far the cheapest path.
//   medium — composer on but GTAO OFF (the expensive screen-space AO), bloom +
//            grade kept, shadows on, 1.25x pixels.
//   high   — everything: GTAO + bloom + grade + shadows, 1.5x pixels.
//
// On first run we GUESS a preset from the device (cores / memory / mobile), so a
// weak machine starts smooth without anyone touching a menu. We also watch the
// frame-rate and step DOWN a level if it's sustained-low and the player hasn't
// pinned a choice — and once they pick a level in the dashboard, we respect it.
//
// EXPORT: createQuality({ renderer, post, sun }) -> manager

const LEVELS = {
  low:    { pixelRatio: 1.0,  shadows: false, post: false, gtao: false, bloom: false },
  medium: { pixelRatio: 1.25, shadows: true,  post: true,  gtao: false, bloom: true },
  high:   { pixelRatio: 1.5,  shadows: true,  post: true,  gtao: true,  bloom: true },
};
const ORDER = ['low', 'medium', 'high'];
const KEY = 'brig:quality';

function detect() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (mobile || cores <= 4 || mem <= 4) return 'low';
  if (cores <= 8 || mem <= 6) return 'medium';
  return 'high';
}

export function createQuality({ renderer, post, sun }) {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  let level = LEVELS[saved] ? saved : detect();
  let userLocked = Boolean(LEVELS[saved]); // a saved choice means the player picked
  const listeners = new Set();

  function apply() {
    const q = LEVELS[level];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.needsUpdate = true;
    if (sun) sun.castShadow = q.shadows;
    post.setPixelRatio?.(renderer.getPixelRatio());
    post.setPasses?.({ gtao: q.gtao, bloom: q.bloom });
    listeners.forEach((f) => { try { f(level); } catch { /* ignore */ } });
  }
  apply();

  // rolling FPS + adaptive step-down (only while the player hasn't locked a level)
  let acc = 0, frames = 0, fps = 60, lowWindows = 0;
  function update(dt) {
    acc += dt; frames += 1;
    if (acc >= 0.5) {
      fps = frames / acc; acc = 0; frames = 0;
      if (!userLocked) {
        if (fps < 28) { lowWindows += 1; if (lowWindows >= 6 && stepDown()) lowWindows = 0; }
        else lowWindows = Math.max(0, lowWindows - 1);
      }
    }
  }
  function stepDown() {
    const i = ORDER.indexOf(level);
    if (i > 0) { level = ORDER[i - 1]; apply(); return true; }
    return false;
  }

  window.addEventListener('resize', () => apply());

  return {
    get level() { return level; },
    get fps() { return Math.round(fps); },
    get usePost() { return LEVELS[level].post; },
    get levels() { return ORDER.slice(); },
    get auto() { return !userLocked; },
    set(next) { if (LEVELS[next]) { level = next; userLocked = true; try { localStorage.setItem(KEY, next); } catch { /* ignore */ } apply(); } },
    // let the player return to automatic (clears their pin)
    setAuto() { userLocked = false; try { localStorage.removeItem(KEY); } catch { /* ignore */ } level = detect(); apply(); },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    update,
  };
}
