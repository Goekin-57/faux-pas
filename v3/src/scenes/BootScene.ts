import Phaser from 'phaser';
import { fitCamera } from '../core/Display';
import { FONTS, GAME_W, GAME_H } from '../core/constants';
import { loadSvgTextures } from '../art/textures';

/** Prépare polices et illustrations (générées localement, aucun téléchargement d'assets). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    fitCamera(this);
    const label = this.add.text(GAME_W / 2, GAME_H / 2, 'La serre s’éveille…', {
      fontFamily: FONTS.ui, fontSize: '22px', color: '#cfe3dc'
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: label, alpha: 1, duration: 400, delay: 200 });

    const fonts = (async () => {
      try {
        await Promise.race([
          Promise.all([
            document.fonts.load('40px "Bagel Fat One"'),
            document.fonts.load('600 20px "Fredoka"'),
            document.fonts.load('400 20px "Fredoka"')
          ]),
          new Promise((r) => setTimeout(r, 2500))
        ]);
      } catch { /* polices de secours */ }
    })();

    void Promise.all([fonts, loadSvgTextures(this)]).then(() => {
      const params = new URLSearchParams(window.location.search);
      const lvl = params.get('level');
      if (lvl) this.scene.start('Game', { levelId: lvl });
      else this.scene.start('Menu');
    });
  }
}
