// Admin moderation panel — recent lore entries with a Hide button. Opens on
// Shift+M for accounts where `profiles.is_admin = true`. Hidden rows are kept
// in the DB but stripped from public reads by RLS; this panel still sees them
// (and lets admins restore) because RLS exempts admins from the hide filter.

import { listLore, hideLore, unhideLore } from '../../net/lore.js';

const CSS = `
#brig-mod {
  position: fixed; inset: 0; z-index: 110; display: none;
  align-items: center; justify-content: center;
  background: rgba(6,8,14,.78); backdrop-filter: blur(3px);
  font: 14px Georgia, serif; color: #f1e3c4;
}
#brig-mod.show { display: flex; }
#brig-mod .panel {
  width: min(720px, 94vw); max-height: 80vh; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#231708,#140c06);
  border: 1px solid rgba(200,160,90,.55); border-radius: 8px; overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,.7);
}
#brig-mod header {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 14px 18px 10px; border-bottom: 1px solid rgba(200,160,90,.25);
}
#brig-mod h2 { margin: 0; font: 600 18px Georgia, serif; letter-spacing: 3px; color: #e8b860; }
#brig-mod .hint { font-size: 11px; opacity: .65; letter-spacing: 1px; }
#brig-mod .close { font-size: 12px; letter-spacing: 2px; opacity: .7; cursor: pointer; }
#brig-mod .list { padding: 6px 4px; overflow-y: auto; }
#brig-mod .row {
  display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start;
  padding: 10px 14px; border-bottom: 1px solid rgba(200,160,90,.12);
}
#brig-mod .row.hidden { opacity: .55; }
#brig-mod .t { font-size: 15px; color: #f0dca8; }
#brig-mod .b { font-size: 13px; opacity: .82; margin-top: 2px; font-style: italic; white-space: pre-wrap; }
#brig-mod .a { font-size: 11px; letter-spacing: 2px; opacity: .55; text-transform: uppercase; margin-top: 4px; }
#brig-mod .badge { display: inline-block; margin-left: 8px; padding: 1px 6px; font: 600 10px system-ui; letter-spacing: 1px; color: #1a0e02; background: #d8a346; border-radius: 3px; vertical-align: 2px; }
#brig-mod button {
  padding: 7px 12px; font: 600 11px system-ui; letter-spacing: 1px; cursor: pointer;
  background: rgba(0,0,0,.35); color: #f0dca8;
  border: 1px solid rgba(200,160,90,.4); border-radius: 4px;
}
#brig-mod button.danger { color: #ffd2c8; border-color: #a05444; }
#brig-mod button:hover { filter: brightness(1.15); }
#brig-mod .empty { padding: 30px 18px; text-align: center; opacity: .6; font-style: italic; }
`;

export function createModerationPanel({ onHide, onUnhide }) {
  const style = document.createElement('style');
  style.textContent = CSS; document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'brig-mod';
  el.innerHTML = `
    <div class="panel">
      <header>
        <div>
          <h2>MODERATE THE CHRONICLE</h2>
          <div class="hint">Admin only · Shift+M to toggle · Esc to close</div>
        </div>
        <div class="close">CLOSE</div>
      </header>
      <div class="list" id="brig-mod-list"><div class="empty">Loading…</div></div>
    </div>`;
  document.body.appendChild(el);

  const listEl = el.querySelector('#brig-mod-list');
  el.querySelector('.close').onclick = () => close();

  let open = false;
  let canMod = false;

  function fmt(ts) { try { return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function refresh() {
    listEl.innerHTML = '<div class="empty">Loading…</div>';
    const rows = await listLore(200);
    // newest first for moderation
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (!rows.length) {
      listEl.innerHTML = '<div class="empty">Nothing has been inscribed yet.</div>';
      return;
    }
    listEl.innerHTML = '';
    for (const r of rows) {
      const div = document.createElement('div');
      const hidden = !!r.hidden_at;
      div.className = 'row' + (hidden ? ' hidden' : '');
      div.innerHTML = `
        <div>
          <div class="t">${escapeHtml(r.title)}${hidden ? '<span class="badge">HIDDEN</span>' : ''}</div>
          <div class="b">${escapeHtml(r.body)}</div>
          <div class="a">${escapeHtml(r.author_handle)} · ${fmt(r.created_at)}</div>
        </div>
        <div><button class="${hidden ? '' : 'danger'}">${hidden ? 'RESTORE' : 'HIDE'}</button></div>`;
      const btn = div.querySelector('button');
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          if (hidden) { await unhideLore({ id: r.id }); onUnhide?.(r); }
          else        { await hideLore({ id: r.id });   onHide?.(r); }
          await refresh();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'FAILED';
          setTimeout(() => { btn.textContent = hidden ? 'RESTORE' : 'HIDE'; }, 1500);
        }
      };
      listEl.appendChild(div);
    }
  }

  function open_() { if (!canMod) return; open = true; el.classList.add('show'); refresh(); }
  function close()  { open = false; el.classList.remove('show'); }

  window.addEventListener('keydown', (e) => {
    // Shift+M toggles. Ignore when typing in inputs/textareas.
    if (e.key === 'Escape' && open) { close(); return; }
    if (e.shiftKey && (e.code === 'KeyM' || e.key === 'M' || e.key === 'm')) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (open) close(); else open_();
    }
  });

  return {
    setAdmin(v) { canMod = !!v; if (!canMod && open) close(); },
    open: open_,
    close,
    refresh,
    get isOpen() { return open; },
  };
}
