import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H } from '../core/constants';
import { LOOK2 } from '../core/Look';
import { ensureCanvas } from './textures';
import { paintGreenhouseInterior, paintHaze, paintSunBloom } from './paint';
import { paintForegroundLeaves } from '../menu/paintMenu';

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

  if (LOOK2) {
    // [maquette v2] intérieur de serre entre la verrière et la végétation
    ensureCanvas(scene, 'v2-interior', () => paintGreenhouseInterior(2000, 520, 77));
    layer('v2-interior', 0.2, GAME_H - 520, 2000, DEPTH.far + 2);
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

  if (LOOK2) {
    // brume de profondeur entre les plans lointains et proches
    ensureCanvas(scene, 'v2-haze', () => paintHaze(GAME_W, 420));
    scene.add.image(0, GAME_H - 470, 'v2-haze').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.mid + 1);
    // lumière chaude qui baigne l'image
    ensureCanvas(scene, 'v2-bloom', () => paintSunBloom(GAME_W, GAME_H));
    scene.add.image(0, 0, 'v2-bloom').setOrigin(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(DEPTH.vignette - 1);
    // cadrage : feuillage sombre et flou au tout premier plan, en bas de l'écran
    ensureCanvas(scene, 'v2-fg', () => paintForegroundLeaves(360, 220, 5, 'bottom'));
    for (let x = 200; x < (worldW - GAME_W) * 1.3 + GAME_W; x += 900 + ((x * 7) % 500)) {
      scene.add.image(x, GAME_H + 30 + refScrollY * 1.3, 'v2-fg').setOrigin(0.5, 1).setScrollFactor(1.3).setAlpha(0.92)
        .setFlipX((x / 900) % 2 > 1).setDepth(DEPTH.foreground);
    }
  }
  scene.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.vignette);
}
