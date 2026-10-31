const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
const only = process.argv[3] != null && process.argv[3] !== "all" ? +process.argv[3] : null;

let rafCb = null;
function mkEl(id) {
  const e = { id, hidden: false, textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, clientWidth: 48, width: 0, height: 0,
    classList: { add() {}, remove() {}, toggle() {} }, children: [], _l: {}, tagName: 'DIV', getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }, setAttribute() {}, focus() {}, blur() {}, select() {},
    appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); },
    getContext() {
      return new Proxy({}, { get: (o, k) => {
        if (k === 'measureText') return () => ({ width: 50 });
        if (k === 'createPattern') return () => ({});
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k in o) return o[k];
        return () => {};
      }, set: (o, k, v) => { o[k] = v; return true; } });
    } };
  return e;
}
const els = {};
const tabs = [0, 1, 2].map((w) => { const t = mkEl('tab' + w); t.dataset.w = String(w); return t; });
global.document = { getElementById: (id) => els[id] || (els[id] = mkEl(id)), createElement: () => mkEl('x'),
  querySelectorAll: (s) => (s === '.tab' ? tabs : []), documentElement: {}, fonts: null, addEventListener() {}, hidden: false, activeElement: null, body: { style: {}, dataset: {}, classList: { toggle() {}, remove() {} }, appendChild() {} }, querySelector: () => mkEl('q') };
global.window = { devicePixelRatio: 1, __FP_TEST: {} };
global.innerWidth = 1100; global.innerHeight = 760;
global.matchMedia = () => ({ matches: false });
global.getComputedStyle = () => ({ getPropertyValue: () => '#000' });
global.localStorage = { getItem: () => null, setItem() {} };
global.addEventListener = () => {};
global.requestAnimationFrame = (f) => { rafCb = f; };
global.performance = { now: () => 0 };
global.setTimeout = () => 0; global.clearTimeout = () => {};
eval(code);
const api = window.__FP_TEST.api;
let t = 0;
const frame = () => { t += 1000 / 60; rafCb(t); };

const cx = (P) => P.x + P.w / 2;
function runJumps(xs, invert = false) {
  let k = 0, hold = 0;
  return () => {
    const P = api.P; const a = { r: !invert, l: invert, j: false };
    if (hold > 0) { hold--; a.j = true; return a; }
    if (k < xs.length && cx(P) >= xs[k] && P.onGround) { k++; hold = 20; a.j = true; }
    return a;
  };
}
function seq(fns) { let i = 0; return () => fns[i](() => i++); }
const W = 960; const clampv = (v, a, c) => Math.max(a, Math.min(c, v));
const toward = (tx, dead = 4) => { const P = api.P; return { r: cx(P) < tx - dead, l: cx(P) > tx + dead }; };
function dodgeShock(a) {
  const P = api.P;
  for (const s of api.L.spikes) {
    if (!s.vx) continue;
    const gap = s.vx < 0 ? s.x - (P.x + P.w) : P.x - (s.x + s.w);
    if (gap > -4 && gap < 70 && P.onGround) a.j = true;
  }
  return a;
}
function bossBot(kind) {
  let hold = 0;
  return () => {
    const P = api.P, L = api.L, bo = L.boss;
    if (!bo || bo.dead) { const d = L.door; return toward(d.x + d.w / 2, 2); }
    const bc = bo.x + bo.w / 2, d = bc - cx(P);
    let a = { r: false, l: false, j: false };
    if (hold > 0) { hold--; a = { r: d > 0, l: d < 0, j: true }; if (!P.onGround) { a.r = d > 3; a.l = d < -3; } return a; }
    if (kind === 'grav') return toward(bc, 3);
    if (kind === 'rock') {
      if (bo.state === 'jump') {
        const land = bo.x1 + bo.w / 2; let away = cx(P) < land ? -1 : 1;
        if (cx(P) < 90) away = 1; if (cx(P) > W - 90) away = -1;
        if (Math.abs(cx(P) - land) < 150 || (cx(P) < 90 || cx(P) > W - 90)) a = { r: away > 0, l: away < 0 };
        return dodgeShock(a);
      }
      if (bo.state === 'idle') {
        if (!P.onGround) return { r: d > 3, l: d < -3, j: P.vy < 0 };
        a = { r: d > 0, l: d < 0 };
        if (api.L.spikes.some((s) => s.vx && (s.vx < 0 ? s.x > P.x : s.x < P.x) && Math.abs(s.x - P.x) < 200)) return dodgeShock(a);
        if (Math.abs(d) < bo.w / 2 + 34) { hold = 22; a.j = true; }
        return a;
      }
      return a;
    }
    // presse
    const span = P.x + P.w > bo.x - 12 && P.x < bo.x + bo.w + 12;
    if (bo.state === 'track') return toward(480, 40);
    if (bo.state === 'warn' || bo.state === 'slam') { if (span) { const go = bc > cx(P) ? -1 : 1; const g2 = (cx(P) < 70 && go < 0) || (cx(P) > W - 70 && go > 0) ? -go : go; return { r: g2 > 0, l: g2 < 0 }; } return a; }
    if (bo.state === 'stuck') {
      if (!P.onGround) return { r: d > 3, l: d < -3, j: P.vy < 0 };
      a = { r: d > 0, l: d < 0 };
      if (Math.abs(d) < bo.w / 2 + 34) { hold = 22; a.j = true; }
      return a;
    }
    return a;
  };
}

function blinkBot(finalJumps) {
  let k = 0, hold = 0; const fj = runJumps(finalJumps || []);
  return () => {
    const P = api.P, L = api.L, plats = L.blocks.filter((b) => b.blink && b.y > 300);
    const on = (b, t) => ((t + b.blink.ph) % (b.blink.on + b.blink.off)) < b.blink.on;
    if (hold > 0) { hold--; const tg = plats[k] || plats[plats.length - 1]; const tc = tg.x + tg.w / 2; return { r: cx(P) < tc - 4, l: cx(P) > tc + 4, j: true }; }
    if (k >= plats.length) return fj();
    const tgt = plats[k], tc = tgt.x + tgt.w / 2;
    if (!P.onGround) return { r: cx(P) < tc - 6, l: cx(P) > tc + 6 };
    if (P.on === tgt) { k++; return {}; }
    const t = L.time, ok = on(tgt, t + 0.4) && on(tgt, t + 0.8);
    const cur2 = P.on; const edge = cur2 ? Math.min(tgt.x - 36, cur2.x + cur2.w - 15) : tgt.x - 36;
    if (cx(P) < edge - 6) return { r: true };
    if (ok) { hold = 18; return { r: true, j: true }; }
    return { l: P.vx > 20 };
  };
}
function windBot() {
  let ph = 0, hold = 0;
  return () => {
    const P = api.P, L = api.L, zs = L.zones.filter((z) => z.type === 'wind');
    if (hold > 0) { hold--; return { r: true, j: true }; }
    if (ph >= 2) return { r: true };
    const z = zs[ph], edge = z.x - 16;
    const offFor = (() => { for (let d = 0; d < 1.5; d += 0.05) { const t = L.time + d; if (((t + (z.ph || 0)) % z.period) < z.on) return d; } return 9; })();
    if (cx(P) < edge - 4) return { r: true };
    if (P.onGround && offFor > 0.7) { ph++; hold = 22; return { r: true, j: true }; }
    return { l: P.vx > 20 };
  };
}
function yetiBot() {
  let hold = 0;
  return () => {
    const P = api.P, L = api.L, bo = L.boss;
    if (!bo || bo.dead) { const d = L.door; return toward(d.x + d.w / 2, 2); }
    const bc = bo.x + bo.w / 2, d = bc - cx(P);
    if (hold > 0) { hold--; return { j: true, r: bo.state === 'dizzy' && d > 3, l: bo.state === 'dizzy' && d < -3 }; }
    for (const bl of (L.balls || [])) {
      const appr = (bl.vx < 0 && bl.x > cx(P)) || (bl.vx > 0 && bl.x < cx(P));
      const gap = Math.abs(bl.x - cx(P)) - bl.r - 13;
      if (appr && gap < 55 && gap > -10 && P.onGround) { hold = 20; return { j: true }; }
    }
    if (bo.state === 'charge' || bo.state === 'warn') {
      const v = [430, 500, 570][bo.max - bo.hp];
      const front = bo.dir < 0 ? bo.x : bo.x + bo.w, toward2 = bo.dir < 0 ? cx(P) < front : cx(P) > front;
      const gap = Math.abs(front - cx(P)) - 13;
      if (bo.state === 'charge' && toward2 && gap < v * 0.23 && P.onGround) { hold = 30; return { j: true }; }
      return {};
    }
    if (bo.state === 'dizzy') {
      if (!P.onGround) return { r: d > 3, l: d < -3 };
      if (Math.abs(d) < bo.w / 2 + 34) { hold = 22; return { r: d > 0, l: d < 0, j: true }; }
      return { r: d > 0, l: d < 0 };
    }
    if (P.y + P.h <= bo.y + 4 && Math.abs(d) < bo.w / 2 + 20) return d > 0 ? { l: true } : { r: true };
    if (!P.onGround) return {};
    const want = bc > W / 2 ? 330 : 630;
    return toward(want, 20);
  };
}
function cursorBot() {
  let hold = 0;
  return () => {
    const P = api.P, L = api.L, bo = L.boss;
    if (!bo || bo.dead) { const d = L.door; return toward(d.x + d.w / 2, 2); }
    const tip = bo.x + bo.w / 2, d = tip - cx(P);
    if (hold > 0) { hold--; return { r: d > 3, l: d < -3, j: true }; }
    if (bo.state === 'warn' || bo.state === 'click') {
      if (Math.abs(d) < 95) { let go = d > 0 ? -1 : 1; if (cx(P) < 120 && go < 0) go = 1; if (cx(P) > W - 120 && go > 0) go = -1; return { r: go > 0, l: go < 0 }; }
      return {};
    }
    if (bo.state === 'loading') {
      if (!P.onGround) return { r: d > 3, l: d < -3 };
      let hl = tip, hr = tip;
      L.blocks.forEach((b) => { if (b.tile && !b.solid) { hl = Math.min(hl, b.x); hr = Math.max(hr, b.x + b.w); } });
      const spot = cx(P) < tip ? hl - 16 : hr + 16;
      if (Math.abs(cx(P) - spot) > 6) return toward(spot, 2);
      hold = 24; return { r: d > 0, l: d < 0, j: true };
    }
    return {};
  };
}

function introBot(L0) {
  const jumps = (L0.plan || []).slice().sort((a, b) => a - b); let k = 0, hold = 0;
  return () => {
    const P = api.P, inv = L0.zones.some((z) => z.type === 'inv' && cx(P) > z.x && cx(P) < z.x + z.w);
    const a = { r: !inv, l: inv };
    if (hold > 0) { hold--; a.j = true; return a; }
    while (k < jumps.length && cx(P) > jumps[k] + 40) k++;
    if (k < jumps.length && cx(P) >= jumps[k] && P.onGround) { k++; hold = 20; a.j = true; }
    return a;
  };
}
function awayFrom(x0) { const P = api.P; let go = cx(P) < x0 ? -1 : 1; if (cx(P) < 90) go = 1; if (cx(P) > W - 90) go = -1; return { r: go > 0, l: go < 0 }; }
function rockBot() {
  let hold = 0, passing = false;
  return () => {
    const P = api.P, L = api.L, bo = L.boss;
    if (!bo || bo.dead) { const d = L.door; return toward(d.x + d.w / 2, 2); }
    if (hold > 0) { hold--; if (bo.state === 'jump' && !passing) { const a = awayFrom(bo.x1 + bo.w / 2); a.j = true; return a; } return { j: true }; }
    for (const s of L.spikes) {
      if (!s.vx) continue;
      const gap = s.vx < 0 ? s.x - (P.x + P.w) : P.x - (s.x + s.w);
      if (gap > -4 && gap < 60 && P.onGround) { hold = 20; return { j: true }; }
    }
    const bc = bo.x + bo.w / 2;
    if (bo.state !== 'jump') passing = false;
    if (bo.state === 'jump') {
      const land = bo.x1 + bo.w / 2, sd = cx(P) < land ? -1 : 1;
      const mine = L.blocks.some((q) => q.crack && q.solid && Math.sign(q.x + q.w / 2 - land) === sd && Math.abs(q.x + q.w / 2 - land) > 130);
      void mine;
      if (passing) { if (bo.jt > 0.98) passing = false; return { r: sd < 0, l: sd > 0 }; }
      return Math.abs(cx(P) - land) < 150 ? awayFrom(land) : {};
    }
    if (bo.state === 'sunk' || !P.onGround) return {};
    const side = cx(P) < bc ? -1 : 1;
    const cracks = L.blocks.filter((b) => b.crack && b.solid).map((b) => b.x + b.w / 2).filter((c) => Math.abs(c - bc) > 130 && Math.sign(c - bc) === side);
    if (!cracks.length) return Math.abs(cx(P) - bc) < 160 ? awayFrom(bc) : {};
    if (!cracks.length) return {};
    cracks.sort((a, c) => Math.abs(a - cx(P)) - Math.abs(c - cx(P)));
    return toward(cracks[0], 4);
  };
}
function gravBot() {
  return () => {
    const P = api.P, L = api.L, bo = L.boss;
    if (!bo || bo.dead) { const d = L.door; return toward(d.x + d.w / 2, 2); }
    const bc = bo.x + bo.w / 2;
    if (bo.warn || !P.onGround) return Math.abs(cx(P) - bc) < 150 ? awayFrom(bc) : {};
    const orb = (L.orbs || []).find((o) => !o.homing && ((P.grav > 0) === (o.y > 240)));
    if (orb) return toward(orb.x, 4);
    return toward(clampv(bc + (cx(P) < bc ? -200 : 200), 60, W - 60), 10);
  };
}
function yetiBot2() {
  let hold = 0;
  return () => {
    const P = api.P, L = api.L, bo = L.boss;
    if (!bo || bo.dead) { const d = L.door; return toward(d.x + d.w / 2, 2); }
    const balls = (L.balls || []).filter((b) => !b.friendly);
    if (hold > 0) {
      hold--;
      const bl = balls.sort((a, c) => Math.abs(a.x - cx(P)) - Math.abs(c.x - cx(P)))[0];
      if (bl && !P.onGround && P.vy > 0) return { j: true, r: bl.x > cx(P) + 4, l: bl.x < cx(P) - 4 };
      return { j: true };
    }
    const v0 = [430, 500, 570][bo.max - bo.hp] / (bo.ease || 1);
    if (bo.state === 'charge') {
      const front = bo.dir < 0 ? bo.x : bo.x + bo.w, tw = bo.dir < 0 ? cx(P) < front : cx(P) > front;
      const gap = Math.abs(front - cx(P)) - 13;
      if (tw && gap < v0 * 0.23 && P.onGround) { hold = 30; return { j: true }; }
      return {};
    }
    if (bo.state === 'warn') return {};
    for (const bl of balls) {
      const appr = (bl.vx < 0 && bl.x > cx(P)) || (bl.vx > 0 && bl.x < cx(P));
      const d = Math.abs(bl.x - cx(P)), v = Math.abs(bl.vx);
      if (appr && P.onGround && ((d < v * 0.62 + 6 && d > v * 0.62 - 50) || d < bl.r + 48)) { hold = 26; return { j: true }; }
    }
    if (!P.onGround) return {};
    const bc = bo.x + bo.w / 2, want = clampv(bc > W / 2 ? bc - 300 : bc + 300, 80, W - 80);
    return toward(want, 15);
  };
}

function routeBot() {
  let k = 0, phase = null, hold = 0, frames = 0, dodge = 0, ddir = 1;
  return () => {
    const P = api.P, L = api.L, R = L.route || [];
    const inv = L.invertAll || L.zones.some((z) => z.type === 'inv' && !z.off && cx(P) > z.x && cx(P) < z.x + z.w && P.y + 15 > z.y && P.y + 15 < z.y + z.h);
    const out = (a) => { a = a || {}; if (inv) { const t = a.r; a.r = a.l; a.l = t; } return a; };
    if (dodge > 0) { dodge--; return out({ r: ddir > 0, l: ddir < 0, j: true }); }
    while (k < R.length) {
      const s = R[k];
      if (s.t === 'go') {
        if (s.dir == null) s.dir = s.x > cx(P) ? 1 : -1;
        if ((s.dir > 0 && cx(P) >= s.x) || (s.dir < 0 && cx(P) <= s.x)) { k++; continue; }
        if (P.onGround && L.balls) for (const bl of L.balls) {
          if (bl.friendly || Math.abs(bl.y + bl.r - (P.y + P.h)) > 10) continue;
          const ahead = (bl.x - cx(P)) * s.dir, closing = bl.vx * s.dir < 0;
          if (closing && ahead > 0 && ahead < 95) { dodge = 20; ddir = s.dir; return out({ r: s.dir > 0, l: s.dir < 0, j: true }); }
        }
        if (P.onGround && P.grav > 0 && L.mobs && L.mobs.length) {
          let wait = false;
          for (const m of L.mobs) {
            if (!m.alive || Math.abs(m.y + m.h - (P.y + P.h)) > 6) continue;
            const gap = s.dir > 0 ? m.x - (P.x + P.w) : P.x - (m.x + m.w);
            if (gap < -2 || gap > 120) continue;
            const toward = m.vx * s.dir < 0;
            if (toward && gap < 30) { dodge = 20; ddir = 0; return out({ j: true }); }
            if (toward ? gap < 70 : gap < 90) wait = true;
          }
          if (wait) return out({});
        }
        return out({ r: s.dir > 0, l: s.dir < 0 });
      }
      if (s.t === 'jump') {
        if (phase === null) { if (!P.onGround) return out({ r: s.d > 0, l: s.d < 0 }); phase = 'press'; hold = 20; }
        if (phase === 'press') { if (hold-- > 0) return out({ r: s.d > 0, l: s.d < 0, j: true }); phase = 'air'; frames = 0; }
        if (phase === 'air') { frames++; if (P.onGround && frames > 2) { phase = null; k++; continue; } return out({ r: s.d > 0, l: s.d < 0 }); }
      }
      if (s.t === 'hunt') {
        const tg = L.mobs[s.m];
        if (!tg || !tg.alive) { k++; continue; }
        const dir = tg.x + tg.w / 2 > cx(P) ? 1 : -1;
        if (!P.onGround) return out({});
        if (P.grav > 0) {
          let wait = false;
          for (const m of L.mobs) {
            if (!m.alive || Math.abs(m.y + m.h - (P.y + P.h)) > 6) continue;
            const md = m.x + m.w / 2 > cx(P) ? 1 : -1;
            const gap = md > 0 ? m.x - (P.x + P.w) : P.x - (m.x + m.w);
            if (gap < -2 || gap > 120) continue;
            const toward = m.vx * md < 0;
            if (toward && gap < 30) { dodge = 20; ddir = 0; return out({ j: true }); }
            if (toward ? gap < 70 : (m === tg && gap < 60)) wait = true;
          }
          if (wait) return out({});
        }
        return out({ r: dir > 0, l: dir < 0 });
      }
      if (s.t === 'until') { if (s.f(P, L)) { k++; continue; } return {}; }
      if (s.t === 'land') { frames++; if (P.onGround && frames > 4) { frames = 0; k++; continue; } return {}; }
      if (s.t === 'wrap') { if (L.v.wrapped) { k++; continue; } return out({ r: true }); }
      k++;
    }
    return {};
  };
}
let this32 = false;
const BOTS = {
  0: runJumps([400]), 1: runJumps([430]), 2: runJumps([470]), 3: runJumps([410]), 4: runJumps([625]),
  5: () => ({ r: true }),
  6: (() => { let ph = 0, w = 0, hold = 0; return () => { const P = api.P;
      if (hold > 0) { hold--; return { r: true, j: true }; }
      if (ph === 0) { if (cx(P) >= 555) ph = 1; return { r: ph === 0 }; }
      if (ph === 1) { if (++w > 55) ph = 2; return { l: P.vx > 20 }; }
      if (api.L.spikes.some((s) => s.dir === 'left' && s.x - (P.x + P.w) < 120 && s.x > P.x) && P.onGround) { hold = 20; return { r: true, j: true }; }
      return { r: true }; }; })(),
  7: rockBot(),
  8: runJumps([290]),
  9: (() => { let ph = 0; const jb = runJumps([692]); return () => { const P = api.P, c = api.L.get('cr');
      if (ph === 0) { if (cx(P) >= 366) ph = 1; return { r: true }; }
      if (ph === 1) { if (c.to && c.to.y === 40 && c.y + c.h < 365) ph = 2; return { l: P.vx > 20 }; }
      return jb(); }; })(),
  10: (() => { let ph = 0, hold = 0; return () => { const P = api.P, L = api.L, p1 = L.blocks[1], p2 = L.blocks[2];
      if (hold > 0) { hold--; return { r: true, j: true }; }
      if (ph === 0) { if (cx(P) >= 190) { ph = 1; } return { r: cx(P) < 190 }; }
      if (ph === 1) { if (p1.x < 270 && p1.dx > 0) { ph = 2; hold = 20; return { r: true, j: true }; } return { l: P.vx > 20 }; }
      if (ph === 2) { if (P.onGround && P.on === p1) ph = 3; return { r: P.y + P.h < 370 ? cx(P) < p1.x + 50 : true }; }
      if (ph === 3) { const target = p1.x + 55; if (p1.x >= 455) { ph = 4; hold = 20; return { r: true, j: true }; } return { r: cx(P) < target - 4, l: cx(P) > target + 4 }; }
      if (ph === 4) { if (P.onGround && P.on === p2) { ph = 5; hold = 20; return { r: true, j: true }; } return { r: true }; }
      return { r: true }; }; })(),
  11: runJumps([505, 765]), 12: runJumps([375, 592]), 13: runJumps([420]), 14: runJumps([330, 537]),
  15: bossBot('press'),
  16: () => ({ r: true }),
  17: (() => { let hold = 0; return () => { const P = api.P; const inZ = cx(P) > 260 && cx(P) < 760;
      const a = { r: !inZ, l: inZ };
      if (hold > 0) { hold--; a.j = true; return a; }
      for (const sx of [400, 580]) { const d = sx - (P.x + P.w); if (d > 0 && d < 34 && P.onGround) { hold = 20; a.j = true; } }
      return a; }; })(),
  18: (() => { let done = false, hold = 0; return () => { const P = api.P;
      if (hold > 0) { hold--; return { r: true, j: true }; }
      if (!done && P.grav < 0 && cx(P) >= 392 && P.onGround) { done = true; hold = 20; return { r: true, j: true }; }
      return { r: true }; }; })(),
  19: runJumps([255, 705]),
  20: runJumps([92, 250, 418, 585, 765]),
  21: runJumps([290, 440, 600]),
  22: () => ({ r: true }),
  23: gravBot(),
  24: runJumps([520, 700]),
  25: (() => { let ph = 0, w = 0; return () => { const P = api.P; if (ph === 0) { if (cx(P) >= 600) ph = 1; return { r: true }; } if (ph === 1) { if (++w > 70) ph = 2; return {}; } return { r: true }; }; })(),
  26: windBot(),
  27: runJumps([705]),
  28: (() => { let hold = 0, gapDone = false; return () => { const P = api.P;
      if (hold > 0) { hold--; return { r: true, j: true }; }
      for (const bl of api.L.balls) { const gap = bl.x - bl.r - (P.x + P.w); if (bl.vx < 0 && gap < 60 && gap > -8 && P.onGround) { hold = 20; return { r: true, j: true }; } }
      if (!gapDone && cx(P) >= 455 && P.onGround) { gapDone = true; hold = 20; return { r: true, j: true }; }
      return { r: true }; }; })(),
  29: (() => { let ph = 0, hold = 0; return () => { const P = api.P, L = api.L, p1 = L.blocks[1], p2 = L.blocks[2];
      if (hold > 0) { hold--; return { r: true, j: true }; }
      if (ph === 0) { if (cx(P) >= 190) ph = 1; return { r: cx(P) < 190 }; }
      if (ph === 1) { if (p1.x < 262 && p1.dx > 0) { ph = 2; hold = 20; return { r: true, j: true }; } return { l: P.vx > 20 }; }
      if (ph === 2) { if (P.onGround && P.on === p1) ph = 3; return { r: P.y + P.h < 370 ? cx(P) < p1.x + 50 : true }; }
      if (ph === 3) { const target = p1.x + 55; if (p1.x >= 425) { ph = 4; hold = 20; return { r: true, j: true }; } return { r: cx(P) < target - 4, l: cx(P) > target + 4 }; }
      if (ph === 4) { if (P.onGround && P.on === p2) { ph = 5; hold = 20; return { r: true, j: true }; } return { r: true }; }
      return { r: true }; }; })(),
  30: runJumps([715]),
  31: yetiBot2(),
  32: (() => { let hold = 0; return () => { const P = api.P, bar = api.L.get('bar');
      if (hold > 0) { hold--; return { r: true, j: true }; }
      if (bar.w < 470) { const tip = 260 + bar.w - 40; if (cx(P) < 200) return { r: true }; return { r: cx(P) < tip - 6, l: cx(P) > tip + 6 }; }
      if (!this32 && cx(P) >= 712 && P.onGround) { this32 = true; hold = 20; return { r: true, j: true }; }
      return { r: true }; }; })(),
  33: runJumps([520]),
  34: blinkBot([]),
  35: runJumps([400, 650]),
  36: runJumps([355, 575]),
  37: (() => { let ph = 0; const jb = runJumps([768]); return () => { const P = api.P, c = api.L.get('cr');
      if (ph === 0) { if (cx(P) >= 622) ph = 1; return { r: true }; }
      if (ph === 1) { if (c.to && c.to.y === 40 && c.y + c.h < 365) ph = 2; return { l: cx(P) > 605 || P.vx > 20 }; }
      return jb(); }; })(),
  38: blinkBot([665]),
  39: cursorBot(),
};

let fails = 0;
for (let i = 0; i < (api.NL || api.N); i++) {
  if (only != null && i !== only) continue;
  api.startLevel(i);
  if (process.env.DEATHS) api.setDeaths(+process.env.DEATHS);
  const bot = process.argv[4] === 'naive' ? (() => ({ r: true })) : BOTS[i];
  let hist = [], prevJ = false, f = 0, firstDeath = null, lastL = null, rb = null, xb = null;
  while (f < 60 * 120 && api.state !== 'replay') {
    const st = api.state;
    if (process.env.OFF && f < +process.env.OFF && st === 'play') { api.keys.left = api.keys.right = api.keys.jump = false; frame(); f++; continue; }
    if (st === 'play') {
      if (api.L !== lastL) { lastL = api.L; rb = api.L.room === 0 ? introBot(api.L) : null; xb = null; }
      if (!xb && api.L.route && api.L.room === 1 && process.argv[4] !== 'naive') {
        const e = api.L.ext; if (e.when ? e.when(api.P, api.L) : cx(api.P) >= e.start) xb = routeBot();
      }
      const a = (xb || ((api.L.room === 0 && process.argv[4] !== 'naive') ? rb : bot))() || {};
      api.keys.left = !!a.l; api.keys.right = !!a.r;
      if (a.j && !prevJ) api.pressJump();
      if (!a.j && prevJ) api.releaseJump();
      api.keys.jump = !!a.j; prevJ = !!a.j;
    }
    if (process.env.TR && st === 'play' && f % 6 === 0) console.log(`f${f} x=${api.P.x.toFixed(0)} y=${api.P.y.toFixed(0)} g=${api.P.onGround} on=${api.P.on ? (api.P.on.id || '') + '@' + api.P.on.x + ',' + api.P.on.y.toFixed(0) : '-'}`);
    if (process.env.DBG && st === 'play' && api.L.mobs && api.L.mobs.length) { hist.push(`f${f} P x=${api.P.x.toFixed(0)} y=${api.P.y.toFixed(0)} vx=${api.P.vx.toFixed(0)} vy=${api.P.vy.toFixed(0)} g=${api.P.onGround} | ` + api.L.mobs.map((m) => `${m.type} x=${m.x.toFixed(0)} vx=${m.vx} ${m.alive ? '' : 'mort'}`).join(' ')); if (hist.length > 50) hist.shift(); }
    if (st === 'dead') { if (process.env.DBG) console.log(hist.join('\n')); firstDeath = { room: api.L.room, x: Math.round(api.P.x), y: Math.round(api.P.y), g: api.P.grav, bs: api.L.boss ? api.L.boss.state + '/hp' + api.L.boss.hp : '' }; break; }
    frame(); f++;
  }
  const ok = api.state === 'replay' || api.state === 'next';
  if (!ok) fails++;
  const bo = api.L.boss;
  if (process.env.CNT) console.log("COINS", i, api.L.coins.filter((c) => !c.bait).length, "MOBS", api.L.mobs.length);
  console.log(`${i} ${ok ? 'OK ' : 'FAIL'} t=${(f / 60).toFixed(1)}s` + (firstDeath ? ` mort salle${firstDeath.room + 1} x=${firstDeath.x} y=${firstDeath.y} g=${firstDeath.g} ${firstDeath.bs}` : (ok ? '' : ` bloqué x=${Math.round(api.P.x)} y=${Math.round(api.P.y)} ${bo ? bo.state + ' hp' + bo.hp : ''}`)));
  api.keys.left = api.keys.right = api.keys.jump = false;
}
api.openMap(3); for (let k = 0; k < 120; k++) frame(); api.startLevel(8); for (let k = 0; k < 30; k++) frame(); api.pauseGame(); for (let k = 0; k < 10; k++) frame(); console.log('carte, écran de chapitre et pause : ok, état =', api.state);
console.log(fails ? `${fails} niveau(x) en échec` : 'Tous les niveaux sont réussis par le robot');
process.exit(0);
