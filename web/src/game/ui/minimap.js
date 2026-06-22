// Voyage minimap — a small chart showing where you are on the crossing relative
// to Valdara and Puerto Dorado, with a heading arrow and a progress readout.
// The map is tall and thin (an ocean-spanning route), so it reads as a strip
// you work your way up as you sail west.

export function createMinimap(places, getShip) {
  const SIZE = 150, PAD = 18;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:14px;left:14px;z-index:70;width:' + SIZE + 'px;'
    + 'font:600 11px system-ui,sans-serif;color:#f3e8cf;text-align:center;pointer-events:none';
  const cv = document.createElement('canvas');
  cv.width = SIZE * dpr; cv.height = SIZE * dpr;
  cv.style.cssText = 'width:' + SIZE + 'px;height:' + SIZE + 'px;border-radius:10px;'
    + 'background:rgba(8,22,34,.68);backdrop-filter:blur(3px);border:1px solid rgba(190,158,96,.5);box-shadow:0 6px 20px rgba(0,0,0,.4)';
  const label = document.createElement('div');
  label.style.cssText = 'margin-top:5px;letter-spacing:.4px;text-shadow:0 1px 3px rgba(0,0,0,.6)';
  wrap.appendChild(cv); wrap.appendChild(label);
  document.body.appendChild(wrap);

  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);

  // fixed map bounds covering all places, padded — so the chart never jitters
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of places) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const m = 600; // margin in world units around the route
  minX -= m; maxX += m; minZ -= m; maxZ += m;
  const spanX = maxX - minX, spanZ = maxZ - minZ;

  // project world (x,z) -> canvas px. North (max z, the Indies) at the TOP.
  function proj(x, z) {
    const u = (x - minX) / spanX;
    const v = (z - minZ) / spanZ;
    return [PAD + u * (SIZE - 2 * PAD), (SIZE - PAD) - v * (SIZE - 2 * PAD)];
  }

  const from = places[0], to = places[places.length - 1];
  const routeLen = Math.hypot(to.x - from.x, to.z - from.z);

  // ── Town map (shown when berthed) ──────────────────────────────────────────
  // Draws a simple schematic of the active harbour in design space.
  // getPlayerDesign() → {x, z} in design coords (computed by main.js).

  let harbourInfo = null; // { kind, name, getPlayerDesign }

  function setBerthed(info) {
    harbourInfo = info; // null = at sea
  }

  function drawTown() {
    const { kind, name, getPlayerDesign } = harbourInfo;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // design-space extents for the map view
    const DX0 = -22, DX1 = 22, DZ0 = -8, DZ1 = 80;
    const spanDX = DX1 - DX0, spanDZ = DZ1 - DZ0;
    function dp(dx, dz) {
      return [
        PAD + ((dx - DX0) / spanDX) * (SIZE - 2 * PAD),
        (SIZE - PAD) - ((dz - DZ0) / spanDZ) * (SIZE - 2 * PAD),
      ];
    }
    function rect(dx, dz, w, h, fill) {
      const [x, y] = dp(dx - w / 2, dz + h / 2);
      const [x2, y2] = dp(dx + w / 2, dz - h / 2);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, x2 - x, y2 - y);
    }

    // sea/sky background
    ctx.fillStyle = '#07131e';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // quay deck
    rect(0, 11, 24, 22, '#3d2e1a');
    // street / avenue
    rect(0, 46, 8, 50, '#2a2010');
    // full ground area
    rect(0, 46, 46, 52, '#1e1a0f');

    if (kind === 'city') {
      // Valdara — cathedral, market area, plaza
      rect(0, 33, 10, 8, '#2e1f0c');      // plaza
      rect(0, 33, 1.2, 4.5, '#c8a050');   // cross upright
      rect(0, 33.4, 3.5, 0.8, '#c8a050'); // cross arm
      rect(-14, 40, 14, 8, '#28220f');    // market stalls L
      rect(14, 40, 14, 8, '#28220f');     // market stalls R
      rect(0, 65, 24, 24, '#2a1f0f');     // cathedral block
      rect(0, 65, 10, 32, '#332512');     // nave
    } else {
      // Puerto Dorado — keep
      rect(0, 36, 20, 14, '#302818');    // keep courtyard
      rect(0, 42, 10, 8, '#3a2a14');     // keep tower
      rect(-12, 22, 4, 8, '#1d3d1a');    // palms L
      rect(12, 22, 4, 8, '#1d3d1a');     // palms R
    }

    // quay edge line
    ctx.strokeStyle = 'rgba(200,160,90,.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([]);
    const [qx1, qy1] = dp(-12, 0); const [qx2, qy2] = dp(12, 0);
    ctx.beginPath(); ctx.moveTo(qx1, qy1); ctx.lineTo(qx2, qy2); ctx.stroke();

    // player dot
    const pd = getPlayerDesign();
    if (pd) {
      const [px, py] = dp(pd.x, pd.z);
      ctx.fillStyle = '#ff6a3c';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }

    label.textContent = name;
  }

  function update() {
    if (harbourInfo) { drawTown(); return; }
    // --- ocean crossing map (original) ---
    const s = getShip();
    ctx.clearRect(0, 0, SIZE, SIZE);
    const a = proj(from.x, from.z), b = proj(to.x, to.z);
    ctx.strokeStyle = 'rgba(220,190,120,.35)';
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.font = '600 10px system-ui';
    for (const p of places) {
      const [px, py] = proj(p.x, p.z);
      ctx.fillStyle = '#f0d68a'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8d49a'; ctx.lineWidth = 1.4; ctx.stroke();
      const ly = py + (p === to ? -8 : 14);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,12,18,.92)'; ctx.lineJoin = 'round';
      ctx.strokeText(p.name, px, ly); ctx.fillStyle = '#f6ecd2'; ctx.fillText(p.name, px, ly);
    }
    const [sx, sy] = proj(s.x, s.z);
    const ang = Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw));
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(-ang);
    ctx.fillStyle = '#ff6a3c';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    const prog = Math.max(0, Math.min(1, Math.hypot(s.x - from.x, s.z - from.z) / routeLen));
    label.textContent = 'Crossing the Ocean Sea · ' + Math.round(prog * 100) + '%';
  }

  return { update, setBerthed };
}
