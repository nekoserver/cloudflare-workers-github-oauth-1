// 仮説(2026-11-12、本番のログで確認): Worker内WASMのノードは起動し直した直後、tailnetにつながるまで約13秒かかる
// (ノード側は MUSE_NODE_READY_MS まで待つ)。死活確認(ページ読み込み時のトースト)が8秒で打ち切ると、
// Museが動いていても起動直後は必ず「Tailscaleの接続状況を確認してください」が出る(06:40・07:09・07:32・07:58、
// どれも muse-health が約8.1秒で終わっていた)。
// → ノードの準備に MUSE_NODE_READY_MS 近くかかっても、Museが動いていれば確認は成功しないとおかしい。
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkMuseWorkerHealth, MUSE_WORKER_HEALTH_TIMEOUT_MS } from './museWorkerAsk';
import { MUSE_NODE_READY_MS } from './museNodeReady';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function slowNode(readyAfterMs: number, status = 'ok') {
  return { idFromName: () => 'muse', get: () => ({ fetch: () => new Promise<Response>(resolve => setTimeout(() => resolve(Response.json({ status })), readyAfterMs)) }) };
}

it('起動直後のノードが準備に13秒かかっても、Museが動いていれば成功する', async () => {
  const pending = checkMuseWorkerHealth({ TAILSCALE_WASM: slowNode(13_000) as never, MUSE_API_KEY: 'k' });
  await vi.advanceTimersByTimeAsync(13_000);
  await expect(pending).resolves.toBe(true);
});

it('確認の待ち時間は、ノードが準備を待つ上限より長い(ノードより先に打ち切らない)', () => {
  expect(MUSE_WORKER_HEALTH_TIMEOUT_MS).toBeGreaterThan(MUSE_NODE_READY_MS);
});

it('ノードの準備の上限を過ぎても答えがなければ失敗にする(いつまでも待たない)', async () => {
  const pending = checkMuseWorkerHealth({ TAILSCALE_WASM: slowNode(10 * 60_000) as never, MUSE_API_KEY: 'k' });
  await vi.advanceTimersByTimeAsync(MUSE_WORKER_HEALTH_TIMEOUT_MS + 1);
  await expect(pending).resolves.toBe(false);
});

it('Museが ok を返さなければ失敗にする', async () => {
  const pending = checkMuseWorkerHealth({ TAILSCALE_WASM: slowNode(100, 'down') as never, MUSE_API_KEY: 'k' });
  await vi.advanceTimersByTimeAsync(100);
  await expect(pending).resolves.toBe(false);
});
