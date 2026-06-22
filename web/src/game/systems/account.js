// Account state — auth is handled by the login screen (loginscreen.js) before
// the game canvas appears. This module just: restores an existing session from
// supabase-js storage, fires onSignIn callbacks, and shows a small in-game
// status chip (handle + sign-out). Clicking sign-out reloads the page so the
// login screen shows fresh.

import { supabase, online } from '../../net/supabase.js';

export function createAccount() {
  let session = null, handle = null;
  const listeners = [];

  const handleOf = (s) => (s?.user?.user_metadata?.handle) || (s?.user?.email || 'sailor').split('@')[0];

  // small "⚓ handle" chip top-right; hidden until signed in
  const btn = document.createElement('button');
  btn.style.cssText = 'position:fixed;top:14px;right:106px;z-index:80;height:38px;padding:0 14px;'
    + 'display:none;border:none;border-radius:19px;font:600 13px system-ui;cursor:pointer;color:#f3e8cf;'
    + 'background:rgba(10,30,45,.55);backdrop-filter:blur(3px)';
  btn.title = 'Click to sign out';
  document.body.appendChild(btn);

  btn.onclick = () => {
    if (!session) return;
    if (!confirm('Sign out and return to the login screen?')) return;
    supabase.auth.signOut().finally(() => location.reload());
  };

  async function setSignedIn(s) {
    session = s; handle = handleOf(s);
    btn.textContent = '⚓ ' + handle;
    btn.style.display = '';
    let isAdmin = false;
    try {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', s.user.id).single();
      isAdmin = !!(data?.is_admin);
    } catch {}
    if (isAdmin) btn.textContent = '⚓ ' + handle + ' ✦';
    listeners.forEach((cb) => cb({ session, handle, userId: s.user.id, isAdmin }));
  }

  // pick up whatever session the login screen just established
  if (online) {
    supabase.auth.getSession()
      .then(({ data }) => { if (data?.session) setSignedIn(data.session); })
      .catch(() => {});
  }

  return {
    onSignIn(cb) { listeners.push(cb); if (session) cb({ session, handle, userId: session.user.id }); },
    openSignIn() {}, // no-op: auth is now via the login screen / page reload
    get session() { return session; },
    get handle() { return handle; },
  };
}
