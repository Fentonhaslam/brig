// Full-screen login / enlist screen shown before the game canvas is revealed.
// Styled like a weathered ship's manifest — RuneScape-era vibes, pirate world.
// The 3D game warms up behind the overlay; when auth resolves the overlay lifts.
//
// EXPORT: createLoginScreen(onDone)
//   onDone({ session, handle } | null) is called once: null = guest.

import { supabase, online } from '../../net/supabase.js';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');

#ls {
  position: fixed; inset: 0; z-index: 999;
  display: flex; align-items: center; justify-content: center;
  background: #04090f;
  font-family: Georgia, 'Times New Roman', serif;
  overflow: hidden;
  transition: opacity .7s ease;
}

/* ocean floor background */
#ls::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 90% 60% at 50% 110%, rgba(12,40,80,.9) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 20% 80%,  rgba(8,25,50,.7)  0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 90%,  rgba(8,25,50,.7)  0%, transparent 60%),
    linear-gradient(180deg, #04090f 0%, #071420 40%, #0a1e32 100%);
  pointer-events: none;
}

/* misty waterline at the bottom */
#ls::after {
  content: '';
  position: absolute; bottom: 0; left: 0; right: 0; height: 220px;
  background: linear-gradient(0deg,
    rgba(15,50,90,.55) 0%,
    rgba(10,35,65,.3)  40%,
    transparent        100%);
  pointer-events: none;
}

/* stars */
#ls-stars {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    radial-gradient(1px 1px at 15%  8%, rgba(255,235,180,.7) 0%, transparent 100%),
    radial-gradient(1px 1px at 72% 12%, rgba(255,235,180,.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 42%  4%, rgba(255,235,180,.6) 0%, transparent 100%),
    radial-gradient(1px 1px at 89% 20%, rgba(255,235,180,.4) 0%, transparent 100%),
    radial-gradient(1px 1px at  6% 22%, rgba(255,235,180,.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 58%  9%, rgba(255,235,180,.3) 0%, transparent 100%),
    radial-gradient(1px 1px at 30% 16%, rgba(255,235,180,.6) 0%, transparent 100%),
    radial-gradient(1px 1px at 95%  5%, rgba(255,235,180,.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 50% 28%, rgba(255,235,180,.3) 0%, transparent 100%),
    radial-gradient(1px 1px at 78%  2%, rgba(255,235,180,.5) 0%, transparent 100%);
}

#ls-wrap {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center;
  width: min(400px, 94vw);
  gap: 0;
}

/* ─── logo ─── */
#ls-logo {
  text-align: center; margin-bottom: 28px; user-select: none;
}
#ls-logo .anchor { font-size: 28px; opacity: .8; letter-spacing: 30px; display: block; margin-bottom: 6px; }
#ls-logo h1 {
  margin: 0;
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(54px, 12vw, 84px);
  font-weight: 900;
  letter-spacing: 18px;
  color: #c8a050;
  text-shadow:
    0 0 40px rgba(200,160,80,.35),
    0 2px 0 rgba(0,0,0,.9),
    0 4px 20px rgba(0,0,0,.8);
  line-height: 1;
}
#ls-logo .sub {
  display: block; margin-top: 7px;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 11px; letter-spacing: 5px; text-transform: uppercase;
  color: rgba(200,170,110,.55);
}

/* ─── rope divider ─── */
.ls-rope {
  width: 100%; height: 14px; margin: 0 0 0;
  background:
    repeating-linear-gradient(90deg,
      rgba(160,120,60,.0)  0px,
      rgba(160,120,60,.25) 3px,
      rgba(100,75,35,.35)  6px,
      rgba(160,120,60,.25) 9px,
      rgba(160,120,60,.0)  12px);
  border-top: 1px solid rgba(160,120,60,.2);
  border-bottom: 1px solid rgba(160,120,60,.2);
}

/* ─── card ─── */
#ls-card {
  width: 100%; box-sizing: border-box;
  background: linear-gradient(180deg, #1c1208 0%, #120d06 60%, #0e0a05 100%);
  border: 1px solid rgba(200,160,90,.4);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 24px 28px 20px;
  box-shadow: 0 30px 80px rgba(0,0,0,.85), inset 0 1px 0 rgba(200,160,90,.1);
}
#ls-card-top {
  width: 100%; box-sizing: border-box;
  background: linear-gradient(180deg, #241808 0%, #1c1208 100%);
  border: 1px solid rgba(200,160,90,.4);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  padding: 16px 28px 0;
}
#ls-mode-btns {
  display: flex; gap: 0; border-bottom: 1px solid rgba(200,160,90,.25);
}
#ls-mode-btns button {
  flex: 1; padding: 10px 0; background: none; border: none; cursor: pointer;
  font: 600 11px system-ui; letter-spacing: 2.5px; text-transform: uppercase;
  color: rgba(200,170,110,.45); border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: color .2s, border-color .2s;
}
#ls-mode-btns button.on { color: #e8b860; border-bottom-color: #c8a050; }
#ls-mode-btns button:hover:not(.on) { color: rgba(200,170,110,.75); }

/* ─── welcome back state ─── */
#ls-welcome { text-align: center; padding: 8px 0 4px; }
#ls-welcome .ahoy { font-family: 'Cinzel', Georgia, serif; font-size: 13px; letter-spacing: 2px; color: rgba(200,170,110,.6); text-transform: uppercase; margin-bottom: 6px; }
#ls-welcome .wname { font-size: 22px; color: #e8b860; font-weight: 700; margin-bottom: 18px; }
#ls-welcome .enter {
  width: 100%; padding: 13px; font: 700 13px system-ui; letter-spacing: 2px; text-transform: uppercase;
  background: linear-gradient(180deg, #a07828, #6a4e14); color: #fff8e8;
  border: 1px solid #c8a050; border-radius: 5px; cursor: pointer;
  box-shadow: 0 4px 20px rgba(200,160,80,.2);
  transition: filter .15s;
}
#ls-welcome .enter:hover { filter: brightness(1.12); }
#ls-welcome .notme { margin-top: 12px; font-size: 12px; color: rgba(200,170,110,.45); cursor: pointer; text-decoration: underline; }
#ls-welcome .notme:hover { color: rgba(200,170,110,.75); }

/* ─── form fields ─── */
.ls-field {
  margin-bottom: 9px;
}
.ls-field label {
  display: block; font: 600 10px system-ui; letter-spacing: 2px; text-transform: uppercase;
  color: rgba(200,170,110,.5); margin-bottom: 4px;
}
.ls-field input {
  width: 100%; box-sizing: border-box;
  padding: 10px 12px; font: 15px Georgia, serif;
  background: rgba(0,0,0,.4); border: 1px solid rgba(200,160,90,.3);
  border-radius: 4px; color: #f4ead2; outline: none;
  transition: border-color .15s;
}
.ls-field input:focus { border-color: #c8a050; }
.ls-field input::placeholder { color: rgba(200,170,110,.3); }

/* ─── primary button ─── */
#ls-submit {
  width: 100%; margin-top: 6px; padding: 13px;
  font: 700 13px system-ui; letter-spacing: 2px; text-transform: uppercase;
  background: linear-gradient(180deg, #a07828, #6a4e14); color: #fff8e8;
  border: 1px solid #c8a050; border-radius: 5px; cursor: pointer;
  box-shadow: 0 4px 20px rgba(200,160,80,.15);
  transition: filter .15s;
}
#ls-submit:hover { filter: brightness(1.12); }
#ls-submit:disabled { opacity: .5; cursor: default; filter: none; }

/* ─── error / status ─── */
#ls-err { min-height: 16px; margin-top: 8px; font-size: 12px; color: #e88; text-align: center; }

/* ─── divider ─── */
.ls-sep {
  display: flex; align-items: center; gap: 10px; margin: 14px 0 10px;
  color: rgba(200,170,110,.25); font-size: 11px; letter-spacing: 2px;
}
.ls-sep::before, .ls-sep::after {
  content: ''; flex: 1; height: 1px; background: rgba(200,160,90,.2);
}

/* ─── footer ─── */
#ls-foot {
  margin-top: 16px; text-align: center;
  font-size: 11px; color: rgba(200,170,110,.3); letter-spacing: 1px;
}
`;

export function createLoginScreen(onDone) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'ls';
  el.innerHTML = `
    <div id="ls-stars"></div>
    <div id="ls-wrap">
      <div id="ls-logo">
        <span class="anchor">⚓</span>
        <h1>BRIG</h1>
        <span class="sub">Departure from Sevilla</span>
      </div>
      <div class="ls-rope"></div>
      <div id="ls-card-top">
        <div id="ls-mode-btns">
          <button data-mode="signin" class="on">Sign In</button>
          <button data-mode="signup">Enlist</button>
        </div>
      </div>
      <div id="ls-card">
        <div id="ls-welcome" style="display:none">
          <div class="ahoy">Welcome back</div>
          <div class="wname" id="ls-wname">sailor</div>
          <button class="enter" id="ls-enter">⚓ &nbsp;Enter the Sea</button>
          <div class="notme" id="ls-notme">Not you?</div>
        </div>
        <div id="ls-form">
          <div class="ls-field" id="ls-hfield" style="display:none">
            <label>Name to sail under</label>
            <input id="ls-handle" maxlength="24" placeholder="e.g. Fenton, Black Sal…" autocomplete="username" />
          </div>
          <div class="ls-field">
            <label>Email</label>
            <input id="ls-email" type="email" autocomplete="email" placeholder="your@email.com" />
          </div>
          <div class="ls-field">
            <label>Password</label>
            <input id="ls-pass" type="password" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <button id="ls-submit">Sign In</button>
          <div id="ls-err"></div>
        </div>
      </div>
      <div id="ls-foot">Anno Domini · Atlantic Crossing Simulator</div>
    </div>`;
  document.body.appendChild(el);

  const $ = (id) => el.querySelector(id);
  let mode = 'signin';

  function setErr(msg) { $('#ls-err').textContent = msg || ''; }

  function showWelcome(h) {
    $('#ls-wname').textContent = h;
    $('#ls-welcome').style.display = 'block';
    $('#ls-form').style.display = 'none';
    $('#ls-card-top').style.display = 'none';
  }

  function setMode(m) {
    mode = m;
    const isUp = m === 'signup';
    $('#ls-hfield').style.display = isUp ? 'block' : 'none';
    $('#ls-submit').textContent = isUp ? 'Enlist' : 'Sign In';
    el.querySelectorAll('#ls-mode-btns button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    setErr('');
    if (isUp) setTimeout(() => $('#ls-handle').focus(), 30);
    else setTimeout(() => $('#ls-email').focus(), 30);
  }

  el.querySelectorAll('#ls-mode-btns button').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });

  function dismiss(result) {
    el.style.opacity = '0';
    setTimeout(() => { el.remove(); style.remove(); onDone(result); }, 700);
  }

  $('#ls-enter').onclick = () => {
    supabase.auth.getSession().then(({ data }) => dismiss(data?.session ? { session: data.session, handle: handleOf(data.session) } : null));
  };

  $('#ls-notme').onclick = async () => {
    await supabase.auth.signOut();
    $('#ls-welcome').style.display = 'none';
    $('#ls-form').style.display = 'block';
    $('#ls-card-top').style.display = 'block';
    setTimeout(() => $('#ls-email').focus(), 30);
  };

  async function submit() {
    if (!online) { setErr('Backend not configured — play as guest.'); return; }
    const email = $('#ls-email').value.trim();
    const pass = $('#ls-pass').value;
    if (!email || !pass) { setErr('Email and password are required.'); return; }
    const btn = $('#ls-submit'); btn.disabled = true; setErr('…');
    try {
      if (mode === 'signup') {
        const h = $('#ls-handle').value.trim() || email.split('@')[0];
        const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { handle: h } } });
        if (error) throw error;
        if (!data.session) { setErr('Check your email to confirm, then sign in.'); btn.disabled = false; return; }
        dismiss({ session: data.session, handle: handleOf(data.session) });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        dismiss({ session: data.session, handle: handleOf(data.session) });
      }
    } catch (e) {
      setErr(e.message || 'Could not sign in — check your details.');
      btn.disabled = false;
    }
  }

  $('#ls-submit').onclick = submit;
  $('#ls-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  $('#ls-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (mode === 'signup') $('#ls-pass').focus(); else submit(); } });

  const handleOf = (s) => s?.user?.user_metadata?.handle || (s?.user?.email || 'sailor').split('@')[0];

  // check for an existing session immediately — show welcome-back state
  if (online) {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) showWelcome(handleOf(data.session));
      else setTimeout(() => $('#ls-email').focus(), 80);
    }).catch(() => setTimeout(() => $('#ls-email').focus(), 80));
  } else {
    setTimeout(() => $('#ls-email').focus(), 80);
  }
}
