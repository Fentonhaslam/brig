// The Chronicle of the World — the keep's archive UI. Read every entry, and
// (when signed in) inscribe a new one, which saves to the DB and raises a
// memory-stone in the world for everyone.

import { addLore } from './lore.js';

const CSS = `
#chronicle {
  position: absolute; inset: 0; z-index: 60; display: none;
  align-items: center; justify-content: center;
  background: rgba(8,5,3,0.72); backdrop-filter: blur(2px);
  font-family: 'Cormorant Garamond','Times New Roman',serif; color: #f1e3c4;
}
#chronicle.show { display: flex; }
#chronicle .book {
  width: min(880px, 92vw); height: min(640px, 86vh); display: grid;
  grid-template-columns: 1fr 1fr; gap: 0;
  background: linear-gradient(180deg,#231708,#140c06);
  border: 1px solid rgba(200,160,90,.5); border-radius: 6px; overflow: hidden;
  box-shadow: 0 24px 90px rgba(0,0,0,.7);
}
#chronicle .col { padding: 22px 24px; overflow-y: auto; }
#chronicle .left { border-right: 1px solid rgba(200,160,90,.25); }
#chronicle h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: 3px; color:#e8b860; }
#chronicle .hint { font-size: 12px; opacity:.6; margin-bottom: 16px; letter-spacing:1px; }
#chronicle .entry { border-bottom: 1px solid rgba(200,160,90,.18); padding: 10px 0; }
#chronicle .entry .t { font-size: 17px; color:#f0dca8; }
#chronicle .entry .b { font-size: 14px; opacity:.85; font-style: italic; margin-top:3px; white-space: pre-wrap; }
#chronicle .entry .a { font-size: 11px; opacity:.5; letter-spacing:2px; text-transform: uppercase; margin-top:5px; }
#chronicle label { display:block; font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.7; margin:10px 0 4px; }
#chronicle input, #chronicle textarea {
  width:100%; box-sizing:border-box; padding:9px 11px; font-size:15px; font-family:inherit;
  background: rgba(0,0,0,.3); border:1px solid rgba(200,160,90,.3); border-radius:4px; color:#f4ead2;
}
#chronicle textarea { height: 200px; resize: vertical; line-height:1.5; }
#chronicle input:focus, #chronicle textarea:focus { outline:none; border-color:#c8a050; }
#chronicle button {
  margin-top:14px; padding:11px 16px; font-size:14px; letter-spacing:2px; font-family:inherit;
  background: linear-gradient(180deg,#9a6a20,#6a4410); color:#fff3df; border:1px solid #c8a050;
  border-radius:4px; cursor:pointer;
}
#chronicle button:hover { filter: brightness(1.12); }
#chronicle .close { position:absolute; top:18px; right:24px; font-size:13px; letter-spacing:3px; opacity:.7; cursor:pointer; }
#chronicle .ro { font-size:13px; opacity:.7; font-style:italic; }
`;

export function mountChronicle({ session, handle, online, onInscribe }) {
  const style = document.createElement('style');
  style.textContent = CSS; document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'chronicle';
  const canWrite = online && session;
  el.innerHTML = `
    <div class="book">
      <div class="close">CLOSE · ESC</div>
      <div class="col left">
        <h2>The Chronicle</h2>
        <div class="hint">The recorded history of this world</div>
        <div id="chron-list"></div>
      </div>
      <div class="col right">
        <h2>Inscribe</h2>
        <div class="hint">Add to the lore — a memory-stone will rise in the keep</div>
        ${canWrite ? `
          <label>Title</label>
          <input id="chron-title" maxlength="140" placeholder="e.g. The Founding of Santo Domingo" />
          <label>Account</label>
          <textarea id="chron-body" maxlength="8000" placeholder="Tell the tale..."></textarea>
          <button id="chron-go">RAISE THE STONE</button>
          <div id="chron-err" class="ro" style="color:#e88;margin-top:8px;min-height:16px;"></div>
        ` : `<div class="ro">Sign in to add to the Chronicle.</div>`}
      </div>
    </div>`;
  document.body.appendChild(el);

  const listEl = el.querySelector('#chron-list');
  const seen = new Set();

  function fmt(ts) { try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } }

  function addToList(entry, prepend = true) {
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `<div class="t"></div><div class="b"></div><div class="a"></div>`;
    div.querySelector('.t').textContent = entry.title;
    div.querySelector('.b').textContent = entry.body;
    div.querySelector('.a').textContent = `${entry.author_handle} · ${fmt(entry.created_at)}`;
    if (prepend && listEl.firstChild) listEl.insertBefore(div, listEl.firstChild);
    else listEl.appendChild(div);
  }

  function open() { el.classList.add('show'); }
  function close() { el.classList.remove('show'); }
  el.querySelector('.close').onclick = close;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  if (canWrite) {
    const titleEl = el.querySelector('#chron-title');
    const bodyEl = el.querySelector('#chron-body');
    const goEl = el.querySelector('#chron-go');
    const errEl = el.querySelector('#chron-err');
    goEl.onclick = async () => {
      const title = titleEl.value.trim(), body = bodyEl.value.trim();
      if (!title || !body) { errEl.textContent = 'A title and an account are required.'; return; }
      goEl.disabled = true; errEl.textContent = '…';
      try {
        const row = await addLore({ session, handle, title, body, kind: 'monument' });
        addToList(row);
        onInscribe?.(row);
        titleEl.value = ''; bodyEl.value = ''; errEl.textContent = 'Inscribed.';
      } catch (e) {
        errEl.textContent = e.message || 'Could not inscribe.';
      } finally { goEl.disabled = false; }
    };
  }

  return { open, close, addToList, isOpen: () => el.classList.contains('show') };
}
