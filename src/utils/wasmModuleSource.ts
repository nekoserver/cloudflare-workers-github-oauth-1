/**
 * /wasm-modulesページ用に、GitHub上のWASMモジュールのRustソース本文・
 * 最終更新日時(ソースファイルの最新コミット日時)・最新ビルド日時
 * (ビルド成果物である.wasmファイルの最新コミット日時)を取得する。
 *
 * このリポジトリ自身(nekoserver/cloudflare-workers-github-oauth-1)を対象とする。
 * GitHub Contents API / Commits API はユーザーのGitHub OAuthアクセストークンで
 * 呼び出す(このアプリ自体がGitHub OAuthログインを前提とするため、専用の
 * サービストークンを別途用意する必要が無い)。
 */
export const WASM_MODULES_REPO_FULL_NAME = 'nekoserver/cloudflare-workers-github-oauth-1';

const GITHUB_API_HEADERS_BASE = {
  'User-Agent': 'cloudflare-workers-github-oauth',
};

/**
 * 指定パスの最新コミット日時(ISO 8601文字列)を取得する。
 * 404・レート制限・トークン未設定などで取得できない場合はnullを返す
 * (呼び出し元はnullを「不明」として表示すること。例外を投げて画面全体を
 * 壊さない)。
 */
export async function fetchLatestCommitDateForPath(
  accessToken: string,
  repoFullName: string,
  path: string
): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${repoFullName}/commits?path=${encodeURIComponent(path)}&per_page=1`;
    const res = await fetch(url, {
      headers: {
        ...GITHUB_API_HEADERS_BASE,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return null;
    const commits = (await res.json()) as Array<{ commit?: { committer?: { date?: string }; author?: { date?: string } } }>;
    const first = commits[0];
    return first?.commit?.committer?.date ?? first?.commit?.author?.date ?? null;
  } catch {
    return null;
  }
}

export type FetchFileContentResult =
  | { ok: true; content: string }
  | { ok: false; status: number; message: string };

/**
 * 指定パスのファイル本文(UTF-8テキスト)を取得する。
 *
 * 以前は失敗時にnullだけを返して詳細を握りつぶしており、GitHub側の実際の
 * エラー(トークンのスコープ不足によるBad credentials、レート制限等)が
 * 呼び出し元にもユーザーにも一切伝わらず「ソースファイルの取得に失敗
 * しました」としか表示できなかった(CLAUDE.mdルール8: catchで握りつぶす
 * なら記録・通知・テストの3つを満たすこと、に反していた)。GitHub APIの
 * ステータスコードとエラーメッセージ本文を呼び出し元に返すよう修正した。
 */
export async function fetchFileContent(accessToken: string, repoFullName: string, path: string): Promise<FetchFileContentResult> {
  try {
    const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;
    const res = await fetch(url, {
      headers: {
        ...GITHUB_API_HEADERS_BASE,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as { message?: string };
        detail = body?.message ?? '';
      } catch {
        // レスポンスボディがJSONでない場合は無視し、ステータス文言のみ使う
      }
      return { ok: false, status: res.status, message: detail || res.statusText || '不明なエラー' };
    }
    return { ok: true, content: await res.text() };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : String(error) };
  }
}
