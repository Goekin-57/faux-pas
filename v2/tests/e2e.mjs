// Tests de bout en bout (Playwright) : menu, navigation, physique, mort, sauvegarde, fin de niveau.
// Lancer : (cd jeu-v2 && python3 -m http.server 4173) puis node v2/tests/e2e.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || '/tmp/';
const ok = [], ko = [];
const check = (name, cond, extra = '') => { (cond ? ok : ko).push(name + (extra ? ` (${extra})` : '')); console.log((cond ? 'OK  ' : 'NON ') + name, extra); };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL); await p.waitForTimeout(3500);
const gameNow = () => p.evaluate(() => window.__GT());
async function wait(ms) { const t0 = await gameNow(); for (let i = 0; i < 400; i++) { await p.waitForTimeout(40); if ((await gameNow()) - t0 >= ms) return; } }
const scene = () => p.evaluate(() => window.__GAME.scene.getScenes(true).map((s) => s.scene.key).join(','));
check('le menu s\'affiche', (await scene()).includes('Menu'), await scene());
await p.screenshot({ path: OUT + 'v2-menu.png' });
// navigation clavier : le premier bouton est sélectionné, flèche bas → un autre
const focus = () => p.evaluate(() => window.__NSF_MENU.group.index);
check('premier bouton sélectionné', (await focus()) === 0);
await p.keyboard.press('ArrowDown'); await wait(150);
check('flèche bas change la sélection', (await focus()) !== 0, String(await focus()));
// ouvrir les paramètres au clavier
await p.evaluate(() => { const m = window.__NSF_MENU; m.group.focus(m.group.items.findIndex((x) => x.list[1].text.includes('Paramètres'))); });
await p.keyboard.press('Enter'); await wait(500);
check('paramètres ouverts', await p.evaluate(() => !!window.__NSF_MENU.panel));
await p.screenshot({ path: OUT + 'v2-settings.png' });
await p.keyboard.press('ArrowRight'); await wait(150);
check('réglage du volume au clavier', await p.evaluate(() => Math.abs(JSON.parse(localStorage.getItem('not-so-fast-save-v1')).settings.master - 0.9) < 0.01));
await p.keyboard.press('Escape'); await wait(400);
check('Échap ferme le panneau', await p.evaluate(() => !window.__NSF_MENU.panel));
// lancer le jeu
await p.evaluate(() => { const m = window.__NSF_MENU; m.group.focus(0); });
await p.keyboard.press('Enter'); await wait(1500);
check('le niveau démarre', (await scene()).includes('Game'), await scene());
await p.screenshot({ path: OUT + 'v2-game.png' });
// physique : hauteur du saut ≈ 107 px
const jump = await p.evaluate(async () => {
  const g = window.__NSF; const y0 = g.player.y; let minY = y0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  for (let i = 0; i < 60; i++) { await new Promise((r) => requestAnimationFrame(r)); minY = Math.min(minY, g.player.y); }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  return y0 - minY;
});
check('hauteur de saut proche de 107 px', jump > 95 && jump < 120, jump.toFixed(1));
const shortJump = await p.evaluate(async () => {
  const g = window.__NSF; for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r)); const y0 = g.player.y; let minY = y0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  const t0 = window.__GT(); while (window.__GT() - t0 < 70) await new Promise((r) => setTimeout(r, 1));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  for (let i = 0; i < 50; i++) { await new Promise((r) => requestAnimationFrame(r)); minY = Math.min(minY, g.player.y); }
  return y0 - minY;
});
check('saut court plus bas (hauteur variable)', shortJump < jump - 8, shortJump.toFixed(1));   // marge large : le navigateur de test tourne au ralenti
// courir à droite : vitesse max 260
await p.keyboard.down('ArrowRight'); await wait(700);
const vx = await p.evaluate(() => window.__NSF.player.body.velocity.x);
await p.keyboard.up('ArrowRight');
check('vitesse de course 260', Math.abs(vx - 260) < 5, vx.toFixed(0));
// mort dans un trou puis réapparition
await p.evaluate(() => { const g = window.__NSF; g.player.rect.setPosition(600, 300); g.player.body.reset(600, 300); });
await wait(1800);
const st = await p.evaluate(() => ({ d: window.__NSF.deaths, x: window.__NSF.player.x, dead: window.__NSF.player.dead, hp: window.__NSF.player.hp }));
check('tomber dans un trou = 1 mort puis réapparition', st.d === 1 && !st.dead && st.x < 200 && st.hp === 3, JSON.stringify(st));
// faux sol : il tombe quand on marche dessus
await p.evaluate(() => { const g = window.__NSF; g.player.rect.setPosition(1020, 418); g.player.body.reset(1020, 418); });
await wait(250); await p.screenshot({ path: OUT + 'v2-crumble.png' });
await wait(1600);
check('le faux sol fait tomber', await p.evaluate(() => window.__NSF.deaths) === 2);
// ennemi : un coup retire un cœur
await wait(300);
await p.evaluate(() => { const g = window.__NSF; const s = g.snails[0]; s.x = 1700; s.vx = -45; g.player.rect.setPosition(1580, 418); g.player.body.reset(1580, 418); });
await p.keyboard.down('ArrowRight'); await wait(500); await p.keyboard.up('ArrowRight'); await wait(200);
check('l\'escargot retire un coup sans tuer (pansement visible)', await p.evaluate(() => window.__NSF.player.hp === 2 && !window.__NSF.player.dead), String(await p.evaluate(() => window.__NSF.player.hp)));
// pause au clavier
await p.keyboard.press('Escape'); await wait(400);
check('Échap met en pause', (await scene()).includes('Pause'), await scene());
await p.screenshot({ path: OUT + 'v2-pause.png' });
await p.keyboard.press('Escape'); await wait(300);
check('Échap reprend', !(await scene()).includes('Pause'));
// fausse victoire puis vraie sortie
await p.evaluate(() => { const g = window.__NSF; g.player.rect.setPosition(3060, 418); g.player.body.reset(3060, 418); });
await p.keyboard.down('ArrowRight'); await wait(500); await p.keyboard.up('ArrowRight');
await wait(400); await p.screenshot({ path: OUT + 'v2-fakewin.png' });
await wait(2300);
// la porte en carton est devenue un pont : on traverse le trou en marchant
await p.keyboard.down('ArrowRight'); await wait(1600); await p.keyboard.up('ArrowRight');
const cross = await p.evaluate(() => ({ x: Math.round(window.__NSF.player.x), y: Math.round(window.__NSF.player.y), d: window.__NSF.deathLog.join(' ') }));
check('la fausse porte devient un pont au-dessus du trou', cross.x > 3290 && cross.y <= 421, JSON.stringify(cross));
await p.keyboard.down('ArrowRight'); await wait(900); await p.keyboard.up('ArrowRight');
await wait(2600);
const dl = await p.evaluate(() => window.__NSF.deathLog.join(' '));
console.log('causes des morts :', dl);
check('la sortie mène aux résultats', (await scene()).includes('Results'), await scene());
await p.screenshot({ path: OUT + 'v2-results.png' });
const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('not-so-fast-save-v1')));
check('résultat sauvegardé', sv.levels['1-1'] && sv.levels['1-1'].done, JSON.stringify(sv.levels['1-1']));
// une touche maintenue ne valide pas l'écran deux fois ; Entrée → menu
await wait(1000); await p.keyboard.press('Enter'); await wait(1200);
check('Entrée sur les résultats → menu', (await scene()).includes('Menu'), await scene());
check('aucune erreur JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log('RÉUSSIS :\n  ' + ok.join('\n  '));
console.log('ÉCHECS :\n  ' + (ko.length ? ko.join('\n  ') : 'aucun'));
await b.close();
process.exit(ko.length ? 1 : 0);
