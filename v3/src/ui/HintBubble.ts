import Phaser from 'phaser';
import { DEPTH, FONTS } from '../core/constants';
import type { HintDef } from '../levels/types';
import type { Player } from '../player/Player';

/**
 * Indices contextuels d'un niveau. Un indice s'affiche seulement si le joueur reste
 * longtemps dans une zone sans résoudre le passage ; il disparaît dès que c'est résolu.
 * Petite bulle dans le monde (pas un panneau), une icône + quelques mots.
 */
export class HintSystem {
  private timers = new Map<string, number>();
  private shown = new Map<string, Phaser.GameObjects.Container>();
  private solved = new Set<string>();

  constructor(private scene: Phaser.Scene, private hints: HintDef[], private player: Player) {}

  update(dt: number): void {
    const p = this.player;
    if (!p.alive) return;
    for (const h of this.hints) {
      if (this.solved.has(h.id)) continue;
      const b = p.body;
      const cx = b.x + b.halfWidth;
      const done = (h.solvedBelowY !== undefined && b.bottom > h.solvedBelowY) ||
        (h.solvedRightOf !== undefined && cx > h.solvedRightOf) ||
        (h.solvedAboveY !== undefined && b.bottom < h.solvedAboveY);
      if (done) {
        this.solved.add(h.id);
        this.hide(h.id);
        continue;
      }
      const inside = cx > h.area.x && cx < h.area.x + h.area.w && b.bottom <= h.area.yMax;
      if (inside) {
        const t = (this.timers.get(h.id) ?? 0) + dt;
        this.timers.set(h.id, t);
        if (t >= h.after && !this.shown.has(h.id)) this.show(h);
      }
    }
  }

  /** Une mort ne réinitialise pas le compteur : celui qui meurt en boucle a d'autant plus besoin d'aide. */
  private show(h: HintDef): void {
    const s = this.scene;
    const icon = s.add.graphics();
    this.drawIcon(icon, h.icon);
    const t = s.add.text(16, 0, h.text, { fontFamily: FONTS.ui, fontSize: '16px', fontStyle: '600', color: '#24306a' }).setOrigin(0, 0.5);
    const w = t.width + 50, hh = 38;
    const bg = s.add.graphics();
    bg.fillStyle(0x16302f, 0.18);
    bg.fillRoundedRect(-24, -hh / 2 + 4, w, hh, hh / 2);
    bg.fillStyle(0xfffaf0, 0.94);
    bg.fillRoundedRect(-24, -hh / 2, w, hh, hh / 2);
    bg.fillTriangle(-4, hh / 2 - 1, 8, hh / 2 - 1, 0, hh / 2 + 10);
    const c = s.add.container(h.at.x, h.at.y, [bg, icon, t]).setDepth(DEPTH.fx + 2).setScale(0).setAlpha(0);
    s.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    s.tweens.add({ targets: c, y: h.at.y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 320 });
    this.shown.set(h.id, c);
  }

  private hide(id: string): void {
    const c = this.shown.get(id);
    if (!c) return;
    this.shown.delete(id);
    this.scene.tweens.killTweensOf(c);
    this.scene.tweens.add({ targets: c, alpha: 0, scale: 0.7, duration: 250, onComplete: () => c.destroy() });
  }

  private drawIcon(g: Phaser.GameObjects.Graphics, kind: HintDef['icon']): void {
    g.lineStyle(2.2, 0x24306a, 1);
    if (kind === 'wait') {
      // sablier
      g.strokeTriangle(-7, -9, 7, -9, 0, 0);
      g.strokeTriangle(-7, 9, 7, 9, 0, 0);
      g.fillStyle(0xe2b65a, 1);
      g.fillTriangle(-4, 8, 4, 8, 0, 3);
    } else if (kind === 'up') {
      g.lineBetween(0, 9, 0, -8);
      g.lineBetween(-6, -2, 0, -8);
      g.lineBetween(6, -2, 0, -8);
    } else if (kind === 'eye') {
      g.strokeEllipse(0, 0, 18, 11);
      g.fillStyle(0x24306a, 1);
      g.fillCircle(0, 0, 3.5);
    } else {
      g.fillStyle(0xf28c38, 1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.fillCircle(Math.cos(a) * 5, Math.sin(a) * 5, 3.5);
      }
      g.fillStyle(0xf7d774, 1);
      g.fillCircle(0, 0, 3.5);
    }
  }

  destroy(): void {
    this.shown.forEach((c) => c.destroy());
    this.shown.clear();
  }
}
