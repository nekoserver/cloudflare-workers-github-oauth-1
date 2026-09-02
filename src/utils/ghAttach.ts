// /gh-attach ページのバックエンド側純粋関数群。
//
// gh CLI(cli/cli)の `gh issue create --attach` は
// (1) ローカル画像/動画をGitHubへアップロード
// (2) 本文Markdown中の参照を書き換え/追記
// (3) Issueを作成
// という3段階で動く。(2)はwasm/gh-attach-wasm(Go/js-wasm移植)がブラウザ側で
// 行うため、このファイルは(1)(3)のHTTPリクエスト組み立てとレスポンス解釈
// (=実際にfetchする副作用そのものは除く、純粋な部分)のみを担う。

export const ALLOWED_ATTACH_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// GitHub側のuser-attachments assetsエンドポイントの上限(cli/cliのmaxImageBytesと同じ)。
export const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

// クライアント側base64長の上限(4/3倍、切り上げに余裕を持たせた値)。
export const MAX_ATTACH_BASE64_LENGTH = 14_000_000;

export type AttachValidationResult = { ok: true; mime: string; base64: string } | { ok: false; reason: string };

const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/;

export function validateAttachDataUrl(input: string): AttachValidationResult {
  const match = DATA_URL_RE.exec(input);
  if (!match) {
    return { ok: false, reason: '添付データの形式が不正です' };
  }
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  if (!ALLOWED_ATTACH_MIME_TYPES.has(mime)) {
    return { ok: false, reason: '対応していないファイル形式です(png/jpeg/webp/gifのみ)' };
  }
  if (base64.length > MAX_ATTACH_BASE64_LENGTH) {
    return { ok: false, reason: 'ファイルサイズが大きすぎます(上限10MB程度)' };
  }
  return { ok: true, mime, base64 };
}

export function decodeAttachDataUrlToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type OwnerRepo = { owner: string; repo: string };

const OWNER_REPO_RE = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/;

export function parseOwnerRepo(input: string): OwnerRepo | null {
  const trimmed = input.trim();
  const m = OWNER_REPO_RE.exec(trimmed);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

/**
 * cli/cli internal/attachments/client.go の checkPermission 相当。
 * リポジトリのviewerPermission(REST APIの permissions.push 等から得られる書き込み可否)
 * が無ければアップロードは拒否する。
 */
export function canUploadWithPermission(canPush: boolean | undefined): boolean {
  return canPush === true;
}

export function buildUserAttachmentUploadUrl(params: {
  name: string;
  contentType: string;
  repositoryId: number;
}): string {
  const url = new URL('https://github.com/user-attachments/assets');
  url.searchParams.set('name', params.name);
  url.searchParams.set('content_type', params.contentType);
  url.searchParams.set('repository_id', String(params.repositoryId));
  return url.toString();
}

export type UploadAssetResponse = { url: string } | { error: string };

/**
 * cli/cli internal/attachments/client.go の postAsset のレスポンス解釈部分。
 * 実際のfetch自体は呼び出し元(index.ts)が行い、この関数はJSONパース後の
 * オブジェクトから最終的なURLを取り出すだけの純粋関数にする。
 */
export function parseUploadAssetResponse(json: unknown): UploadAssetResponse {
  if (typeof json !== 'object' || json === null) {
    return { error: 'アップロード応答の形式が不正です' };
  }
  const url = (json as Record<string, unknown>)['url'];
  if (typeof url !== 'string' || url === '') {
    return { error: 'サーバーがアセットURLを返しませんでした' };
  }
  return { url };
}

/**
 * GitHub APIのエラーレスポンスJSONから message フィールドを取り出す。
 * ステータスコード単体(例: "401")だけではユーザーも呼び出し元も原因を
 * 追えないため、GitHubが返す具体的な理由("Bad credentials"等)を
 * エラーメッセージに含めて返せるようにする(CLAUDE.mdルール8の「記録」義務)。
 */
export function parseGithubErrorMessage(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const message = (json as Record<string, unknown>)['message'];
  return typeof message === 'string' && message !== '' ? message : null;
}

export type CreateIssueResponse = { url: string; number: number } | { error: string };

export function parseCreateIssueResponse(json: unknown): CreateIssueResponse {
  if (typeof json !== 'object' || json === null) {
    return { error: 'Issue作成応答の形式が不正です' };
  }
  const obj = json as Record<string, unknown>;
  const url = obj['html_url'];
  const number = obj['number'];
  if (typeof url !== 'string' || url === '' || typeof number !== 'number') {
    return { error: 'サーバーがIssue情報を返しませんでした' };
  }
  return { url, number };
}
