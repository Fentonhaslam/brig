// A small top banner shown when the page is opened via the Twitch stream link
// (`?stream=1` or `#stream`). It nudges the viewer to sign in so their actions
// in the world persist — without blocking the game underneath. Dismisses on
// click, on sign-in, or once per session.

const SESSION_FLAG = 'brig:streamBannerSeen';

function isStreamArrival() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('stream') === '1') return true;
    if ((url.hash || '').toLowerCase().includes('stream')) return true;
  } catch {}
  return false;
}

export function createStreamWelcome({ onSignInClick }) {
  if (!isStreamArrival()) return { hide() {}, get visible() { return false; } };
  try { if (sessionStorage.getItem(SESSION_FLAG) === '1') return { hide() {}, get visible() { return false; } }; } catch {}

  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:14px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:130', 'max-width:560px', 'width:calc(100vw - 28px)',
    'font:14px/1.45 Georgia,serif', 'color:#f3e8cf',
    'background:linear-gradient(180deg,rgba(34,26,16,.98),rgba(20,15,9,.99))',
    'border:1px solid rgba(190,158,96,.6)', 'border-radius:10px',
    'padding:14px 18px', 'box-shadow:0 18px 50px rgba(0,0,0,.55)',
    'display:flex', 'align-items:center', 'gap:14px',
    'opacity:0', 'transition:opacity .5s ease',
  ].join(';');
  el.innerHTML = `
    <div style="font-size:24px;line-height:1">📺</div>
    <div style="flex:1;min-width:0">
      <div style="font:600 13px system-ui;letter-spacing:1.5px;color:#e8b860">YOU'RE WATCHING THE STREAM</div>
      <div style="margin-top:3px;opacity:.85">Sign in and your name, ship, and any stones you raise stay with you across every session.</div>
    </div>
    <button id="brig-sw-go" style="padding:10px 14px;font:600 12px system-ui;letter-spacing:1px;cursor:pointer;color:#fff3df;background:linear-gradient(180deg,#9a6a20,#6a4410);border:1px solid #c8a050;border-radius:6px;white-space:nowrap">SIGN IN</button>
    <div id="brig-sw-x" style="font:600 18px system-ui;color:#9a8a66;cursor:pointer;padding:0 4px;user-select:none">×</div>`;
  document.body.appendChild(el);

  requestAnimationFrame(() => { el.style.opacity = '1'; });

  function dismiss() {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
    try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch {}
  }

  el.querySelector('#brig-sw-go').onclick = () => {
    onSignInClick?.();
    dismiss();
  };
  el.querySelector('#brig-sw-x').onclick = dismiss;

  return {
    hide: dismiss,
    get visible() { return !!el.isConnected; },
  };
}
