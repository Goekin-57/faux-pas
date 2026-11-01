import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H } from '../core/constants';
import { ensureCanvas } from '../art/textures';
import { canvas } from '../art/paint';
import { DISPLAY } from '../core/Display';
import type { LevelData } from '../levels/types';
import type { Player } from '../player/Player';
import {
  paintNightSky, paintForest, paintFacade, paintRoomWall, paintInteriorWindow, paintFrame, paintBookcase,
  paintClock, paintPumpkin, paintMist, paintDarkness, paintBat, paintGrate, paintChandelier
} from './art';
import { ROOMS, AMBIENCE, WALL_PROPS, Z, type WallProp } from './layout';

export { paintManorTerrain, paintSpikes } from './art';

/** Profondeurs propres au manoir : l'obscurité passe au-dessus du monde, les flammes au-dessus d'elle. */
export const MDEPTH = { dark: DEPTH.foreground + 4, glow: DEPTH.foreground + 6, tint: DEPTH.foreground + 3 };

/**
 * Éclairage du manoir : teinte par zone + obscurité qui entoure le héros (halo doux).
 * Le script peut assombrir davantage (salle de bal, phase 2) ou faire vaciller (couloir interdit).
 */
export class ManorAmbience {
  extraDark = 0;
  flicker = 0;
  private tint: Phaser.GameObjects.Rectangle;
  private dark: Phaser.GameObjects.Image;
  private time = 0;
  private cur = { tint: 0x1c1650, tintA: 0.16, dark: 0.05 };
  readonly glows: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene) {
    this.tint = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x1c1650, 0.16).setOrigin(0).setScrollFactor(0).setDepth(MDEPTH.tint);
    ensureCanvas(scene, 'mn-dark', () => paintDarkness(GAME_W * 2, GAME_H * 2));
    this.dark = scene.add.image(0, 0, 'mn-dark').setScrollFactor(0).setDepth(MDEPTH.dark).setDisplaySize(GAME_W * 2, GAME_H * 2);
  }

  /** Réglages cibles à une abscisse (interpolés aux frontières des zones). */
  private targetAt(x: number): { tint: number; tintA: number; dark: number } {
    const i = AMBIENCE.findIndex((a) => x >= a.x0 && x < a.x1);
    const a = AMBIENCE[Math.max(0, i)];
    if (i < 0) return a;
    const blend = 260;
    const n = AMBIENCE[i + 1];
    if (n && n.x0 === a.x1 && x > a.x1 - blend) {
      const k = (x - (a.x1 - blend)) / blend;
      return {
        tint: Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(a.tint), Phaser.Display.Color.ValueToColor(n.tint), 100, k * 100
        ).color ?? a.tint,
        tintA: a.tintA + (n.tintA - a.tintA) * k,
        dark: a.dark + (n.dark - a.dark) * k
      };
    }
    return a;
  }

  update(dt: number, player: Player): void {
    this.time += dt;
    const t = this.targetAt(player.x);
    const k = Math.min(1, dt * 3);
    this.cur.tintA += (t.tintA - this.cur.tintA) * k;
    this.cur.dark += (t.dark + this.extraDark - this.cur.dark) * k;
    this.cur.tint = t.tint;
    this.tint.setFillStyle(this.cur.tint, this.cur.tintA);
    // vacillement : somme de sinus (déterministe), jamais de noir complet
    const fl = this.flicker > 0
      ? (Math.sin(this.time * 23) * 0.5 + Math.sin(this.time * 7.3) * 0.5 > 0.55 ? 0.22 : 0) * this.flicker
      : 0;
    this.dark.setAlpha(Phaser.Math.Clamp(this.cur.dark + fl, 0, 0.82));
    const cam = this.scene.cameras.main;
    const sx = player.x - cam.scrollX, sy = player.y - cam.scrollY;
    this.dark.setPosition(sx, sy);
    // les flammes respirent
    for (let i = 0; i < this.glows.length; i++) {
      const g = this.glows[i];
      g.setAlpha(0.5 + Math.sin(this.time * 9 + i * 1.7) * 0.08 + Math.sin(this.time * 23 + i) * 0.05);
    }
  }

  destroy(): void {
    this.tint.destroy();
    this.dark.destroy();
  }
}

/** Flamme animée (bougie, applique, lustre) : petite forme + halo additif au-dessus de l'obscurité. */
export function addFlame(scene: Phaser.Scene, amb: ManorAmbience | null, x: number, y: number, scale = 1): Phaser.GameObjects.Image {
  ensureCanvas(scene, 'mn-flame', () => {
    const [c, ctx] = canvas(16, 26);
    const g = ctx.createRadialGradient(8, 18, 1, 8, 16, 12);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.5, '#ffd36b');
    g.addColorStop(1, 'rgba(242,140,56,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 1);
    ctx.quadraticCurveTo(15, 14, 8, 25);
    ctx.quadraticCurveTo(1, 14, 8, 1);
    ctx.fill();
    return c;
  });
  const f = scene.add.image(x, y, 'mn-flame').setOrigin(0.5, 1).setScale(scale).setDepth(MDEPTH.glow);
  scene.tweens.add({ targets: f, scaleX: scale * 0.82, scaleY: scale * 1.12, duration: 180 + ((x * 7) % 90), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const halo = scene.add.image(x, y - 8 * scale, 'dot-warm').setScale(1.6 * scale).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(MDEPTH.glow - 1);
  amb?.glows.push(halo);
  return f;
}

/** Visage de citrouille lanterne (forme taillée lumineuse). */
export function drawCarvedFace(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, mood: 'grin' | 'watch' | 'scared' | 'angry' | 'dizzy', lookX = 0, alpha = 1): void {
  g.fillStyle(0xffd36b, alpha);
  const ex = r * 0.34, ey = -r * 0.12, es = r * 0.2;
  const lx = lookX * r * 0.08;
  if (mood === 'scared') {
    g.fillCircle(x - ex + lx, y + ey, es * 0.75);
    g.fillCircle(x + ex + lx, y + ey, es * 0.75);
    g.fillEllipse(x + lx, y + r * 0.38, r * 0.26, r * 0.32);
    return;
  }
  if (mood === 'dizzy') {
    g.lineStyle(Math.max(2, r * 0.08), 0xffd36b, alpha);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(x + s * ex - es * 0.6, y + ey - es * 0.6); g.lineTo(x + s * ex + es * 0.6, y + ey + es * 0.6);
      g.moveTo(x + s * ex + es * 0.6, y + ey - es * 0.6); g.lineTo(x + s * ex - es * 0.6, y + ey + es * 0.6);
      g.strokePath();
    }
    g.fillEllipse(x, y + r * 0.38, r * 0.5, r * 0.14);
    return;
  }
  const tilt = mood === 'angry' ? es * 0.5 : 0;
  g.fillTriangle(x - ex - es + lx, y + ey + es * 0.7, x - ex + es + lx, y + ey + es * 0.7 + tilt * 0.3, x - ex + lx, y + ey - es + tilt);
  g.fillTriangle(x + ex - es + lx, y + ey + es * 0.7 + tilt * 0.3, x + ex + es + lx, y + ey + es * 0.7, x + ex + lx, y + ey - es + tilt);
  // bouche dentelée
  const mw = r * 0.62, my = y + r * 0.3;
  g.beginPath();
  g.moveTo(x - mw + lx, my);
  for (let i = 0; i <= 6; i++) g.lineTo(x - mw + (i / 6) * mw * 2 + lx, my + (i % 2 ? r * 0.08 : -r * 0.02));
  g.lineTo(x + mw * 0.8 + lx, my + r * 0.2);
  g.lineTo(x - mw * 0.8 + lx, my + r * 0.2);
  g.closePath();
  g.fillPath();
  if (mood === 'watch') {
    // pupilles qui suivent
    g.fillStyle(0x3a1a08, alpha);
    g.fillCircle(x - ex + lx * 2.2, y + ey + es * 0.25, es * 0.25);
    g.fillCircle(x + ex + lx * 2.2, y + ey + es * 0.25, es * 0.25);
  }
}

export function buildManorBackdrop(scene: Phaser.Scene, L: LevelData): ManorAmbience {
  const W = L.width;
  ensureCanvas(scene, 'mn-sky', () => paintNightSky(GAME_W, GAME_H));
  scene.add.image(0, 0, 'mn-sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);

  const layer = (key: string, sf: number, screenY: number, tileW: number, depth: number) => {
    const span = (W - GAME_W) * sf + GAME_W + tileW;
    for (let x = -tileW * 0.3; x < span; x += tileW) {
      scene.add.image(x, screenY + 180 * sf, key).setOrigin(0, 0).setScrollFactor(sf).setDepth(depth);
    }
  };
  ensureCanvas(scene, 'mn-forest-far', () => paintForest(1600, 460, 31, false));
  ensureCanvas(scene, 'mn-forest-near', () => paintForest(1600, 560, 57, true));
  layer('mn-forest-far', 0.15, GAME_H - 460, 1600, DEPTH.far);
  layer('mn-forest-near', 0.4, GAME_H - 520, 1600, DEPTH.mid);
  scene.add.rectangle(0, GAME_H - 30 + 180 * 0.4, (W - GAME_W) * 0.4 + GAME_W * 2, 800, 0x191231).setOrigin(0).setScrollFactor(0.4).setDepth(DEPTH.mid - 1);

  // façade du manoir derrière la cour, et son revers à la sortie
  ensureCanvas(scene, 'mn-facade', () => paintFacade(680, 600));
  scene.add.image(Z.courtyard[1] + 10, 600, 'mn-facade').setOrigin(1, 1).setDepth(DEPTH.near + 1);
  scene.add.image(Z.forest[0] - 10, 560, 'mn-facade').setOrigin(0, 1).setFlipX(true).setDepth(DEPTH.near + 1);
  // grille d'entrée ouverte (départ)
  ensureCanvas(scene, 'mn-grate-bg', () => paintGrate(120, 230));
  scene.add.image(-30, 600, 'mn-grate-bg').setOrigin(0, 1).setAngle(-8).setDepth(DEPTH.backProps);
  const pillar = scene.add.graphics().setDepth(DEPTH.backProps + 1);
  pillar.fillStyle(0x4a4670, 1);
  pillar.fillRect(86, 330, 40, 270);
  pillar.fillStyle(0x6f7690, 1);
  pillar.fillRect(80, 320, 52, 16);

  // murs intérieurs (au-dessus des fonds extérieurs)
  const TILE = 640;
  for (const room of ROOMS) {
    for (let v = 0; v < 2; v++) ensureCanvas(scene, `mn-wall-${room.kind}-${v}`, () => paintRoomWall(room.kind, TILE, 1040, 900 + v * 31 + room.kind.length));
    let v = 0;
    for (let x = room.x0; x < room.x1; x += TILE) {
      const img = scene.add.image(x, -40, `mn-wall-${room.kind}-${v++ % 2}`).setOrigin(0).setDepth(DEPTH.near);
      const rest = room.x1 - x;
      if (rest < TILE) img.setCrop(0, 0, rest, 1040);
    }
    // piliers d'encadrement
    const g = scene.add.graphics().setDepth(DEPTH.near + 2);
    for (const px of [room.x0, room.x1]) {
      g.fillStyle(0x1a1533, 1);
      g.fillRect(px - 14, -40, 28, 1040);
      g.fillStyle(0x4a4670, 0.6);
      g.fillRect(px - 10, -40, 5, 1040);
    }
  }

  const amb = new ManorAmbience(scene);
  for (const p of WALL_PROPS) placeProp(scene, amb, p);

  // brume au sol (cour et forêt) — dérive lente
  ensureCanvas(scene, 'mn-mist', () => paintMist(900, 160));
  for (const [x0, x1, y] of [[Z.courtyard[0], Z.courtyard[1], 470], [Z.forest[0], Z.forest[1], 430]] as const) {
    for (let x = x0 - 200; x < x1; x += 700) {
      const m = scene.add.image(x, y, 'mn-mist').setOrigin(0).setAlpha(0.8).setDepth(DEPTH.frontProps - 1);
      scene.tweens.add({ targets: m, x: x + 120, duration: 9000 + (x % 3000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // chauves-souris : vols réguliers au-dessus de la cour et de la forêt
  ensureCanvas(scene, 'mn-bat', () => paintBat(14));
  const flock = (x: number, y: number, delay: number) => {
    scene.time.addEvent({
      delay, loop: true, startAt: delay * 0.7, callback: () => {
        for (let i = 0; i < 4; i++) {
          const b = scene.add.image(x - i * 40, y + (i % 2) * 24, 'mn-bat').setScale(0.6 + (i % 3) * 0.15).setDepth(DEPTH.mid + 2).setScrollFactor(0.6);
          scene.tweens.add({ targets: b, scaleY: { from: b.scaleY, to: b.scaleY * 0.4 }, duration: 110, yoyo: true, repeat: -1 });
          scene.tweens.add({
            targets: b, x: x + 1500, y: y - 140 + i * 20, duration: 5200 + i * 300, ease: 'Sine.easeIn',
            onComplete: () => b.destroy()
          });
        }
      }
    });
  };
  flock(-200, 220, 9000);
  flock(Z.forest[0] * 0.6 - 300, 200, 11000);

  // réglage « netteté économe » : on garde l'ambiance, sans les particules d'agrément
  if (DISPLAY.quality === 'perf') return amb;
  // feuilles mortes dans la cour
  scene.add.particles(0, 0, 'leaf', {
    x: { min: 0, max: Z.courtyard[1] }, y: -20, lifespan: 7000, speedX: { min: -30, max: 30 }, speedY: { min: 30, max: 60 },
    scale: { start: 0.35, end: 0.25 }, rotate: { min: 0, max: 360 }, frequency: 900, tint: [0xc4561c, 0x8a5a2a, 0xd9a23a]
  }).setDepth(DEPTH.frontProps);
  // poussière en suspension à l'intérieur (suit la caméra, très discrète)
  scene.add.particles(0, 0, 'dot-warm', {
    x: { min: 0, max: GAME_W }, y: { min: 0, max: GAME_H }, lifespan: 5000, speedX: { min: -6, max: 6 }, speedY: { min: -4, max: 4 },
    scale: { start: 0.06, end: 0 }, alpha: { start: 0.5, end: 0 }, frequency: 220, blendMode: Phaser.BlendModes.ADD
  }).setScrollFactor(0).setDepth(DEPTH.fx);

  return amb;
}

function placeProp(scene: Phaser.Scene, amb: ManorAmbience, p: WallProp): void {
  const D = DEPTH.backProps;
  switch (p.t) {
    case 'window': {
      const key = ensureCanvas(scene, `mn-win-${p.w}-${p.h}-${p.moon ? 1 : 0}`, () => paintInteriorWindow(p.w, p.h, !!p.moon));
      scene.add.image(p.x - 12, p.y - 30, key).setOrigin(0).setDepth(D - 1);
      // rayon de lune au sol
      if (p.moon) {
        const ray = scene.add.image(p.x + p.w / 2, p.y + 40, 'ray').setOrigin(0.5, 0).setAngle(-14).setAlpha(0.1)
          .setTint(0xc8c0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D);
        scene.tweens.add({ targets: ray, alpha: 0.05, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      break;
    }
    case 'sconce': {
      const g = scene.add.graphics().setDepth(D);
      g.fillStyle(0x2a2236, 1);
      g.fillRect(p.x - 3, p.y, 6, 26);
      g.fillRoundedRect(p.x - 12, p.y + 22, 24, 6, 3);
      g.fillStyle(0xfff0c8, 1);
      g.fillRoundedRect(p.x - 4, p.y + 2, 8, 20, 2);
      addFlame(scene, amb, p.x, p.y + 3, 0.9);
      break;
    }
    case 'chandelier': {
      const w = p.w ?? 120;
      const key = ensureCanvas(scene, `mn-chand-${w}`, () => paintChandelier(w));
      const g = scene.add.graphics().setDepth(D);
      g.lineStyle(3, 0x1a1533, 1);
      g.lineBetween(p.x, -40, p.x, p.y);
      const img = scene.add.image(p.x, p.y, key).setOrigin(0.5, 0).setDepth(D);
      scene.tweens.add({ targets: img, angle: { from: -1.5, to: 1.5 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      for (let i = -2; i <= 2; i++) addFlame(scene, amb, p.x + i * w * 0.21, p.y + 20, 0.7);
      break;
    }
    case 'clock': {
      const key = ensureCanvas(scene, 'mn-clock', () => paintClock(70, 260));
      scene.add.image(p.x, p.y + 260, key).setOrigin(0.5, 1).setDepth(D);
      const pend = scene.add.graphics().setDepth(D + 0.5).setPosition(p.x, p.y + 120);
      pend.lineStyle(2, 0xd9a23a, 1);
      pend.lineBetween(0, 0, 0, 80);
      pend.fillStyle(0xd9a23a, 1);
      pend.fillCircle(0, 84, 8);
      scene.tweens.add({ targets: pend, angle: { from: -14, to: 14 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      break;
    }
    case 'shelf': {
      const key = ensureCanvas(scene, `mn-shelf-${p.w}-${p.h}`, () => paintBookcase(p.w, p.h, p.x));
      scene.add.image(p.x, p.y, key).setOrigin(0).setDepth(D);
      break;
    }
    case 'tapestry': {
      const g = scene.add.graphics().setDepth(D);
      g.fillStyle(0x1a1533, 1);
      g.fillRect(p.x - 8, p.y - 6, p.w + 16, 8);
      g.fillStyle(p.color, 1);
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle(0xd9a23a, 0.8);
      g.fillRect(p.x, p.y + 10, p.w, 4);
      g.fillRect(p.x, p.y + p.h - 14, p.w, 4);
      g.fillTriangle(p.x, p.y + p.h, p.x + p.w / 2, p.y + p.h + 22, p.x + p.w, p.y + p.h);
      g.fillStyle(0xffe9a8, 0.35);
      g.fillCircle(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.22);
      break;
    }
    case 'frame': {
      const key = ensureCanvas(scene, `mn-frame-${p.w}-${p.h}`, () => paintFrame(p.w, p.h));
      const g = scene.add.graphics().setDepth(D);
      g.fillStyle(0x1d2350, 1);
      g.fillRect(p.x + 12, p.y + 12, p.w, p.h);
      if (p.scene === 'moon') { g.fillStyle(0xf7ecc4, 1); g.fillCircle(p.x + 12 + p.w * 0.65, p.y + 12 + p.h * 0.35, p.w * 0.16); }
      if (p.scene === 'pumpkin') { g.fillStyle(0xf28c38, 1); g.fillEllipse(p.x + 12 + p.w / 2, p.y + 12 + p.h * 0.65, p.w * 0.6, p.h * 0.45); }
      if (p.scene === 'ghost') { g.fillStyle(0xc9ffe8, 0.9); g.fillEllipse(p.x + 12 + p.w / 2, p.y + 12 + p.h * 0.5, p.w * 0.45, p.h * 0.6); }
      scene.add.image(p.x, p.y, key).setOrigin(0).setDepth(D + 0.1);
      break;
    }
    case 'column': {
      const g = scene.add.graphics().setDepth(D + 1);
      g.fillStyle(0x3d4260, 1);
      g.fillRect(p.x - 22, p.y - p.h, 44, p.h);
      g.fillStyle(0x6f7690, 1);
      g.fillRect(p.x - 16, p.y - p.h, 8, p.h);
      g.fillStyle(0x4a4f6c, 1);
      g.fillRect(p.x - 30, p.y - p.h - 14, 60, 16);
      g.fillRect(p.x - 30, p.y - 14, 60, 14);
      break;
    }
    case 'pumpkin': {
      const key = ensureCanvas(scene, `mn-pk-${p.r}`, () => paintPumpkin(p.r, p.r));
      scene.add.image(p.x, p.y + 4, key).setOrigin(0.5, 1).setDepth(DEPTH.props - 1);
      if (p.lit) {
        const g = scene.add.graphics().setDepth(DEPTH.props);
        drawCarvedFace(g, p.x, p.y - p.r - 2, p.r, 'grin');
        const halo = scene.add.image(p.x, p.y - p.r, 'dot-warm').setScale(p.r / 9).setAlpha(0.45).setTint(0xffa040)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(MDEPTH.glow - 1);
        amb.glows.push(halo);
      }
      break;
    }
    case 'cobweb': {
      const g = scene.add.graphics().setDepth(DEPTH.frontProps);
      const dir = p.flip ? -1 : 1;
      g.lineStyle(1.2, 0xdcdcf0, 0.45);
      for (let k = 0; k < 6; k++) g.lineBetween(p.x, p.y, p.x + dir * Math.cos(k * 0.3) * 110, p.y + Math.sin(k * 0.3) * 110);
      for (let ring = 1; ring < 6; ring++) {
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const px = p.x + dir * Math.cos(k * 0.3) * ring * 20, py = p.y + Math.sin(k * 0.3) * ring * 20;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokePath();
      }
      break;
    }
    case 'armor': {
      const g = scene.add.graphics().setDepth(D + 1);
      g.fillStyle(0x6f7690, 1);
      g.fillRoundedRect(p.x - 18, p.y - 120, 36, 70, 8);
      g.fillCircle(p.x, p.y - 136, 16);
      g.fillRect(p.x - 14, p.y - 50, 10, 50);
      g.fillRect(p.x + 4, p.y - 50, 10, 50);
      g.fillStyle(0x24306a, 1);
      g.fillRect(p.x - 10, p.y - 140, 20, 4);
      g.lineStyle(3, 0xa3a9c0, 1);
      g.lineBetween(p.x + 26, p.y - 170, p.x + 26, p.y);
      break;
    }
  }
}

