// Branching conversation box. An NPC carries a dialogue graph (a map of node id
// -> { text, choices:[{label, to}] } plus a start node); `to: null` ends the
// talk. Choices are pickable by number key (1-3), by F (the first choice, to
// advance), by click, and Esc leaves. Routing of keys is done by main so there
// is a single keydown owner.

export function createDialogue() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:65;'
    + 'display:none;width:min(560px,92vw);font:16px/1.55 Georgia,serif;color:#f3e8cf;'
    + 'background:linear-gradient(180deg,rgba(30,23,13,.96),rgba(18,13,8,.98));'
    + 'padding:16px 20px 14px;border:1px solid rgba(190,158,96,.55);border-radius:9px;'
    + 'box-shadow:0 14px 44px rgba(0,0,0,.6)';
  document.body.appendChild(el);

  let npc = null, nodeId = null;

  function render() {
    const node = npc.tree[nodeId];
    const choices = node.choices.map((c, i) =>
      `<div class="dchoice" data-i="${i}" style="padding:7px 10px;margin-top:6px;cursor:pointer;`
      + `border:1px solid rgba(190,158,96,.3);border-radius:5px;background:rgba(0,0,0,.22);`
      + `font:15px Georgia,serif;color:#ecd9ab">`
      + `<b style="color:#e8b860">${i + 1}.</b> ${c.label}</div>`).join('');
    el.innerHTML =
      `<div style="color:#e8b860;font:600 13px system-ui;letter-spacing:.6px;margin-bottom:7px">`
      + `${npc.name.toUpperCase()} · ${npc.title}</div>`
      + `<div style="margin-bottom:4px">${node.text}</div>`
      + choices
      + `<div style="color:#9a8a66;font:11px system-ui;margin-top:9px">1–${node.choices.length} · click · Esc to leave</div>`;
    el.querySelectorAll('.dchoice').forEach((d) => {
      d.onmouseenter = () => { d.style.background = 'rgba(190,158,96,.18)'; };
      d.onmouseleave = () => { d.style.background = 'rgba(0,0,0,.22)'; };
      d.onclick = () => choose(+d.dataset.i);
    });
  }

  function open(n) { npc = n; nodeId = n.start; el.style.display = 'block'; render(); }
  function close() { npc = null; el.style.display = 'none'; }
  function choose(i) {
    if (!npc) return;
    const ch = npc.tree[nodeId].choices[i];
    if (!ch) return;
    if (ch.to == null) { close(); return; }
    nodeId = ch.to; render();
  }

  return { open, close, choose, get isOpen() { return !!npc; } };
}
