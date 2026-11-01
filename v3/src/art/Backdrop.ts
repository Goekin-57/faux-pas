import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H } from '../core/constants';

/**
 * Décor en couches façon diorama : ciel fixe, structure de serre lointaine,
 * deux plans de végétation, rayons de lumière, pollen et vignette.
 * refScrollY = défilement vertical "typique" pour lequel les couches sont calées.
 */
export function buildGreenhouseBackdrop(scene: Phaser.Scene, worldW: number, refScrollY: number): void {
  scene.add.image(0, 0, 'sky-c1').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);

  const layer = (key: string, sf: number, screenY: number, tileW: number, depth: number, originY = 0) => {
    const span = (worldW - GAME_W) * sf + GAME_W + tileW;
    for (let x = -tileW * 0.3; x < span; x += tileW) {
      scene.add.image(x, screenY + refScrollY * sf, key).setOrigin(0, originY).setScrollFactor(sf).setDepth(depth);
    }
  };

  layer('greenhouse', 0.12, 0, 1600, DEPTH.far);

  // rayons de lumière (additifs, respiration lente)
  const raysSpan = (worldW - GAME_W) * 0.35 + GAME_W;
  for (let x = 120; x < raysSpan; x += 520 + ((x * 7) % 260)) {
    const ray = scene.add
      .image(x, -60 + refScrollY * 0.35, 'ray')
      .setOrigin(0.5, 0)
      .setScrollFactor(0.35)
      .setAngle(-18)
      .setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.rays);
    scene.tweens.add({
      targets: ray, alpha: 0.08 + ((x / 100) % 3) * 0.04, duration: 3200 + ((x * 13) % 1800),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  layer('foliage-far', 0.3, GAME_H - 470, 2400, DEPTH.mid);
  // remplissage sous la végétation lointaine
  scene.add.rectangle(0, GAME_H - 60 + refScrollY * 0.3, (worldW - GAME_W) * 0.3 + GAME_W * 2, 600, 0xb3d6c4)
    .setOrigin(0).setScrollFactor(0.3).setDepth(DEPTH.mid - 1);

  layer('foliage-mid', 0.55, GAME_H - 500, 2400, DEPTH.near);
  scene.add.rectangle(0, GAME_H - 10 + refScrollY * 0.55, (worldW - GAME_W) * 0.55 + GAME_W * 2, 700, 0x86b49c)
    .setOrigin(0).setScrollFactor(0.55).setDepth(DEPTH.near - 1);

  // pollen en suspension (léger : ~24 particules)
  scene.add.particles(0, 0, 'dot-warm', {
    x: { min: 0, max: GAME_W },
    y: { min: 0, max: GAME_H },
    lifespan: 7000,
    speedX: { min: -8, max: 14 },
    speedY: { min: -10, max: 6 },
    scale: { start: 0.05, end: 0.18 },
    alpha: { start: 0.85, end: 0 },
    frequency: 300,
    maxAliveParticles: 24,
    blendMode: Phaser.BlendModes.ADD
  }).setScrollFactor(0).setDepth(DEPTH.rays + 1);

  scene.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.vignette);
}
