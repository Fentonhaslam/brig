// The opening — making the start feel like entering a world, not loading a demo.
// First visit only (persists a seen-once flag): a name-entry card, then a short
// letterbox cinematic that sweeps over the Sevilla quay, then it hands you the
// first objective and a proximity-driven onboarding guide (find the
// harbourmaster -> cross to Triana -> reach the shipwright). Returning players
// skip straight in. Cheap DOM + a self-contained rAF for the camera move.

import { setHandle } from '../player/identity.js';

export function createIntro({ orbit, onReady, onName }) {
  const SEEN = 'brig:introSeen';
  let seen = false;
  try { seen = localStorage.getItem(SEEN) === '1'; } catch {}
  let active = false;          // true while the name card / cinematic hold control

  // --- letterbox bars + caption ---
  const mkBar = (top) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:0;right:0;${top ? 'top' : 'bottom'}:0;height:0;background:#000;z-index:88;transition:height .7s ease;pointer-events:none`; document.body.appendChild(d); return d; };
  const barT = mkBar(true), barB = mkBar(false);
  const caption = document.createElement('div');
  caption.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:89;color:#f3e8cf;'
    + 'font:600 21px Georgia,serif;text-shadow:0 2px 12px rgba(0,0,0,.9);opacity:0;transition:opacity .7s;text-align:center;pointer-events:none;max-width:80vw';
  document.body.appendChild(caption);
  const setBars = (h) => { barT.style.height = h; barB.style.height = h; };
  const say = (txt) => { caption.textContent = txt; caption.style.opacity = txt ? '1' : '0'; };

  // --- name-entry card ---
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:95;display:none;align-items:center;justify-content:center;'
    + 'background:radial-gradient(circle at 50% 38%,rgba(22,30,44,.55),rgba(8,10,16,.93));backdrop-filter:blur(2px)';
  overlay.innerHTML = `
    <div style="width:min(440px,92vw);text-align:center;font-family:Georgia,serif;color:#f3e8cf;
                background:linear-gradient(180deg,rgba(34,26,16,.96),rgba(18,13,8,.98));
                padding:30px 30px 26px;border:1px solid rgba(190,158,96,.55);border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.6)">
      <div style="font:800 40px Georgia,serif;letter-spacing:6px;color:#e8c87a">BRIG</div>
      <div style="font:600 12px system-ui;letter-spacing:2px;color:#c9a96a;margin-top:4px">SEVILLA · 1519 · GATEWAY TO THE INDIES</div>
      <p style="font-size:14px;line-height:1.6;opacity:.85;margin:18px 4px 16px">
        You step off the river barge with empty pockets and a head full of the Ocean Sea.
        No ship, no name yet worth knowing — only a city of merchants, friars and shipwrights,
        and the long road to a boat of your own. What do they call you?</p>
      <input id="brig-name" maxlength="24" placeholder="Your name" autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:11px 13px;font:16px Georgia,serif;color:#1a1410;
               background:#e9dcb8;border:1px solid #b8923f;border-radius:6px;text-align:center;outline:none">
      <button id="brig-begin"
        style="margin-top:16px;width:100%;padding:12px;font:700 15px system-ui;letter-spacing:.5px;cursor:pointer;
               color:#fff3df;background:linear-gradient(180deg,#7a5a20,#54380e);border:1px solid #b8923f;border-radius:7px">
        Step ashore</button>
      <div id="brig-skip" style="margin-top:12px;font:12px system-ui;color:#9a8a66;cursor:pointer;text-decoration:underline">Skip the introduction</div>
    </div>`;
  document.body.appendChild(overlay);
  const nameInput = overlay.querySelector('#brig-name');
  const beginBtn = overlay.querySelector('#brig-begin');
  const skipLink = overlay.querySelector('#brig-skip');

  function finishSeen() { try { localStorage.setItem(SEEN, '1'); } catch {} seen = true; }

  function runCinematic() {
    active = true;
    setBars('10vh');
    orbit.setRadius(58); orbit.setPitch(1.0);
    const yaw0 = orbit.yaw;
    const t0 = performance.now();
    const DUR = 4200;
    say('Sevilla — where every voyage to the New World begins.');
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - k, 3); // ease-out
      orbit.setYaw(yaw0 + 0.9 * e);                 // slow establishing orbit
      orbit.setRadius(58 - (58 - 13) * e);          // sweep down to the walk view
      orbit.setPitch(1.0 - (1.0 - 0.42) * e);
      if (k > 0.5 && caption.textContent.startsWith('Sevilla')) say('Make your fortune ashore — and earn your passage across the sea.');
      if (k < 1) requestAnimationFrame(tick);
      else {
        say(''); setBars('0');
        active = false;
        if (onReady) onReady();   // hand off to the quest system
      }
    };
    requestAnimationFrame(tick);
  }

  function begin(skip) {
    const name = setHandle(nameInput.value);
    if (onName) onName(name);
    overlay.style.display = 'none';
    finishSeen();
    if (skip) { active = false; setBars('0'); say(''); if (onReady) onReady(); }
    else runCinematic();
  }
  beginBtn.addEventListener('click', () => begin(false));
  skipLink.addEventListener('click', () => begin(true));
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') begin(false); });

  // first visit -> show the card (and hold control); returning -> straight in
  function maybeRun() {
    if (seen) return false;
    active = true;
    overlay.style.display = 'flex';
    setTimeout(() => nameInput.focus(), 50);
    return true;
  }

  return { maybeRun, get active() { return active; }, get seen() { return seen; } };
}
