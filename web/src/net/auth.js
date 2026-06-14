// Login / signup gate. Shows a period-styled sign-in screen, then resolves
// once the player is authenticated (or immediately, if running offline).

import { supabase, online } from './supabase.js';

const CSS = `
#auth {
  position: absolute; inset: 0; z-index: 200; display: flex;
  align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 35%, #2a1708 0%, #060403 80%);
  font-family: 'Cormorant Garamond','Times New Roman',serif; color: #f1e3c4;
  transition: opacity .6s ease;
}
#auth.hidden { opacity: 0; pointer-events: none; }
#auth .panel {
  width: min(420px, 86vw); padding: 34px 36px 30px;
  background: linear-gradient(180deg, rgba(30,20,11,.92), rgba(16,10,6,.96));
  border: 1px solid rgba(200,160,90,.45); border-radius: 6px;
  box-shadow: 0 20px 80px rgba(0,0,0,.7);
}
#auth .label { font-size: 11px; letter-spacing: 5px; opacity: .65; text-align:center; }
#auth h1 { font-size: 30px; letter-spacing: 5px; margin: 8px 0 4px; text-align:center; font-weight:500; }
#auth .sub { font-size: 13px; font-style: italic; opacity: .7; text-align:center; margin-bottom: 22px; }
#auth label { display:block; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity:.7; margin: 12px 0 4px; }
#auth input {
  width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 15px;
  background: rgba(0,0,0,.35); border: 1px solid rgba(200,160,90,.35);
  border-radius: 4px; color: #f4ead2; font-family: inherit;
}
#auth input:focus { outline: none; border-color: #c8a050; }
#auth .row-handle { display: none; }
#auth.signup .row-handle { display: block; }
#auth button {
  width: 100%; margin-top: 20px; padding: 12px; font-size: 15px; letter-spacing: 2px;
  background: linear-gradient(180deg,#9a6a20,#6a4410); color: #fff3df;
  border: 1px solid #c8a050; border-radius: 4px; cursor: pointer; font-family: inherit;
}
#auth button:hover { filter: brightness(1.12); }
#auth button:disabled { opacity: .5; cursor: default; }
#auth .toggle { margin-top: 16px; text-align:center; font-size: 13px; opacity:.8; }
#auth .toggle a { color:#e8b860; cursor:pointer; text-decoration: underline; }
#auth .err { margin-top: 14px; min-height: 18px; font-size: 13px; color:#e88; text-align:center; }
#auth .offline { margin-top: 18px; text-align:center; font-size:12px; opacity:.6; }
#auth .offline a { color:#cdbb88; cursor:pointer; text-decoration: underline; }
`;

export function mountAuth() {
  return new Promise((resolve) => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'auth';
    el.innerHTML = `
      <div class="panel">
        <div class="label">ANNO DOMINI · MDXIX</div>
        <h1>BRIG</h1>
        <div class="sub">Enlist for the voyage to the Indies</div>
        <div class="row-handle">
          <label>Name to sail under</label>
          <input id="auth-handle" type="text" autocomplete="nickname" maxlength="24" placeholder="e.g. Diego de Sevilla" />
        </div>
        <label>Email</label>
        <input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" />
        <label>Password</label>
        <input id="auth-pass" type="password" autocomplete="current-password" placeholder="••••••••" />
        <button id="auth-go">SIGN IN</button>
        <div class="toggle" id="auth-toggle">New hand? <a>Enlist a crew &amp; name</a></div>
        <div class="err" id="auth-err"></div>
        <div class="offline" id="auth-offline"></div>
      </div>`;
    document.body.appendChild(el);

    const $ = (id) => el.querySelector(id);
    const emailEl = $('#auth-email'), passEl = $('#auth-pass'), handleEl = $('#auth-handle');
    const goEl = $('#auth-go'), errEl = $('#auth-err'), toggleEl = $('#auth-toggle'), offlineEl = $('#auth-offline');
    let mode = 'signin';

    function finish(session) {
      el.classList.add('hidden');
      setTimeout(() => el.remove(), 700);
      resolve({ session });
    }

    // dev / guest bypass for quick looks (read-only, no account)
    if (location.hash.includes('guest')) { finish(null); return; }

    if (!online) {
      // No backend configured — let them in to explore solo.
      offlineEl.innerHTML = 'Backend not configured — <a>play offline</a>';
      offlineEl.querySelector('a').onclick = () => finish(null);
      goEl.disabled = true;
      errEl.textContent = 'Set VITE_SUPABASE_URL / VITE_SUPABASE_KEY to enable login.';
      return;
    }
    offlineEl.innerHTML = 'Just looking? <a>enter as guest</a>';
    offlineEl.querySelector('a').onclick = () => finish(null);

    function bindToggle() {
      toggleEl.querySelector('a').onclick = () => {
        mode = mode === 'signin' ? 'signup' : 'signin';
        el.classList.toggle('signup', mode === 'signup');
        goEl.textContent = mode === 'signup' ? 'ENLIST' : 'SIGN IN';
        toggleEl.innerHTML = mode === 'signup'
          ? 'Already enlisted? <a>Sign in</a>'
          : 'New hand? <a>Enlist a crew &amp; name</a>';
        bindToggle();
        errEl.textContent = '';
      };
    }
    bindToggle();

    async function submit() {
      const email = emailEl.value.trim();
      const password = passEl.value;
      if (!email || !password) { errEl.textContent = 'Email and password required.'; return; }
      goEl.disabled = true; errEl.textContent = '…';
      try {
        if (mode === 'signup') {
          const handle = handleEl.value.trim() || email.split('@')[0];
          const { data, error } = await supabase.auth.signUp({
            email, password, options: { data: { handle } },
          });
          if (error) throw error;
          if (!data.session) { // email confirmation required
            errEl.textContent = 'Check your email to confirm, then sign in.';
            goEl.disabled = false; return;
          }
          finish(data.session);
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          finish(data.session);
        }
      } catch (e) {
        errEl.textContent = e.message || 'Could not sign in.';
        goEl.disabled = false;
      }
    }

    goEl.onclick = submit;
    passEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

    // already signed in? skip straight through.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(data.session);
    });
  });
}

export async function currentProfile(session) {
  if (!online || !session) return null;
  const { data } = await supabase
    .from('profiles').select('id, handle').eq('id', session.user.id).single();
  return data || { id: session.user.id, handle: session.user.email.split('@')[0] };
}
