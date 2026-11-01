// Captures d'écran de contrôle (lisibilité, indices) : node v2/tests/shots.mjs <dossier>
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const OUT = process.argv[2] || '.';
const URL = process.env.URL || 'http://localhost:4173/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL); await p.waitForTimeout(3000);
const gt = () => p.evaluate(() => window.__GT());
const wait = async (ms) => { const t0 = await gt(); while ((await gt()) - t0 < ms) await p.waitForTimeout(30); };
const shots = JSON.parse(process.env.SHOTS || '[]');
for (const s of shots) {
  await p.evaluate(([s]) => {
    window.__SAVE.data.settings.readable = !!s.readable;
    const g = window.__GAME, act = g.scene.getScenes(true).map((x) => x.scene.key);
    const data = { level: s.level, deaths: s.deaths || 0, deathXs: s.deathXs || [], deathPts: s.deathPts || [], cause: s.cause };
    if (act.includes('Game')) { act.filter((k) => k !== 'Game').forEach((k) => g.scene.stop(k)); g.scene.getScene('Game').scene.restart(data); }
    else g.scene.getScene(act[0]).scene.start('Game', data);
  }, [s]);
  await wait(500);
  if (s.x != null) await p.evaluate(([x, y]) => { const pl = window.__NSF.player; pl.rect.setPosition(x, y); pl.body.reset(x, y); pl.invuln = 99; }, [s.x, s.y ?? 420]);
  if (s.eval) await p.evaluate(s.eval);
  await wait(s.wait ?? 900);
  await p.screenshot({ path: `${OUT}/${s.name}.png` });
}
console.log('erreurs:', errs.slice(0, 3).join(' | ') || 'aucune');
await b.close();
