/**
 * ショウジョウバエ（Drosophila）の脳を極限まで簡略化したミニ connectome。
 * 感覚入力（触角・複眼）→ インターニューロン → 運動出力の3層フィードフォワード。
 */

export type StimulusKind = 'food' | 'light';

export type Stimulus = {
  kind: StimulusKind;
  x: number;
  y: number;
  intensity: number;
};

export type FlyState = {
  x: number;
  y: number;
  angle: number;
  speed: number;
};

export type SensoryInput = {
  smellLeft: number;
  smellRight: number;
  lightLeft: number;
  lightRight: number;
};

export type MotorOutput = {
  turn: number;
  thrust: number;
};

export type NeuronState = {
  sensory: [number, number, number, number];
  interneuron: [number, number, number, number, number, number];
  motor: [number, number];
};

const ANTENNA_OFFSET = 0.35;
const SENSORY_RADIUS = 220;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function sigmoid(v: number): number {
  return 1 / (1 + Math.exp(-v));
}

function antennaPos(fly: FlyState, side: -1 | 1): { x: number; y: number } {
  const perp = fly.angle + (Math.PI / 2) * side;
  return {
    x: fly.x + Math.cos(fly.angle) * 8 + Math.cos(perp) * ANTENNA_OFFSET * 10,
    y: fly.y + Math.sin(fly.angle) * 8 + Math.sin(perp) * ANTENNA_OFFSET * 10,
  };
}

function eyePos(fly: FlyState, side: -1 | 1): { x: number; y: number } {
  const perp = fly.angle + (Math.PI / 2) * side;
  return {
    x: fly.x + Math.cos(fly.angle) * 4 + Math.cos(perp) * 6,
    y: fly.y + Math.sin(fly.angle) * 4 + Math.sin(perp) * 6,
  };
}

function stimulusField(
  pos: { x: number; y: number },
  stimuli: Stimulus[],
  kind: StimulusKind,
): number {
  let total = 0;
  for (const s of stimuli) {
    if (s.kind !== kind) continue;
    const dx = s.x - pos.x;
    const dy = s.y - pos.y;
    const dist = Math.hypot(dx, dy);
    const falloff = Math.exp(-dist / SENSORY_RADIUS);
    total += s.intensity * falloff;
  }
  return clamp01(total);
}

/** 左右の触角・複眼から感覚入力を算出する */
export function computeSensoryInputs(fly: FlyState, stimuli: Stimulus[]): SensoryInput {
  const leftAnt = antennaPos(fly, -1);
  const rightAnt = antennaPos(fly, 1);
  const leftEye = eyePos(fly, -1);
  const rightEye = eyePos(fly, 1);

  return {
    smellLeft: stimulusField(leftAnt, stimuli, 'food'),
    smellRight: stimulusField(rightAnt, stimuli, 'food'),
    lightLeft: stimulusField(leftEye, stimuli, 'light'),
    lightRight: stimulusField(rightEye, stimuli, 'light'),
  };
}

/** 固定重みの3層ネットで運動指令を生成する */
export function stepNeuralNetwork(input: SensoryInput): { motor: MotorOutput; neurons: NeuronState } {
  const s = [
    input.smellLeft,
    input.smellRight,
    input.lightLeft,
    input.lightRight,
  ] as NeuronState['sensory'];

  const h: NeuronState['interneuron'] = [
    sigmoid(s[0] * 2.2 - s[1] * 0.4 + 0.1),
    sigmoid(s[1] * 2.2 - s[0] * 0.4 + 0.1),
    sigmoid(s[2] * 2.5 - s[3] * 0.3),
    sigmoid(s[3] * 2.5 - s[2] * 0.3),
    sigmoid((s[0] + s[1]) * 1.4 - (s[2] + s[3]) * 1.1),
    sigmoid((s[2] + s[3]) * 1.2 - (s[0] + s[1]) * 0.6 + 0.2),
  ];

  const rawTurn = (h[0] - h[1]) * 1.4 + (h[2] - h[3]) * -1.2 + (h[5] - h[4]) * 0.3;
  const rawThrust = h[4] * 1.3 - h[5] * 0.9 + 0.15;

  const motor: MotorOutput = {
    turn: Math.max(-1, Math.min(1, rawTurn)),
    thrust: clamp01(rawThrust),
  };

  const motorNeurons: NeuronState['motor'] = [
    clamp01((rawTurn + 1) / 2),
    motor.thrust,
  ];

  return {
    motor,
    neurons: { sensory: s, interneuron: h, motor: motorNeurons },
  };
}

/** 運動出力を位置・向きへ積分する */
export function applyMotor(fly: FlyState, motor: MotorOutput, dt: number): FlyState {
  const turnRate = motor.turn * 3.2;
  const angle = fly.angle + turnRate * dt;
  const speed = 20 + motor.thrust * 90;
  return {
    x: fly.x + Math.cos(angle) * speed * dt,
    y: fly.y + Math.sin(angle) * speed * dt,
    angle,
    speed,
  };
}

/** アリーナ内にハエを留める */
export function clampFlyToArena(
  fly: FlyState,
  width: number,
  height: number,
  margin = 16,
): FlyState {
  let { x, y, angle, speed } = fly;
  const minX = margin;
  const maxX = width - margin;
  const minY = margin;
  const maxY = height - margin;

  if (x < minX) {
    x = minX;
    angle = Math.PI - angle;
  } else if (x > maxX) {
    x = maxX;
    angle = Math.PI - angle;
  }
  if (y < minY) {
    y = minY;
    angle = -angle;
  } else if (y > maxY) {
    y = maxY;
    angle = -angle;
  }

  return { x, y, angle, speed };
}

/** 1 tick 分のシミュレーション */
export function simulateFlyStep(
  fly: FlyState,
  stimuli: Stimulus[],
  dt: number,
  arena: { width: number; height: number },
): { fly: FlyState; sensory: SensoryInput; motor: MotorOutput; neurons: NeuronState } {
  const sensory = computeSensoryInputs(fly, stimuli);
  const { motor, neurons } = stepNeuralNetwork(sensory);
  const moved = applyMotor(fly, motor, dt);
  const clamped = clampFlyToArena(moved, arena.width, arena.height);
  return { fly: clamped, sensory, motor, neurons };
}
