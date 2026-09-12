/**
 * 日本式麻雀の向聴数（一般形・七対子・国士無双）を計算する。
 * tiles は長さ34の配列（萬子0-8, 筒9-17, 索18-26, 字27-33）。
 */

export const TILE_LABELS: readonly string[] = (() => {
  const labels: string[] = [];
  for (const suit of ['m', 'p', 's'] as const) {
    for (let n = 1; n <= 9; n++) labels.push(`${n}${suit}`);
  }
  for (const h of ['東', '南', '西', '北', '白', '發', '中'] as const) {
    labels.push(h);
  }
  return labels;
})();

const YAO_INDICES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export function emptyCounts(): number[] {
  return new Array(34).fill(0);
}

export function cloneCounts(counts: number[]): number[] {
  return [...counts];
}

function mianziShanten(counts: number[], index: number, sets: number, taatsu: number): number {
  let i = index;
  while (i < 34 && counts[i] === 0) i++;
  if (i >= 34) {
    let s = sets;
    let t = taatsu;
    const over = s + t - 4;
    if (over > 0) {
      const cutT = Math.min(t, over);
      t -= cutT;
      s -= over - cutT;
    }
    return 8 - 2 * s - t;
  }

  let min = 8;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    min = Math.min(min, mianziShanten(counts, i, sets + 1, taatsu));
    counts[i] += 3;
  }

  if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    min = Math.min(min, mianziShanten(counts, i, sets + 1, taatsu));
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
  }

  if (i < 27 && i % 9 <= 7 && counts[i + 1] > 0) {
    counts[i]--;
    counts[i + 1]--;
    min = Math.min(min, mianziShanten(counts, i, sets, taatsu + 1));
    counts[i]++;
    counts[i + 1]++;
  }

  if (i < 27 && i % 9 <= 6 && counts[i + 2] > 0) {
    counts[i]--;
    counts[i + 2]--;
    min = Math.min(min, mianziShanten(counts, i, sets, taatsu + 1));
    counts[i]++;
    counts[i + 2]++;
  }

  if (counts[i] >= 2) {
    counts[i] -= 2;
    min = Math.min(min, mianziShanten(counts, i, sets, taatsu + 1));
    counts[i] += 2;
  }

  min = Math.min(min, mianziShanten(counts, i + 1, sets, taatsu));
  return min;
}

function calcNormalShanten(counts: number[]): number {
  let min = mianziShanten(cloneCounts(counts), 0, 0, 0) - 1;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 2) {
      const c = cloneCounts(counts);
      c[i] -= 2;
      min = Math.min(min, mianziShanten(c, 0, 0, 0));
    }
  }
  return min;
}

function calcChiitoitsuShanten(counts: number[]): number {
  let types = 0;
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0) types++;
    if (counts[i] >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - types);
}

function calcKokushiShanten(counts: number[]): number {
  let types = 0;
  let hasPair = false;
  for (const i of YAO_INDICES) {
    if (counts[i] > 0) types++;
    if (counts[i] >= 2) hasPair = true;
  }
  return 13 - types - (hasPair ? 1 : 0);
}

/** 向聴数。0=テンパイ、-1=和了形。13枚(3n+1)・14枚(3n+2)に対応 */
export function calcShanten(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 8;
  const mod = total % 3;
  if (mod !== 1 && mod !== 2) return 8;

  const base = Math.min(
    calcNormalShanten(counts),
    calcChiitoitsuShanten(counts),
    calcKokushiShanten(counts),
  );
  return mod === 2 ? base - 1 : base;
}

export function tileIndexToLabel(index: number): string {
  return TILE_LABELS[index] ?? '?';
}

export function totalTiles(counts: number[]): number {
  return counts.reduce((a, b) => a + b, 0);
}
