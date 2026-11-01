// Le chapitre 1 est-il faisable ? Un robot joue chaque niveau avec la manette émulée, image par image,
// puis on vérifie que les pièges font bien ce qu'ils annoncent.
// Lancer : (cd jeu-v2 && python3 -m http.server 4173) puis node v2/tests/chapter1.mjs   (ONLY=1-3,1-4 pour filtrer)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const ok = [], ko = [];
const check = (n, c, e = '') => { (c ? ok : ko).push(n); console.log((c ? 'OK  ' : 'NON ') + n, c ? '' : e); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  const btn = () => ({ pressed: false, value: 0 });
  window.__pad = { id: 'robot', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), timestamp: 0 };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  // le robot fait avancer le jeu lui-même, image par image à 60 i/s : résultat identique quelle que soit la vitesse de la machine
  window.__tick = (n = 1) => { const g = window.__GAME; if (!g.__manual) { g.loop.sleep(); g.__manual = true; g.__t = g.loop.now || performance.now(); } for (let i = 0; i < n; i++) { g.__t += 1000 / 60; g.step(g.__t, 1000 / 60); } };
});
await p.goto(URL); await p.waitForTimeout(3500);
const gt = () => p.evaluate(() => window.__GT());
const wait = (ms) => p.evaluate((ms) => window.__tick(Math.ceil(ms / (1000 / 60))), ms);
const start = async (level, deaths = 0, extra = {}) => {
  await p.evaluate(([level, deaths, extra]) => {
    const g = window.__GAME, act = g.scene.getScenes(true).map((s) => s.scene.key), data = { level, deaths, ...extra };
    if (act.includes('Game')) { act.filter((k) => k !== 'Game').forEach((k) => g.scene.stop(k)); g.scene.getScene('Game').scene.restart(data); }
    else act[0] ? g.scene.getScene(act[0]).scene.start('Game', data) : g.scene.start('Game', data);
  }, [level, deaths, extra]);
  await wait(900);
};
// étapes : ax (stick), jump (bouton A), until : x / xle / fall / ground / frames / time (ms de jeu) / mv (plateforme mobile i proche de v)
const route = (steps) => p.evaluate(async (steps) => {
  const P = window.__pad, fr = async () => window.__tick(), g = () => window.__NSF;
  const setB = (on) => { P.buttons[0] = { pressed: on, value: on ? 1 : 0 }; };
  const log = [];
  for (const st of steps) {
    const pl = g().player, t0 = window.__GT();
    if (st.ax != null) P.axes[0] = st.ax;
    if (st.jump != null) setB(st.jump);
    for (let i = 0; i < (st.max || 400); i++) {
      await fr();
      if (pl.dead || g().won) break;
      if (st.until === 'x' && pl.x >= st.v) break;
      if (st.until === 'xle' && pl.x <= st.v) break;
      if (st.until === 'fall' && i > 2 && pl.body.velocity.y > 0 && !pl.onGround) break;
      if (st.until === 'ground' && i > 2 && pl.onGround && pl.body.velocity.y >= 0) break;
      if (st.until === 'frames' && i >= st.v) break;
      if (st.until === 'time' && window.__GT() - t0 >= st.v) break;
      if (st.until === 'mv' && Math.abs(g().movers[st.i].x - st.v) < (st.tol || 12)) break;
      if (st.until === 'mvgo' && g().movers[st.i].dir === 1 && Math.abs(g().movers[st.i].x - st.v) < (st.tol || 12)) break;
      if (st.until === 'mvge' && g().movers[st.i].x >= st.v) break;
    }
    log.push(`${st.until}:${Math.round(pl.x)},${Math.round(pl.y)}`);
    if (pl.dead || g().won) break;
  }
  P.axes[0] = 0; setB(false);
  for (let i = 0; i < 5; i++) await fr();
  return { x: Math.round(g().player.x), y: Math.round(g().player.y), won: g().won, dead: g().player.dead, hp: g().player.hp, deaths: g().deathLog.join(' '), log: log.slice(-9).join(' ') };
}, steps);
const J = (x, ax = 1) => [{ ax: 1, until: 'x', v: x }, { ax, jump: true, until: 'fall' }, { jump: false, until: 'ground' }];
const run = (x) => ({ ax: 1, until: 'x', v: x });
const stop = (ms) => ({ ax: 0, until: 'time', v: ms });
const hop = (x, ms) => [{ ax: 1, until: 'x', v: x }, { ax: 1, jump: true, until: 'time', v: ms }, { ax: 0, until: 'fall' }, { jump: false, until: 'ground' }];

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (label) => !ONLY || ONLY.some((o) => label.startsWith(o));
async function level(n, deaths, steps, label) {
  if (!want(label)) return;
  await start(n, deaths);
  const r = await route(steps);
  check(`${label} : le robot atteint la sortie`, r.won, JSON.stringify(r));
}

// ---------------------------------------------------------------- parcours complets
await level(0, 0, [...J(320), ...J(540), ...J(880), ...J(1630), run(2400)], '1-1');
await level(0, 2, [...J(320), ...J(540), ...J(880), ...J(1630), run(2400)], '1-1 (après 2 morts)');
await level(1, 0, [...J(570), ...J(950), ...J(1170), ...J(1530), ...J(1790), ...J(2150), ...J(2515), ...J(2745), run(3070)], '1-2');
await level(2, 0, [run(262), { jump: true, until: 'fall' }, { jump: false, until: 'ground' }, { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' },
  ...J(775), run(1250), { ax: 1, until: 'ground' }, run(1455), stop(150), { ax: 0, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, stop(1700),
  ...J(1482), { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, ...J(2275), { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, ...J(2635), run(2910)], '1-3');
await level(3, 0, [...J(300), ...J(675), ...J(975), ...J(1240), run(1700), ...J(1800), run(2860)], '1-4');
await level(4, 0, [run(900), stop(400), { ax: 0, until: 'mvgo', i: 0, v: 1005, tol: 6, max: 900 }, { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, { ax: 0, until: 'mvge', i: 0, v: 1220, max: 900 }, { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' },
  ...hop(1585, 150), ...J(1725), run(1985), { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' },
  { ax: 0, until: 'mvge', i: 1, v: 2290, max: 900 }, { ax: 1, jump: true, until: 'fall' }, { jump: false, until: 'ground' }, run(3110)], '1-5');
await level(5, 0, [run(560), { ax: 1, until: 'ground' }, run(1000), { ax: 1, until: 'x', v: 1090 }, ...J(1090), ...hop(1262, 120), { ax: 1, until: 'x', v: 1392 }, { ax: 1, until: 'fall' }, { until: 'ground' }, ...J(1650), run(2200), { ax: 1, until: 'ground' }, ...J(2330), ...J(2620), run(2890)], '1-6');
await level(6, 0, [run(560), stop(1500), run(800), ...J(838), run(1460), stop(1500), run(1900), ...J(1950), run(2340), stop(1500), run(3060)], '1-7');

// ---------------------------------------------------------------- les pièges font ce qu'ils annoncent
const scenario = (fn, arg) => p.evaluate(fn, arg);
if (want('pièges')) {
  // 1-4 : sauter sous le plafond surveillé par l'œil → la plaque à pics tombe
  await start(3, 0);
  let r = await scenario(async () => {
    const g = window.__NSF, pl = g.player, fr = async () => window.__tick(); pl.rect.setPosition(800, 420); pl.body.reset(800, 420);
    for (let i = 0; i < 10; i++) await fr();
    window.__pad.buttons[0] = { pressed: true, value: 1 }; for (let i = 0; i < 4; i++) await fr(); window.__pad.buttons[0] = { pressed: false, value: 0 };
    for (let i = 0; i < 60 && !pl.dead; i++) await fr();
    return g.deathLog.join(' ');
  });
  check('pièges : 1-4 sauter sous le plafond surveillé fait tomber les pics', r.startsWith('spikes'), r);
  // 1-4 : marcher sous le plafond → rien
  await start(3, 0);
  r = await route([{ ax: 1, until: 'x', v: 680 }, { ax: 0.6, until: 'x', v: 960 }]);
  check('pièges : 1-4 marcher sous le plafond ne déclenche rien', !r.dead, JSON.stringify(r));
  // 1-4 : sauter sur le pont déplié → il se replie
  await start(3, 0, { cp: { x: 1690, y: 420 } });
  r = await route([...J(1800), run(2000), { ax: 0.2, jump: true, until: 'fall' }, { jump: false, ax: 0.2, until: 'ground', max: 200 }]);
  check('pièges : 1-4 sauter sur le pont le replie (chute)', r.dead, JSON.stringify(r));
  // 1-3 : la plateforme timide plonge si on saute près d'elle
  await start(2, 0, { cp: { x: 1440, y: 420 } });
  r = await scenario(async () => {
    const g = window.__NSF, fr = async () => window.__tick(), sh = g.traps.find((t) => t.radius != null);
    window.__pad.buttons[0] = { pressed: true, value: 1 }; for (let i = 0; i < 4; i++) await fr(); window.__pad.buttons[0] = { pressed: false, value: 0 };
    let maxY = 0; for (let i = 0; i < 20; i++) { await fr(); maxY = Math.max(maxY, sh.y); }
    return { y0: sh.y0, maxY };
  });
  check('pièges : 1-3 la plateforme timide plonge quand on saute près d\'elle', r.maxY > r.y0 + 60, JSON.stringify(r));
  // 1-7 : rester sous une grosse stalactite qui vibre → touché
  await start(6, 0);
  r = await route([run(655), stop(2500)]);
  check('pièges : 1-7 rester sous la stalactite qui vibre est mortel', r.dead && r.deaths.startsWith('spike'), JSON.stringify(r));
  // 1-2 : le papillon se fait croquer avant qu'on arrive à la fleur
  await start(1, 0);
  r = await scenario(async () => {
    const g = window.__NSF, fr = async () => window.__tick(), bf = g.traps.find((t) => t.list && t.list[0]?.eat !== undefined || t.list?.some?.((b) => b.eat));
    window.__pad.axes[0] = 1; for (let i = 0; i < 400 && g.player.x < 560; i++) await fr(); window.__pad.axes[0] = 0;
    return { eaten: bf.list.find((b) => b.eat).state, x: Math.round(g.player.x) };
  });
  check('pièges : 1-2 le papillon se fait croquer avant que le joueur arrive', r.eaten === 'gone', JSON.stringify(r));
}

// ---------------------------------------------------------------- 1-8 : boss
if (want('1-8')) {
  await start(7, 0); await wait(2500);
  const boss = await p.evaluate(async () => {
    const g = window.__NSF, B = g.boss, fr = async () => window.__tick(), out = [];
    g.player.invuln = 999;
    const hitOnce = async () => {
      for (let i = 0; i < 200 && !['idle', 'prep', 'sunk'].includes(B.state); i++) await fr();
      const tl = g.bossTiles.find((t) => t.cracked) || g.bossTiles[2];
      if (!tl.cracked) B.crack(tl);
      B.x = tl.x + 60; B.y = 420; B.land(true);
      const sunk = B.state === 'sunk', cue = g.hints.text;
      g.player.invuln = 999; g.player.rect.setPosition(B.x, 260); g.player.body.reset(B.x, 260);
      const hp0 = B.hp; for (let i = 0; i < 90 && B.hp === hp0; i++) await fr();
      out.push({ sunk, hp: B.hp, state: B.state, cue });
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
  check('1-8 : il s\'enfonce sur une dalle fissurée, l\'indication « vulnérable » s\'affiche, il prend un coup', boss.out[0].sunk && boss.out[0].hp === 2 && /vuln/.test(boss.out[0].cue), JSON.stringify(boss.out[0]));
  check('1-8 : fausse défaite puis il revient', boss.revived, JSON.stringify(boss));
  check('1-8 : vaincu pour de vrai, la porte apparaît et mène à la fin', boss.doorVisible && boss.won, JSON.stringify(boss));
}
check('aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${ok.length} OK, ${ko.length} NON`);
await b.close();
process.exit(ko.length ? 1 : 0);
