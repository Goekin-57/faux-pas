import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H } from '../core/constants';
import { ensureCanvas } from '../art/textures';
import {
  paintMenuGround, paintNearPlants, paintIvy, paintForegroundLeaves,
  paintMenuGlow, paintMist, paintGlint
} from './paintMenu';

/** Hauteur de la surface du sol de l'accueil. */
export const MENU_GROUND = 646;

interface Layer {
  obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
  baseX: number;
  baseY: number;
  depth: number; // < 1 : derrière la scène, > 1 : devant (bouge davantage)
}

/**
 * Décor de l'écran d'accueil : diorama en couches.
 * La caméra ne bouge pas : chaque couche est décalée selon sa profondeur,
 * en fonction du pointeur et d'une lente respiration. La scène jouable (sol, héros,
 * pièges) reste fixe, donc la physique n'est jamais perturbée.
 */
export class MenuBackdrop {
  private layers: Layer[] = [];
  private px = 0;
  private py = 0;
  private tx = 0;
  private ty = 0;
  private time = 0;
  private sways: { obj: Phaser.GameObjects.Image; amp: number; speed: number; phase: number }[] = [];

  constructor(private scene: Phaser.Scene) {
    const s = scene;
    ensureCanvas(s, 'menu-ground', () => paintMenuGround(GAME_W + 120, GAME_H - MENU_GROUND + 30));
    ensureCanvas(s, 'menu-plants', () => paintNearPlants(1760, 330));
    ensureCanvas(s, 'menu-ivy-a', () => paintIvy(300, 3));
    ensureCanvas(s, 'menu-ivy-b', () => paintIvy(190, 8));
    ensureCanvas(s, 'menu-fg-br', () => paintForegroundLeaves(300, 200, 12, 'bottom'));
    ensureCanvas(s, 'menu-fg-tr', () => paintForegroundLeaves(230, 150, 31, 'top'));
    ensureCanvas(s, 'menu-glow', () => paintMenuGlow(GAME_W, GAME_H));
    ensureCanvas(s, 'menu-mist', () => paintMist(1600, 220));
    ensureCanvas(s, 'menu-glint', () => paintGlint(160, GAME_H + 200));

    // ciel et verrière
    s.add.image(0, 0, 'sky-c1').setOrigin(0).setDepth(DEPTH.sky);
    this.add(s.add.image(-120, -10, 'greenhouse').setOrigin(0).setDepth(DEPTH.far), 0.1);
    this.add(s.add.image(1480, -10, 'greenhouse').setOrigin(0).setDepth(DEPTH.far), 0.1);

    // reflets qui glissent sur les vitres
    for (let i = 0; i < 2; i++) {
      const g = s.add.image(-200 + i * 760, -80, 'menu-glint').setOrigin(0).setAngle(16)
        .setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.far + 1);
      s.tweens.add({ targets: g, x: g.x + 900, duration: 26000 + i * 7000, repeat: -1, delay: i * 5000, ease: 'Linear' });
    }

    // rayons de soleil
    [180, 560, 900, 1180].forEach((x, i) => {
      const ray = s.add.image(x, -60, 'ray').setOrigin(0.5, 0).setAngle(-18).setAlpha(0.18)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.rays).setScale(1 + (i % 2) * 0.3, 1);
      this.add(ray, 0.25);
      s.tweens.add({ targets: ray, alpha: 0.06 + (i % 3) * 0.03, duration: 3800 + i * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // végétation lointaine, moyenne, proche
    this.add(s.add.image(-200, GAME_H - 440, 'foliage-far').setOrigin(0).setDepth(DEPTH.mid), 0.22);
    this.add(s.add.rectangle(-200, GAME_H - 40, GAME_W + 400, 200, 0xb3d6c4).setOrigin(0).setDepth(DEPTH.mid - 1), 0.22);
    this.add(s.add.image(-420, GAME_H - 470, 'foliage-mid').setOrigin(0).setDepth(DEPTH.near), 0.42);
    this.add(s.add.rectangle(-200, GAME_H - 30, GAME_W + 400, 200, 0x86b49c).setOrigin(0).setDepth(DEPTH.near - 1), 0.42);

    // brume basse qui dérive lentement
    const mist = s.add.image(-160, MENU_GROUND - 190, 'menu-mist').setOrigin(0).setAlpha(0.85).setDepth(DEPTH.near + 2);
    this.add(mist, 0.55);
    s.tweens.add({ targets: mist, alpha: 0.5, duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add(s.add.image(-260, MENU_GROUND - 312, 'menu-plants').setOrigin(0).setDepth(DEPTH.backProps - 2), 0.72);

    // lierre suspendu à la charpente (se balance)
    const ivy = (key: string, x: number, depth: number, scale: number) => {
      const img = s.add.image(x, -12, key).setOrigin(0.5, 0).setScale(scale).setDepth(DEPTH.backProps - 1);
      this.add(img, depth);
      this.sways.push({ obj: img, amp: 1.6, speed: 0.6 + Math.random() * 0.3, phase: Math.random() * 6 });
    };
    ivy('menu-ivy-b', 606, 0.6, 0.9);
    ivy('menu-ivy-a', 1010, 0.8, 1);
    ivy('menu-ivy-b', 1236, 0.9, 1.1);

    // halo de lisibilité derrière le logo et le menu
    s.add.image(0, 0, 'menu-glow').setOrigin(0).setDepth(DEPTH.backProps - 0.5);

    // sol (fin) : il fait partie de la scène, il ne bouge pas
    s.add.image(-60, MENU_GROUND - 20, 'menu-ground').setOrigin(0).setDepth(DEPTH.terrain);

    // poussière dorée en suspension + grosses particules floues (profondeur de champ)
    s.add.particles(0, 0, 'dot-warm', {
      x: { min: 0, max: GAME_W }, y: { min: 40, max: MENU_GROUND },
      lifespan: 8000, speedX: { min: -6, max: 12 }, speedY: { min: -9, max: 4 },
      scale: { start: 0.05, end: 0.16 }, alpha: { start: 0.8, end: 0 },
      frequency: 260, maxAliveParticles: 30, blendMode: Phaser.BlendModes.ADD
    }).setDepth(DEPTH.rays + 1);
    s.add.particles(0, 0, 'dot-warm', {
      x: { min: 560, max: GAME_W }, y: { min: 60, max: 520 },
      lifespan: 9000, speedX: { min: -5, max: 5 }, speedY: { min: -4, max: 4 },
      scale: { start: 0.5, end: 0.9 }, alpha: { start: 0, end: 0.12, ease: 'Sine.easeInOut' },
      frequency: 1400, maxAliveParticles: 5, blendMode: Phaser.BlendModes.ADD
    }).setDepth(DEPTH.foreground - 1);

    // feuillage de premier plan (cadre à droite, loin de l'interface)
    this.add(s.add.image(GAME_W + 24, GAME_H + 26, 'menu-fg-br').setOrigin(1, 1).setAlpha(0.92).setDepth(DEPTH.foreground), 1.3);
    this.add(s.add.image(GAME_W + 30, -24, 'menu-fg-tr').setOrigin(1, 0).setAlpha(0.88).setDepth(DEPTH.foreground), 1.35);

    s.add.image(0, 0, 'vignette').setOrigin(0).setDepth(DEPTH.vignette).setAlpha(0.8);

    s.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      // p.x est en pixels du canevas (résolution réelle) : on normalise par sa taille
      const sw = s.scale.width, sh = s.scale.height;
      this.tx = Phaser.Math.Clamp(p.x / sw - 0.5, -0.5, 0.5) * 2;
      this.ty = Phaser.Math.Clamp(p.y / sh - 0.5, -0.5, 0.5) * 2;
    });
  }

  private add(obj: Layer['obj'], depth: number): void {
    this.layers.push({ obj, baseX: obj.x, baseY: obj.y, depth });
  }

  update(dt: number): void {
    this.time += dt;
    // lissage exponentiel du pointeur (indépendant du framerate) + lente respiration
    const k = 1 - Math.exp(-dt * 2.5);
    this.px += (this.tx - this.px) * k;
    this.py += (this.ty - this.py) * k;
    const driftX = Math.sin(this.time * 0.13) * 0.35;
    const driftY = Math.sin(this.time * 0.17 + 1) * 0.25;
    for (const l of this.layers) {
      const d = l.depth - 1; // 0 = plan de la scène
      l.obj.x = l.baseX + (this.px + driftX) * d * 22;
      l.obj.y = l.baseY + (this.py + driftY) * d * 8;
    }
    for (const s of this.sways) s.obj.setAngle(Math.sin(this.time * s.speed + s.phase) * s.amp);
  }
}
