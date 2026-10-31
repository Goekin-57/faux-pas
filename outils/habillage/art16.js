  // ================= images uniques du chapitre 1 (dessinées avec ChatGPT, préparées pour le jeu) =================
@@ART@@
  const ART = { img: null, far: null, mid: null, ok: false, n: 0 };
  try {
    if (typeof Image !== 'undefined') {
      const done = () => { if (++ART.n === 3) { ART.ok = true; try { phxBoot(); } catch (e) {} } };
      for (const [k, src] of [['img', ART_SRC], ['far', ART_FAR], ['mid', ART_MID]]) { const im = new Image(); im.onload = done; im.src = src; ART[k] = im; }
    }
  } catch (e) {}
  const ART_WORLDS = { 0: true };
  let ARTNOW = false;
  // image + rectangle d'une vignette : d'abord les images uniques, sinon le pack
  function frm(n) { if (ARTNOW && ART_MAP[n]) return [ART.img, ART_MAP[n]]; const r = SKIN_MAP[n]; return r ? [SKIN.img, r] : null; }
  // découpe d'un bloc avec les images uniques : bouts arrondis, bandeau d'herbe, terre à cailloux, contour
  function artTiles(b, Lx, cut = 0) {
    if (!b._nb && Lx) {
      const side = (o) => o !== b && !o.gate && !o.crusher && !o.ceil && !o.inv && o.y <= b.y + 1 && o.y + o.h >= b.y + b.h - 1;
      b._nb = { l: Lx.blocks.some((o) => side(o) && Math.abs(o.x + o.w - b.x) < 2), r: Lx.blocks.some((o) => side(o) && Math.abs(o.x - b.x - b.w) < 2) };
    }
    const nb = b._nb || {}, bh = b.h - cut, ops = [], w = b.w;
    const floorY = Lx && Lx.by1 != null ? Lx.by1 : H, bottomOpen = b.y + b.h >= floorY - 2;
    const row = (L, M, R, y, hgt) => {
      const sL = ART_MAP[L], sM = ART_MAP[M], sR = ART_MAP[R], k = hgt / sM[3];
      let wl = nb.l ? 0 : sL[2] * k, wr = nb.r ? 0 : sR[2] * k;
      if (wl + wr > w) { const f = w / (wl + wr); wl *= f; wr *= f; }
      if (wl) ops.push([L, 0, y, Math.round(wl) + 1, hgt]);
      const rem = w - Math.round(wl) - Math.round(wr);
      if (rem > 0) {
        const n = Math.max(1, Math.round(rem / (sM[2] * k)));
        for (let i = 0; i < n; i++) { const xa = Math.round(wl + (rem * i) / n), xb = Math.round(wl + (rem * (i + 1)) / n); ops.push([M, xa, y, xb - xa + 1, hgt]); }
      }
      if (wr) ops.push([R, w - Math.round(wr), y, Math.round(wr), hgt]);
    };
    if (bh <= 44 && !cut) { row('pf_l', 'pf_m', 'pf_r', 0, 44); if (!b._deco) b._deco = []; return ops; }
    const TH = 32, y1 = cut + TH - 2, bodyH = b.h - y1;
    if (bodyH > 0) {
      const d = ART_MAP.dirt, dw = d[2] * 0.52, dh = d[3] * 0.52, nx = Math.max(1, Math.round(w / dw)), ny = Math.max(1, Math.round(bodyH / dh));
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const xa = Math.round((w * i) / nx), xb = Math.round((w * (i + 1)) / nx), ya = y1 + Math.round((bodyH * j) / ny), yb = y1 + Math.round((bodyH * (j + 1)) / ny);
        ops.push(['dirt', xa, ya, xb - xa + 1, yb - ya + 1]);
      }
      if (!nb.l) ops.push(['ink', 0, y1, 3, bodyH]);
      if (!nb.r) ops.push(['ink', w - 3, y1, 3, bodyH]);
      if (!bottomOpen) ops.push(['ink', 0, b.h - 3, w, 3]);
    }
    if (!cut) row('top_l', 'top_m', 'top_r', 0, TH); else ops.push(['ink', 0, cut, w, 3]);
    if (!b._deco) {
      b._deco = [];
      const cols = Math.round(w / 40);
      if (!cut && cols >= 2 && Lx) for (let i = 0; i < cols; i++) {
        const cxw = b.x + (w * (i + 0.5)) / cols, hs = hash(Math.round(cxw) * 7 + 13);
        const busy = [Lx.door, Lx.fake].some((dd) => dd && dd.x - 50 < cxw && dd.x + dd.w + 50 > cxw) || Lx.props.some((p) => Math.abs(p.x - cxw) < 50);
        const kk = hs < 0.1 ? 'flower' : hs < 0.15 ? 'mushroom_red' : hs < 0.21 ? 'rock' : hs < 0.25 ? 'bush' : null;
        if (kk && !busy) b._deco.push([cxw - b.x + (hash(i + Math.round(b.x)) - 0.5) * 14, kk, { flower: 22, mushroom_red: 20, rock: 15, bush: 22 }[kk]]);
      }
    }
    return ops;
  }
  // fond en deux couches (lointain + arbres) quand Phaser n'est pas là
  function artBackdrop(lvl, t, tier) {
    const wide = lvl.bx1 - lvl.bx0 > W + 1, px = wide ? CAM.x - lvl.bx0 : 0, oy = -CAM.y * 0.3;
    const lay = (im, sz, s, par, y) => { const w = sz[0] * s, h = sz[1] * s; let x = -((px * par) % w); if (x > 0) x -= w; for (; x < W; x += w - 1) ctx.drawImage(im, x, y + oy, w, h); return y + oy + h; };
    const fb = lay(ART.far, ART_FAR_SIZE, 0.82, 0.12, G - ART_FAR_SIZE[1] * 0.82 + 24);
    ctx.fillStyle = '#22b268'; ctx.fillRect(0, fb - 1, W, H);
    const mb = lay(ART.mid, ART_MID_SIZE, 0.62, 0.3, G - ART_MID_SIZE[1] * 0.62 + 34);
    ctx.fillStyle = '#36c770'; ctx.fillRect(0, mb - 1, W, H);
    ctx.fillStyle = 'rgba(16,48,42,.62)'; ctx.fillRect(0, G - CAM.y, W, H + 400);
  }

