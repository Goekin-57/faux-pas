import Phaser from 'phaser';
import { GAME_W, GAME_H } from './constants';

/**
 * Résolution d'affichage.
 *
 * Le monde du jeu mesure toujours 1280 × 720 unités (gameplay, positions, collisions inchangés).
 * Mais le canevas est rendu à la résolution réelle de l'écran : 1280 × 720 × R, avec R calculé
 * d'après la taille de la fenêtre et le devicePixelRatio (×1,5 en Full HD, ×2 en 1440p, ×3 en 4K).
 * Chaque caméra est zoomée de R : un sprite garde sa taille, mais il est dessiné avec R fois plus de pixels.
 *
 * Toutes les illustrations sont peintes par le code : elles sont REPEINTES à la résolution TEX
 * (pas agrandies), ce qui donne de vrais contours nets. Les textes sont rastérisés à R.
 */

export type Quality = 'auto' | 'perf';

function readQuality(): Quality {
  try {
    const raw = window.localStorage.getItem('not-so-fast/save-v1');
    const q = raw ? (JSON.parse(raw)?.settings?.quality as Quality | undefined) : undefined;
    return q === 'perf' ? 'perf' : 'auto';
  } catch {
    return 'auto';
  }
}

function compute(): { R: number; TEX: number; quality: Quality } {
  const quality = readQuality();
  const params = new URLSearchParams(window.location.search);
  const forced = Number(params.get('res'));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const fit = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cap = quality === 'perf' ? 1.5 : mobile ? 2 : 3;
  let R = Number.isFinite(forced) && forced > 0 ? forced : fit * dpr;
  R = Phaser.Math.Clamp(Math.ceil(R * 4 - 0.15) / 4, 1, cap); // pas de 0,25, arrondi vers le haut
  // Les textures montent jusqu'à ×2 : au-delà, le gain est invisible et la mémoire explose.
  const TEX = Math.min(R, quality === 'perf' ? 1 : mobile ? 1.5 : 2);
  return { R, TEX, quality };
}

export const DISPLAY = compute();

/** Taille du canevas (pixels réels). */
export const CANVAS_W = Math.round(GAME_W * DISPLAY.R);
export const CANVAS_H = Math.round(GAME_H * DISPLAY.R);

/** Caméra principale d'une scène : zoom R, origine en haut à gauche (scroll = coin du monde visible). */
export function fitCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(DISPLAY.R);
  return cam;
}

/**
 * Enregistre un canevas peint à TEX× comme texture de taille "logique" (unités du monde).
 * Phaser calcule les UV à partir de la taille déclarée : l'image s'affiche à sa taille normale
 * tout en envoyant au GPU tous les pixels haute résolution.
 */
export function addHiDpiCanvas(scene: Phaser.Scene, key: string, c: HTMLCanvasElement): void {
  const lw = (c as HiDpiCanvas).__lw ?? c.width;
  const lh = (c as HiDpiCanvas).__lh ?? c.height;
  const tex = scene.textures.addCanvas(key, c);
  if (!tex || (lw === c.width && lh === c.height)) return;
  const src = tex.source[0];
  src.width = lw;
  src.height = lh;
  tex.get('__BASE')?.setSize(lw, lh);
}

export interface HiDpiCanvas extends HTMLCanvasElement {
  __lw?: number;
  __lh?: number;
}

/** Les textes sont rastérisés à la résolution réelle (sinon ils sont flous une fois zoomés). */
let patched = false;
export function patchTextResolution(): void {
  if (patched) return;
  patched = true;
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: (...a: unknown[]) => Phaser.GameObjects.Text };
  const orig = proto.text;
  proto.text = function (this: unknown, ...args: unknown[]) {
    const t = orig.apply(this, args);
    t.setResolution(Math.max(DISPLAY.R, 1));
    return t;
  };
}
