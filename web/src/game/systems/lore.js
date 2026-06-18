// The Chronicle as memory-stones. Every entry of the world's lore stands as a
// toon obelisk in the keep courtyard with its title floating above. Reads are
// open to everyone (the shared DB chronicle + a couple of founding tales +
// anything you've inscribed locally); writing a permanent, world-shared stone
// needs a login, so for guests we save the mark locally and raise the stone for
// this session, noting that signing in makes it permanent.

import {
  Group, Mesh, CylinderGeometry, ConeGeometry, BoxGeometry,
  Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace,
} from 'three';
import { withOutline } from '../core/toon.js';
import { pbrMaterial } from '../core/materials.js';
import { listLore, addLore } from '../../net/lore.js';

// founding inscriptions so the courtyard is never empty (offline / fresh DB)
const SEED = [
  { title: 'The Founding of Santo Domingo', author_handle: 'Fray Bartolomé',
    body: 'On this shore the first stone was laid, that those who cross the Ocean Sea might have a haven.' },
  { title: 'The First Crossing', author_handle: 'Maestre Alvarado',
    body: 'Forty days from Sevilla, the lookout cried land. We had not lost a soul.' },
];

const STONE = pbrMaterial(0x8f897c);
const STONE_LT = pbrMaterial(0x9f998c);
const PLAQUE = pbrMaterial(0x6a5a3a);

function labelSprite(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 24px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,5,3,0.85)';
  ctx.fillStyle = '#f0dca8';
  const t = text.length > 24 ? text.slice(0, 23) + '…' : text;
  ctx.strokeText(t, 128, 34); ctx.fillText(t, 128, 34);
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace;
  const sp = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.4, 0.85, 1);
  return sp;
}

export function createLore({ group, anchor, handle, key }) {
  const root = new Group();
  root.position.set(anchor.x, anchor.y, anchor.z);
  group.add(root);

  const entries = [];
  let session = null;
  let curHandle = handle;
  const LSKEY = 'brig:lore:' + key;
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LSKEY) || '[]'); } catch { return []; } };
  const saveLocal = (l) => { try { localStorage.setItem(LSKEY, JSON.stringify(l)); } catch {} };
  let localEntries = loadLocal();

  function makeStone(i, entry) {
    const col = i % 4, row = Math.floor(i / 4);
    const s = new Group();
    s.position.set((col - 1.5) * 3.0, 0, row * 3.0);
    s.rotation.y = (i % 2 ? 1 : -1) * 0.06;
    const shaft = new Mesh(new CylinderGeometry(0.34, 0.52, 2.3, 5), i % 2 ? STONE : STONE_LT);
    shaft.position.y = 1.15; shaft.castShadow = true; shaft.receiveShadow = true;
    withOutline(shaft, 0.04); s.add(shaft);
    const cap = new Mesh(new ConeGeometry(0.5, 0.55, 5), STONE_LT);
    cap.position.y = 2.55; cap.castShadow = true; s.add(cap);
    const plaque = new Mesh(new BoxGeometry(0.66, 0.5, 0.09), PLAQUE);
    plaque.position.set(0, 1.25, 0.5); plaque.castShadow = true; s.add(plaque);
    const label = labelSprite(entry.title);
    label.position.set(0, 3.25, 0);
    s.add(label);
    root.add(s);
  }

  function render() {
    while (root.children.length) root.remove(root.children[0]);
    entries.slice(0, 16).forEach((e, i) => makeStone(i, e));
  }

  // assemble: founding tales + local marks now; merge the shared DB when it loads
  entries.push(...SEED, ...localEntries);
  render();
  // key by DB id when present (so distinct tales that happen to share a
  // title+author don't collide), falling back to title|author for id-less
  // seed/local entries.
  const loreKey = (e) => (e.id ? 'id:' + e.id : 't:' + e.title + '|' + e.author_handle);
  listLore(100).then((rows) => {
    if (!rows || !rows.length) return;
    const seen = new Set(entries.map(loreKey));
    for (const r of rows) {
      const k = loreKey(r);
      if (!seen.has(k)) { entries.push(r); seen.add(k); }
    }
    render();
  }).catch(() => {});

  // raise a memory-stone. Signed in -> insert to the shared chronicle as the
  // real author (visible to everyone); guest -> save locally for this browser.
  // Returns a promise that resolves to {ok, error?} so the UI can show DB
  // errors (e.g. rate limit) instead of silently swallowing them.
  async function inscribe(title, body) {
    const t = title.trim(), b = body.trim();
    if (!t || !b) return { ok: false, error: 'A title and a tale are required.' };
    const entry = { title: t, body: b, author_handle: curHandle, local: !session };
    entries.push(entry); render();
    if (session) {
      try {
        const row = await addLore({ session, handle: curHandle, title: t, body: b, kind: 'monument' });
        // patch the optimistic entry with the real DB id so we can hide it later
        const idx = entries.indexOf(entry);
        if (idx >= 0 && row) entries[idx] = { ...entry, ...row };
      } catch (err) {
        // roll back the optimistic stone and bubble the error up
        const idx = entries.indexOf(entry);
        if (idx >= 0) entries.splice(idx, 1);
        render();
        return { ok: false, error: err?.message || 'Could not raise the stone.' };
      }
    } else {
      localEntries.push(entry); saveLocal(localEntries);
    }
    return { ok: true };
  }

  function setSession(s, h) { session = s; if (h) curHandle = h; }

  // moderation: drop a stone by DB id (admins hide via the moderation panel)
  function removeById(id) {
    const before = entries.length;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i] && entries[i].id === id) entries.splice(i, 1);
    }
    if (entries.length !== before) render();
  }

  return { inscribe, setSession, removeById, get count() { return entries.length; } };
}

// --- the inscribe panel (parchment) ----------------------------------------
export function createInscribePanel(onSubmit) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:95;'
    + 'display:none;width:min(460px,92vw);font:15px/1.5 Georgia,serif;color:#f3e8cf;'
    + 'background:linear-gradient(180deg,rgba(34,26,16,.98),rgba(20,15,9,.99));'
    + 'padding:20px 22px;border:1px solid rgba(180,150,90,.55);border-radius:10px;'
    + 'box-shadow:0 18px 50px rgba(0,0,0,.6)';
  el.innerHTML = `
    <div style="color:#e8b860;font:600 16px system-ui;letter-spacing:2px;margin-bottom:2px">RAISE A MEMORY-STONE</div>
    <div style="font-size:12px;opacity:.6;margin-bottom:12px">Inscribe a line into the chronicle of this world</div>
    <input id="lore-title" maxlength="60" placeholder="Title — e.g. The Storm off the Canaries"
      style="width:100%;box-sizing:border-box;padding:9px 11px;margin-bottom:8px;font:15px Georgia,serif;background:rgba(0,0,0,.3);border:1px solid rgba(200,160,90,.3);border-radius:4px;color:#f4ead2" />
    <textarea id="lore-body" maxlength="240" placeholder="Tell the tale…"
      style="width:100%;box-sizing:border-box;height:96px;resize:vertical;padding:9px 11px;font:15px/1.5 Georgia,serif;background:rgba(0,0,0,.3);border:1px solid rgba(200,160,90,.3);border-radius:4px;color:#f4ead2"></textarea>
    <div id="lore-err" style="min-height:18px;margin-top:8px;font:13px Georgia,serif;color:#e88;font-style:italic"></div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button id="lore-go" style="flex:1;padding:11px;font:600 13px system-ui;letter-spacing:1px;background:linear-gradient(180deg,#9a6a20,#6a4410);color:#fff3df;border:1px solid #c8a050;border-radius:5px;cursor:pointer">RAISE THE STONE</button>
      <button id="lore-x" style="padding:11px 16px;font:600 13px system-ui;background:rgba(0,0,0,.3);color:#d8c39a;border:1px solid rgba(180,150,90,.4);border-radius:5px;cursor:pointer">CLOSE</button>
    </div>
    <div style="font-size:11px;opacity:.55;margin-top:10px;font-style:italic">Saved to your log. Sign in to make it permanent for every sailor.</div>`;
  document.body.appendChild(el);

  const title = el.querySelector('#lore-title');
  const body = el.querySelector('#lore-body');
  const errEl = el.querySelector('#lore-err');
  const goEl = el.querySelector('#lore-go');
  let open = false;
  function show() { open = true; errEl.textContent = ''; el.style.display = 'block'; title.focus(); }
  function hide() { open = false; el.style.display = 'none'; }
  el.querySelector('#lore-x').onclick = hide;
  goEl.onclick = async () => {
    errEl.textContent = ''; goEl.disabled = true;
    try {
      const res = await onSubmit(title.value, body.value);
      // back-compat: legacy onSubmit returned a boolean
      if (res === true) { title.value = ''; body.value = ''; hide(); return; }
      if (res && res.ok) { title.value = ''; body.value = ''; hide(); return; }
      errEl.textContent = (res && res.error) || 'Could not raise the stone.';
    } finally { goEl.disabled = false; }
  };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
  return { show, hide, get isOpen() { return open; } };
}
