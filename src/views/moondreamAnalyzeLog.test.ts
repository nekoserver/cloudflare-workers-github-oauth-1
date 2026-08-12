import { describe, expect, it } from 'vitest';
import { buildMoondreamAnalyzeLogRowsHtml, getMoondreamAnalyzeLogPage, type MoondreamAnalyzeLogRow } from './moondreamAnalyzeLog';

// 対象: /moondream-analyze-log ページ。/api/moondream-analyze の呼び出し失敗を
// D1(moondream_analyze_log)から調査するための内部用ログ閲覧ページ。
// AIチャットの左サイドパネルと同様のスワイプ削除UIを持ち、削除操作は
// /api/moondream-analyze-log/:id へのDELETEでD1の該当行そのものを消す
// (ai_chat_sharesのような論理削除ではなく物理削除)。
// また各行をタップすると、AIチャットの「詳細プレビュー」と同様にプロンプト
// (ユーザーバブル)と分析結果またはエラー(アシスタントバブル)をチャット形式で
// 表示するプレビューモーダルが開く。データは追加fetchなしで行のdata-*属性
// から読み取る。
//
// 故障シナリオ:
//   (1) ログ0件のとき空の一覧になり「読み込み中のまま止まっている」ように見える
//   (2) error_messageにHTML特殊文字が含まれるとエスケープされずXSSになる
//   (3) statusが'ok'でもエラー扱いのバッジ色になる(逆も同様)
//   (4) 各行にdata-id・削除ボタンが無いとスワイプ削除の対象が特定できない
//   (5) prompt_text/analysis_textに"やHTML特殊文字が含まれるとdata-*属性が
//       壊れ、以降の属性やDOM構造が崩れる(属性エスケープにダブルクォートが
//       含まれていない場合の典型的な不具合)

function baseRow(overrides: Partial<MoondreamAnalyzeLogRow> = {}): MoondreamAnalyzeLogRow {
  return {
    id: 1,
    status: 'ok',
    model: 'm',
    prompt_length: 3,
    image_bytes: 100,
    error_message: null,
    created_at: '2026-08-10',
    image_data_url: null,
    prompt_text: null,
    analysis_text: null,
    ...overrides,
  };
}

describe('buildMoondreamAnalyzeLogRowsHtml', () => {
  it('ログが0件のとき「ログがありません」の空表示を返す', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([]);
    expect(html).toContain('ログがありません');
  });

  it('status=okの行はstatus-okバッジ、status=errorの行はstatus-errorバッジになる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      baseRow({ id: 1, status: 'ok' }),
      baseRow({ id: 2, status: 'error', error_message: 'boom' }),
    ]);
    expect(html).toContain('status-ok">OK</span>');
    expect(html).toContain('status-error">ERROR</span>');
  });

  it('error_messageのHTML特殊文字はエスケープされる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      baseRow({ status: 'error', error_message: '<script>alert(1)</script>' }),
    ]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('error_messageがnullのときはハイフンを表示する', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([baseRow()]);
    expect(html).toContain('<div class="log-cell log-cell-error">-</div>');
  });

  it('image_data_urlがあれば画像を復元できるサムネイルリンク(ダウンロード付き)を表示する', () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    const html = buildMoondreamAnalyzeLogRowsHtml([baseRow({ id: 5, image_data_url: dataUrl })]);
    expect(html).toContain(`<a href="${dataUrl}" download="moondream-log-5.png" target="_blank" rel="noopener">`);
    expect(html).toContain(`<img class="thumb" src="${dataUrl}" alt="添付画像">`);
  });

  it('image_data_urlがnullのときは画像セルがハイフンになる(元画像を保存していない場合)', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([baseRow()]);
    expect(html).not.toContain('class="thumb"');
  });

  it('各行にスワイプ削除対象を特定するdata-idと削除ボタンを持つ', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([baseRow({ id: 42 })]);
    expect(html).toContain('data-id="42"');
    expect(html).toContain('class="log-delete-btn"');
    expect(html).toContain('class="log-swipe-inner"');
  });

  it('タップ時のプレビュー用にprompt/analysis/error/image/status/model/createdをdata-*属性へ埋め込む', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      baseRow({
        id: 9, status: 'ok', model: 'moondream3.1', created_at: '2026-08-12 10:00',
        prompt_text: 'この画像には何が写っていますか?', analysis_text: '猫が写っています。',
        image_data_url: 'data:image/png;base64,BBBB',
      }),
    ]);
    expect(html).toContain('data-preview="1"');
    expect(html).toContain('data-status="ok"');
    expect(html).toContain('data-model="moondream3.1"');
    expect(html).toContain('data-created="2026-08-12 10:00"');
    expect(html).toContain('data-prompt="この画像には何が写っていますか?"');
    expect(html).toContain('data-analysis="猫が写っています。"');
    expect(html).toContain('data-image="data:image/png;base64,BBBB"');
  });

  it('prompt_text/analysis_textがnullのときはdata-prompt/data-analysisが空文字になる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([baseRow({ prompt_text: null, analysis_text: null })]);
    expect(html).toContain('data-prompt=""');
    expect(html).toContain('data-analysis=""');
  });

  it('prompt_text/analysis_text/error_messageのダブルクォート・HTML特殊文字はdata-*属性内でエスケープされる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      baseRow({
        status: 'error',
        prompt_text: '"onmouseover="alert(1)',
        error_message: '"><img src=x onerror=alert(1)>',
      }),
    ]);
    expect(html).not.toContain('"onmouseover="alert(1)"');
    expect(html).not.toContain('"><img src=x onerror=alert(1)>');
    expect(html).toContain('&quot;onmouseover=&quot;alert(1)');
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
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
    const html = getMoondreamAnalyzeLogPage('testuser', [baseRow({ id: 7 })]);
    expect(html).toContain('id="deleteConfirmOverlay"');
    expect(html).toContain('/api/moondream-analyze-log/');
    expect(html).toContain("method: 'DELETE'");
  });

  it('タップ時のプレビューモーダル(チャットバブル表示)を埋め込む', () => {
    const html = getMoondreamAnalyzeLogPage('testuser', [baseRow({ id: 3 })]);
    expect(html).toContain('id="previewOverlay"');
    expect(html).toContain('id="previewChat"');
    expect(html).toContain('preview-bubble user');
    expect(html).toContain('preview-bubble assistant');
    expect(html).toContain('preview-bubble error');
  });
});
