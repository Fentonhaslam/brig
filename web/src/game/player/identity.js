// A stable per-browser identity so the player's handle and saved data persist
// across sessions (until a real login lands). Stored in localStorage; created
// once on first visit.

export function getIdentity() {
  let key = null, handle = null;
  try {
    key = localStorage.getItem('brig:key');
    handle = localStorage.getItem('brig:handle');
  } catch { /* private mode / disabled storage */ }

  if (!key) {
    key = 'guest-' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('brig:key', key); } catch {}
  }
  if (!handle) {
    handle = 'Sailor ' + (1000 + Math.floor(Math.random() * 9000));
    try { localStorage.setItem('brig:handle', handle); } catch {}
  }
  return { key, handle };
}

// Update the stored handle (used by the intro's name-entry). Returns the
// cleaned name actually stored.
export function setHandle(name) {
  const clean = String(name || '').trim().slice(0, 24) || ('Sailor ' + (1000 + Math.floor(Math.random() * 9000)));
  try { localStorage.setItem('brig:handle', clean); } catch {}
  return clean;
}
