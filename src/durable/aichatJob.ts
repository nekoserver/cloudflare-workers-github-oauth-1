/**
 * AIチャットのジョブのDurable Object(wrangler.tomlのAICHAT_JOB)。中身はsrc/utils/aichatJob.tsのAichatJobRunner。
 *
 * 生成はalarm(最長15分)の中で、同じWorkerのアプリ(src/index.tsのHono)へ /api/aichat の要求をそのまま渡して行う。
 * ブラウザとの接続には依存しないので、タブを閉じても応答とログ保存は最後まで終わる(ユーザー指定、2026-11-07)。
 * worker-entry.tsだけがこのクラスを再exportする(DemoContainerと同じく、class_nameのバインディングに必要)。
 */
import app from '../index';
import type { Bindings } from '../types';
import { AichatJobRunner } from '../utils/aichatJob';

export class AichatJob {
  private readonly runner: AichatJobRunner;

  constructor(state: DurableObjectState, env: Bindings) {
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => state.waitUntil(promise),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;
    this.runner = new AichatJobRunner(state.storage, (request) => Promise.resolve(app.fetch(request, env, ctx)));
  }

  fetch(request: Request): Promise<Response> {
    return this.runner.fetch(request);
  }

  alarm(): Promise<void> {
    return this.runner.alarm();
  }
}
