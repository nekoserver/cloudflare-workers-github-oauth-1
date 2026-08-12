import { describe, expect, it } from 'vitest';
import { buildMoondreamAnalyzeLogRowsHtml, getMoondreamAnalyzeLogPage } from './moondreamAnalyzeLog';

// 対象: /moondream-analyze-log ページ。/api/moondream-analyze の呼び出し失敗を
// D1(moondream_analyze_log)から調査するための内部用ログ閲覧ページ。
// AIチャットの左サイドパネルと同様のスワイプ削除UIを持ち、削除操作は
// /api/moondream-analyze-log/:id へのDELETEでD1の該当行そのものを消す
// (ai_chat_sharesのような論理削除ではなく物理削除)。
//
// 故障シナリオ:
//   (1) ログ0件のとき空の一覧になり「読み込み中のまま止まっている」ように見える
//   (2) error_messageにHTML特殊文字が含まれるとエスケープされずXSSになる
//   (3) statusが'ok'でもエラー扱いのバッジ色になる(逆も同様)
//   (4) 各行にdata-id・削除ボタンが無いとスワイプ削除の対象が特定できない

describe('buildMoondreamAnalyzeLogRowsHtml', () => {
  it('ログが0件のとき「ログがありません」の空表示を返す', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([]);
    expect(html).toContain('ログがありません');
  });

  it('status=okの行はstatus-okバッジ、status=errorの行はstatus-errorバッジになる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10', image_data_url: null },
      { id: 2, status: 'error', model: 'm', prompt_length: 3, image_bytes: 100, error_message: 'boom', created_at: '2026-08-10', image_data_url: null },
    ]);
    expect(html).toContain('status-ok">OK</span>');
    expect(html).toContain('status-error">ERROR</span>');
  });

  it('error_messageのHTML特殊文字はエスケープされる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'error', model: 'm', prompt_length: 3, image_bytes: 100, error_message: '<script>alert(1)</script>', created_at: '2026-08-10', image_data_url: null },
    ]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('error_messageがnullのときはハイフンを表示する', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10', image_data_url: null },
    ]);
    expect(html).toContain('<div class="log-cell log-cell-error">-</div>');
  });

  it('image_data_urlがあれば画像を復元できるサムネイルリンク(ダウンロード付き)を表示する', () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 5, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10', image_data_url: dataUrl },
    ]);
    expect(html).toContain(`<a href="${dataUrl}" download="moondream-log-5.png" target="_blank" rel="noopener">`);
    expect(html).toContain(`<img class="thumb" src="${dataUrl}" alt="添付画像">`);
  });

  it('image_data_urlがnullのときは画像セルがハイフンになる(元画像を保存していない場合)', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10', image_data_url: null },
    ]);
    expect(html).not.toContain('class="thumb"');
  });

  it('各行にスワイプ削除対象を特定するdata-idと削除ボタンを持つ', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 42, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10', image_data_url: null },
    ]);
    expect(html).toContain('data-id="42"');
    expect(html).toContain('class="log-delete-btn"');
    expect(html).toContain('class="log-swipe-inner"');
  });
});

describe('getMoondreamAnalyzeLogPage', () => {
  it('script タグに構文エラーがない', () => {
    const html = getMoondreamAnalyzeLogPage('testuser', []);
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    while ((m = scriptRe.exec(html)) !== null) {
      expect(() => new Function(m![1])).not.toThrow();
    }
  });

  it('ユーザー名がHTMLエスケープされて出力される', () => {
    const html = getMoondreamAnalyzeLogPage('<b>evil</b>', []);
    expect(html).not.toContain('<b>evil</b>');
    expect(html).toContain('&lt;b&gt;evil&lt;/b&gt;');
  });

  it('削除確認オーバーレイと削除APIエンドポイントを埋め込む', () => {
    const html = getMoondreamAnalyzeLogPage('testuser', [
      { id: 7, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10', image_data_url: null },
    ]);
    expect(html).toContain('id="deleteConfirmOverlay"');
    expect(html).toContain('/api/moondream-analyze-log/');
    expect(html).toContain("method: 'DELETE'");
  });
});
