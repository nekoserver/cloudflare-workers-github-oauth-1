import { describe, expect, it } from 'vitest';
import {
  applyMotor,
  clampFlyToArena,
  computeSensoryInputs,
  simulateFlyStep,
  stepNeuralNetwork,
  type FlyState,
  type Stimulus,
} from './flyBrainLogic';

const baseFly: FlyState = { x: 200, y: 200, angle: 0, speed: 0 };

describe('computeSensoryInputs', () => {
  it('左側の餌に左触角の匂いが強く届く', () => {
    const stimuli: Stimulus[] = [{ kind: 'food', x: 80, y: 193, intensity: 1 }];
    const input = computeSensoryInputs(baseFly, stimuli);
    expect(input.smellLeft).toBeGreaterThan(input.smellRight);
  });

  it('右側の光に右複眼の入力が強くなる', () => {
    const stimuli: Stimulus[] = [{ kind: 'light', x: 320, y: 207, intensity: 1 }];
    const input = computeSensoryInputs(baseFly, stimuli);
    expect(input.lightRight).toBeGreaterThan(input.lightLeft);
  });
});

describe('stepNeuralNetwork', () => {
  it('左匂い優位で右旋（turn > 0）する', () => {
    const { motor } = stepNeuralNetwork({
      smellLeft: 0.9,
      smellRight: 0.1,
      lightLeft: 0,
      lightRight: 0,
    });
    expect(motor.turn).toBeGreaterThan(0.2);
  });

  it('左光優位で左旋（turn < 0）する', () => {
    const { motor } = stepNeuralNetwork({
      smellLeft: 0,
      smellRight: 0,
      lightLeft: 0.9,
      lightRight: 0.1,
    });
    expect(motor.turn).toBeLessThan(-0.2);
  });

  it('出力は境界内に収まる', () => {
    const { motor } = stepNeuralNetwork({
      smellLeft: 1,
      smellRight: 1,
      lightLeft: 1,
      lightRight: 1,
    });
    expect(motor.turn).toBeGreaterThanOrEqual(-1);
    expect(motor.turn).toBeLessThanOrEqual(1);
    expect(motor.thrust).toBeGreaterThanOrEqual(0);
    expect(motor.thrust).toBeLessThanOrEqual(1);
  });
});

describe('applyMotor', () => {
  it('前進 thrust で位置が変わる', () => {
    const next = applyMotor(baseFly, { turn: 0, thrust: 1 }, 0.1);
    expect(next.x).toBeGreaterThan(baseFly.x);
    expect(next.y).toBeCloseTo(baseFly.y, 1);
  });
});

describe('clampFlyToArena', () => {
  it('左端で反射する', () => {
    const fly: FlyState = { x: 5, y: 200, angle: Math.PI, speed: 50 };
    const clamped = clampFlyToArena(fly, 400, 400);
    expect(clamped.x).toBe(16);
  });
});

describe('simulateFlyStep', () => {
  it('餌があると前進する', () => {
    const stimuli: Stimulus[] = [{ kind: 'food', x: 350, y: 200, intensity: 1 }];
    const { fly, motor } = simulateFlyStep(baseFly, stimuli, 0.05, { width: 400, height: 400 });
    expect(motor.thrust).toBeGreaterThan(0.1);
    expect(fly.x).toBeGreaterThan(baseFly.x);
  });
});
