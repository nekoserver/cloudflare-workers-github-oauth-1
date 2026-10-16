/**
 * 対象: /cf-containersの「累計接続時間・単価表・予定支出」表示用の純粋関数
 * (CLAUDE.mdルール15)。DBアクセス・fetchを含まない。
 *
 * 単価はCloudflare公式ドキュメント(2026-10時点、Workers Paid plan超過分)の
 * 従量課金レート。無料枠(375 vCPU分・25 GiB時間・200 GB時間/月)は考慮せず、
 * 単純にレート×累計接続時間で計算した「無料枠を使い切った場合の目安」を
 * 返す(実際の請求額はこれより低いことが多い)。
 * 出典: https://developers.cloudflare.com/containers/platform/pricing/
 */

export interface ContainerInstanceSpec {
  vcpu: number;
  memoryGiB: number;
  diskGB: number;
}

// wrangler.tomlの[[containers]]に設定しているinstance_type。変更したら
// ここも合わせて更新すること。
export const CONFIGURED_INSTANCE_TYPE = 'standard-1';
export const CONFIGURED_INSTANCE_SPEC: ContainerInstanceSpec = { vcpu: 0.5, memoryGiB: 4, diskGB: 8 };

export const RATE_PER_VCPU_SECOND_USD = 0.00002;
export const RATE_PER_GIB_SECOND_USD = 0.0000025;
export const RATE_PER_GB_SECOND_USD = 0.00000007;

export interface HourlyRateBreakdown {
  vcpuUsdPerHour: number;
  memoryUsdPerHour: number;
  diskUsdPerHour: number;
  totalUsdPerHour: number;
}

/** instance_typeのスペックから、1時間あたりの単価(CPU/メモリ/ディスク別)を返す。 */
export function computeHourlyRate(spec: ContainerInstanceSpec): HourlyRateBreakdown {
  const vcpuUsdPerHour = spec.vcpu * RATE_PER_VCPU_SECOND_USD * 3600;
  const memoryUsdPerHour = spec.memoryGiB * RATE_PER_GIB_SECOND_USD * 3600;
  const diskUsdPerHour = spec.diskGB * RATE_PER_GB_SECOND_USD * 3600;
  return {
    vcpuUsdPerHour,
    memoryUsdPerHour,
    diskUsdPerHour,
    totalUsdPerHour: vcpuUsdPerHour + memoryUsdPerHour + diskUsdPerHour,
  };
}

/** 累計接続秒数と単価から、無料枠を考慮しない概算の予定支出(USD)を返す。 */
export function estimateCostUsd(cumulativeConnectedSeconds: number, spec: ContainerInstanceSpec): number {
  const hours = Math.max(0, cumulativeConnectedSeconds) / 3600;
  return computeHourlyRate(spec).totalUsdPerHour * hours;
}

export interface OperationEvent {
  action: string;
  result: string;
  createdAt: string;
}

/**
 * start/restart〜stopの区間を積算して、累計接続秒数を返す。
 * - start/restartで区間が開く(既に開いていれば何もしない。連続start等の
 *   想定外入力でも例外にしない)
 * - stopで区間が閉じ、経過秒数を加算する
 * - 最後まで区間が開いたまま(=現在起動中)なら、nowまでの経過も加算する
 * 入力はcreated_at昇順である必要はない(関数内でソートする)。
 */
export function computeCumulativeConnectedSeconds(events: OperationEvent[], now: Date = new Date()): number {
  const sorted = events
    .filter((e) => e.result === 'success' && (e.action === 'start' || e.action === 'restart' || e.action === 'stop'))
    .map((e) => ({ ...e, ts: Date.parse(e.createdAt) }))
    .filter((e) => !Number.isNaN(e.ts))
    .sort((a, b) => a.ts - b.ts);

  let total = 0;
  let openStart: number | null = null;
  for (const e of sorted) {
    if (e.action === 'start' || e.action === 'restart') {
      if (openStart === null) openStart = e.ts;
    } else if (e.action === 'stop' && openStart !== null) {
      total += Math.max(0, e.ts - openStart) / 1000;
      openStart = null;
    }
  }
  if (openStart !== null) {
    total += Math.max(0, now.getTime() - openStart) / 1000;
  }
  return total;
}
