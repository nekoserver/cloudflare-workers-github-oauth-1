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

/**
 * 指定パスのファイル本文(UTF-8テキスト)を取得する。取得失敗時はnullを返す。
 */
export async function fetchFileContent(accessToken: string, repoFullName: string, path: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;
    const res = await fetch(url, {
      headers: {
        ...GITHUB_API_HEADERS_BASE,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
