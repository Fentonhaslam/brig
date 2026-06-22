// In-game feedback — a "Feedback" button (bottom-right) that opens a small
// panel where ANY player can report a bug or suggest an improvement without
// leaving the game. Submissions go to the Supabase `feedback` table (no login
// required — frictionless; you review them in the Supabase dashboard or, as an
// admin, in-app). A little context (where you are, vessel, version, device) is
// attached automatically so reports are actionable. If Supabase isn't
// configured (offline build), or as an explicit alternative, the panel offers a
// one-click "open as a GitHub issue" link that prefills the report.
//
// EXPORT: createFeedback({ handle, playerKey, getContext, repo }) -> { open, close, isOpen }

import { supabase, online } from '../../net/supabase.js';

const REPO = 'Fentonhaslam/brig';
// injected by Vite (see vite.config.js); falls back to 'dev' outside a build
const VERSION = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';

const CSS = `
#fb-btn {
  position: fixed; bottom: 16px; right: 16px; z-index: 90;
  display: flex; align-items: center; gap: 7px;
  padding: 9px 14px; font: 600 13px system-ui, sans-serif; letter-spacing: .3px;
  color: #f3e8cf; background: rgba(10,30,45,.6); backdrop-filter: blur(3px);
  border: 1px solid rgba(190,158,96,.5); border-radius: 22px; cursor: pointer;
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
#fb-btn:hover { background: rgba(20,45,62,.75); border-color: rgba(190,158,96,.85); }
#fb {
  position: fixed; inset: 0; z-index: 96; display: none;
  align-items: center; justify-content: center;
  background: rgba(8,5,3,.6); backdrop-filter: blur(2px);
  font-family: 'Cormorant Garamond','Times New Roman',serif; color: #f1e3c4;
}
#fb.show { display: flex; }
#fb .card {
  width: min(460px, 92vw); position: relative;
  background: linear-gradient(180deg,#231708,#140c06);
  border: 1px solid rgba(200,160,90,.5); border-radius: 8px; padding: 22px 24px;
  box-shadow: 0 24px 90px rgba(0,0,0,.7);
}
#fb h2 { margin: 0 0 2px; font-size: 24px; letter-spacing: 2px; color: #e8b860; }
#fb .hint { font-size: 13px; opacity: .7; margin-bottom: 14px; }
#fb .seg { display: flex; gap: 8px; margin-bottom: 12px; }
#fb .seg button {
  flex: 1; padding: 9px 0; font: 600 13px system-ui; letter-spacing: .5px; cursor: pointer;
  color: #d8c39a; background: rgba(0,0,0,.25); border: 1px solid rgba(190,158,96,.3); border-radius: 6px;
}
#fb .seg button.on { color: #fff3df; background: linear-gradient(180deg,#7a5a20,#54380e); border-color: rgba(190,158,96,.85); }
#fb label { display: block; font: 600 11px system-ui; letter-spacing: 2px; text-transform: uppercase; opacity: .65; margin: 12px 0 4px; }
#fb textarea, #fb input {
  width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 15px; font-family: inherit;
  background: rgba(0,0,0,.3); border: 1px solid rgba(200,160,90,.3); border-radius: 5px; color: #f4ead2;
}
#fb textarea { height: 130px; resize: vertical; line-height: 1.45; }
#fb textarea:focus, #fb input:focus { outline: none; border-color: #c8a050; }
#fb .ctx { font-size: 12px; opacity: .55; margin-top: 8px; font-style: italic; }
#fb .row { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
#fb .send {
  padding: 11px 20px; font: 600 14px system-ui; letter-spacing: 1px; cursor: pointer;
  color: #fff3df; background: linear-gradient(180deg,#9a6a20,#6a4410); border: 1px solid #c8a050; border-radius: 5px;
}
#fb .send:hover { filter: brightness(1.12); }
#fb .send:disabled { opacity: .5; cursor: default; }
#fb .gh { font-size: 13px; color: #cdb079; text-decoration: underline; cursor: pointer; }
#fb .status { font-size: 13px; min-height: 18px; margin-top: 10px; }
#fb .status.ok { color: #9fd29a; } #fb .status.err { color: #e89; }
#fb .close { position: absolute; top: 14px; right: 18px; font: 600 11px system-ui; letter-spacing: 2px; opacity: .6; cursor: pointer; }
`;

export function createFeedback({ handle = '', playerKey = '', getContext = () => ({}), repo = REPO } = {}) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'fb-btn'; btn.title = 'Report a bug or suggest an improvement';
  btn.innerHTML = '<span>💬</span><span>Feedback</span>';
  document.body.appendChild(btn);

  const el = document.createElement('div');
  el.id = 'fb';
  el.innerHTML = `
    <div class="card">
      <div class="close">CLOSE · ESC</div>
      <h2>Send Feedback</h2>
      <div class="hint">Found a bug, or have an idea to make Brig better? Tell us — no account needed.</div>
      <div class="seg">
        <button data-kind="bug" class="on">🐞 Bug</button>
        <button data-kind="idea">💡 Improvement</button>
      </div>
      <label>Your message</label>
      <textarea id="fb-msg" maxlength="4000" placeholder="What happened, or what would you change?"></textarea>
      <label>Name (optional)</label>
      <input id="fb-name" maxlength="60" placeholder="So we can thank/credit you — optional" />
      <div class="ctx" id="fb-ctx"></div>
      <div class="row">
        <button class="send" id="fb-send">SEND</button>
        <span class="gh" id="fb-gh">…or open as a GitHub issue</span>
      </div>
      <div class="status" id="fb-status"></div>
    </div>`;
  document.body.appendChild(el);

  let kind = 'bug';
  const msgEl = el.querySelector('#fb-msg');
  const nameEl = el.querySelector('#fb-name');
  const ctxEl = el.querySelector('#fb-ctx');
  const sendEl = el.querySelector('#fb-send');
  const ghEl = el.querySelector('#fb-gh');
  const statusEl = el.querySelector('#fb-status');
  if (handle) nameEl.value = handle;

  el.querySelectorAll('.seg button').forEach((b) => {
    b.onclick = () => { kind = b.dataset.kind; el.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b)); };
  });

  // snapshot of where the player is + their environment, attached to the report
  function context() {
    const c = getContext() || {};
    return {
      place: c.place ?? null, vessel: c.vessel ?? null, atSea: c.atSea ?? null,
      version: VERSION, url: location.href,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      ua: navigator.userAgent,
    };
  }

  function setStatus(msg, cls = '') { statusEl.textContent = msg; statusEl.className = 'status ' + cls; }

  function open() {
    setStatus('');
    const c = getContext() || {};
    ctxEl.textContent = `Attached automatically: ${c.place || 'unknown spot'} · ${c.vessel || 'on foot'} · v${VERSION}`;
    el.classList.add('show'); setTimeout(() => msgEl.focus(), 30);
  }
  function close() { el.classList.remove('show'); }
  const isOpen = () => el.classList.contains('show');

  btn.onclick = open;
  el.querySelector('.close').onclick = close;
  el.addEventListener('click', (e) => { if (e.target === el) close(); }); // click backdrop to close
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });

  // open the same report prefilled as a GitHub issue (alternative + offline path)
  function githubUrl(msg) {
    const c = context();
    const body = `${msg}\n\n---\n_Context:_ ${c.place || '—'} · ${c.vessel || 'on foot'} · v${c.version}\n${c.screen} · ${c.ua}`;
    const title = `[${kind === 'bug' ? 'Bug' : 'Idea'}] ${msg.slice(0, 60)}`;
    return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}`
      + `&body=${encodeURIComponent(body)}&labels=${kind === 'bug' ? 'bug' : 'enhancement'}`;
  }
  ghEl.onclick = () => {
    const msg = msgEl.value.trim();
    if (!msg) { setStatus('Write your message first.', 'err'); return; }
    window.open(githubUrl(msg), '_blank', 'noopener');
  };

  sendEl.onclick = async () => {
    const msg = msgEl.value.trim();
    if (!msg) { setStatus('Please write a message.', 'err'); return; }
    if (!online || !supabase) {
      // offline build: fall back to the GitHub issue path
      setStatus('Opening a GitHub issue (offline)…', '');
      window.open(githubUrl(msg), '_blank', 'noopener');
      return;
    }
    sendEl.disabled = true; setStatus('Sending…');
    try {
      const { error } = await supabase.from('feedback').insert({
        kind, message: msg, handle: (nameEl.value.trim() || null), player_key: playerKey || null, context: context(),
      });
      if (error) throw error;
      setStatus('Thank you! Your feedback was sent. ⚓', 'ok');
      msgEl.value = '';
      setTimeout(close, 1400);
    } catch (e) {
      console.warn('[brig] feedback submit failed', e);
      setStatus('Could not send — try “open as a GitHub issue” instead.', 'err');
    } finally { sendEl.disabled = false; }
  };

  return { open, close, isOpen };
}
