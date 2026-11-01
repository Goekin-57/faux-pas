import type { LevelScript, LevelScriptHost } from '../levels/types';
import type { Trap } from '../traps/Trap';
import { tuning } from '../core/Difficulty';
import type { ManorAmbience } from './ManorBackdrop';
import type { Kit } from './kit';
import { CuriousPumpkins, RollingPumpkin, GuardDoor, GhostDoorman, SwingChandelier, PrankStairs, ObserverPortrait, LyingPainting, LivingBookcase } from './zones123';
import { ShadowSection, SpiderWeb, ScaredMonster, ThreeDoors } from './zones456';
import { PumpkinKing, Finale } from './boss';
import { Z } from './layout';

/**
 * Script du Manoir des Trouillards : installe chaque mécanisme à sa place précise.
 * Les pièges sont mis à jour et remis à zéro par la scène de jeu (contrat Trap) ;
 * les états de progression (portes ouvertes, lustre lancé, monstre enfermé…) persistent.
 */
export function buildManorScript(host: LevelScriptHost): LevelScript {
  const expert = tuning().id === 'expert';
  const k: Kit = {
    scene: host.scene, ctx: host.ctx, player: host.player, host,
    amb: (host.ambience as ManorAmbience | undefined) ?? null, solids: [], expert
  };
  const traps: Trap[] = [];
  const add = <T extends Trap>(t: T): T => { traps.push(t); return t; };

  // ---------------------------------------------------------------- 1. la cour
  add(new CuriousPumpkins(k, [330, 520, 700], 600, 900));
  const roller = add(new RollingPumpkin(k, 1400, 380, 600, 1030, 1360));
  const guard = add(new GuardDoor(k, 1630, 540, 1700, 1600));

  // ---------------------------------------------------------------- 2. le grand hall
  add(new GhostDoorman(k, 2020, 2160, 525));
  const chand = add(new SwingChandelier(k, 3000, 90, 420, 200, { x: 3200, y: 340 }, 2560));
  add(new PrankStairs(k, [
    { x: 3400, top: 380, dx: 0, dy: 30 },
    { x: 3500, top: 335, dx: 0, dy: -25 },
    { x: 3600, top: 290, dx: -25, dy: 0 }
  ]));

  // ---------------------------------------------------------------- 3. la galerie
  add(new ObserverPortrait(k, 4200, 250, 4420, 460, 100));
  add(new LyingPainting(k, 4720, 230, [
    { x: 5010, top: 430, w: 90 }, { x: 5170, top: 400, w: 90 }, { x: 5330, top: 430, w: 90 }
  ], [4920, 5420]));
  const books = add(new LivingBookcase(k, 5560, 130, 160, 330, 5775, 440, 250));

  // ---------------------------------------------------------------- 4. le couloir des ombres
  const sh = add(new ShadowSection(k));
  const sa = sh.addPlatform(6800, 520, 110);
  sh.addCandle(6800, 380, 130, expert ? 2.0 : 1.8, expert ? 1.5 : 2.2);
  void sa;
  const s1 = sh.addPlatform(7230, 500, 90);
  const s2 = sh.addPlatform(7400, 470, 90);
  const s3 = sh.addPlatform(7570, 500, 90);
  sh.addLantern(7400, 120, [s1, s2, s3], [s1, s2, s3], expert ? 0.85 : 1.2, expert ? 0.3 : 0.38);
  add(new SpiderWeb(k, 0, 8000, 8250, 560, 1250, 0, 8170, 300));
  const sd = sh.addPlatform(8625, 360, 100);
  sh.addLantern(8625, 110, [sd], [sd, -1], expert ? 0.9 : 1.3, 0.35, 0.95);
  add(new SpiderWeb(k, 1, 8450, 8800, 580, 1000, -170));

  // ---------------------------------------------------------------- 5. le monstre qui a peur de toi
  const monster = add(new ScaredMonster(k, {
    trigger: 9350, doorOpenAt: 9700, doorX: 9950, floorY: 520,
    table: { x: 10010, land: 10200, landTop: 560 }, hole1: [10050, 10350],
    wait1: 10500, stand: 10560, chand: { x: 10775, bridge: [10612, 10938], top: 516 }, hole2: [10600, 10950],
    wait2: 11080, statue: 11160, balcony: { x: 11120, top: 340, w: 320 }, arm: { x: 11230, top: 430 },
    wardrobe: 11390, lever: 11450, grate: 11480
  }));

  // ---------------------------------------------------------------- 6. l'antichambre des trois portes
  add(new ThreeDoors(k, {
    floorY: 520, a: 11950, b: 12400, c: 12850,
    subA: { arrive: 18060, box: 18520, floorY: 520, x0: Z.subA[0] + 60, x1: Z.subA[1] - 60 },
    subB: { arrive: 19120, candy: 20010, exit: 20130, floorY: 520, planks: [19310, 19410, 19510, 19610, 19710], plankTop: 520 },
    arena: { x: 13360, y: 530 }
  }));

  // ---------------------------------------------------------------- 7. la salle de bal
  const boss = add(new PumpkinKing(k, {
    x0: Z.ballroom[0], x1: Z.ballroom[1], floorY: 560, bossX: 14580, crack: 13950,
    shadow: [{ x: 15000, top: 470, w: 100 }, { x: 15160, top: 390, w: 100 }, { x: 15320, top: 310, w: 100 }],
    ledge: { x: 15420, top: 230, w: 160 }, lever: 15500,
    dais: { x: 15620, top: 470, w: 220 }, exitGate: 15880, exitLever: 15860
  }));
  add(new Finale(k, 16120, 330, 16450, 560));

  // points d'accès pour les tests
  (window as unknown as { __manor: unknown }).__manor = { roller, guard, chand, books, sh, monster, boss };

  return {
    traps,
    solids: k.solids,
    update: () => { /* les pièges sont mis à jour par la scène */ },
    onRespawn: () => { /* rien de plus : chaque piège sait se remettre à zéro */ },
    destroy: () => { delete (window as unknown as { __manor?: unknown }).__manor; }
  };
}
