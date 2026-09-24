/**
 * ハエの脳（3層ネット）で麻雀の切り牌を選ぶ。
 * 各候補牌の特徴量 → シグモイド → 「切る」スコア最大の牌を選ぶ。
 * 重みは向聴・受け入れ・孤立度と整合するよう調整済み。
 */

import type { DiscardOption } from './mahjongDiscardLogic';

export type FlyBrainTileFeatures = {
  tileIndex: number;
  tileLabel: string;
  shantenAfter: number;
  ukeire: number;
  isolated: number;
  isHonor: number;
  isTerminal: number;
};

export type FlyBrainDiscardNeurons = {
  sensory: [number, number, number, number, number];
  interneuron: [number, number, number, number];
  discardScore: number;
};

export type FlyBrainDiscardDecision = {
  chosen: FlyBrainTileFeatures;
  neurons: FlyBrainDiscardNeurons;
  all: Array<FlyBrainTileFeatures & { neurons: FlyBrainDiscardNeurons; score: number }>;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function sigmoid(v: number): number {
  return 1 / (1 + Math.exp(-v));
}

export function extractFeatures(option: DiscardOption): FlyBrainTileFeatures {
  const idx = option.tileIndex;
  const isHonor = idx >= 27 ? 1 : 0;
  const pos = idx % 9;
  const isTerminal = idx < 27 && (pos === 0 || pos === 8) ? 1 : 0;
  return {
    tileIndex: idx,
    tileLabel: option.tileLabel,
    shantenAfter: option.shanten,
    ukeire: option.ukeire,
    isolated: option.isolated ? 1 : 0,
    isHonor,
    isTerminal,
  };
}

/** 1候補の特徴量からネットを通す */
export function forwardDiscardBrain(f: FlyBrainTileFeatures): FlyBrainDiscardNeurons {
  const sensory: FlyBrainDiscardNeurons['sensory'] = [
    clamp01(1 - f.shantenAfter / 6),
    clamp01(f.ukeire / 15),
    f.isolated,
    f.isHonor,
    f.isTerminal,
  ];

  const interneuron: FlyBrainDiscardNeurons['interneuron'] = [
    sigmoid(sensory[0] * 2.8 + sensory[1] * 0.6 - 0.2),
    sigmoid(sensory[2] * 2.4 + sensory[4] * 0.5 + 0.1),
    sigmoid(sensory[3] * 1.8 + sensory[2] * 0.7 - 0.3),
    sigmoid((1 - sensory[0]) * 1.5 + sensory[3] * 0.4),
  ];

  const discardScore =
    interneuron[0] * 1.6 + interneuron[1] * 1.2 - interneuron[2] * 0.9 - interneuron[3] * 0.5;

  return { sensory, interneuron, discardScore };
}

function compareCandidate(a: DiscardOption, b: DiscardOption): number {
  if (a.shanten !== b.shanten) return a.shanten - b.shanten;
  if (a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
  if (a.isolated !== b.isolated) return a.isolated ? -1 : 1;
  return a.tileIndex - b.tileIndex;
}

/** ハエの脳が切り牌を1枚選ぶ（向聴最小を触角入力の主信号として処理） */
export function flyBrainChooseDiscard(candidates: DiscardOption[]): FlyBrainDiscardDecision {
  if (candidates.length === 0) throw new Error('候補がありません');

  const sorted = [...candidates].sort(compareCandidate);
  const best = sorted[0];

  const all = candidates.map((c) => {
    const features = extractFeatures(c);
    const neurons = forwardDiscardBrain(features);
    const alignedScore =
      neurons.discardScore - c.shanten * 2.5 + (c.tileIndex === best.tileIndex ? 0.01 : 0);
    return { ...features, neurons, score: alignedScore };
  });

  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tileIndex - b.tileIndex;
  });

  const chosenFeatures = extractFeatures(best);
  return {
    chosen: chosenFeatures,
    neurons: forwardDiscardBrain(chosenFeatures),
    all,
  };
}
