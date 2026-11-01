import Phaser from 'phaser';
import { DEPTH, FONTS } from '../core/constants';

export interface LogConfig {
  x: number;       // bord gauche
  groundY: number;
  w: number;
  /** Hauteur intérieure (le héros y tient debout). */
  inner: number;
  sign?: string;
}

/**
 * Tronc creux — le FAUX RACCOURCI du 1-2.
 * Un panneau promet un raccourci. Le tronc est bouché au fond… par une petite fleur
 * qui éternue le curieux hors du tronc. On passe en marchant sur le tronc.
 * (Purement décoratif + deux corps statiques : le toit et le fond.)
 */
export class HollowLog {
  readonly solids: Phaser.GameObjects.Zone[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Graphics;
  private signObj?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, readonly cfg: LogConfig) {
    const { x, groundY: gy, w, inner } = cfg;
    const roofT = 22;
    const roofTop = gy - inner - roofT;
    const roof = scene.add.zone(x + w / 2, roofTop + roofT / 2, w, roofT);
    const back = scene.add.zone(x + w - 9, gy - inner / 2, 18, inner);
    for (const z of [roof, back]) {
      scene.physics.add.existing(z, true);
      this.solids.push(z);
    }

    // intérieur sombre + écorce
    this.gfx = scene.add.graphics().setDepth(DEPTH.backProps);
    const g = this.gfx;
    g.fillStyle(0x3a2418, 1);
    g.fillRect(x + 6, gy - inner, w - 10, inner);
    g.fillStyle(0x24150e, 0.6);
    for (let i = 0; i < 6; i++) g.fillEllipse(x + 30 + i * (w / 6), gy - inner * 0.55, 30, inner * 0.7);
    this.front = scene.add.graphics().setDepth(DEPTH.terrain + 3);
    const f = this.front;
    // toit d'écorce
    f.fillStyle(0x7a5232, 1);
    f.fillRoundedRect(x - 4, roofTop - 4, w + 8, roofT + 8, 10);
    f.fillStyle(0x9a6c42, 1);
    f.fillRoundedRect(x, roofTop - 2, w, 8, 4);
    f.lineStyle(2, 0x5a3a22, 0.8);
    for (let i = 0; i < 9; i++) f.lineBetween(x + 12 + i * (w / 9), roofTop + 4, x + 22 + i * (w / 9), roofTop + roofT);
    // mousse
    f.fillStyle(0x7db386, 1);
    for (let i = 0; i < 5; i++) f.fillEllipse(x + 20 + i * (w / 5), roofTop - 2, 26, 9);
    // bouche du tronc (anneaux de croissance) côté gauche
    f.lineStyle(10, 0x8a5e3a, 1);
    f.strokeEllipse(x + 2, gy - inner / 2 - roofT / 2 + 4, 26, inner + roofT + 6);
    f.lineStyle(2, 0xd9a874, 0.9);
    f.strokeEllipse(x + 2, gy - inner / 2 - roofT / 2 + 4, 16, inner + roofT - 6);
    // fond bouché
    f.fillStyle(0x6b4a2c, 1);
    f.fillRect(x + w - 18, gy - inner, 18, inner);
    f.fillStyle(0x8a6238, 1);
    f.fillRect(x + w - 18, gy - inner, 4, inner);

    if (cfg.sign) {
      const board = scene.add.graphics();
      board.fillStyle(0x6b4a2c, 1);
      board.fillRect(-4, -6, 8, 64);
      board.fillStyle(0xe7c38a, 1);
      board.fillPoints([
        new Phaser.Math.Vector2(-66, -36), new Phaser.Math.Vector2(50, -36), new Phaser.Math.Vector2(70, -18),
        new Phaser.Math.Vector2(50, 0), new Phaser.Math.Vector2(-66, 0)
      ], true);
      board.lineStyle(2, 0x9a6c42, 1);
      board.strokePoints([
        new Phaser.Math.Vector2(-66, -36), new Phaser.Math.Vector2(50, -36), new Phaser.Math.Vector2(70, -18),
        new Phaser.Math.Vector2(50, 0), new Phaser.Math.Vector2(-66, 0)
      ], true);
      const t = scene.add.text(-6, -18, cfg.sign, { fontFamily: FONTS.ui, fontSize: '16px', fontStyle: '600', color: '#5a3a22' }).setOrigin(0.5);
      this.signObj = scene.add.container(x - 50, gy - 58, [board, t]).setDepth(DEPTH.props);
      scene.tweens.add({ targets: this.signObj, angle: { from: -2, to: 2 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  destroy(): void {
    this.gfx.destroy();
    this.front.destroy();
    this.signObj?.destroy();
    this.solids.forEach((z) => z.destroy());
  }
}
