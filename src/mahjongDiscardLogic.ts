import {
  calcShanten,
  cloneCounts,
  emptyCounts,
  tileIndexToLabel,
  totalTiles,
} from './mahjongShanten';

export type DiscardOption = {
  tileIndex: number;
  tileLabel: string;
  shanten: number;
  ukeire: number;
  isolated: boolean;
};

export type DiscardRecommendation = {
  best: DiscardOption;
  candidates: DiscardOption[];
  handLabels: string[];
};

const SUIT_RUN = /^([1-9]+)([mps])$/;
const HONOR_RUN = /^([1-7]+)z$/;
const SUIT_ONE = /^([1-9])([mps])$/;
const HONOR_ONE = /^([1-7])z$/;

function addTile(counts: number[], idx: number, token: string): void {
  counts[idx]++;
  if (counts[idx] > 4) throw new Error(`同じ牌が5枚以上: ${token}`);
}

function parseOneToken(counts: number[], token: string): void {
  const runS = SUIT_RUN.exec(token);
  if (runS) {
    const base = runS[2] === 'm' ? 0 : runS[2] === 'p' ? 9 : 18;
    for (const ch of runS[1]) {
      addTile(counts, base + parseInt(ch, 10) - 1, token);
    }
    return;
  }
  const runZ = HONOR_RUN.exec(token);
  if (runZ) {
    for (const ch of runZ[1]) {
      addTile(counts, 26 + parseInt(ch, 10), token);
    }
    return;
  }
  const oneS = SUIT_ONE.exec(token);
  if (oneS) {
    const base = oneS[2] === 'm' ? 0 : oneS[2] === 'p' ? 9 : 18;
    addTile(counts, base + parseInt(oneS[1], 10) - 1, token);
    return;
  }
  const oneZ = HONOR_ONE.exec(token);
  if (oneZ) {
    addTile(counts, 26 + parseInt(oneZ[1], 10), token);
    return;
  }
  throw new Error(`牌の形式が不正です: ${token}（例: 123m, 11p, 7s, 1z）`);
}

/** "123m 11p 7s 1z" 形式を34要素カウントへ */
export function parseHandTokens(input: string): number[] {
  const counts = emptyCounts();
  const tokens = input.trim().split(/[\s,]+/).filter(Boolean);
  for (const token of tokens) parseOneToken(counts, token);
  return counts;
}

export function countsToLabels(counts: number[]): string[] {
  const labels: string[] = [];
  for (let i = 0; i < 34; i++) {
    for (let k = 0; k < counts[i]; k++) labels.push(tileIndexToLabel(i));
  }
  return labels;
}

function countUkeire(counts: number[]): number {
  const base = calcShanten(counts);
  let u = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 4) continue;
    const c = cloneCounts(counts);
    c[i]++;
    if (calcShanten(c) < base) u++;
  }
  return u;
}

function isIsolated(counts: number[], index: number): boolean {
  if (index >= 27) return counts[index] === 1;
  const pos = index % 9;
  const left = pos > 0 && counts[index - 1] > 0;
  const right = pos < 8 && counts[index + 1] > 0;
  const skip = pos < 7 && counts[index + 2] > 0;
  const skipL = pos > 1 && counts[index - 2] > 0;
  return counts[index] === 1 && !left && !right && !skip && !skipL;
}

function compareOption(a: DiscardOption, b: DiscardOption): number {
  if (a.shanten !== b.shanten) return a.shanten - b.shanten;
  if (a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
  if (a.isolated !== b.isolated) return a.isolated ? -1 : 1;
  return a.tileIndex - b.tileIndex;
}

/** 14枚手牌から最良の切り牌を列挙する */
export function recommendDiscard(input: string): DiscardRecommendation {
  const counts = parseHandTokens(input);
  const n = totalTiles(counts);
  if (n !== 14) throw new Error(`14枚必要です（現在 ${n} 枚）`);

  const candidates: DiscardOption[] = [];
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 0) continue;
    const next = cloneCounts(counts);
    next[i]--;
    candidates.push({
      tileIndex: i,
      tileLabel: tileIndexToLabel(i),
      shanten: calcShanten(next),
      ukeire: countUkeire(next),
      isolated: isIsolated(counts, i),
    });
  }

  if (candidates.length === 0) throw new Error('切れる牌がありません');

  candidates.sort(compareOption);
  return {
    best: candidates[0],
    candidates,
    handLabels: countsToLabels(counts),
  };
}
