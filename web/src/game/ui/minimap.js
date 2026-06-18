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

  function update() {
    const s = getShip();
    ctx.clearRect(0, 0, SIZE, SIZE);

    // route line
    const a = proj(from.x, from.z), b = proj(to.x, to.z);
    ctx.strokeStyle = 'rgba(220,190,120,.35)';
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.setLineDash([]);

    // ports — a dot with an outlined label so the names read over any sea colour
    ctx.textAlign = 'center';
    ctx.font = '600 10px system-ui';
    for (const p of places) {
      const [px, py] = proj(p.x, p.z);
      ctx.fillStyle = '#f0d68a';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8d49a'; ctx.lineWidth = 1.4; ctx.stroke();
      const ly = py + (p === to ? -8 : 14);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,12,18,.92)'; ctx.lineJoin = 'round';
      ctx.strokeText(p.name, px, ly);
      ctx.fillStyle = '#f6ecd2';
      ctx.fillText(p.name, px, ly);
    }

    // ship marker — a heading arrow (forward = +z)
    const [sx, sy] = proj(s.x, s.z);
    const ang = Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw)); // map heading
    ctx.save();
    ctx.translate(sx, sy);
    // +z is up on the map, so rotate the up-pointing arrow by -yaw
    ctx.rotate(-ang);
    ctx.fillStyle = '#ff6a3c';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();

    const prog = Math.max(0, Math.min(1, Math.hypot(s.x - from.x, s.z - from.z) / routeLen));
    label.textContent = 'Crossing the Ocean Sea · ' + Math.round(prog * 100) + '%';
  }

  return { update };
}
