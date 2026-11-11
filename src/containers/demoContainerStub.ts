/**
 * 本体demoコンテナのDurable Objectを名前'demo'で取り出す。
 * 旧@cloudflare/containersのgetContainer(binding, 'demo')と同じ呼び方
 * (binding.get(binding.idFromName('demo')))なので、今のDurable Objectと
 * その保存データに届く。このファイルはcloudflare:workersを読み込まないため、
 * index.tsから静的にimportしてよい。
 * 仕様: SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md
 */
export const DEMO_CONTAINER_NAME = 'demo';

type Namespace<T> = { idFromName(name: string): unknown; get(id: never): T };

export function getDemoContainer<T>(binding: Namespace<T>): T {
  return binding.get(binding.idFromName(DEMO_CONTAINER_NAME) as never);
}
