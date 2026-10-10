export function buildSnapshotRepoNotSupportedMessage(repoName: string, supported: readonly string[]): string {
  if (!repoName) {
    return 'repoName が指定されていません。owner/repo 形式(例: nekoserver/dynamicneko)で指定してください';
  }
  return `「${repoName}」は tree-view のツリーデータ(初期JSON)が未登録のため表示できません。` +
    `対処: このリポジトリのツリーJSONを tree-view のスナップショットとして本体ワーカーに追加してデプロイしてください。` +
    `現在表示できるリポジトリ: ${supported.join(', ')}`;
}
