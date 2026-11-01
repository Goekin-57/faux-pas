// Le chapitre 1 est-il faisable ? Un robot joue chaque niveau avec la manette émulée, image par image.
// Lancer : (cd jeu-v2 && python3 -m http.server 4173) puis node v2/tests/chapter1.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const ok = [], ko = [];
const check = (n, c, e = '') => { (c ? ok : ko).push(n); console.log((c ? 'OK  ' : 'NON ') + n, e); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  const btn = () => ({ pressed: false, value: 0 });
  window.__pad = { id: 'robot', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), timestamp: 0 };
  navigator.getGamepads = () => [window.__pad, null, null, null];
});
await p.goto(URL); await p.waitForTimeout(3500);
const gt = () => p.evaluate(() => window.__GT());
const wait = async (ms) => { const t0 = await gt(); while ((await gt()) - t0 < ms) await p.waitForTimeout(30); };
const start = async (level, deaths = 0) => {
  await p.evaluate(([level, deaths]) => {
    const g = window.__GAME, act = g.scene.getScenes(true).map((s) => s.scene.key);
    if (act.includes('Game')) { act.filter((k) => k !== 'Game').forEach((k) => g.scene.stop(k)); g.scene.getScene('Game').scene.restart({ level, deaths }); }
    else act[0] ? g.scene.getScene(act[0]).scene.start('Game', { level, deaths }) : g.scene.start('Game', { level, deaths });
  }, [level, deaths]);
  await wait(1200);
};
const scene = () => p.evaluate(() => window.__GAME.scene.getScenes(true).map((s) => s.scene.key).join(','));
// étapes : ax (stick), jump (bouton A), until : x / xle / fall / ground / frames / boss
const route = (steps) => p.evaluate(async (steps) => {
  const P = window.__pad, fr = () => new Promise((r) => requestAnimationFrame(r)), g = () => window.__NSF;
  const setB = (on) => { P.buttons[0] = { pressed: on, value: on ? 1 : 0 }; };
  const log = [];
  for (const st of steps) {
    const pl = g().player;
    if (st.ax != null) P.axes[0] = st.ax;
    if (st.jump != null) setB(st.jump);
    for (let i = 0; i < (st.max || 300); i++) {
      await fr();
      if (pl.dead || g().won) break;
      if (st.until === 'x' && pl.x >= st.v) break;
      if (st.until === 'xle' && pl.x <= st.v) break;
      if (st.until === 'fall' && i > 2 && pl.body.velocity.y > 0 && !pl.onGround) break;
      if (st.until === 'ground' && i > 2 && pl.onGround && pl.body.velocity.y >= 0) break;
      if (st.until === 'frames' && i >= st.v) break;
      if (st.until === 'on' && i > 2 && pl.onGround && Math.abs(pl.y - st.v) < 3) break;
      if (st.until === 'mv' && Math.abs(g().movers[st.i].x - st.v) < (st.tol || 12)) break;
    }
    log.push(`${st.until}:${Math.round(pl.x)},${Math.round(pl.y)}`);
    if (pl.dead || g().won) break;
  }
  P.axes[0] = 0; setB(false);
  for (let i = 0; i < 5; i++) await fr();
  return { x: Math.round(g().player.x), y: Math.round(g().player.y), won: g().won, dead: g().player.dead, deaths: g().deathLog.join(' '), log: log.slice(-4).join(' ') };
}, steps);
const J = (x, after = 'ground') => [{ ax: 1, until: 'x', v: x }, { jump: true, until: 'fall' }, { jump: false, until: after }];
const run = (x) => ({ ax: 1, until: 'x', v: x });
// saut court qui freine en l'air pour se poser sur une petite plateforme
const Land = (x) => [{ ax: 1, until: 'x', v: x }, { jump: true, until: 'fall' }, { jump: false, ax: -0.4, until: 'ground' }, { ax: 0, until: 'frames', v: 8 }];

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
async function level(n, deaths, steps, label) {
  if (ONLY && !ONLY.includes(label)) return;
  await start(n, deaths);
  const r = await route(steps);
  check(`${label} : le robot atteint la sortie`, r.won, JSON.stringify(r));
}

await level(0, 1, [...J(250), ...J(655), ...J(1015), { ax: 1, until: 'x', v: 1238 }, { jump: true, until: 'fall' }, { jump: false, ax: 0.2, until: 'ground' }, { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, ...J(1620), run(1885), { ax: 0, until: 'frames', v: 140 }, run(1990), { ax: 0.4, until: 'frames', v: 90 }, run(2460)], '1-1');
await level(1, 0, [...J(455), ...J(770), ...J(1060), ...J(1370), ...J(1580), ...J(1760), run(2140), ...J(2470, 'ground'), ...J(2660, 'ground'), run(3340)], '1-2');
await level(2, 1, [run(400), { ax: 1, until: 'x', v: 560 }, { ax: 0.3, until: 'ground' }, run(740), { jump: true, until: 'fall' }, { jump: false, until: 'ground' }, ...J(940), run(1150), { ax: 0.5, until: 'ground' }, run(1215), { ax: 0, until: 'ground' }, { ax: -1, until: 'xle', v: 1120 }, run(1290), { ax: 1, until: 'ground' }, run(1820), { ax: 0.8, until: 'ground' }, run(2660)], '1-3');
await level(3, 2, [run(400), { ax: 0, until: 'mv', i: 0, v: 530, max: 600 }, { ax: 1, jump: true, until: 'fall' }, { jump: false, ax: 0.25, until: 'ground' }, { ax: 0, until: 'mv', i: 0, v: 745, max: 600 },
  ...Land(830), ...Land(965), { ax: 0, until: 'mv', i: 1, v: 1450, tol: 3, max: 900 },
  ...Land(1550), ...Land(1780),
  { ax: 0.3, until: 'x', v: 2035 }, { ax: 0, until: 'mv', i: 3, v: 2136, tol: 6, max: 900 }, { ax: 1, jump: true, until: 'fall' }, { jump: false, ax: 0, until: 'ground' }, { ax: 0, until: 'mv', i: 3, v: 2325, max: 900 },
  run(2410), { jump: true, until: 'fall' }, { jump: false, until: 'ground' }, run(2850)], '1-4');
await level(5, 0, [...J(250), ...J(565), ...J(925), ...J(1250), run(1560), ...J(1640), ...J(1960), ...J(2075), { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, ...J(2530), run(2900)], '1-6');
await level(6, 0, [...J(420), ...J(740), ...J(1075), ...J(1425), ...J(1885), { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, run(2900)], '1-7');
// 1-7 inversé (après une mort) : on part de la droite
await level(6, 1, [{ ax: -1, until: 'xle', v: 2580 }, { jump: true, until: 'fall' }, { jump: false, until: 'ground' }, { ax: -1, until: 'xle', v: 2260 }, { ax: -1, until: 'xle', v: 1115 }, { jump: true, until: 'fall' }, { jump: false, until: 'ground' }, { ax: -1, until: 'xle', v: 100 }], '1-7 inversé (partiel)');
// 1-5 : mécanique de l'arène (la porte s'ouvre quand tous les escargots sont écrasés)
await start(4, 0);
const arena = await p.evaluate(async () => {
  const g = window.__NSF, fr = () => new Promise((r) => requestAnimationFrame(r));
  const before = g.snails.filter((s) => s.alive).length;
  // on écrase un escargot pour de vrai : on tombe dessus
  const sn = g.snails[0]; sn.vx = 0; g.player.rect.setPosition(sn.x, 330); g.player.body.reset(sn.x, 330);
  for (let i = 0; i < 60 && sn.alive; i++) await fr();
  const stomped = !sn.alive;
  g.snails.forEach((s) => { s.alive = false; s.img.setVisible(false); });
  for (let i = 0; i < 5; i++) await fr();
  g.player.rect.setPosition(1660, 418); g.player.body.reset(1660, 418); g.player.invuln = 5;
  window.__pad.axes[0] = 1; for (let i = 0; i < 40 && !g.won; i++) await fr(); window.__pad.axes[0] = 0;
  return { before, stomped, won: g.won };
});
check('1-5 : on écrase un escargot en tombant dessus', arena.stomped, JSON.stringify(arena));
check('1-5 : la porte s\'ouvre quand il n\'y a plus d\'escargots', arena.won, JSON.stringify(arena));
// 1-8 : boss — dalle fissurée → coincé → coup sur la tête ; fausse défaite ; vraie défaite ; la porte apparaît
await start(7, 0); await wait(2500);
const boss = await p.evaluate(async () => {
  const g = window.__NSF, B = g.boss, fr = () => new Promise((r) => requestAnimationFrame(r)), out = [];
  g.player.invuln = 999;
  const hitOnce = async () => {
    for (let i = 0; i < 200 && !['idle', 'prep', 'sunk'].includes(B.state); i++) await fr();
    const tl = g.bossTiles.find((t) => t.cracked) || g.bossTiles[2];
    if (!tl.cracked) B.crack(tl);
    B.x = tl.x + 60; B.y = 420; B.land(true);
    const sunk = B.state === 'sunk';
    g.player.invuln = 999; g.player.rect.setPosition(B.x, 260); g.player.body.reset(B.x, 260);
    const hp0 = B.hp; for (let i = 0; i < 90 && B.hp === hp0; i++) await fr();
    out.push({ sunk, hp: B.hp, state: B.state });
    for (let i = 0; i < 60; i++) await fr();
  };
  await hitOnce(); await hitOnce(); await hitOnce();
  for (let i = 0; i < 200 && B.state === 'fake'; i++) await fr();
  const revived = B.revived && B.hp === 1;
  await hitOnce();
  for (let i = 0; i < 120; i++) await fr();
  const doorVisible = g.doorImg.visible && !g.def.door.locked;
  g.player.invuln = 5; g.player.rect.setPosition(800, 418); g.player.body.reset(800, 418);
  window.__pad.axes[0] = 1; for (let i = 0; i < 60 && !g.won; i++) await fr(); window.__pad.axes[0] = 0;
  return { out, revived, doorVisible, won: g.won };
});
check('1-8 : il s\'enfonce sur une dalle fissurée et prend un coup', boss.out[0].sunk && boss.out[0].hp === 2, JSON.stringify(boss.out[0]));
check('1-8 : fausse défaite puis il revient', boss.revived, JSON.stringify(boss));
check('1-8 : vaincu pour de vrai, la porte apparaît et mène à la fin', boss.doorVisible && boss.won, JSON.stringify(boss));
check('aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
await b.close();
process.exit(ko.length ? 1 : 0);
