  // ================= habillage en images : « New Platformer Pack » de Kenney (licence CC0) =================
  // Les images sont regroupées dans un seul atlas intégré au fichier. Si elles ne chargent pas, l'ancien dessin reprend la main.
@@ATLAS@@
  const SKIN = { img: null, ok: false };
  try { if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { SKIN.ok = true; }; im.src = SKIN_SRC; SKIN.img = im; } } catch (e) {}
  const SKIN_SET = { 0: 'grass' };          // chapitres habillés (les autres suivront)
  let SKINNOW = false, SKINSET = 'grass';
  const skinFor = (w) => SKIN.ok && save.gfx !== 'classic' && SKIN_SET[w] != null;
  function spr(n, x, y, w, h) { const r = SKIN_MAP[n]; if (r) ctx.drawImage(SKIN.img, r[0], r[1], r[2], r[3], x, y, w, h); }
  // image posée sur « by », centrée sur « cx », proportions gardées
  function sprFit(n, cx, by, h, flip, g = ctx) {
    const r = SKIN_MAP[n]; if (!r) return 0;
    const w = (h * r[2]) / r[3];
    if (flip) { g.save(); g.translate(cx, 0); g.scale(-1, 1); g.drawImage(SKIN.img, r[0], r[1], r[2], r[3], -w / 2, by - h, w, h); g.restore(); }
    else g.drawImage(SKIN.img, r[0], r[1], r[2], r[3], cx - w / 2, by - h, w, h);
    return w;
  }
  const curLevel = () => (state === 'replay' ? RL : L);
  function skinBlock(b, ox, oy, cut = 0) {
    const Lx = curLevel();
    if (!b._nb && Lx) {
      const side = (o) => o !== b && !o.gate && !o.crusher && !o.ceil && !o.inv && o.y <= b.y + 1 && o.y + o.h >= b.y + b.h - 1;
      b._nb = { l: Lx.blocks.some((o) => side(o) && Math.abs(o.x + o.w - b.x) < 2), r: Lx.blocks.some((o) => side(o) && Math.abs(o.x - b.x - b.w) < 2) };
    }
    const nb = b._nb || {}, pre = 'terrain_' + SKINSET + '_', TS = 40;
    const x0 = b.x + ox, y0 = b.y + oy + cut, bh = b.h - cut;
    const floorY = Lx && Lx.by1 != null ? Lx.by1 : H, bottomOpen = b.y + b.h >= floorY - 2;
    const cols = Math.max(1, Math.round(b.w / TS)), thin = bh <= 44, rows = thin ? 1 : Math.max(2, Math.round(bh / TS));
    const xs = (i) => Math.round(x0 + (b.w * i) / cols), ys = (j) => Math.round(y0 + (bh * j) / rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const le = i === 0 && !nb.l, ri = i === cols - 1 && !nb.r;
      let n;
      if (thin) n = le && ri ? 'block' : le ? 'horizontal_left' : ri ? 'horizontal_right' : 'horizontal_middle';
      else {
        const top = j === 0 && !cut, bot = j === rows - 1 && !bottomOpen;
        if (le && ri) n = top ? 'vertical_top' : bot ? 'vertical_bottom' : 'vertical_middle';
        else { const v = top ? 'block_top' : bot ? 'block_bottom' : 'block'; n = v + (le ? '_left' : ri ? '_right' : v === 'block' ? '_center' : ''); }
      }
      const xa = xs(i), xb = xs(i + 1), ya = thin ? y0 : ys(j), yb = thin ? y0 + Math.max(bh, 34) : ys(j + 1);
      spr(pre + n, xa, ya, xb - xa + (i < cols - 1 ? 1 : 0), yb - ya + (j < rows - 1 ? 1 : 0));
    }
    // petites touches de décor sur les grands sols (identiques sur les vrais et les faux blocs)
    if (thin || cut || cols < 2 || !Lx) return;
    if (!b._deco) {
      b._deco = [];
      for (let i = 0; i < cols; i++) {
        const cxw = b.x + (b.w * (i + 0.5)) / cols, hs = hash(Math.round(cxw) * 7 + 13);
        const busy = [Lx.door, Lx.fake].some((d) => d && d.x - 40 < cxw && d.x + d.w + 40 > cxw) || Lx.props.some((p) => Math.abs(p.x - cxw) < 46);
        const k = hs < 0.16 ? 'grass' : hs < 0.22 ? 'mushroom_red' : hs < 0.26 ? 'rock' : hs < 0.3 ? 'mushroom_brown' : null;
        if (k && !busy) b._deco.push([cxw - b.x + (hash(i + Math.round(b.x)) - 0.5) * 14, k]);
      }
    }
    for (const [dx, k] of b._deco) {
      const ax = b.x + dx;
      if (Lx.spikes.some((s) => s.vis && s.rise > 0.2 && s.x - 14 < ax && s.x + s.w + 14 > ax && Math.abs(s.y + s.h - b.y) < 30)) continue;
      sprFit(k, x0 + dx, y0 + 4, k === 'grass' ? 22 : k === 'rock' ? 16 : 18);
    }
  }
  function skinSpring(b, ox, oy) {
    skinBlock(b, ox, oy, 16);
    const out = (b.squash || 0) > 0.2;
    sprFit(out ? 'spring_out' : 'spring', b.x + ox + b.w / 2, b.y + oy + 18, out ? 40 : 22);
  }
  function skinSpike(s) {
    const r = SKIN_MAP.spikes, n = Math.max(1, Math.round(s.w / 26)), tw = s.w / n, off = (1 - s.rise) * s.h;
    ctx.save();
    if (s.dir === 'down') { ctx.translate(0, 2 * s.y + s.h); ctx.scale(1, -1); }
    for (let k = 0; k < n; k++) ctx.drawImage(SKIN.img, r[0], r[1], r[2], r[3], s.x + k * tw, s.y + off, tw + 0.5, s.h);
    ctx.restore();
  }
  function skinDoor(d) {
    const h = d.h + 14, w = h * 0.5, x = d.x + d.w / 2 - w / 2, y = d.y + d.h - h;
    spr('door_open_top', x, y, w, h / 2 + 1); spr('door_open', x, y + h / 2, w, h / 2);
  }
  function skinCoin(c, x, y, t) {
    const sw = Math.abs(Math.cos(t * 4 + c.x * 0.05)), side = sw < 0.3, n = side ? 'coin_gold_side' : 'coin_gold', r = SKIN_MAP[n];
    const h = 24, w = side ? (h * r[2]) / r[3] : ((h * r[2]) / r[3]) * Math.max(0.3, sw);
    ctx.drawImage(SKIN.img, r[0], r[1], r[2], r[3], x - w / 2, y - h / 2, w, h);
    if (c.path && c.path.length) { ctx.fillStyle = COL.ink; ctx.fillRect(x - 4 * sw - 1, y - 3, 2, 3); ctx.fillRect(x + 3 * sw - 1, y - 3, 2, 3); }
  }
  function skinHeart(x, cy, s, empty) { const r = SKIN_MAP[empty ? 'hud_heart_empty' : 'hud_heart'], w = s * 1.1, h = (w * r[3]) / r[2]; ctx.drawImage(SKIN.img, r[0], r[1], r[2], r[3], x - w / 2, cy - h / 2, w, h); }
  function skinBackdrop(t, tier) {
    const dark = tier >= 2;
    ctx.globalAlpha = 0.92; ctx.fillStyle = dark ? '#c9d6ea' : '#ffffff';
    for (let k = 0; k < (dark ? 6 : 4); k++) {
      const x = ((k * 230 + t * (dark ? 18 : 10) * (1 + k * 0.3)) % (W + 200)) - 100, y = 84 + (k % 4) * 30;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.arc(x + 24, y - 8, 24, 0, Math.PI * 2); ctx.arc(x + 52, y, 18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const r = SKIN_MAP.bg_hills, s = 1.1, bw = r[2] * s, bh = r[3] * s, y = 190;
    for (let x = 0; x < W + 1; x += bw - 1) ctx.drawImage(SKIN.img, r[0], r[1], r[2], r[3], x, y, bw, bh);
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(0, y + bh - 1, W, H);
    const pit = ctx.createLinearGradient(0, G, 0, H); pit.addColorStop(0, 'rgba(18,60,44,.35)'); pit.addColorStop(1, 'rgba(18,40,40,.85)');
    ctx.fillStyle = pit; ctx.fillRect(0, G, W, H - G + 400);   // le fond des trous est sombre : on voit tout de suite que c'est le vide
    if (tier >= 2) {
      ctx.globalAlpha = 0.35; ctx.strokeStyle = COL.ink2; ctx.lineWidth = 2;
      for (let k = 0; k < (tier >= 3 ? 90 : 45); k++) {
        const x = (k * 97) % W, yy = frac(t * 1.4 + k * 0.137) * (G - 60) + 60;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - 4, yy + 12); ctx.stroke();
      }
    }
    if (tier >= 3 && frac(t * 0.35) < 0.05 && !save.noflash) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.95; ctx.strokeStyle = COL.paper; ctx.lineWidth = 5;
      const lx = 200 + (Math.floor(t * 0.35) * 311) % 560;
      ctx.beginPath(); ctx.moveTo(lx, 90); ctx.lineTo(lx - 22, 170); ctx.lineTo(lx + 10, 170); ctx.lineTo(lx - 16, 270); ctx.stroke();
    }
  }

