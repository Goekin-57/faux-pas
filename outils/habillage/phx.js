  // ================= rendu Phaser (WebGL) — chapitre 1 =================
  // La logique du jeu (physique, pièges, niveaux) ne change pas. Phaser dessine le ciel, les collines en parallaxe,
  // le sol, les pics et les effets (poussière, éclats, vignette). Le reste passe par deux calques « canvas » que Phaser affiche.
  const PHX = { game: null, scene: null, ready: false, holder: null, back: null, front: null, bimg: null, fimg: null, blocks: new Map(), spikes: new Map(), lvl: null, prev: {}, fx: {} };
  const phxWorld = (w) => w === 0;
  const phxColor = (c) => { const r = phxRgb(c); return (r[0] << 16) | (r[1] << 8) | r[2]; };
  function phxRgb(col) {
    const m = /^#([0-9a-f]{6})$/i.exec(col); if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const k = /rgba?\(([^)]+)\)/.exec(col); if (k) return k[1].split(',').slice(0, 3).map((v) => +v);
    return [168, 228, 255];
  }
  function phxBoot() {
    if (PHX.game || typeof Phaser === 'undefined' || !SKIN.ok || !ART.ok || !stageEl) return;
    try { stageEl.style.isolation = 'isolate'; } catch (e) {}
    const holder = document.createElement('div'); holder.id = 'phx';
    Object.assign(holder.style, { position: 'absolute', zIndex: '-1', pointerEvents: 'none', left: '0px', top: '0px', overflow: 'hidden' });
    stageEl.insertBefore(holder, cv); PHX.holder = holder;
    PHX.game = new Phaser.Game({
      type: Phaser.WEBGL, parent: holder, width: cv.width || W, height: cv.height || H, backgroundColor: '#a8e4ff', banner: false,
      audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false, gamepad: false }, scale: { mode: Phaser.Scale.NONE },
      render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
      scene: { create() { PHX.scene = this; phxCreate(this); } },
    });
  }
  function phxCreate(sc) {
    const tex = sc.textures.addImage('skin', SKIN.img);
    for (const [n, r] of Object.entries(SKIN_MAP)) tex.add(n, 0, r[0], r[1], r[2], r[3]);
    const atex = sc.textures.addImage('art', ART.img);
    for (const [n, r] of Object.entries(ART_MAP)) atex.add(n, 0, r[0], r[1], r[2], r[3]);
    sc.textures.addImage('artfar', ART.far); sc.textures.addImage('artmid', ART.mid);
    // textures simples pour les effets
    const g = sc.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8); g.generateTexture('dot', 16, 16); g.clear();
    g.fillStyle(0xffffff, 1); g.fillCircle(20, 26, 20); g.fillCircle(44, 18, 24); g.fillCircle(72, 26, 18); g.fillRect(20, 26, 52, 20); g.generateTexture('cloud', 92, 50); g.clear();
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('chip', 4, 4); g.destroy();
    const cam = sc.cameras.main; cam.setOrigin(0, 0);
    // ciel (dégradé redessiné à chaque niveau)
    PHX.sky = sc.add.graphics().setScrollFactor(0).setDepth(0);
    // collines lointaines (pâles) puis proches, en parallaxe
    const hr = SKIN_MAP.bg_hills;
    PHX.far = sc.add.tileSprite(0, 0, W / 0.8 + 2, hr[3], 'skin', 'bg_hills').setOrigin(0, 0).setScrollFactor(0).setDepth(1).setScale(0.8).setTint(0xcfe8ff).setAlpha(0.55);
    PHX.near = sc.add.tileSprite(0, 0, W / 1.1 + 2, hr[3], 'skin', 'bg_hills').setOrigin(0, 0).setScrollFactor(0).setDepth(2).setScale(1.1);
    PHX.fill = sc.add.rectangle(0, 0, W, H, 0x2ecc71).setOrigin(0, 0).setScrollFactor(0).setDepth(2);
    // images uniques : panorama lointain + bande d'arbres
    const fs = 0.82, ms = 0.62;
    PHX.afar = sc.add.tileSprite(0, 0, W / fs + 2, ART_FAR_SIZE[1], 'artfar').setOrigin(0, 0).setScrollFactor(0).setDepth(1).setScale(fs);
    PHX.afarFill = sc.add.rectangle(0, 0, W, H, 0x22b268).setOrigin(0, 0).setScrollFactor(0).setDepth(1);
    PHX.amid = sc.add.tileSprite(0, 0, W / ms + 2, ART_MID_SIZE[1], 'artmid').setOrigin(0, 0).setScrollFactor(0).setDepth(2).setScale(ms);
    PHX.amidFill = sc.add.rectangle(0, 0, W, H, 0x36c770).setOrigin(0, 0).setScrollFactor(0).setDepth(2);
    PHX.clouds = [];
    for (let k = 0; k < 5; k++) PHX.clouds.push(sc.add.image(0, 0, 'cloud').setOrigin(0, 0).setScrollFactor(0).setDepth(1.5).setAlpha(0.95));
    PHX.pit = sc.add.rectangle(0, 0, W, H + 400, 0x10302a, 0.62).setOrigin(0, 0).setScrollFactor(0).setDepth(3);
    // calques du jeu d'origine
    PHX.back = sc.textures.createCanvas('legacyBack', cv.width || W, cv.height || H);
    PHX.front = sc.textures.createCanvas('legacyFront', cv.width || W, cv.height || H);
    PHX.bimg = sc.add.image(0, 0, 'legacyBack').setOrigin(0, 0).setScrollFactor(0).setDepth(4);
    PHX.fimg = sc.add.image(0, 0, 'legacyFront').setOrigin(0, 0).setScrollFactor(0).setDepth(20);
    // effets
    const burstCfg = (o) => Object.assign({ lifespan: 500, speed: { min: 40, max: 140 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, gravityY: 400, emitting: false }, o);
    PHX.fx.dust = sc.add.particles(0, 0, 'dot', burstCfg({ angle: { min: 190, max: 350 }, speed: { min: 30, max: 110 }, tint: 0xf3e2c6, scale: { start: 0.55, end: 0 }, gravityY: -40, lifespan: 420 })).setDepth(21);
    PHX.fx.spark = sc.add.particles(0, 0, 'dot', burstCfg({ angle: { min: 0, max: 360 }, speed: { min: 60, max: 200 }, tint: [0xffd23f, 0xfff6c8, 0xffffff], scale: { start: 0.4, end: 0 }, gravityY: 120, blendMode: 'ADD' })).setDepth(21);
    PHX.fx.chips = sc.add.particles(0, 0, 'chip', burstCfg({ angle: { min: 200, max: 340 }, speed: { min: 80, max: 220 }, tint: [0xde7e4f, 0xc66a3e, 0x2ecc71], scale: { start: 1.6, end: 0.6 }, gravityY: 900, lifespan: 800, rotate: { min: 0, max: 360 } })).setDepth(21);
    try { cam.postFX.addVignette(0.5, 0.5, 0.92, 0.22); } catch (e) {}
    PHX.ready = true;
    if (window.__FP_TEST) window.__FP_TEST.PHX = PHX;
    phxLayout();
  }
  function phxLayout() {
    if (!PHX.ready) return;
    const bw = cv.width, bh = cv.height;
    if (PHX.game.scale.width !== bw || PHX.game.scale.height !== bh) PHX.game.scale.resize(bw, bh);
    const c = PHX.game.canvas; c.style.width = cv.offsetWidth + 'px'; c.style.height = cv.offsetHeight + 'px';
    Object.assign(PHX.holder.style, { left: cv.offsetLeft + 'px', top: cv.offsetTop + 'px', width: cv.offsetWidth + 'px', height: cv.offsetHeight + 'px' });
    PHX.scene.cameras.main.setZoom(bw / W);
    for (const [t, im] of [[PHX.back, PHX.bimg], [PHX.front, PHX.fimg]]) {
      if (t.width !== bw || t.height !== bh) { t.setSize(bw, bh); }
      im.setDisplaySize(W, H);
    }
  }
  const legacyCtx = (t) => { const g = t.context; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, t.width, t.height); g.setTransform(t.width / W, 0, 0, t.height / H, 0, 0); return g; };
  // dessin du monde quand Phaser est actif : mêmes fonctions qu'avant, réparties sur deux calques
  function drawWorldPhx(lvl, t) {
    const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeA : 0, sy = shakeT > 0 ? (Math.random() - 0.5) * shakeA : 0;
    ctx = legacyCtx(PHX.back);
    ctx.save(); ctx.translate(sx, sy); drawBackScreen(lvl, t); ctx.restore();
    ctx = legacyCtx(PHX.front);
    ctx.save(); ctx.translate(sx, sy);
    ctx.save(); ctx.translate(-Math.round(CAM.x), -Math.round(CAM.y));
    drawLevel(lvl, t);
    if (state === 'replay') drawReplay();
    else if (state === 'play' || state === 'pause' || state === 'menu' || state === 'next') drawHero(ctx, P.x, P.y, P.face, P.sx, P.sy, P.vy, P.ifr > 0 && Math.floor(P.ifr * 14) % 2 ? 0.3 : 1, P.grav, save.char, save.hat, null, { feet: true, run: P.onGround && Math.abs(P.vx) > 40, phase: P.runPh, air: !P.onGround, hurt: P.hurtT > 0, win: state === 'next', surprise: P.surT > 0 });
    for (const q of parts) {
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.life); ctx.fillStyle = q.col;
      if (q.shape === 'heart') { heart(ctx, q.x, q.y - q.s / 2, q.s); ctx.fill(); } else ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.globalAlpha = 1;
    if (lvl.fog && state !== 'replay') drawFog();
    if (lvl.darkA > 0 && state !== 'replay') drawDark(lvl, t);
    ctx.restore();
    drawCrowd(t);
    ctx.restore();
    ctx = mainCtx;
    PHX.back.refresh(); PHX.front.refresh();
    phxSync(lvl, t, sx, sy);
  }
  // blocs pris en charge par Phaser (les blocs spéciaux restent dessinés à l'ancienne)
  const phxOwnsBlock = (b) => !(b.gate || b.crusher || b.ceil || b.wall || b.grow || b.spring || b.roof || (b.tile && !b.solid) || (b.blink && !b.solid) || (b.inv && !b.seen));
  const phxOwnsSpike = (s) => s.vis && !s.chand && s.disguise !== 'hand' && s.dir !== 'left' && s.dir !== 'right';
  const phxTex = (n) => (ARTNOW && ART_MAP[n] ? ['art', ART_MAP[n]] : ['skin', SKIN_MAP[n]]);
  const phxKey = (b) => b.w + 'x' + b.h + (ARTNOW ? 'a' : 'k');
  function phxBlock(sc, b, Lx) {
    const ct = sc.add.container(0, 0).setDepth(10);
    for (const [n, x, y, w, h] of skinTiles(b, Lx)) ct.add(sc.add.image(x, y, phxTex(n)[0], n).setOrigin(0, 0).setDisplaySize(w, h));
    const deco = [];
    for (const [dx, k, h] of b._deco || []) {
      const [tk, r] = phxTex(k), w = (h * r[2]) / r[3], im = sc.add.image(dx, ARTNOW ? 7 : 4, tk, k).setOrigin(0.5, 1).setDisplaySize(w, h);
      ct.add(im); deco.push([dx, im]);
    }
    return { ct, deco, key: phxKey(b) };
  }
  function phxSync(lvl, t, sx, sy) {
    const sc = PHX.scene, cam = sc.cameras.main, w = worldOf(lvl.i), k = lvl.i % 8;
    if (PHX.lvl !== lvl) {
      for (const o of PHX.blocks.values()) o.ct.destroy();
      for (const o of PHX.spikes.values()) o.forEach((im) => im.destroy());
      PHX.blocks.clear(); PHX.spikes.clear(); PHX.lvl = lvl; PHX.prev = {};
      const s = SKIES[w][k]; PHX.sky.clear(); const a = phxColor(s[0]), b2 = phxColor(s[1]); PHX.sky.fillGradientStyle(a, a, b2, b2, 1); PHX.sky.fillRect(0, 0, W, H);
    }
    cam.setScroll(Math.round(CAM.x) - sx, Math.round(CAM.y) - sy);
    PHX.holder.style.transform = lvl.mirror ? 'scaleX(-1)' : '';
    // fond en parallaxe
    const wide = lvl.bx1 - lvl.bx0 > W + 1, px = wide ? (CAM.x - lvl.bx0) : 0, oy = -CAM.y * 0.3, s = 1.1, tier = tierOf(levelDeaths);
    PHX.near.setPosition(0, 190 + oy + sy); PHX.near.tilePositionX = (px * 0.3) / s;
    PHX.far.setPosition(0, 150 + oy * 0.6 + sy); PHX.far.tilePositionX = (px * 0.12) / 0.8 + 200;
    PHX.fill.setPosition(0, 190 + oy + SKIN_MAP.bg_hills[3] * s - 1 + sy);
    for (const o of [PHX.near, PHX.far, PHX.fill, ...PHX.clouds]) o.setVisible(!ARTNOW);
    for (const o of [PHX.afar, PHX.afarFill, PHX.amid, PHX.amidFill]) o.setVisible(ARTNOW);
    if (ARTNOW) {
      const fy = G - ART_FAR_SIZE[1] * 0.82 + 24 + oy + sy, my = G - ART_MID_SIZE[1] * 0.62 + 34 + oy + sy;
      PHX.afar.setPosition(0, fy); PHX.afar.tilePositionX = (px * 0.12) / 0.82; PHX.afarFill.setPosition(0, fy + ART_FAR_SIZE[1] * 0.82 - 1);
      PHX.amid.setPosition(0, my); PHX.amid.tilePositionX = (px * 0.3) / 0.62; PHX.amidFill.setPosition(0, my + ART_MID_SIZE[1] * 0.62 - 1);
    }
    PHX.clouds.forEach((c, i) => {
      const dark = tier >= 2, x = ((i * 230 + t * (dark ? 18 : 10) * (1 + i * 0.3) - px * 0.05) % (W + 200) + W + 200) % (W + 200) - 100;
      c.setPosition(x, 60 + (i % 4) * 30 + oy * 0.4).setTint(dark ? 0xc9d6ea : 0xffffff).setScale(0.9 + (i % 3) * 0.15);
    });
    PHX.pit.setPosition(0, G - CAM.y + sy);
    // sol
    const seen = new Set();
    for (const b of lvl.blocks) {
      if (!phxOwnsBlock(b)) continue;
      seen.add(b);
      let o = PHX.blocks.get(b);
      if (o && o.key !== phxKey(b)) { o.ct.destroy(); o = null; }
      if (!o) { o = phxBlock(sc, b, lvl); PHX.blocks.set(b, o); }
      let ox = 0, oyb = 0;
      if (b.crumbleT != null && !b.fall) { ox = (Math.random() - 0.5) * 3; oyb = (Math.random() - 0.5) * 2; }
      o.ct.setPosition(Math.round(b.x + ox), Math.round(b.y + oyb));
      for (const [dx, im] of o.deco) im.setVisible(!decoHidden(b, lvl, dx));
      // éclats quand un bloc piégé commence à tomber
      if (b.fall && !o.fell) { o.fell = true; PHX.fx.chips.explode(14, b.x + b.w / 2, b.y + 6); }
      if (!b.fall) o.fell = false;
    }
    for (const [b, o] of PHX.blocks) if (!seen.has(b)) { o.ct.destroy(); PHX.blocks.delete(b); }
    // pics
    const seenS = new Set();
    for (const sp of lvl.spikes) {
      if (!phxOwnsSpike(sp)) continue;
      seenS.add(sp);
      const n = Math.max(1, Math.round(sp.w / (ARTNOW ? 34 : 26))), tw = sp.w / n, tk = phxTex('spikes')[0];
      let arr = PHX.spikes.get(sp);
      if (!arr || arr.length !== n || arr.tk !== tk) { if (arr) arr.forEach((im) => im.destroy()); arr = []; arr.tk = tk; for (let q = 0; q < n; q++) arr.push(sc.add.image(0, 0, tk, 'spikes').setOrigin(0, 0)); PHX.spikes.set(sp, arr); }
      const off = (1 - sp.rise) * sp.h, down = sp.dir === 'down', behind = !down && !sp.fallG;
      arr.forEach((im, q) => { im.setDisplaySize(tw + 0.5, sp.h).setFlipY(down).setDepth(behind ? 9 : 11).setPosition(sp.x + q * tw, down ? sp.y - off : sp.y + off); });
    }
    for (const [sp, arr] of PHX.spikes) if (!seenS.has(sp)) { arr.forEach((im) => im.destroy()); PHX.spikes.delete(sp); }
    // poussière à l'atterrissage et en courant, étincelles sur les pièces
    if (P && state === 'play') {
      const pv = PHX.prev, feetX = P.x + 13, feetY = P.grav > 0 ? P.y + 30 : P.y;
      if (P.onGround && pv.ground === false && (pv.vy || 0) * P.grav > 380) PHX.fx.dust.explode(10, feetX, feetY);
      if (P.onGround && Math.abs(P.vx) > 200 && (t - (pv.puff || 0)) > 0.14) { PHX.fx.dust.explode(2, feetX - Math.sign(P.vx) * 8, feetY); pv.puff = t; }
      pv.ground = P.onGround; pv.vy = P.vy;
      for (const c of lvl.coins) { if (c.got && !c._fx) { c._fx = true; PHX.fx.spark.explode(12, c.x, c.y); } }
    }
  }

