import sys
D = '/tmp/claude-0/-home-claude/3f7854d1-44a1-55df-af76-c75e2bb012da/scratchpad/skin/'
F = '/home/claude/faux-pas/index.html'
s = open(D + 'index-v14.html').read()
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count: sys.exit(f'MATCH {n}x pour : {old[:120]!r}')
    s = s.replace(old, new)
A = '/tmp/claude-0/-home-claude/3f7854d1-44a1-55df-af76-c75e2bb012da/scratchpad/art/'
mod = open(D + 'skin16.js').read().replace('@@ATLAS@@\n', open(D + 'atlas.js').read()) + open(A + 'art16.js').read().replace('@@ART@@\n', open(A + 'art.js').read())
rep("  function drawSpike(s) {\n", mod + "  function drawSpike(s) {\n")
rep("    if (s.chand) { drawChandelier(s); return; }\n", "    if (s.chand) { drawChandelier(s); return; }\n    if (SKINNOW && s.dir !== 'left' && s.dir !== 'right') { skinSpike(s); return; }\n")
rep("    if (b.spring) {\n      const sq = (b.squash || 0) * 8;", "    if (b.spring) {\n      if (SKINNOW) { skinSpring(b, ox, oy); return; }\n      const sq = (b.squash || 0) * 8;")
rep("    ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);\n    blockTexture(b, ox, oy);", "    if (SKINNOW && !b.roof) skinBlock(b, ox, oy);\n    else { ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h); blockTexture(b, ox, oy); }")
rep("else ctx.fillRect(b.x + ox, b.y + oy, b.w, 4);", "else if (!SKINNOW) ctx.fillRect(b.x + ox, b.y + oy, b.w, 4);")
rep("    if (PAL === WORLDS[0] && b.h >= 40 && !b.roof && !b.spring) {", "    if (!SKINNOW && PAL === WORLDS[0] && b.h >= 40 && !b.roof && !b.spring) {")
rep("""    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);""", """    ctx.globalAlpha = 1;
    if (SKINNOW) {
      skinDoor(d);
      if (d.bit) { ctx.fillStyle = COL.ink; ctx.fillRect(x + 5, y + 18, w - 10, 24); ctx.fillStyle = '#fff'; teeth(x + 5, y + 18, w - 10, 8); teeth(x + 5, y + 42, w - 10, 8, false); }
      ctx.restore(); return;
    }
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);""")
rep("    if (c.candy) { drawCandy(c, x, y + Math.sin(t * 3 + c.x) * 2, t); return; }\n",
    "    if (c.candy) { drawCandy(c, x, y + Math.sin(t * 3 + c.x) * 2, t); return; }\n    if (SKINNOW) { skinCoin(c, x, y + Math.sin(t * 3 + c.x) * 2, t); return; }\n")
rep("""    heart(ctx, h.x, y - s / 2, s); ctx.fillStyle = h.fake ? '#c2185b' : COL.pink; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(h.x - 6, y - s / 2 + 5, 3, 4);""",
"""    if (SKINNOW) { if (h.fake) ctx.globalAlpha = 0.82; skinHeart(h.x, y, s, false); ctx.globalAlpha = 1; }
    else {
      heart(ctx, h.x, y - s / 2, s); ctx.fillStyle = h.fake ? '#c2185b' : COL.pink; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(h.x - 6, y - s / 2 + 5, 3, 4);
    }""")
rep("""      heart(ctx, x0 + 14 + k * 30, y0 + 12 - s / 2 + 2, s);
      ctx.fillStyle = full ? COL.pink : 'rgba(29,26,57,.45)'; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.stroke();""",
"""      if (SKINNOW) { skinHeart(x0 + 14 + k * 30, y0 + 14, s, !full); continue; }
      heart(ctx, x0 + 14 + k * 30, y0 + 12 - s / 2 + 2, s);
      ctx.fillStyle = full ? COL.pink : 'rgba(29,26,57,.45)'; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.stroke();""")
rep("    if (m.type === 'snail') {\n      ctx.fillStyle = '#9fe07a';",
    "    if (SKINNOW && m.type === 'snail') { sprFit(m.flat > 0 || !m.alive ? 'snail_shell' : Math.floor(m.t * 6) % 2 ? 'snail_walk_a' : 'snail_walk_b', mid, y + h + 2, m.flat > 0 || !m.alive ? h * 1.05 : h * 1.3, dir > 0); ctx.restore(); return; }\n    if (m.type === 'snail') {\n      ctx.fillStyle = '#9fe07a';")
rep("""        ctx.fillStyle = PAL.block; ctx.fillRect(x - 3, y - 58, 6, 58);
        ctx.fillStyle = COL.paper; ctx.strokeStyle = COL.ink; ctx.lineWidth = 3;""",
"""        ctx.fillStyle = SKINNOW ? '#c66a3e' : PAL.block; ctx.fillRect(x - 3, y - 58, 6, 58);
        if (SKINNOW) { ctx.strokeStyle = '#353541'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 58, 6, 58); }
        ctx.fillStyle = SKINNOW ? '#f4c08a' : COL.paper; ctx.strokeStyle = SKINNOW ? '#353541' : COL.ink; ctx.lineWidth = 3;""")
rep("      case 'bush':\n        ctx.fillStyle = '#3fae4f';", "      case 'bush':\n        if (SKINNOW) { sprFit('bush', x, y + 2, 34); break; }\n        ctx.fillStyle = '#3fae4f';")
rep("    if (w === 5) drawHalloFar(t); else drawFar(w, k, t);", "    if (w === 5) drawHalloFar(t); else if (!SKINNOW) drawFar(w, k, t);")
rep("    if (w === 5) { drawHalloBack(t); ctx.restore(); return; }\n    if (w === 0) {", "    if (w === 5) { drawHalloBack(t); ctx.restore(); return; }\n    if (SKINNOW) { skinBackdrop(t, tier); ctx.restore(); return; }\n    if (w === 0) {")
rep("    PAL = WORLDS[lvl ? worldOf(lvl.i) : 0];\n    if (state === 'map')", "    PAL = WORLDS[lvl ? worldOf(lvl.i) : 0];\n    SKINNOW = !!lvl && skinFor(worldOf(lvl.i)); if (SKINNOW) SKINSET = SKIN_SET[worldOf(lvl.i)];\n    if (state === 'map')")
# réglage
rep('<button class="ghost light" id="optQuality">Qualité : auto</button>', '<button class="ghost light" id="optQuality">Qualité : auto</button>\n              <button class="ghost light" id="optGfx">Graphismes : nouveaux</button>')
rep("    set('optQuality',", "    set('optGfx', `Graphismes : ${save.gfx === 'classic' ? 'classiques' : 'nouveaux'}`);\n    set('optQuality',")
rep("  $('optFull2').addEventListener('click',", "  $('optGfx').addEventListener('click', () => { sfx.click(); save.gfx = save.gfx === 'classic' ? 'new' : 'classic'; persist(); updSetButtons(); });\n  $('optFull2').addEventListener('click',")
open(F, 'w').write(s)
print('ok', len(s))

# ======================= Phaser (actif seulement si la page charge Phaser) =======================
s = open(F).read()
phx = open(D + 'phx.js').read()
rep("  const ctx = cv.getContext('2d');", "  const mainCtx = cv.getContext('2d');\n  let ctx = mainCtx;")
rep("  function draw(t) {\n", phx + "  function draw(t) {\n")
rep("    if (SKINNOW && !b.roof) skinBlock(b, ox, oy);", "    if (SKINNOW && !b.roof) { if (!PHXNOW) skinBlock(b, ox, oy); }")
rep("  function drawSpike(s) {\n    if (!s.vis) {", "  function drawSpike(s) {\n    if (PHXNOW && phxOwnsSpike(s)) return;\n    if (!s.vis) {")
rep("    SKINNOW = !!lvl && skinFor(worldOf(lvl.i)); if (SKINNOW) SKINSET = SKIN_SET[worldOf(lvl.i)];\n",
    "    ctx = mainCtx;\n    SKINNOW = !!lvl && skinFor(worldOf(lvl.i)); if (SKINNOW) SKINSET = SKIN_SET[worldOf(lvl.i)];\n"
    "    PHXNOW = SKINNOW && PHX.ready && phxWorld(worldOf(lvl.i)) && state !== 'map';\n"
    "    if (PHX.ready) { PHX.holder.style.display = PHXNOW ? '' : 'none'; if (PHXNOW && !PHX.game.loop.running) PHX.game.loop.wake(); else if (!PHXNOW && PHX.game.loop.running) PHX.game.loop.sleep(); }\n")
rep("""    ctx.fillStyle = lvl ? skyGrad(lvl.i) : PAL.grad; ctx.fillRect(0, 0, W, H);
""", """    if (PHXNOW) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); drawWorldPhx(lvl, t); }
    else {
    ctx.fillStyle = lvl ? skyGrad(lvl.i) : PAL.grad; ctx.fillRect(0, 0, W, H);
""")
rep("""    if (lvl) drawCrowd(t);
    ctx.restore();
""", """    if (lvl) drawCrowd(t);
    ctx.restore();
    }
""")
rep("    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);\n  }\n  addEventListener('resize', layout);", "    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);\n    phxLayout();\n  }\n  addEventListener('resize', layout);")
rep("im.onload = () => { SKIN.ok = true; };", "im.onload = () => { SKIN.ok = true; try { phxBoot(); } catch (e) {} };")
# images uniques : fond, accessoires, réglage d'activation
rep("    PHXNOW = SKINNOW && PHX.ready", "    ARTNOW = SKINNOW && ART.ok && !!ART_WORLDS[worldOf(lvl.i)];\n    PHXNOW = SKINNOW && PHX.ready")
rep("    ctx.save(); ctx.translate(ox, oy); drawBackdrop(w, t, tier, k);", "    if (ARTNOW && !PHXNOW) artBackdrop(Lx, t, tier);\n    ctx.save(); ctx.translate(ox, oy); drawBackdrop(w, t, tier, k);")
rep("        if (SKINNOW) { sprFit('bush', x, y + 2, 34); break; }", "        if (SKINNOW) { sprFit('bush', x, y + (ARTNOW ? 4 : 2), ARTNOW ? 30 : 34); break; }")
rep("      case 'flower': flower(x, y, COL.pink); break;", "      case 'flower': if (ARTNOW) sprFit('flower', x, y + 4, 26); else flower(x, y, COL.pink); break;")
rep("      case 'tree':\n", "      case 'tree':\n        if (ARTNOW) { sprFit('tree', x, y + 5, 112); break; }\n")
rep("""        ctx.fillStyle = SKINNOW ? '#c66a3e' : PAL.block; ctx.fillRect(x - 3, y - 58, 6, 58);""", """        if (ARTNOW) { const f = frm('sign'), r = f[1], sw = Math.max(100, (w - 18) / 0.7 + 12); ctx.drawImage(f[0], r[0], r[1], r[2], r[3], x - sw / 2, y - 90, sw, 92); ctx.fillStyle = '#3a2416'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.str, x, y - 90 + 92 * 33.5 / 126 + 1); }
        else {
        ctx.fillStyle = SKINNOW ? '#c66a3e' : PAL.block; ctx.fillRect(x - 3, y - 58, 6, 58);""")
rep("""        ctx.fillStyle = COL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.str, x, y - 68);
""", """        ctx.fillStyle = COL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.str, x, y - 68);
        }
""")
open(F, 'w').write(s)
print('phaser ok', len(s))
