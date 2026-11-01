// Tests complémentaires : manette émulée, ressort paresseux, chemin au-dessus du faux sol.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const ok = [], ko = [];
const check = (n, c, e = '') => { (c ? ok : ko).push(n); console.log((c ? 'OK  ' : 'NON ') + n, e); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
// manette « standard » émulée
await p.addInitScript(() => {
  const btn = () => ({ pressed: false, value: 0 });
  window.__pad = { id: 'Manette de test (standard)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), timestamp: 0 };
  navigator.getGamepads = () => [window.__pad, null, null, null];
});
const pad = (i, on) => p.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [i, on]);
const axis = (v) => p.evaluate((v) => { window.__pad.axes[0] = v; }, v);
const gt = () => p.evaluate(() => window.__GT());
async function wait(ms) { const t0 = await gt(); for (let i = 0; i < 500; i++) { await p.waitForTimeout(30); if ((await gt()) - t0 >= ms) return; } }
const tap = async (i) => { await pad(i, true); await wait(80); await pad(i, false); await wait(80); };
const scene = () => p.evaluate(() => window.__GAME.scene.getScenes(true).map((s) => s.scene.key).join(','));
await p.goto(URL); await p.waitForTimeout(3500);
await tap(13); // croix bas
check('manette : la croix déplace la sélection', await p.evaluate(() => window.__NSF_MENU.group.index) !== 0);
await tap(12); await p.evaluate(() => window.__NSF_MENU.group.focus(0));
await tap(0); await wait(1500);
check('manette : Ⓐ lance le jeu', (await scene()).includes('Game'), await scene());
// déplacement au stick
await axis(1); await wait(500);
const vx = await p.evaluate(() => window.__NSF.player.body.velocity.x);
await axis(0);
check('manette : le stick fait courir', vx > 200, vx.toFixed(0));
await tap(9); await wait(300);
check('manette : Start met en pause', (await scene()).includes('Pause'));
await tap(9); await wait(300);
check('manette : Start reprend', !(await scene()).includes('Pause'));
// ressort : refuse le premier rebond, propulse sur le mur au second
const place = (x, y) => p.evaluate(([x, y]) => { const g = window.__NSF; g.player.rect.setPosition(x, y); g.player.body.reset(x, y); }, [x, y]);
await place(2480, 418); await wait(300);
await axis(1); await wait(260); await axis(0);
await wait(900);
const y1 = await p.evaluate(() => window.__NSF.player.y);
check('ressort : le premier rebond est raté (on reste en bas)', y1 > 400, y1.toFixed(0));
// routine pilotée dans la page, image par image, à partir de l'état du jeu
const route = (steps) => p.evaluate(async (steps) => {
  const g = window.__NSF, pl = g.player, P = window.__pad, fr = () => new Promise((r) => requestAnimationFrame(r));
  const setB = (i, on) => { P.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
  let best = 999;
  for (const st of steps) {
    if (st.place) { pl.rect.setPosition(st.place[0], st.place[1]); pl.body.reset(st.place[0], st.place[1]); for (let i = 0; i < 10; i++) await fr(); }
    P.axes[0] = st.ax ?? P.axes[0];
    if (st.jump != null) setB(0, st.jump);
    for (let i = 0; i < 600; i++) {
      await fr(); best = Math.min(best, pl.y);
      if (st.until === 'x' && pl.x >= st.v) break;
      if (st.until === 'fall' && i > 2 && pl.body.velocity.y > 0 && !pl.onGround) break;
      if (st.until === 'ground' && i > 2 && pl.onGround && pl.body.velocity.y >= 0) break;
      if (st.until === 'frames' && i >= st.v) break;
    }
  }
  P.axes[0] = 0; setB(0, false);
  for (let i = 0; i < 10; i++) await fr();
  return { x: Math.round(pl.x), y: Math.round(pl.y), g: pl.onGround, best: Math.round(best), deaths: g.deathLog.join(' ') };
}, steps);
await place(2480, 418); await wait(200);
const r1 = await route([{ ax: 1, until: 'x', v: 2620 }, { ax: 0.6, until: 'ground' }, { ax: 0, until: 'frames', v: 10 }]);
check('ressort : le second rebond fait passer le mur', r1.best < 250 && r1.x > 2580 && r1.y <= 300 && r1.g, JSON.stringify(r1));
const r2 = await route([{ place: [1000, 418], ax: 1, until: 'x', v: 1040 }, { jump: true, until: 'fall' }, { until: 'ground' }, { ax: 0, jump: false, until: 'frames', v: 10 }]);
check('on passe le faux sol par la plateforme du dessus', r2.best < 330 && r2.g && !r2.deaths && (Math.abs(r2.y - 345) < 3 || r2.x > 1340), JSON.stringify(r2));
// parcours complet du niveau sans téléportation (après la remise à zéro), comme un joueur
await p.evaluate(() => { const g = window.__NSF; g.scene.restart(); });
await wait(1500);
const J = (x) => [{ ax: 1, until: 'x', v: x }, { jump: true, until: 'fall' }, { jump: false, until: 'ground' }];
const full = await route([
  ...J(630), ...J(1040), { ax: 1, until: 'x', v: 1330 }, { until: 'ground' }, ...J(1620), ...J(1790),
  { ax: 1, until: 'x', v: 2500 }, { ax: 0, until: 'frames', v: 50 }, { ax: -1, until: 'frames', v: 20 }, { ax: 0, until: 'ground' },
  { ax: 1, until: 'x', v: 2620 }, { ax: 0.6, until: 'ground' }, ...J(2845), { ax: 1, until: 'x', v: 3200 }, { until: 'ground' },
  ...J(3250), { ax: 1, until: 'x', v: 3995 }, { ax: 0, until: 'frames', v: 140 }, { ax: 1, until: 'x', v: 4240 }, { ax: 0, until: 'frames', v: 120 },
]);
await wait(2500);
check('un robot finit le niveau sans téléportation', (await scene()).includes('Results'), JSON.stringify(full) + ' ' + (await scene()));
check('aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
await b.close();
process.exit(ko.length ? 1 : 0);
