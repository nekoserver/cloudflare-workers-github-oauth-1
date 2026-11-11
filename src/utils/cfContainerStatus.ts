/**
 * 対象: /cf-containers(Cloudflare Containersのデモ用管理ページ)が使う、
 * DBアクセス・fetchを含まない純粋関数(CLAUDE.mdルール15)。
 * 実際のContainer状態取得(DemoContainer.getState())や起動/停止
 * 操作自体はindex.ts側で行い、ここではその結果の解釈・表示整形・入力検証
 * だけを担う。
 */

export type ContainerStatusValue = 'running' | 'stopping' | 'stopped' | 'healthy' | 'stopped_with_code';

export interface ContainerStateLike {
  lastChange: number;
  status: ContainerStatusValue;
  exitCode?: number;
}

export type ContainerActionName = 'start' | 'stop' | 'restart';

const VALID_ACTIONS: ReadonlySet<string> = new Set<ContainerActionName>(['start', 'stop', 'restart']);

/**
 * リクエストで受け取ったactionパラメータ(文字列)を検証する。
 * 不正な値(typoや未対応の操作名)が来た場合はnullを返し、呼び出し元が
 * 400エラーとして拒否できるようにする。
 */
export function resolveContainerAction(action: string): ContainerActionName | null {
  return VALID_ACTIONS.has(action) ? (action as ContainerActionName) : null;
}

/**
 * Container.getState()が返す状態を日本語の表示ラベルに変換する。
 * state自体がnull(取得前・取得失敗)の場合は「状態不明」と区別する
 * (「停止済み」と誤解させない)。
 */
export function formatContainerStatusLabel(state: ContainerStateLike | null): string {
  if (!state) return '未起動または状態不明';
  switch (state.status) {
    case 'running':
      return '起動中';
    case 'healthy':
      return '起動中(ポート応答確認済み)';
    case 'stopping':
      return '停止処理中';
    case 'stopped':
      return '停止済み';
    case 'stopped_with_code':
      return `停止済み(終了コード: ${state.exitCode ?? '不明'})`;
    default:
      return '不明な状態';
  }
}

/**
 * 現在コンテナが(起動処理の結果として)動作中とみなせるかどうか。
 * UI側で「起動」ボタンを非活性にするかどうかの判定に使う。
 */
export function isContainerRunning(state: ContainerStateLike | null): boolean {
  return !!state && (state.status === 'running' || state.status === 'healthy');
}
