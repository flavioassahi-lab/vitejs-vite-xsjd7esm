import Phaser from 'phaser';

const WIDTH = 600;
const HEIGHT = 1000;

type Point = { x: number; y: number };
type TowerKind = 'basic' | 'rapid' | 'sniper';
type SkillKind = 'explosion' | 'repair' | 'strike' | 'shield';

// Paleta inspirada no HUD do Dota 2
const GOLD = 0xc8a45a;
const GOLD_BRIGHT = 0xf0d48a;
const GOLD_DARK = 0x5a4524;
const HUD_BG = 0x0a0c10;
const PANEL_BG = 0x12161c;
const PANEL_INNER = 0x0d1015;

const ENTRY: Point = { x: 300, y: 165 };
const MERGE: Point = { x: 300, y: 755 };
const EXIT: Point = { x: 300, y: 800 };

const LEFT_PATH: Point[] = [
  ENTRY,
  { x: 220, y: 185 },
  { x: 110, y: 185 },
  { x: 110, y: 235 },
  { x: 250, y: 235 },
  { x: 250, y: 285 },
  { x: 90, y: 285 },
  { x: 90, y: 335 },
  { x: 250, y: 335 },
  { x: 250, y: 385 },
  { x: 90, y: 385 },
  { x: 90, y: 435 },
  { x: 250, y: 435 },
  { x: 250, y: 485 },
  { x: 90, y: 485 },
  { x: 90, y: 535 },
  { x: 250, y: 535 },
  { x: 250, y: 585 },
  { x: 90, y: 585 },
  { x: 90, y: 635 },
  { x: 250, y: 635 },
  { x: 250, y: 685 },
  { x: 110, y: 685 },
  { x: 110, y: 715 },
  { x: 250, y: 715 },
  MERGE,
  EXIT,
];

const RIGHT_PATH = LEFT_PATH.map(p => ({
  x: WIDTH - p.x,
  y: p.y,
}));

const ALL_PATHS = [LEFT_PATH, RIGHT_PATH];

const TOWER_STATS: Record<TowerKind, {
  name: string;
  range: number;
  damage: number;
  fireRate: number;
  color: number;
  uiColor: number;
  cost: number;
  description: string;
}> = {
  basic: {
    name: 'GUARDIÃ',
    range: 100,
    damage: 2,
    fireRate: 650,
    color: 0x5aa8e0,
    uiColor: 0x24506e,
    cost: 80,
    description: 'Ataque equilibrado',
  },
  rapid: {
    name: 'BESTEIRA',
    range: 100,
    damage: 1,
    fireRate: 250,
    color: 0x7ad07a,
    uiColor: 0x2c5a34,
    cost: 110,
    description: 'Ataque rápido',
  },
  sniper: {
    name: 'ARCANA',
    range: 330,
    damage: 7,
    fireRate: 1200,
    color: 0xb98cff,
    uiColor: 0x4e3570,
    cost: 150,
    description: 'Longo alcance',
  },
};

const SKILL_INFO: Record<SkillKind, {
  name: string;
  description: string;
  mana: number;
  color: number;
}> = {
  explosion: {
    name: 'EXPLOSÃO',
    description: 'Dano em área ao redor do herói.',
    mana: 30,
    color: 0x7a3a1c,
  },
  repair: {
    name: 'REPARO',
    description: 'Recupera a vida da fortaleza.',
    mana: 40,
    color: 0x2c5a34,
  },
  strike: {
    name: 'GOLPE HEROICO',
    description: 'Dano elevado a um inimigo próximo.',
    mana: 20,
    color: 0x6e5222,
  },
  shield: {
    name: 'ESCUDO MÍSTICO',
    description: 'Fere inimigos próximos e protege a base.',
    mana: 25,
    color: 0x24506e,
  },
};

type Enemy = {
  body: Phaser.GameObjects.Arc;
  visual: Phaser.GameObjects.Container;
  healthBar: Phaser.GameObjects.Graphics;
  path: Point[];
  segment: number;
  speed: number;
  hp: number;
  maxHp: number;
  reward: number;
  alive: boolean;
  strong: boolean;
  waveId: number;
};

type Tower = {
  body: Phaser.GameObjects.Arc;
  visual: Phaser.GameObjects.Container;
  level: number;
  cooldown: number;
  range: number;
  kind: TowerKind;
  damage: number;
  fireRate: number;
  cost: number;
  totalInvested: number;
};

type WaveState = {
  remainingToSpawn: number;
  spawningFinished: boolean;
};

type UIButton = {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
  objects: Phaser.GameObjects.GameObject[];
  setLabel: (text: string) => void;
  setColor: (color: number) => void;
  setDepth: (depth: number) => void;
};

type ButtonOptions = {
  fontSize?: number;
  width?: number;
  height?: number;
  allowWhenOver?: boolean;
};

class GameScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Arc;
  private heroVisual!: Phaser.GameObjects.Container;
  private heroLabel!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private activeWaves = new Map<number, WaveState>();

  private coins = 200;
  private xp = 0;
  private heroLevel = 1;
  private wave = 0;
  private baseHP = 20;

  private maxMana = 100;
  private mana = 100;
  private manaRegen = 8;

  private heroAttackCooldown = 0;
  private heroAttackRate = 650;
  private heroRange = 115;
  private heroDamage = 3;

  private buildMode = false;
  private gameOver = false;
  private towerMenuOpen = false;

  private selectedTowerKind: TowerKind = 'basic';
  private selectedTower: Tower | null = null;
  private nextRoute: 'left' | 'right' = 'left';

  private skillPoints = 0;
  private skillLevels: Record<SkillKind, number> = {
    explosion: 0,
    repair: 0,
    strike: 0,
    shield: 0,
  };

  private shieldUntil = 0;

  // HUD
  private hudBars!: Phaser.GameObjects.Graphics;
  private coinsText!: Phaser.GameObjects.Text;
  private waveNumText!: Phaser.GameObjects.Text;
  private baseText!: Phaser.GameObjects.Text;
  private manaText!: Phaser.GameObjects.Text;
  private heroInfoText!: Phaser.GameObjects.Text;
  private battleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private buildInfoText!: Phaser.GameObjects.Text;

  private buildButton!: UIButton;
  private heroButton!: UIButton;
  private waveButton!: UIButton;

  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private buildPreview!: Phaser.GameObjects.Graphics;
  private fortressShield!: Phaser.GameObjects.Arc;

  private contextObjects: Phaser.GameObjects.GameObject[] = [];

  private joystickPointer: number | null = null;
  private joystickX = 0;
  private joystickY = 0;
  private joystickCenter = { x: 85, y: 900 };

  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickKnob!: Phaser.GameObjects.Arc;

  constructor() {
    super('GameScene');
  }

  create() {
    this.drawWorld();
    this.createHero();
    this.createInterface();

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.keys = {
      w: this.input.keyboard!.addKey('W'),
      a: this.input.keyboard!.addKey('A'),
      s: this.input.keyboard!.addKey('S'),
      d: this.input.keyboard!.addKey('D'),
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;

      // Os controles da interface e o joystick não constroem torres.
      if (pointer.y < 150 || pointer.y >= 825) return;

      if (this.buildMode) {
        this.placeTower(pointer.x, pointer.y);
        return;
      }

      this.selectElementAt(pointer.x, pointer.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.buildMode && pointer.y >= 150 && pointer.y < 825) {
        this.updateBuildPreview(pointer.x, pointer.y);
      }

      if (this.joystickPointer === pointer.id && pointer.isDown) {
        this.updateJoystick(pointer.x, pointer.y);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer === pointer.id) {
        this.joystickPointer = null;
        this.joystickX = 0;
        this.joystickY = 0;

        this.joystickKnob.setPosition(
          this.joystickCenter.x,
          this.joystickCenter.y,
        );
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 825 && pointer.x < 170) {
        this.joystickPointer = pointer.id;
        this.updateJoystick(pointer.x, pointer.y);
      }
    });

    this.refreshInterface();
  }

  // ==================================================
  // CENÁRIO (MESMO MAPA, VISUAL MAIS ELABORADO)
  // ==================================================

  private drawWorld() {
    this.cameras.main.setBackgroundColor('#0a0c10');

    const g = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator(['towercraft']);

    // Solo base
    g.fillStyle(0x1f2e1c, 1);
    g.fillRect(0, 150, WIDTH, 675);

    // Manchas de vegetação
    for (let i = 0; i < 45; i++) {
      const x = rnd.between(0, WIDTH);
      const y = rnd.between(150, 825);
      g.fillStyle(rnd.pick([0x26381f, 0x2c4124, 0x1a2817, 0x33462a]), 0.55);
      g.fillEllipse(x, y, rnd.between(60, 160), rnd.between(40, 110));
    }

    // Luz central suave
    g.fillStyle(0x3a5230, 0.3);
    g.fillEllipse(300, 480, 420, 560);

    // Detalhes: grama, pedras e flores
    for (let i = 0; i < 320; i++) {
      const x = rnd.between(6, WIDTH - 6);
      const y = rnd.between(156, 820);

      if (this.isNearPath(x, y, 30)) continue;

      const r = rnd.frac();

      if (r < 0.5) {
        const c = rnd.pick([0x4f6b38, 0x5d7a40, 0x3c5530]);
        g.fillStyle(c, 0.8);
        g.fillTriangle(x - 3, y, x - 1, y, x - 3, y - 6);
        g.fillTriangle(x, y, x + 2, y, x + 1, y - 7);
        g.fillTriangle(x + 3, y, x + 5, y, x + 5, y - 5);
      } else if (r < 0.75) {
        g.fillStyle(0x16200f, 0.6);
        g.fillCircle(x, y, rnd.between(1, 3));
      } else if (r < 0.9) {
        g.fillStyle(0x45453f, 1);
        g.fillEllipse(x, y, 9, 6);
        g.fillStyle(0x7a776a, 0.8);
        g.fillEllipse(x - 1, y - 1, 5, 3);
      } else {
        g.fillStyle(rnd.pick([0xd9c35e, 0xc0606e, 0xb6a3e0]), 0.85);
        g.fillCircle(x, y, 1.6);
      }
    }

    for (const path of ALL_PATHS) {
      this.drawRoad(g, path);
    }

    const trees: Point[] = [
      { x: 24, y: 205 }, { x: 48, y: 255 },
      { x: 25, y: 355 }, { x: 40, y: 410 },
      { x: 28, y: 535 }, { x: 48, y: 590 },
      { x: 30, y: 700 }, { x: 68, y: 755 },
      { x: 576, y: 205 }, { x: 550, y: 255 },
      { x: 575, y: 355 }, { x: 560, y: 410 },
      { x: 572, y: 535 }, { x: 552, y: 590 },
      { x: 570, y: 700 }, { x: 532, y: 755 },
      { x: 145, y: 165 }, { x: 455, y: 165 },
    ];

    trees.forEach((p, i) =>
      this.drawTree(g, p.x, p.y, 15 + i % 4 * 3, i),
    );

    const pads = [
      { x: 35, y: 285 }, { x: 35, y: 465 }, { x: 35, y: 645 },
      { x: 565, y: 285 }, { x: 565, y: 465 }, { x: 565, y: 645 },
      { x: 300, y: 285 }, { x: 300, y: 405 },
      { x: 300, y: 525 }, { x: 300, y: 645 },
    ];

    for (const p of pads) this.drawRunePad(g, p.x, p.y);

    this.drawVignette();
    this.drawPortal();
    this.drawFortress();
  }

  private drawRoad(g: Phaser.GameObjects.Graphics, path: Point[]) {
    const line = (color: number, width: number, alpha = 1) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(path[0].x, path[0].y);

      for (let i = 1; i < path.length; i++) {
        g.lineTo(path[i].x, path[i].y);
      }

      g.strokePath();
    };

    line(0x0e0c09, 54, 0.7);
    line(0x2e271d, 48);
    line(0x4d4131, 40);
    line(0x66573f, 30);

    // Pedras do calçamento
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (distance < 1) continue;

      const nx = -(b.y - a.y) / distance;
      const ny = (b.x - a.x) / distance;

      for (let d = 6; d < distance; d += 11) {
        const t = d / distance;
        const x = Phaser.Math.Linear(a.x, b.x, t);
        const y = Phaser.Math.Linear(a.y, b.y, t);

        for (const side of [-1, 1]) {
          const off = side * (((d / 11) | 0) % 2 ? 6 : 8);
          const shade = (((d / 11) | 0) + i + side) % 3;
          const color = [0x7d6c51, 0x8d7c5e, 0x6c5d46][shade];

          g.fillStyle(color, 0.75);
          g.fillEllipse(x + nx * off, y + ny * off, 8, 6);
          g.fillStyle(0x221c14, 0.35);
          g.fillEllipse(x + nx * off + 1, y + ny * off + 2, 7, 2);
        }
      }
    }
  }

  private drawTree(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    s: number,
    variant: number,
  ) {
    g.fillStyle(0x05080a, 0.5);
    g.fillEllipse(x + 6, y + s * 0.65, s * 2.1, s * 0.7);

    g.fillStyle(0x3a2a1c, 1);
    g.fillRect(x - s * 0.12, y, s * 0.24, s * 0.8);

    const colors = variant % 2
      ? [0x14261a, 0x1f3a24, 0x34573a, 0x5c7f48]
      : [0x172818, 0x24401f, 0x3f6232, 0x6d8a4c];

    g.fillStyle(colors[0], 1);
    g.fillCircle(x, y - s * 0.12, s * 0.78);

    g.fillStyle(colors[1], 1);
    g.fillCircle(x, y - s * 0.18, s * 0.68);

    g.fillStyle(colors[2], 1);
    g.fillCircle(x - s * 0.2, y - s * 0.32, s * 0.44);

    g.fillStyle(colors[3], 0.85);
    g.fillCircle(x - s * 0.28, y - s * 0.42, s * 0.2);
  }

  private drawRunePad(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x05080a, 0.45);
    g.fillEllipse(x + 3, y + 5, 50, 30);

    g.fillStyle(0x2a2b2c, 1);
    g.fillCircle(x, y, 23);

    g.fillStyle(0x45443e, 1);
    g.fillCircle(x, y, 20);

    g.lineStyle(2, 0x6fc7c2, 0.35);
    g.strokeCircle(x, y, 15);

    for (let a = 0; a < 360; a += 45) {
      const rad = Phaser.Math.DegToRad(a);
      g.fillStyle(0x8fe0d8, 0.45);
      g.fillCircle(x + Math.cos(rad) * 15, y + Math.sin(rad) * 15, 1.5);
    }

    g.lineStyle(1, 0x77736a, 1);
    g.strokeCircle(x, y, 20);

    g.fillStyle(0x6fc7c2, 0.18);
    g.fillCircle(x, y, 7);
  }

  private drawVignette() {
    const v = this.add.graphics().setDepth(3);

    for (let i = 0; i < 12; i++) {
      v.fillStyle(0x000000, 0.045);
      const w = 70 - i * 5;
      v.fillRect(0, 150, w, 675);
      v.fillRect(WIDTH - w, 150, w, 675);
      v.fillRect(0, 150, WIDTH, w * 0.6);
      v.fillRect(0, 825 - w * 0.6, WIDTH, w * 0.6);
    }
  }

  private drawPortal() {
    const c = this.add.container(300, 165).setDepth(2);

    const glow = this.add.circle(0, 0, 42, 0xc0392b, 0.18);
    const ring = this.add.circle(0, 0, 29, 0x1e1719)
      .setStrokeStyle(4, 0x5c4a3a);
    const inner = this.add.circle(0, 0, 22, 0x3a0d16)
      .setStrokeStyle(2, 0xe0533e);

    const swirl = this.add.graphics();
    for (let k = 0; k < 3; k++) {
      const start = k * (Math.PI * 2 / 3);
      swirl.lineStyle(3, 0xff7a50, 0.85);
      swirl.beginPath();
      swirl.arc(0, 0, 15, start, start + 1.3);
      swirl.strokePath();

      swirl.lineStyle(2, 0xffb08a, 0.6);
      swirl.beginPath();
      swirl.arc(0, 0, 8, start + 0.6, start + 1.6);
      swirl.strokePath();
    }

    const core = this.add.circle(0, 0, 5, 0xffd2b0, 0.95);

    c.add([glow, ring, inner, swirl, core]);

    this.tweens.add({
      targets: swirl,
      angle: 360,
      duration: 2400,
      repeat: -1,
    });

    this.tweens.add({
      targets: glow,
      scale: 1.25,
      alpha: 0.08,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(300, 202, 'PORTAL', {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      color: '#e8a08a',
      fontStyle: 'bold',
      backgroundColor: '#0b0e12cc',
      padding: { x: 5, y: 2 },
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(3);
  }

  private drawFortress() {
    const g = this.add.graphics().setDepth(2);

    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(300, 815, 130, 34);

    g.fillStyle(0x2d2b28, 1);
    g.fillRoundedRect(248, 778, 104, 44, 6);
    g.lineStyle(2, 0x8a6d3b, 1);
    g.strokeRoundedRect(248, 778, 104, 44, 6);

    g.fillStyle(0x3d3a34, 1);
    g.fillRoundedRect(257, 785, 86, 31, 4);

    for (const px of [258, 334]) {
      g.fillStyle(0x4a463e, 1);
      g.fillRect(px, 768, 8, 48);
      g.fillStyle(GOLD, 1);
      g.fillRect(px - 2, 765, 12, 4);
      g.fillStyle(0x6fe08a, 0.8);
      g.fillCircle(px + 4, 778, 2);
    }

    g.fillStyle(0x0f1512, 1);
    g.fillRoundedRect(289, 795, 22, 21, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.lineStyle(1, GOLD, 0.8);
    g.strokeRoundedRect(289, 795, 22, 21, { tl: 10, tr: 10, bl: 0, br: 0 });

    // Cristal "Ancient"
    const crystal = this.add.container(300, 774).setDepth(3);
    const glow = this.add.circle(0, 0, 24, 0x5fe07a, 0.2);
    const body = this.add.polygon(0, 0, [0, -17, 11, 0, 0, 17, -11, 0], 0x4fbf6a)
      .setStrokeStyle(2, 0xd8ffe0);
    const shine = this.add.polygon(-2, -3, [0, -9, 4.5, 0, 0, 9, -4.5, 0], 0xd8ffe0, 0.75);

    crystal.add([glow, body, shine]);

    this.tweens.add({
      targets: glow,
      scale: 1.35,
      alpha: 0.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: [body, shine],
      y: '-=3',
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.fortressShield = this.add.circle(300, 792, 58, 0x8fd9ff, 0.12)
      .setStrokeStyle(2, 0x9fe5ff, 0.75)
      .setDepth(6)
      .setVisible(false);

    this.add.text(300, 744, 'FORTALEZA', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#bff5c8',
      fontStyle: 'bold',
      backgroundColor: '#0b0e12cc',
      padding: { x: 5, y: 2 },
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(3);
  }

  // ==================================================
  // HERÓI
  // ==================================================

  private createHero() {
    this.hero = this.add.circle(300, 220, 18, 0x000000, 0)
      .setStrokeStyle(0, 0x000000, 0)
      .setDepth(6);

    this.heroVisual = this.add.container(300, 220).setDepth(7);

    const selection = this.add.ellipse(0, 14, 46, 20, 0x59d65a, 0.12)
      .setStrokeStyle(2, 0x7cf07a, 0.8);

    const shadow = this.add.ellipse(0, 14, 34, 14, 0x05080a, 0.55);

    const cape = this.add.triangle(
      0, 6, -13, -11, 13, -11, 0, 20, 0x8a2a24,
    ).setStrokeStyle(2, 0x3c1a18);

    const legs = this.add.rectangle(0, 8, 17, 15, 0x2a333c)
      .setStrokeStyle(2, 0x12181e);

    const leftBoot = this.add.rectangle(-7, 15, 10, 6, 0x1a1e22)
      .setStrokeStyle(1, GOLD);

    const rightBoot = this.add.rectangle(7, 15, 10, 6, 0x1a1e22)
      .setStrokeStyle(1, GOLD);

    const torso = this.add.rectangle(0, -3, 22, 21, 0x3e6a8c)
      .setStrokeStyle(2, GOLD);

    const chest = this.add.rectangle(0, -3, 9, 17, 0xa9b4b6)
      .setStrokeStyle(1, GOLD_BRIGHT);

    const belt = this.add.rectangle(0, 5, 22, 4, 0x4a3420);
    const buckle = this.add.rectangle(0, 5, 5, 4, GOLD_BRIGHT);

    const shoulder = this.add.circle(-10, -9, 6, 0xa9b4b6)
      .setStrokeStyle(2, GOLD);

    const head = this.add.circle(0, -19, 9, 0xc3a47e)
      .setStrokeStyle(2, 0x4a3b2d);

    const helmet = this.add.triangle(
      0, -24, -11, 6, 11, 6, 0, -9, 0xb0bbbd,
    ).setStrokeStyle(2, GOLD);

    const plume = this.add.triangle(
      0, -34, -2, 6, 4, 6, 6, -6, 0xc0392b,
    );

    const visor = this.add.rectangle(0, -19, 12, 3, 0x1a252a);

    const sword = this.add.rectangle(15, -6, 4, 25, 0xe6ebe4)
      .setStrokeStyle(1, 0x65737b)
      .setRotation(-0.4);

    const swordGrip = this.add.rectangle(13, 3, 9, 3, GOLD)
      .setRotation(-0.4);

    const shield = this.add.ellipse(-14, -3, 12, 19, 0x2c5a7a)
      .setStrokeStyle(2, GOLD_BRIGHT)
      .setRotation(-0.2);

    const shieldMark = this.add.star(-14, -3, 4, 2, 5, GOLD_BRIGHT);

    this.heroVisual.add([
      selection, shadow, cape, legs, leftBoot, rightBoot, torso, chest,
      belt, buckle, shoulder, head, helmet, plume, visor, sword, swordGrip,
      shield, shieldMark,
    ]);

    this.heroLabel = this.add.text(300, 180, 'HERÓI · Nv. 1', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f0d48a',
      fontStyle: 'bold',
      backgroundColor: '#0b0e12d9',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(8);
  }

  private createEnemyVisual(
    x: number,
    y: number,
    strong: boolean,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(5);

    const shadow = this.add.ellipse(
      0, 12, strong ? 38 : 28, 14, 0x05080a, 0.55,
    );

    const ring = this.add.ellipse(
      0, 12, strong ? 40 : 30, strong ? 16 : 12, 0xc0392b, 0.1,
    ).setStrokeStyle(1, 0xe0533e, 0.6);

    if (strong) {
      const cape = this.add.triangle(
        0, 4, -16, -9, 16, -9, 0, 19, 0x5a1c1a,
      ).setStrokeStyle(2, 0x2a1010);

      const body = this.add.ellipse(0, 0, 32, 31, 0x6a3a2c)
        .setStrokeStyle(3, 0x2a1e18);

      const armor = this.add.rectangle(0, 0, 22, 22, 0x4a3a34)
        .setStrokeStyle(2, 0xa0503a);

      const belly = this.add.ellipse(0, 4, 12, 14, 0x2e221c);

      const head = this.add.ellipse(0, -17, 28, 24, 0x7e4e3a)
        .setStrokeStyle(2, 0x2a1e18);

      const leftHorn = this.add.triangle(
        -11, -29, -6, 7, 6, 7, -4, -9, 0xd5c69b,
      ).setStrokeStyle(1, 0x51412d);

      const rightHorn = this.add.triangle(
        11, -29, -6, 7, 6, 7, 4, -9, 0xd5c69b,
      ).setStrokeStyle(1, 0x51412d);

      const leftEye = this.add.ellipse(-6, -18, 5, 4, 0xff5a3a);
      const rightEye = this.add.ellipse(6, -18, 5, 4, 0xff5a3a);
      const mouth = this.add.rectangle(0, -9, 12, 3, 0x1a0e0c);

      const leftArm = this.add.rectangle(-19, -1, 8, 20, 0x6a3a2c)
        .setRotation(-0.25);

      const rightArm = this.add.rectangle(19, -1, 8, 20, 0x6a3a2c)
        .setRotation(0.25);

      const leftLeg = this.add.rectangle(-8, 13, 9, 12, 0x2e221c);
      const rightLeg = this.add.rectangle(8, 13, 9, 12, 0x2e221c);

      const club = this.add.rectangle(26, -7, 7, 30, 0x4a3420)
        .setRotation(-0.45)
        .setStrokeStyle(2, 0x241a10);

      const clubHead = this.add.circle(32, -19, 8, 0x6e5a42)
        .setStrokeStyle(2, 0x2e2418);

      c.add([
        ring, shadow, cape, leftLeg, rightLeg, body, belly, armor,
        leftArm, rightArm, head, leftHorn, rightHorn,
        leftEye, rightEye, mouth, club, clubHead,
      ]);
    } else {
      const cape = this.add.triangle(
        0, 5, -12, -8, 12, -8, 0, 17, 0x4a1e1e,
      ).setStrokeStyle(2, 0x2a1212);

      const legs = this.add.rectangle(0, 8, 16, 13, 0x3e3226)
        .setStrokeStyle(2, 0x20180f);

      const leftLeg = this.add.rectangle(-6, 14, 7, 7, 0x26241c);
      const rightLeg = this.add.rectangle(6, 14, 7, 7, 0x26241c);

      const body = this.add.ellipse(0, -1, 24, 25, 0x56663a)
        .setStrokeStyle(2, 0x2a3420);

      const armor = this.add.rectangle(0, 0, 16, 13, 0x4a3a2e)
        .setStrokeStyle(1, 0xa0503a);

      const head = this.add.ellipse(0, -15, 24, 19, 0x6e7e44)
        .setStrokeStyle(2, 0x2a3420);

      const earL = this.add.triangle(
        -11, -20, 0, 5, 7, -2, -8, -7, 0x7a8a4a,
      );

      const earR = this.add.triangle(
        11, -20, 0, 5, -7, -2, 8, -7, 0x7a8a4a,
      );

      const eyeL = this.add.circle(-5, -16, 2.5, 0xff6a3a);
      const eyeR = this.add.circle(5, -16, 2.5, 0xff6a3a);

      const nose = this.add.triangle(
        0, -10, -3, -3, 3, -3, 0, 3, 0x3a3b22,
      );

      const armL = this.add.rectangle(-14, -1, 6, 16, 0x60703e)
        .setRotation(-0.35);

      const armR = this.add.rectangle(14, -1, 6, 16, 0x60703e)
        .setRotation(0.35);

      const dagger = this.add.rectangle(20, -4, 3, 17, 0xc8d2c6)
        .setRotation(-0.5);

      c.add([
        ring, shadow, cape, leftLeg, rightLeg, body, armor, head,
        earL, earR, eyeL, eyeR, nose, armL, armR, dagger,
      ]);
    }

    return c;
  }

  // ==================================================
  // HELPERS DE INTERFACE (ESTILO DOTA)
  // ==================================================

  private drawPanelFrame(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x + 2, y + 3, w, h);

    g.fillStyle(PANEL_BG, 1);
    g.fillRect(x, y, w, h);

    g.fillStyle(PANEL_INNER, 1);
    g.fillRect(x + 3, y + 3, w - 6, h - 6);

    g.lineStyle(1, 0x8a6d3b, 0.9);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    g.lineStyle(1, 0x2a2418, 1);
    g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);

    g.fillStyle(GOLD_BRIGHT, 1);
    g.fillRect(x - 1, y - 1, 4, 4);
    g.fillRect(x + w - 3, y - 1, 4, 4);
    g.fillRect(x - 1, y + h - 3, 4, 4);
    g.fillRect(x + w - 3, y + h - 3, 4, 4);
  }

  private drawButtonFrame(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    hover: boolean,
  ) {
    g.clear();

    g.fillStyle(0x000000, 0.55);
    g.fillRect(x + 2, y + 3, w, h);

    g.fillStyle(0x07080a, 1);
    g.fillRect(x, y, w, h);

    const fill = hover
      ? Phaser.Display.Color.ValueToColor(color).clone().lighten(10).color
      : color;

    g.fillStyle(fill, 1);
    g.fillRect(x + 2, y + 2, w - 4, h - 4);

    g.fillStyle(0x000000, 0.3);
    g.fillRect(x + 2, y + h / 2, w - 4, h / 2 - 2);

    g.fillStyle(0xffffff, hover ? 0.2 : 0.1);
    g.fillRect(x + 2, y + 2, w - 4, 2);

    g.lineStyle(1, GOLD, hover ? 1 : 0.6);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    g.lineStyle(1, 0x000000, 0.6);
    g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);

    g.fillStyle(hover ? GOLD_BRIGHT : GOLD, 1);
    g.fillRect(x, y, 3, 3);
    g.fillRect(x + w - 3, y, 3, 3);
    g.fillRect(x, y + h - 3, 3, 3);
    g.fillRect(x + w - 3, y + h - 3, 3, 3);
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    action: () => void,
    opts: ButtonOptions = {},
  ): UIButton {
    const fontSize = opts.fontSize ?? 11;
    const w = opts.width ?? 150;
    const h = opts.height ?? 28;

    let currentColor = color;
    let hovered = false;

    const bg = this.add.graphics().setDepth(21);

    const text = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: '#f3e3b5',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(22);

    const hit = this.add.zone(x, y, w, h)
      .setOrigin(0)
      .setDepth(23)
      .setInteractive({ useHandCursor: true });

    const redraw = () =>
      this.drawButtonFrame(bg, x, y, w, h, currentColor, hovered);

    redraw();

    hit.on('pointerdown', () => {
      if (this.gameOver && !opts.allowWhenOver) return;

      this.tweens.add({
        targets: text,
        scale: 0.92,
        duration: 60,
        yoyo: true,
      });

      action();
    });

    hit.on('pointerover', () => {
      hovered = true;
      text.setColor('#ffffff');
      redraw();
    });

    hit.on('pointerout', () => {
      hovered = false;
      text.setColor('#f3e3b5');
      redraw();
    });

    return {
      bg,
      label: text,
      hit,
      objects: [bg, text, hit],
      setLabel: (t: string) => {
        if (text.text !== t) text.setText(t);
      },
      setColor: (c: number) => {
        if (c === currentColor) return;
        currentColor = c;
        redraw();
      },
      setDepth: (d: number) => {
        bg.setDepth(d);
        text.setDepth(d + 1);
        hit.setDepth(d + 2);
      },
    };
  }

  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    fill: number,
    dark: number,
  ) {
    const r = Phaser.Math.Clamp(ratio, 0, 1);

    g.fillStyle(0x030405, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);

    g.fillStyle(dark, 1);
    g.fillRect(x, y, w, h);

    g.fillStyle(fill, 1);
    g.fillRect(x, y, w * r, h);

    g.fillStyle(0xffffff, 0.22);
    g.fillRect(x, y, w * r, Math.max(1, h * 0.35));

    g.fillStyle(0x000000, 0.25);
    g.fillRect(x, y + h * 0.65, w * r, h * 0.35);

    g.lineStyle(1, GOLD_DARK, 1);
    g.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
  }

  // ==================================================
  // INTERFACE PRINCIPAL
  // ==================================================

  private createInterface() {
    const ui = this.add.graphics().setDepth(20);

    // Fundo do HUD superior
    ui.fillStyle(HUD_BG, 1);
    ui.fillRect(0, 0, WIDTH, 150);

    // Faixa de título
    ui.fillStyle(0x17121a, 1);
    ui.fillRect(0, 0, WIDTH, 36);
    ui.fillStyle(0x3a1d1a, 0.5);
    ui.fillRect(0, 0, WIDTH, 16);
    ui.fillStyle(GOLD, 1);
    ui.fillRect(0, 36, WIDTH, 2);
    ui.fillStyle(GOLD_DARK, 1);
    ui.fillRect(0, 38, WIDTH, 1);

    // Painel de status
    this.drawPanelFrame(ui, 6, 50, 588, 50);

    ui.lineStyle(1, 0x2a2418, 1);
    ui.lineBetween(338, 56, 338, 94);

    // Placa central da onda
    ui.fillStyle(0x000000, 0.6);
    ui.fillPoints([
      { x: 236, y: 0 }, { x: 368, y: 0 },
      { x: 354, y: 48 }, { x: 250, y: 48 },
    ] as Phaser.Types.Math.Vector2Like[], true);

    ui.fillStyle(0x1c1013, 1);
    ui.fillPoints([
      { x: 234, y: 0 }, { x: 366, y: 0 },
      { x: 352, y: 46 }, { x: 248, y: 46 },
    ] as Phaser.Types.Math.Vector2Like[], true);

    ui.fillStyle(0x3a1414, 0.7);
    ui.fillPoints([
      { x: 240, y: 0 }, { x: 360, y: 0 },
      { x: 356, y: 16 }, { x: 244, y: 16 },
    ] as Phaser.Types.Math.Vector2Like[], true);

    ui.lineStyle(2, GOLD, 1);
    ui.strokePoints([
      { x: 234, y: 0 }, { x: 366, y: 0 },
      { x: 352, y: 46 }, { x: 248, y: 46 },
    ] as Phaser.Types.Math.Vector2Like[], true);

    ui.fillStyle(GOLD_BRIGHT, 1);
    ui.fillTriangle(294, 46, 306, 46, 300, 52);

    // Moeda
    ui.fillStyle(0x7a5a1a, 1);
    ui.fillCircle(488, 18, 9);
    ui.fillStyle(0xe0b23f, 1);
    ui.fillCircle(488, 18, 7);
    ui.fillStyle(0xf6d36b, 1);
    ui.fillCircle(487, 17, 4);

    // Linha inferior do HUD
    ui.fillStyle(GOLD, 1);
    ui.fillRect(0, 148, WIDTH, 2);

    this.add.text(12, 3, 'TOWERCRAFT', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#e9c97a',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      letterSpacing: 1,
    }).setDepth(21);

    this.add.text(13, 24, 'ASSAHI GAME STUDIOS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '8px',
      color: '#8f7d5a',
      letterSpacing: 2,
    }).setDepth(21);

    this.add.text(300, 8, 'ONDA', {
      fontFamily: 'Georgia, serif',
      fontSize: '8px',
      color: '#c8a45a',
      fontStyle: 'bold',
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(21);

    this.waveNumText = this.add.text(300, 28, '0', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#f6e2b0',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21);

    this.coinsText = this.add.text(502, 18, '0', {
      fontFamily: 'Georgia, serif',
      fontSize: '17px',
      color: '#f6d36b',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(21);

    const labelStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '8px',
      color: '#c8a45a',
      fontStyle: 'bold',
      letterSpacing: 1,
    };

    this.add.text(14, 61, 'BASE', labelStyle).setOrigin(0, 0.5).setDepth(21);
    this.add.text(14, 77, 'MANA', labelStyle).setOrigin(0, 0.5).setDepth(21);
    this.add.text(14, 91, 'XP', labelStyle).setOrigin(0, 0.5).setDepth(21);

    this.hudBars = this.add.graphics().setDepth(21);

    const barTextStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    };

    this.baseText = this.add.text(201, 61, '', barTextStyle)
      .setOrigin(0.5).setDepth(22);

    this.manaText = this.add.text(201, 77, '', barTextStyle)
      .setOrigin(0.5).setDepth(22);

    this.heroInfoText = this.add.text(348, 55, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#e8dcc0',
      fontStyle: 'bold',
    }).setDepth(21);

    this.battleText = this.add.text(348, 70, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#c9b98a',
    }).setDepth(21);

    this.hintText = this.add.text(348, 85, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#8a8070',
    }).setDepth(21);

    // Botões principais
    this.buildButton = this.makeButton(
      8, 107, 'TORRES  +', 0x24506e,
      () => this.toggleTowerMenu(),
      { fontSize: 12, width: 190, height: 36 },
    );

    this.heroButton = this.makeButton(
      205, 107, 'HERÓI · HABILIDADES', 0x4e3570,
      () => this.openHeroMenu(),
      { fontSize: 11, width: 190, height: 36 },
    );

    this.waveButton = this.makeButton(
      402, 107, 'INICIAR ONDA  +', 0x7a2620,
      () => this.startWave(),
      { fontSize: 12, width: 190, height: 36 },
    );

    // HUD inferior
    const bottom = this.add.graphics().setDepth(19);
    bottom.fillStyle(HUD_BG, 1);
    bottom.fillRect(0, 825, WIDTH, 175);
    bottom.fillStyle(GOLD, 1);
    bottom.fillRect(0, 825, WIDTH, 2);
    bottom.fillStyle(GOLD_DARK, 1);
    bottom.fillRect(0, 827, WIDTH, 1);

    this.drawPanelFrame(bottom, 8, 836, 156, 156);
    this.drawPanelFrame(bottom, 175, 836, 415, 152);

    bottom.lineStyle(1, 0x2a2418, 1);
    bottom.lineBetween(184, 856, 581, 856);

    this.add.text(186, 842, 'REGISTRO DE BATALHA', {
      fontFamily: 'Georgia, serif',
      fontSize: '9px',
      color: '#c8a45a',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setDepth(20);

    this.messageText = this.add.text(186, 864, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#e8e0cc',
      lineSpacing: 4,
      wordWrap: { width: 390 },
    }).setDepth(20);

    this.buildInfoText = this.add.text(12, 158, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#f3e3b5',
      backgroundColor: '#0b0e12e6',
      padding: { x: 8, y: 6 },
    }).setDepth(19).setVisible(false);

    this.rangeGraphics = this.add.graphics().setDepth(4);
    this.buildPreview = this.add.graphics().setDepth(14).setVisible(false);

    // Joystick
    const socket = this.add.graphics().setDepth(20);
    socket.fillStyle(0x05070a, 1);
    socket.fillCircle(this.joystickCenter.x, this.joystickCenter.y, 52);

    for (let a = 0; a < 360; a += 90) {
      const rad = Phaser.Math.DegToRad(a);
      const cx = this.joystickCenter.x + Math.cos(rad) * 40;
      const cy = this.joystickCenter.y + Math.sin(rad) * 40;
      socket.fillStyle(GOLD, 0.7);
      socket.fillCircle(cx, cy, 2.5);
    }

    this.joystickBase = this.add.circle(
      this.joystickCenter.x,
      this.joystickCenter.y,
      48,
      0x14181d,
      0.9,
    ).setStrokeStyle(3, 0x8a6d3b).setDepth(20);

    this.joystickKnob = this.add.circle(
      this.joystickCenter.x,
      this.joystickCenter.y,
      22,
      0xb08a46,
      1,
    ).setStrokeStyle(3, GOLD_BRIGHT).setDepth(21);

    this.add.text(85, 975, 'MOVER', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#c8a45a',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(21);

    this.showMessage('Prepare as defesas e inicie a primeira onda.');
  }

  private showMessage(message: string) {
    this.messageText.setText(message);
  }

  // ==================================================
  // MENUS CONTEXTUAIS
  // ==================================================

  private clearContextMenu() {
    for (const object of this.contextObjects) {
      if (object.active) object.destroy();
    }

    this.contextObjects = [];
  }

  private addContextButton(
    x: number,
    y: number,
    label: string,
    color: number,
    action: () => void,
    width = 185,
    height = 28,
    fontSize = 10,
  ) {
    const button = this.makeButton(
      x, y, label, color, action, { fontSize, width, height },
    );

    button.setDepth(32);
    this.contextObjects.push(...button.objects);
    return button;
  }

  private addContextText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      ...style,
    }).setDepth(33);

    this.contextObjects.push(t);
    return t;
  }

  private openContextPanel(title: string, height: number) {
    this.clearContextMenu();

    const panel = this.add.graphics().setDepth(29);
    this.drawPanelFrame(panel, 175, 837, 415, height);

    panel.fillStyle(0x1d1a1e, 1);
    panel.fillRect(179, 841, 407, 24);
    panel.fillStyle(GOLD, 0.8);
    panel.fillRect(179, 865, 407, 1);

    this.contextObjects.push(panel);

    this.addContextText(188, 846, title, {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#ead6a4',
      fontStyle: 'bold',
    });

    const close = this.makeButton(
      556, 842, 'X', 0x6a2420,
      () => this.closeContextMenu(),
      { fontSize: 10, width: 28, height: 22 },
    );

    close.setDepth(34);
    this.contextObjects.push(...close.objects);
  }

  private closeContextMenu() {
    this.clearContextMenu();
    this.towerMenuOpen = false;
  }

  private toggleTowerMenu() {
    if (this.towerMenuOpen) {
      this.closeContextMenu();
      return;
    }

    this.cancelBuild();
    this.selectedTower = null;
    this.rangeGraphics.clear();

    this.openContextPanel('CONSTRUIR TORRE', 150);
    this.towerMenuOpen = true;

    const kinds: TowerKind[] = ['basic', 'rapid', 'sniper'];
    const xs = [187, 318, 449];

    kinds.forEach((kind, i) => {
      const stats = TOWER_STATS[kind];
      const affordable = this.coins >= stats.cost;

      this.addContextButton(
        xs[i], 874,
        `${stats.name}\n${stats.cost} OURO`,
        affordable ? stats.uiColor : 0x2a2d30,
        () => this.beginBuild(kind),
        125, 36, 10,
      );

      this.addContextText(
        xs[i] + 2, 916,
        `${stats.description}\nDano ${stats.damage} · Alcance ${stats.range}`,
        {
          fontSize: '9px',
          color: '#cfc6ae',
          lineSpacing: 2,
          wordWrap: { width: 122 },
        },
      );
    });

    this.addContextText(
      188, 956,
      'Escolha uma torre e toque em um espaço livre do mapa.',
      { fontSize: '9px', color: '#8f8470' },
    );
  }

  private openHeroMenu() {
    if (this.gameOver) return;

    this.cancelBuild();
    this.selectedTower = null;
    this.rangeGraphics.clear();
    this.towerMenuOpen = false;

    this.openContextPanel(
      `HERÓI · NÍVEL ${this.heroLevel} · PONTOS: ${this.skillPoints}`,
      150,
    );

    const skills: SkillKind[] = [
      'explosion', 'repair', 'strike', 'shield',
    ];

    const xPositions = [187, 286, 385, 484];

    skills.forEach((skill, i) => {
      const info = SKILL_INFO[skill];
      const rank = this.skillLevels[skill];
      const x = xPositions[i];
      const cost = rank === 0
        ? info.mana
        : Math.max(5, info.mana - (rank - 1) * 3);

      this.addContextButton(
        x, 872,
        `${info.name}\n${cost} MANA`,
        rank > 0 ? info.color : 0x2a2d30,
        () => this.useSkill(skill),
        96, 30, 9,
      );

      // Marcadores de nível no estilo Dota
      const pips = this.add.graphics().setDepth(33);
      for (let k = 0; k < 5; k++) {
        pips.fillStyle(0x000000, 1);
        pips.fillRect(x + k * 19 - 1, 906, 18, 6);
        pips.fillStyle(k < rank ? 0xf0c75a : 0x2a2a2a, 1);
        pips.fillRect(x + k * 19, 907, 16, 4);
      }
      this.contextObjects.push(pips);

      const canUpgrade =
        this.skillPoints > 0 &&
        rank < 5 &&
        this.heroLevel >= (rank + 2);

      this.addContextButton(
        x, 916,
        canUpgrade ? 'MELHORAR  +' : rank >= 5 ? 'MÁXIMO' : 'BLOQUEADO',
        canUpgrade ? 0x7a5a1c : 0x23272a,
        () => this.upgradeSkill(skill),
        96, 22, 9,
      );

      this.addContextText(x, 942, info.description, {
        fontSize: '8px',
        color: '#cfc6ae',
        wordWrap: { width: 94 },
        lineSpacing: 2,
      });
    });

    this.addContextText(
      188, 973,
      'Cada melhoria consome 1 ponto, ganho ao subir de nível.',
      { fontSize: '8px', color: '#a8936a' },
    );
  }

  private upgradeSkill(skill: SkillKind) {
    const rank = this.skillLevels[skill];

    if (rank >= 5) {
      this.showMessage('Esta habilidade já atingiu o nível máximo.');
      return;
    }

    if (this.skillPoints < 1) {
      this.showMessage('Você precisa evoluir de nível para ganhar um ponto de habilidade.');
      return;
    }

    if (this.heroLevel < rank + 2) {
      this.showMessage(`Essa melhoria requer herói no nível ${rank + 2}.`);
      return;
    }

    this.skillPoints--;
    this.skillLevels[skill]++;

    this.showMessage(
      `${SKILL_INFO[skill].name} melhorada para o nível ${this.skillLevels[skill]}.`,
    );

    this.openHeroMenu();
    this.refreshInterface();
  }

  private openTowerMenu(tower: Tower) {
    this.cancelBuild();
    this.towerMenuOpen = false;
    this.selectedTower = tower;
    this.drawSelectedRange();

    this.openContextPanel(
      `${TOWER_STATS[tower.kind].name} · NÍVEL ${tower.level}`,
      150,
    );

    const sellValue = Math.floor(tower.totalInvested * 0.7);
    const upgradeCost = 60 * tower.level;

    this.addContextText(
      188, 874,
      `Dano: ${tower.damage}   ·   Alcance: ${Math.round(tower.range)}   ·   Intervalo: ${Math.round(tower.fireRate)} ms\n` +
      `Investido: ${tower.totalInvested} ouro`,
      { fontSize: '10px', color: '#e6dfcd', lineSpacing: 5 },
    );

    this.addContextButton(
      188, 910,
      tower.level >= 5 ? 'NÍVEL MÁXIMO' : `MELHORAR · ${upgradeCost}`,
      tower.level >= 5 ? 0x23272a : 0x7a5a1c,
      () => this.upgradeTower(tower),
      190, 30,
    );

    this.addContextButton(
      386, 910,
      `VENDER · +${sellValue}`,
      0x7a2620,
      () => this.sellTower(tower),
      190, 30,
    );

    this.addContextText(
      188, 952,
      'A venda devolve 70% de todo o valor investido nesta torre.',
      { fontSize: '9px', color: '#a8936a' },
    );
  }

  private selectElementAt(x: number, y: number) {
    // Tocar no herói abre o menu de habilidades.
    if (
      Phaser.Math.Distance.Between(x, y, this.hero.x, this.hero.y) < 30
    ) {
      this.openHeroMenu();
      return;
    }

    let nearest: Tower | null = null;
    let closest = 38;

    for (const tower of this.towers) {
      const distance = Phaser.Math.Distance.Between(
        x, y, tower.body.x, tower.body.y,
      );

      if (distance < closest) {
        closest = distance;
        nearest = tower;
      }
    }

    if (nearest) {
      this.openTowerMenu(nearest);
      return;
    }

    this.closeContextMenu();
    this.selectedTower = null;
    this.rangeGraphics.clear();
  }

  // ==================================================
  // CONSTRUÇÃO
  // ==================================================

  private beginBuild(kind: TowerKind) {
    if (this.gameOver) return;

    this.closeContextMenu();
    this.selectedTowerKind = kind;
    this.buildMode = true;
    this.selectedTower = null;
    this.rangeGraphics.clear();

    const stats = TOWER_STATS[kind];

    this.buildInfoText.setText(
      `${stats.name}  ·  Dano ${stats.damage}  ·  Alcance ${stats.range}  ·  ${stats.cost} ouro\n` +
      'Verde = posição válida. Toque no terreno para construir.',
    );

    this.buildInfoText.setVisible(true);
    this.buildPreview.setVisible(true);

    const pointer = this.input.activePointer;
    this.updateBuildPreview(pointer.x, pointer.y);

    this.showMessage(`Posicione a ${stats.name} em um espaço livre do mapa.`);

    this.refreshInterface();
  }

  private cancelBuild() {
    this.buildMode = false;
    this.buildPreview.clear();
    this.buildPreview.setVisible(false);
    this.buildInfoText.setVisible(false);
  }

  private updateBuildPreview(x: number, y: number) {
    if (!this.buildMode) return;

    const stats = TOWER_STATS[this.selectedTowerKind];
    const valid = this.isValidBuildLocation(x, y, this.selectedTowerKind);

    this.buildPreview.clear();

    this.buildPreview.fillStyle(valid ? 0x73e39a : 0xf16e65, 0.10);
    this.buildPreview.fillCircle(x, y, stats.range);

    this.buildPreview.lineStyle(2, valid ? 0x8bffad : 0xff776b, 0.9);
    this.buildPreview.strokeCircle(x, y, stats.range);

    this.buildPreview.fillStyle(valid ? 0x73e39a : 0xf16e65, 0.22);
    this.buildPreview.fillCircle(x, y, 23);

    this.buildPreview.lineStyle(2, valid ? 0x9effba : 0xff968d, 1);
    this.buildPreview.strokeCircle(x, y, 23);

    for (let a = 0; a < 360; a += 30) {
      const rad = Phaser.Math.DegToRad(a);
      const inner = stats.range - 5;
      const outer = stats.range + 2;

      this.buildPreview.lineStyle(
        2, valid ? 0xa8f6bd : 0xffa09a, 0.65,
      );

      this.buildPreview.beginPath();
      this.buildPreview.moveTo(
        x + Math.cos(rad) * inner,
        y + Math.sin(rad) * inner,
      );
      this.buildPreview.lineTo(
        x + Math.cos(rad) * outer,
        y + Math.sin(rad) * outer,
      );
      this.buildPreview.strokePath();
    }
  }

  private isValidBuildLocation(
    x: number,
    y: number,
    kind: TowerKind,
  ): boolean {
    const stats = TOWER_STATS[kind];

    if (this.coins < stats.cost) return false;

    if (x < 22 || x > WIDTH - 22) return false;
    if (y < 175 || y > 780) return false;

    if (this.isNearPath(x, y, 34)) return false;

    return !this.towers.some(t =>
      Phaser.Math.Distance.Between(
        x, y, t.body.x, t.body.y,
      ) < 36,
    );
  }

  private placeTower(x: number, y: number) {
    if (!this.buildMode) return;

    const kind = this.selectedTowerKind;
    const stats = TOWER_STATS[kind];

    if (this.coins < stats.cost) {
      this.showMessage('Ouro insuficiente para construir esta torre.');
      return;
    }

    if (!this.isValidBuildLocation(x, y, kind)) {
      this.showMessage(
        'Local inválido. Afaste-se um pouco dos caminhos e das outras torres.',
      );
      this.updateBuildPreview(x, y);
      return;
    }

    const visual = this.createTowerVisual(x, y, kind);
    const body = this.add.circle(x, y, 18, 0x000000, 0)
      .setStrokeStyle(0, 0x000000, 0);

    const tower: Tower = {
      body,
      visual,
      level: 1,
      cooldown: 0,
      range: stats.range,
      kind,
      damage: stats.damage,
      fireRate: stats.fireRate,
      cost: stats.cost,
      totalInvested: stats.cost,
    };

    this.towers.push(tower);
    this.coins -= stats.cost;

    // Efeito de construção
    visual.setScale(0.4);
    this.tweens.add({
      targets: visual,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });

    this.cancelBuild();
    this.openTowerMenu(tower);

    this.showMessage(
      `${stats.name} construída! Selecione a torre para melhorar ou vender.`,
    );

    this.refreshInterface();
  }

  private createTowerVisual(
    x: number,
    y: number,
    kind: TowerKind,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(4);
    const color = TOWER_STATS[kind].color;

    const shadow = this.add.ellipse(3, 8, 50, 25, 0x05080a, 0.6);
    const aura = this.add.circle(0, 4, 26, color, 0.14)
      .setStrokeStyle(1, color, 0.45);
    const base = this.add.circle(0, 4, 21, 0x2e2e2c)
      .setStrokeStyle(3, 0x0e0f10);
    const stoneRing = this.add.circle(0, 2, 17, 0x55524a)
      .setStrokeStyle(2, GOLD);
    const innerRing = this.add.circle(0, 2, 12, 0x24262a)
      .setStrokeStyle(1, 0x8a6d3b);

    c.add([shadow, aura, base, stoneRing, innerRing]);

    if (kind === 'basic') {
      const body = this.add.rectangle(0, -8, 21, 24, 0x2f5672)
        .setStrokeStyle(2, GOLD);
      const battlement = this.add.rectangle(0, -21, 27, 7, 0x7d898a)
        .setStrokeStyle(2, 0x26323a);
      const slit = this.add.rectangle(0, -9, 7, 14, 0x0e1a22);
      const glow = this.add.rectangle(0, -9, 3, 10, color, 0.9);
      const arrow = this.add.triangle(
        0, -18, -5, 7, 5, 7, 0, -8, GOLD_BRIGHT,
      );
      const sideL = this.add.rectangle(-13, -9, 5, 15, 0x6d7976);
      const sideR = this.add.rectangle(13, -9, 5, 15, 0x6d7976);

      c.add([body, sideL, sideR, battlement, slit, glow, arrow]);
    } else if (kind === 'rapid') {
      const frame = this.add.rectangle(0, -8, 23, 23, 0x2f5a34)
        .setStrokeStyle(2, GOLD);
      const hub = this.add.circle(0, -8, 8, 0x15241a)
        .setStrokeStyle(2, color);
      const blade1 = this.add.rectangle(0, -8, 5, 24, 0xc7c7a9)
        .setStrokeStyle(1, 0x3a4a36);
      const blade2 = this.add.rectangle(0, -8, 24, 5, 0xc7c7a9)
        .setStrokeStyle(1, 0x3a4a36);
      const pin = this.add.circle(0, -8, 3, GOLD_BRIGHT);

      c.add([frame, blade1, blade2, hub, pin]);
    } else {
      const pillar = this.add.rectangle(0, -7, 22, 24, 0x3e3058)
        .setStrokeStyle(2, GOLD);
      const crystalBase = this.add.triangle(
        0, -20, -12, 10, 12, 10, 0, -12, 0x6a4f98,
      ).setStrokeStyle(2, 0xd6c8fa);
      const glow = this.add.circle(0, -25, 11, color, 0.3);
      const crystal = this.add.polygon(0, -25, [0, -9.5, 7, 0, 0, 9.5, -7, 0], 0xc8a6ff)
        .setStrokeStyle(2, 0xf1e3ff);
      const core = this.add.circle(0, -25, 4, 0xffffff, 0.85);
      const rune = this.add.circle(0, -7, 5, 0x241a38)
        .setStrokeStyle(2, color);

      c.add([pillar, crystalBase, glow, crystal, core, rune]);

      this.tweens.add({
        targets: glow,
        scale: 1.4,
        alpha: 0.1,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }

    const levelText = this.add.text(15, 13, 'I', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f3d27a',
      fontStyle: 'bold',
      backgroundColor: '#0b0e12',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5);

    c.add(levelText);
    c.setData('levelText', levelText);

    return c;
  }

  private upgradeTower(tower: Tower | null = this.selectedTower) {
    if (this.gameOver) return;

    if (!tower || !this.towers.includes(tower)) {
      this.showMessage('Selecione uma torre para melhorá-la.');
      return;
    }

    if (tower.level >= 5) {
      this.showMessage('Esta torre já atingiu o nível máximo.');
      return;
    }

    const cost = 60 * tower.level;

    if (this.coins < cost) {
      this.showMessage(`Você precisa de ${cost} de ouro para melhorar.`);
      return;
    }

    this.coins -= cost;
    tower.totalInvested += cost;
    tower.level++;

    tower.range += tower.kind === 'sniper' ? 25 : 20;
    tower.damage += tower.kind === 'rapid' ? 1 : 2;
    tower.fireRate = Math.max(120, tower.fireRate * 0.92);

    tower.visual.setScale(1 + (tower.level - 1) * 0.055);

    const levelText = tower.visual.getData(
      'levelText',
    ) as Phaser.GameObjects.Text;

    if (levelText) {
      levelText.setText(['I', 'II', 'III', 'IV', 'V'][tower.level - 1]);
    }

    const flash = this.add.circle(
      tower.body.x, tower.body.y, 24, GOLD_BRIGHT, 0.35,
    ).setDepth(9);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 350,
      onComplete: () => flash.destroy(),
    });

    this.showMessage(`Torre melhorada para o nível ${tower.level}!`);

    this.openTowerMenu(tower);
    this.refreshInterface();
  }

  private sellTower(tower: Tower) {
    if (!this.towers.includes(tower)) return;

    const refund = Math.floor(tower.totalInvested * 0.7);

    this.coins += refund;
    tower.body.destroy();
    tower.visual.destroy();

    this.towers = this.towers.filter(t => t !== tower);

    this.selectedTower = null;
    this.rangeGraphics.clear();
    this.closeContextMenu();

    this.showMessage(
      `Torre vendida por ${refund} de ouro (70% do investimento).`,
    );

    this.refreshInterface();
  }

  // ==================================================
  // ONDAS E INIMIGOS
  // ==================================================

  private startWave() {
    if (this.gameOver) return;

    this.closeContextMenu();
    this.wave++;

    const waveId = this.wave;
    const total = 5 + waveId * 2;

    this.activeWaves.set(waveId, {
      remainingToSpawn: total,
      spawningFinished: false,
    });

    this.showMessage(`Onda ${waveId} iniciada: ${total} inimigos.`);

    this.tweens.add({
      targets: this.waveNumText,
      scale: 1.4,
      duration: 140,
      yoyo: true,
    });

    const spawnNext = () => {
      if (this.gameOver) return;

      const state = this.activeWaves.get(waveId);
      if (!state) return;

      if (state.remainingToSpawn <= 0) {
        state.spawningFinished = true;
        return;
      }

      this.spawnEnemy(waveId);
      state.remainingToSpawn--;

      this.time.delayedCall(500, spawnNext);
    };

    spawnNext();
    this.refreshInterface();
  }

  private spawnEnemy(waveId: number) {
    const strong = waveId % 3 === 0;
    const hp = strong ? 8 + waveId : 4 + waveId;

    const path = this.nextRoute === 'left' ? LEFT_PATH : RIGHT_PATH;
    this.nextRoute = this.nextRoute === 'left' ? 'right' : 'left';

    const start = path[0];

    const body = this.add.circle(
      start.x, start.y, strong ? 19 : 14, 0x000000, 0,
    ).setStrokeStyle(0, 0x000000, 0).setDepth(5);

    const visual = this.createEnemyVisual(start.x, start.y, strong);
    const healthBar = this.add.graphics().setDepth(8);

    const enemy: Enemy = {
      body,
      visual,
      healthBar,
      path,
      segment: 0,
      speed: strong ? 40 : 55 + Math.min(waveId, 20),
      hp,
      maxHp: hp,
      reward: strong ? 18 : 10,
      alive: true,
      strong,
      waveId,
    };

    this.enemies.push(enemy);
    this.drawEnemyHealth(enemy);
  }

  private drawEnemyHealth(enemy: Enemy) {
    enemy.healthBar.clear();
    if (!enemy.alive) return;

    const width = enemy.strong ? 36 : 28;
    const height = 5;
    const x = enemy.body.x - width / 2;
    const y = enemy.body.y - (enemy.strong ? 40 : 33);
    const ratio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);

    enemy.healthBar.fillStyle(0x000000, 0.9);
    enemy.healthBar.fillRect(x - 1, y - 1, width + 2, height + 2);

    enemy.healthBar.fillStyle(0x3a0e0c, 1);
    enemy.healthBar.fillRect(x, y, width, height);

    enemy.healthBar.fillStyle(0xd2392b, 1);
    enemy.healthBar.fillRect(x, y, width * ratio, height);

    enemy.healthBar.fillStyle(0xff8a70, 0.5);
    enemy.healthBar.fillRect(x, y, width * ratio, 1);

    // Divisões da barra
    enemy.healthBar.fillStyle(0x000000, 0.55);
    for (let tx = x + 7; tx < x + width; tx += 7) {
      enemy.healthBar.fillRect(tx, y, 1, height);
    }
  }

  private updateEnemies(delta: number) {
    for (const enemy of [...this.enemies]) {
      if (!enemy.alive) continue;

      const target = enemy.path[enemy.segment + 1];

      if (!target) {
        this.removeEnemy(enemy);

        if (this.shieldUntil > this.time.now) {
          this.showMessage('O Escudo Místico protegeu a fortaleza!');
        } else {
          this.baseHP--;
          this.showMessage('Um inimigo alcançou a fortaleza! -1 vida.');
          this.cameras.main.shake(120, 0.004);
        }

        if (this.baseHP <= 0) {
          this.endGame();
          return;
        }

        continue;
      }

      const dx = target.x - enemy.body.x;
      const dy = target.y - enemy.body.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const step = enemy.speed * delta / 1000;

      if (distance <= step || distance < 1) {
        enemy.body.setPosition(target.x, target.y);
        enemy.visual.setPosition(target.x, target.y);
        enemy.segment++;
      } else {
        const angle = Math.atan2(dy, dx);

        enemy.body.x += Math.cos(angle) * step;
        enemy.body.y += Math.sin(angle) * step;

        enemy.visual.setPosition(enemy.body.x, enemy.body.y);
        enemy.visual.setScale(Math.cos(angle) < 0 ? -1 : 1, 1);
      }

      this.drawEnemyHealth(enemy);
    }
  }

  private removeEnemy(enemy: Enemy) {
    enemy.alive = false;
    enemy.body.destroy();
    enemy.visual.destroy();
    enemy.healthBar.destroy();

    this.enemies = this.enemies.filter(e => e !== enemy);
  }

  private damageEnemy(enemy: Enemy, damage: number) {
    if (!enemy.alive) return;

    enemy.hp -= damage;

    this.tweens.add({
      targets: enemy.visual,
      alpha: 0.55,
      duration: 55,
      yoyo: true,
      repeat: 1,
    });

    if (enemy.hp > 0) {
      this.drawEnemyHealth(enemy);
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.hero.x, this.hero.y,
      enemy.body.x, enemy.body.y,
    );

    const heroGetsXP = distance <= this.heroRange;
    const x = enemy.body.x;
    const y = enemy.body.y;

    this.removeEnemy(enemy);
    this.coins += enemy.reward;

    const burst = this.add.circle(x, y, 8, 0xe0533e, 0.7).setDepth(10);

    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 2.2,
      duration: 200,
      onComplete: () => burst.destroy(),
    });

    // Ouro flutuante
    const gold = this.add.text(x, y - 12, `+${enemy.reward}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#ffd35a',
      fontStyle: 'bold',
      stroke: '#1a1206',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: gold,
      y: y - 36,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => gold.destroy(),
    });

    if (heroGetsXP) this.gainXP(10);
  }

  private checkCompletedWaves() {
    for (const [waveId, state] of this.activeWaves) {
      if (!state.spawningFinished) continue;

      const remaining = this.enemies.some(
        enemy => enemy.alive && enemy.waveId === waveId,
      );

      if (remaining) continue;

      this.activeWaves.delete(waveId);

      const reward = 20 + waveId * 5;
      this.coins += reward;

      this.showMessage(`Onda ${waveId} concluída! +${reward} de ouro.`);
    }
  }

  // ==================================================
  // TORRES E ATAQUES
  // ==================================================

  private updateTowers(delta: number) {
    for (const tower of this.towers) {
      tower.cooldown -= delta;
      if (tower.cooldown > 0) continue;

      let target: Enemy | undefined;
      let closest = tower.range;

      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;

        const distance = Phaser.Math.Distance.Between(
          tower.body.x, tower.body.y,
          enemy.body.x, enemy.body.y,
        );

        if (distance <= closest) {
          closest = distance;
          target = enemy;
        }
      }

      if (target) {
        tower.cooldown = tower.fireRate;
        this.fireProjectile(tower, target);
        this.damageEnemy(target, tower.damage * tower.level);
      }
    }
  }

  private fireProjectile(tower: Tower, target: Enemy) {
    const color = TOWER_STATS[tower.kind].color;

    const projectile = this.add.circle(
      tower.body.x,
      tower.body.y - 10,
      tower.kind === 'sniper' ? 5 : 3,
      color,
    ).setStrokeStyle(1, 0xffffff, 0.8).setDepth(12);

    this.tweens.add({
      targets: projectile,
      x: target.body.x,
      y: target.body.y - 4,
      duration: tower.kind === 'sniper' ? 180 : 120,
      onComplete: () => projectile.destroy(),
    });

    if (tower.kind === 'sniper') {
      const glow = this.add.circle(
        tower.body.x, tower.body.y - 22, 9, color, 0.45,
      ).setDepth(11);

      this.tweens.add({
        targets: glow,
        alpha: 0,
        scale: 1.8,
        duration: 180,
        onComplete: () => glow.destroy(),
      });
    }
  }

  private drawSelectedRange() {
    this.rangeGraphics.clear();

    if (!this.selectedTower || !this.towers.includes(this.selectedTower)) {
      return;
    }

    const tower = this.selectedTower;

    this.rangeGraphics.fillStyle(GOLD_BRIGHT, 0.06);
    this.rangeGraphics.fillCircle(tower.body.x, tower.body.y, tower.range);

    this.rangeGraphics.lineStyle(2, GOLD_BRIGHT, 0.55);
    this.rangeGraphics.strokeCircle(tower.body.x, tower.body.y, tower.range);

    this.rangeGraphics.lineStyle(2, 0x7cf07a, 0.85);
    this.rangeGraphics.strokeCircle(tower.body.x, tower.body.y, 24);
  }

  // ==================================================
  // HERÓI E MOVIMENTAÇÃO
  // ==================================================

  private updateJoystick(x: number, y: number) {
    const dx = x - this.joystickCenter.x;
    const dy = y - this.joystickCenter.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const radius = 35;
    const scale = Math.min(length, radius) / length;

    this.joystickKnob.setPosition(
      this.joystickCenter.x + dx * scale,
      this.joystickCenter.y + dy * scale,
    );

    this.joystickX = dx * scale / radius;
    this.joystickY = dy * scale / radius;
  }

  private moveHero(delta: number) {
    let dx = this.joystickX;
    let dy = this.joystickY;

    if (this.cursors.left.isDown || this.keys.a.isDown) dx = -1;
    if (this.cursors.right.isDown || this.keys.d.isDown) dx = 1;
    if (this.cursors.up.isDown || this.keys.w.isDown) dy = -1;
    if (this.cursors.down.isDown || this.keys.s.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const length = Math.sqrt(dx * dx + dy * dy);
    const speed = 230 * delta / 1000;

    this.hero.x = Phaser.Math.Clamp(
      this.hero.x + dx / length * speed, 18, WIDTH - 18,
    );

    this.hero.y = Phaser.Math.Clamp(
      this.hero.y + dy / length * speed, 175, 815,
    );

    this.heroVisual.setPosition(this.hero.x, this.hero.y);
    this.heroLabel.setPosition(this.hero.x, this.hero.y - 44);

    if (dx !== 0) {
      this.heroVisual.setScale(dx < 0 ? -1 : 1, 1);
    }
  }

  private updateHeroCombat(delta: number) {
    this.heroAttackCooldown -= delta;
    if (this.heroAttackCooldown > 0) return;

    let target: Enemy | undefined;
    let closest = this.heroRange;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      const distance = Phaser.Math.Distance.Between(
        this.hero.x, this.hero.y,
        enemy.body.x, enemy.body.y,
      );

      if (distance <= closest) {
        closest = distance;
        target = enemy;
      }
    }

    if (target) {
      this.heroAttackCooldown = this.heroAttackRate;
      this.fireHeroProjectile(target);
      this.damageEnemy(target, this.heroDamage);

      this.tweens.add({
        targets: this.heroVisual,
        angle: this.heroVisual.scaleX < 0 ? -8 : 8,
        duration: 75,
        yoyo: true,
      });
    }
  }

  private fireHeroProjectile(target: Enemy) {
    const projectile = this.add.rectangle(
      this.hero.x, this.hero.y - 7, 4, 15, GOLD_BRIGHT,
    ).setRotation(-0.4).setDepth(12);

    this.tweens.add({
      targets: projectile,
      x: target.body.x,
      y: target.body.y,
      duration: 130,
      onComplete: () => projectile.destroy(),
    });
  }

  private gainXP(amount: number) {
    this.xp += amount;

    while (this.xp >= this.heroLevel * 50) {
      this.xp -= this.heroLevel * 50;
      this.heroLevel++;
      this.skillPoints++;

      this.heroDamage++;
      this.heroRange += 5;
      this.maxMana += 5;
      this.mana = Math.min(this.maxMana, this.mana + 5);

      this.showMessage(
        `Herói evoluiu para o nível ${this.heroLevel}! Você ganhou 1 ponto de habilidade.`,
      );

      const levelEffect = this.add.circle(
        this.hero.x, this.hero.y, 28, GOLD_BRIGHT, 0.3,
      ).setStrokeStyle(3, GOLD_BRIGHT, 0.9).setDepth(9);

      this.tweens.add({
        targets: levelEffect,
        alpha: 0,
        scale: 2.2,
        duration: 500,
        onComplete: () => levelEffect.destroy(),
      });
    }

    this.heroLabel.setText(`HERÓI · Nv. ${this.heroLevel}`);
  }

  // ==================================================
  // QUATRO HABILIDADES
  // ==================================================

  private useSkill(skill: SkillKind) {
    if (this.gameOver) return;

    const rank = this.skillLevels[skill];

    if (rank === 0) {
      this.showMessage(
        `Desbloqueie ${SKILL_INFO[skill].name} melhorando-a com um ponto de habilidade.`,
      );
      return;
    }

    const cost = Math.max(5, SKILL_INFO[skill].mana - (rank - 1) * 3);

    if (this.mana < cost) {
      this.showMessage('Mana insuficiente para esta habilidade.');
      return;
    }

    switch (skill) {
      case 'explosion':
        this.useExplosion(cost, rank);
        break;
      case 'repair':
        this.useRepair(cost, rank);
        break;
      case 'strike':
        this.useHeroStrike(cost, rank);
        break;
      case 'shield':
        this.useMysticShield(cost, rank);
        break;
    }

    this.refreshInterface();
  }

  private useExplosion(cost = 30, rank = 1) {
    if (this.mana < cost) {
      this.showMessage('Mana insuficiente para usar Explosão.');
      return;
    }

    this.mana -= cost;
    const radius = 135 + rank * 8;
    let hitCount = 0;

    for (const enemy of [...this.enemies]) {
      if (!enemy.alive) continue;

      const distance = Phaser.Math.Distance.Between(
        this.hero.x, this.hero.y,
        enemy.body.x, enemy.body.y,
      );

      if (distance <= radius) {
        this.damageEnemy(enemy, 8 + this.heroLevel * 2 + rank * 3);
        hitCount++;
      }
    }

    const effect = this.add.circle(
      this.hero.x, this.hero.y, radius, 0xff7a30, 0.2,
    ).setStrokeStyle(4, 0xffc15a, 0.9).setDepth(13);

    this.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 1.2,
      duration: 350,
      onComplete: () => effect.destroy(),
    });

    this.cameras.main.shake(150, 0.005);

    this.showMessage(
      hitCount
        ? `Explosão! ${hitCount} inimigo(s) atingido(s).`
        : 'Explosão utilizada, mas nenhum inimigo estava no raio.',
    );
  }

  private useRepair(cost = 40, rank = 1) {
    if (this.mana < cost) {
      this.showMessage('Mana insuficiente para Reparar.');
      return;
    }

    if (this.baseHP >= 20) {
      this.showMessage('A fortaleza já está com a vida máxima.');
      return;
    }

    this.mana -= cost;
    this.baseHP = Math.min(20, this.baseHP + 3 + rank);

    const heal = this.add.circle(300, 790, 30, 0x6fe08a, 0.3)
      .setStrokeStyle(3, 0xbff5c8, 0.9).setDepth(9);

    this.tweens.add({
      targets: heal,
      alpha: 0,
      scale: 2,
      duration: 500,
      onComplete: () => heal.destroy(),
    });

    this.showMessage(
      `Reparo utilizado! A fortaleza recuperou até ${3 + rank} pontos de vida.`,
    );
  }

  private useHeroStrike(cost: number, rank: number) {
    if (this.mana < cost) return;

    let target: Enemy | undefined;
    let closest = this.heroRange + 80;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      const distance = Phaser.Math.Distance.Between(
        this.hero.x, this.hero.y,
        enemy.body.x, enemy.body.y,
      );

      if (distance < closest) {
        closest = distance;
        target = enemy;
      }
    }

    if (!target) {
      this.showMessage('Não há inimigos próximos para o Golpe Heroico.');
      return;
    }

    this.mana -= cost;

    const effect = this.add.circle(
      target.body.x, target.body.y, 22 + rank * 3, GOLD_BRIGHT, 0.65,
    ).setDepth(13);

    this.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 1.8,
      duration: 250,
      onComplete: () => effect.destroy(),
    });

    this.damageEnemy(target, 12 + this.heroLevel * 3 + rank * 5);
    this.showMessage('Golpe Heroico executado!');
  }

  private useMysticShield(cost: number, rank: number) {
    if (this.mana < cost) return;

    this.mana -= cost;
    this.shieldUntil = this.time.now + 5000 + rank * 1000;

    const radius = 90 + rank * 12;
    let hitCount = 0;

    for (const enemy of [...this.enemies]) {
      if (!enemy.alive) continue;

      const distance = Phaser.Math.Distance.Between(
        this.hero.x, this.hero.y,
        enemy.body.x, enemy.body.y,
      );

      if (distance <= radius) {
        this.damageEnemy(enemy, 5 + rank * 4);
        hitCount++;
      }
    }

    const effect = this.add.circle(
      this.hero.x, this.hero.y, radius, 0x8fd9ff, 0.16,
    ).setStrokeStyle(4, 0x9fe5ff, 0.9).setDepth(13);

    this.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 1.3,
      duration: 500,
      onComplete: () => effect.destroy(),
    });

    this.showMessage(
      `Escudo Místico ativado por ${5 + rank} segundos. ${hitCount} inimigo(s) atingido(s).`,
    );
  }

  private regenerateMana(delta: number) {
    this.mana = Math.min(
      this.maxMana,
      this.mana + this.manaRegen * delta / 1000,
    );
  }

  // ==================================================
  // TERRENO E INTERFACE
  // ==================================================

  private isNearPath(x: number, y: number, threshold: number): boolean {
    for (const path of ALL_PATHS) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;

        if (len2 === 0) continue;

        const t = Phaser.Math.Clamp(
          ((x - a.x) * dx + (y - a.y) * dy) / len2,
          0, 1,
        );

        const px = a.x + t * dx;
        const py = a.y + t * dy;

        if (
          Phaser.Math.Distance.Between(x, y, px, py) < threshold
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private refreshInterface() {
    const xpNeeded = this.heroLevel * 50;

    this.hudBars.clear();
    this.drawBar(
      this.hudBars, 74, 55, 254, 12,
      this.baseHP / 20, 0x3fae3a, 0x16301a,
    );
    this.drawBar(
      this.hudBars, 74, 72, 254, 10,
      this.mana / this.maxMana, 0x2f7fd6, 0x13243d,
    );
    this.drawBar(
      this.hudBars, 74, 88, 254, 6,
      this.xp / xpNeeded, 0xd7a83a, 0x2b220f,
    );

    this.baseText.setText(`${this.baseHP} / 20`);
    this.manaText.setText(`${Math.floor(this.mana)} / ${this.maxMana}`);

    this.coinsText.setText(`${this.coins}`);
    this.waveNumText.setText(`${this.wave}`);

    this.heroInfoText.setText(
      `HERÓI Nv. ${this.heroLevel}   ·   XP ${this.xp}/${xpNeeded}   ·   PTS ${this.skillPoints}`,
    );

    this.battleText.setText(
      `Ondas ativas: ${this.activeWaves.size}   ·   Inimigos: ${this.enemies.length}`,
    );

    const shieldLeft = Math.ceil((this.shieldUntil - this.time.now) / 1000);
    if (shieldLeft > 0) {
      this.hintText.setColor('#9fe5ff');
      this.hintText.setText(`ESCUDO MÍSTICO ATIVO · ${shieldLeft}s`);
    } else {
      this.hintText.setColor('#8a8070');
      this.hintText.setText('Toque no herói para usar habilidades');
    }

    this.heroButton.setLabel(
      this.skillPoints > 0
        ? `HERÓI Nv. ${this.heroLevel} · ${this.skillPoints} PT${this.skillPoints > 1 ? 'S' : ''}`
        : `HERÓI Nv. ${this.heroLevel} · HABILIDADES`,
    );

    this.heroButton.setColor(this.skillPoints > 0 ? 0x6a4a1c : 0x4e3570);
    this.buildButton.setColor(this.towerMenuOpen ? 0x2f6a90 : 0x24506e);
    this.waveButton.setLabel('INICIAR ONDA  +');
  }

  // ==================================================
  // LOOP DO JOGO
  // ==================================================

  update(_time: number, delta: number) {
    if (this.gameOver) return;

    this.moveHero(delta);
    this.regenerateMana(delta);
    this.updateEnemies(delta);

    if (this.gameOver) return;

    this.updateTowers(delta);
    this.updateHeroCombat(delta);
    this.checkCompletedWaves();
    this.drawSelectedRange();
    this.fortressShield.setVisible(this.shieldUntil > this.time.now);
    this.refreshInterface();
  }

  private endGame() {
    this.gameOver = true;
    this.cancelBuild();
    this.closeContextMenu();
    this.refreshInterface();

    this.showMessage('FIM DE JOGO! A fortaleza foi destruída.');

    this.add.rectangle(300, 500, WIDTH, HEIGHT, 0x000000, 0.65)
      .setDepth(40);

    const g = this.add.graphics().setDepth(41);
    this.drawPanelFrame(g, 50, 400, 500, 200);

    g.fillStyle(0x3a0e0c, 0.9);
    g.fillRect(54, 404, 492, 70);
    g.fillStyle(GOLD, 1);
    g.fillRect(54, 474, 492, 2);

    this.add.text(300, 440, 'DERROTA', {
      fontFamily: 'Georgia, serif',
      fontSize: '38px',
      color: '#e0533e',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(42);

    this.add.text(
      300, 505,
      `A fortaleza caiu na onda ${this.wave}.\nHerói nível ${this.heroLevel} · ${this.towers.length} torre(s) construída(s)`,
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#f4ecd8',
        align: 'center',
        lineSpacing: 7,
      },
    ).setOrigin(0.5).setDepth(42);

    const again = this.makeButton(
      205, 545, 'JOGAR NOVAMENTE', 0x7a2620,
      () => window.location.reload(),
      { fontSize: 12, width: 190, height: 36, allowWhenOver: true },
    );

    again.setDepth(43);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'app',
  backgroundColor: '#0a0c10',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
