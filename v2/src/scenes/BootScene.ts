// Chargement des images et des polices, avec une barre de progression.
import Phaser from 'phaser';
import { W, H, COL, CSS, FONT } from '../core/config';
import { SaveManager } from '../save/SaveManager';
import { AudioManager } from '../audio/AudioManager';

const PRAIRIE = ['bg_far', 'bg_mid', 'pf_l', 'pf_m', 'pf_r', 'top_l', 'top_m', 'top_r', 'dirt', 'spikes', 'spring', 'coin_gold', 'hud_heart', 'hud_heart_empty', 'door', 'sign', 'bush', 'tree', 'flower', 'mushroom_red', 'rock'];
const ENEMIES = ['snail_walk_a', 'snail_walk_b', 'snail_shell'];

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void {
    SaveManager.load();
    AudioManager.applyVolumes();
    const bar = this.add.graphics();
    const label = this.add.text(W / 2, H / 2 + 44, 'Chargement…', { fontFamily: FONT.body, fontSize: '18px', color: CSS.sun }).setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      bar.clear(); bar.fillStyle(COL.ink2, 1); bar.fillRoundedRect(W / 2 - 160, H / 2, 320, 18, 9);
      bar.fillStyle(COL.sun, 1); bar.fillRoundedRect(W / 2 - 160, H / 2, Math.max(18, 320 * v), 18, 9);
    });
    this.load.on('loaderror', (f: { key: string }) => label.setText(`Image manquante : ${f.key}`));
    for (const k of PRAIRIE) this.load.image(k, `assets/worlds/prairie/${k}.png`);
    for (const k of ENEMIES) this.load.image(k, `assets/enemies/${k}.png`);
  }
  async create(): Promise<void> {
    document.getElementById('boot')?.remove();
    // les polices sont fournies avec le jeu ; on attend qu'elles soient prêtes (2 s maximum)
    try { await Promise.race([Promise.all([document.fonts.load('40px Bungee'), document.fonts.load('800 18px Nunito')]), new Promise((r) => setTimeout(r, 2000))]); } catch { /* police de secours */ }
    this.textures.get('dirt').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.scene.start('Menu');
  }
}
