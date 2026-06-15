// Optional, non-blocking sign-in. Guests play freely; a small "Sign in" button
// (top-right) opens a panel for email + password (with an enlist/sign-up
// toggle). Signing in never interrupts the game — it just upgrades your saves:
// main wires onSignIn() to tie inventory + lore to the account. If already
// signed in from a previous visit, it restores silently on load.

import { supabase, online } from '../../net/supabase.js';

export function createAccount() {
  let session = null, handle = null;
  const listeners = [];

  const handleOf = (s) => (s?.user?.user_metadata?.handle) || (s?.user?.email || 'sailor').split('@')[0];

  const btn = document.createElement('button');
  btn.style.cssText = 'position:fixed;top:14px;right:106px;z-index:80;height:38px;padding:0 14px;'
    + 'border:none;border-radius:19px;font:600 13px system-ui;cursor:pointer;color:#f3e8cf;'
    + 'background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  btn.textContent = 'Sign in';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:60px;right:14px;z-index:96;display:none;width:300px;'
    + 'font:14px Georgia,serif;color:#f3e8cf;background:linear-gradient(180deg,rgba(32,24,14,.98),rgba(18,13,8,.99));'
    + 'padding:16px 16px 14px;border:1px solid rgba(190,158,96,.55);border-radius:9px;box-shadow:0 14px 40px rgba(0,0,0,.6)';
  const I = 'width:100%;box-sizing:border-box;padding:8px 10px;margin-bottom:7px;font:14px Georgia,serif;background:rgba(0,0,0,.3);border:1px solid rgba(200,160,90,.3);border-radius:4px;color:#f4ead2';
  panel.innerHTML = `
    <div style="color:#e8b860;font:600 13px system-ui;letter-spacing:1px;margin-bottom:8px">SIGN IN</div>
    <div id="ac-hrow" style="display:none"><input id="ac-handle" maxlength="24" placeholder="Name to sail under" style="${I}" /></div>
    <input id="ac-email" type="email" autocomplete="email" placeholder="Email" style="${I}" />
    <input id="ac-pass" type="password" autocomplete="current-password" placeholder="Password" style="${I}" />
    <button id="ac-go" style="width:100%;padding:10px;font:600 13px system-ui;letter-spacing:1px;background:linear-gradient(180deg,#9a6a20,#6a4410);color:#fff3df;border:1px solid #c8a050;border-radius:5px;cursor:pointer">SIGN IN</button>
    <div id="ac-toggle" style="margin-top:10px;font-size:12px;opacity:.85">New hand? <a style="color:#e8b860;cursor:pointer;text-decoration:underline">Enlist</a></div>
    <div id="ac-err" style="margin-top:8px;min-height:15px;font-size:12px;color:#e88"></div>
    <div style="margin-top:6px;font-size:11px;opacity:.55;font-style:italic">Guests keep their progress locally — signing in saves it to your account across devices.</div>`;
  document.body.appendChild(panel);

  const $ = (s) => panel.querySelector(s);
  let mode = 'signin', open = false;
  const show = () => { open = true; panel.style.display = 'block'; $('#ac-email').focus(); };
  const hide = () => { open = false; panel.style.display = 'none'; };

  function setSignedIn(s) {
    session = s; handle = handleOf(s);
    btn.textContent = '⚓ ' + handle;
    hide();
    listeners.forEach((cb) => cb({ session, handle, userId: s.user.id }));
  }

  btn.onclick = () => {
    if (session) { // already in → sign out
      supabase.auth.signOut().catch(() => {});
      session = null; handle = null; btn.textContent = 'Sign in';
      return;
    }
    if (!online) { $('#ac-err').textContent = 'Backend not configured.'; }
    open ? hide() : show();
  };

  function toggleMode() {
    mode = mode === 'signin' ? 'signup' : 'signin';
    $('#ac-hrow').style.display = mode === 'signup' ? 'block' : 'none';
    $('#ac-go').textContent = mode === 'signup' ? 'ENLIST' : 'SIGN IN';
    $('#ac-toggle').innerHTML = mode === 'signup'
      ? 'Already enlisted? <a style="color:#e8b860;cursor:pointer;text-decoration:underline">Sign in</a>'
      : 'New hand? <a style="color:#e8b860;cursor:pointer;text-decoration:underline">Enlist</a>';
    $('#ac-toggle').querySelector('a').onclick = toggleMode; // rebind after innerHTML swap
  }
  $('#ac-toggle').querySelector('a').onclick = toggleMode;

  async function submit() {
    if (!online) return;
    const email = $('#ac-email').value.trim(), password = $('#ac-pass').value;
    if (!email || !password) { $('#ac-err').textContent = 'Email and password required.'; return; }
    const go = $('#ac-go'); go.disabled = true; $('#ac-err').textContent = '…';
    try {
      if (mode === 'signup') {
        const h = $('#ac-handle').value.trim() || email.split('@')[0];
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { handle: h } } });
        if (error) throw error;
        if (!data.session) { $('#ac-err').textContent = 'Check your email to confirm, then sign in.'; go.disabled = false; return; }
        setSignedIn(data.session);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSignedIn(data.session);
      }
    } catch (e) {
      $('#ac-err').textContent = e.message || 'Could not sign in.';
    } finally { go.disabled = false; }
  }
  $('#ac-go').onclick = submit;
  $('#ac-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  // restore an existing session silently
  if (online) supabase.auth.getSession().then(({ data }) => { if (data.session) setSignedIn(data.session); }).catch(() => {});

  return {
    onSignIn(cb) { listeners.push(cb); if (session) cb({ session, handle, userId: session.user.id }); },
    get session() { return session; },
    get handle() { return handle; },
  };
}
