import { describe, it, expect, vi, afterEach } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 根本原因:
//   /api/heritage-area/search はSQLエラー時に { error, detail } を返すが、
//   フロントエンドのgetJson()はd.errorしかError messageに含めておらず、
//   detail(実際のD1エラー内容)が画面に一切表示されなかった。
//   結果、利用者はブラウザの開発者ツールやCloudflareダッシュボードの
//   ログを見ない限り本当の原因(例: 特定カラムの欠落)を知る術がなかった。
// 本テストは生成されたHTMLから埋め込みscriptを抽出し、実際のDOM/fetchで
// getJson()を実行して、detailがError messageに含まれることを検証する。
function extractGetJson(html: string): string {
  const m = html.match(/async function getJson\(url,opts\)\{.*?return d;\}/);
  if (!m) throw new Error('getJson not found in generated HTML');
  return m[0];
}

describe('heritage-area: getJsonはAPIレスポンスのdetailをエラーメッセージに含める', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('生成されたHTMLのgetJson実装にdetail連結ロジックが含まれる', () => {
    const html = getHeritageAreaPage();
    const src = extractGetJson(html);
    expect(src).toContain('d.detail');
  });

  it('r.ok=false かつ detail がある場合、Error.message に detail が含まれる', async () => {
    const html = getHeritageAreaPage();
    const src = extractGetJson(html);
    const getJson = new Function('fetch', `return ${src}`)(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: '検索露出ログの検索に失敗しました', detail: 'D1_ERROR: no such column: s.deleted_at: SQLITE_ERROR' }),
      })
    );
    await expect(getJson('/api/heritage-area/search', {})).rejects.toThrow(
      '検索露出ログの検索に失敗しました : D1_ERROR: no such column: s.deleted_at: SQLITE_ERROR'
    );
  });

  it('detail が無い場合は error のみを Error.message にする(従来どおり)', async () => {
    const html = getHeritageAreaPage();
    const src = extractGetJson(html);
    const getJson = new Function('fetch', `return ${src}`)(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: '認証が必要です' }),
      })
    );
    await expect(getJson('/api/heritage-area/search', {})).rejects.toThrow('認証が必要です');
  });
});
