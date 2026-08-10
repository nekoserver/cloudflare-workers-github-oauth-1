import { describe, expect, it } from 'vitest';
import { buildMoondreamAnalyzeLogRowsHtml, getMoondreamAnalyzeLogPage } from './moondreamAnalyzeLog';

// 対象: /moondream-analyze-log ページ。/api/moondream-analyze の呼び出し失敗を
// D1(moondream_analyze_log)から調査するための内部用ログ閲覧ページ。
//
// 故障シナリオ:
//   (1) ログ0件のとき空のテーブル本体になり「読み込み中のまま止まっている」ように見える
//   (2) error_messageにHTML特殊文字が含まれるとエスケープされずXSSになる
//   (3) statusが'ok'でもエラー扱いのバッジ色になる(逆も同様)

describe('buildMoondreamAnalyzeLogRowsHtml', () => {
  it('ログが0件のとき「ログがありません」の行を返す', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([]);
    expect(html).toContain('ログがありません');
  });

  it('status=okの行はstatus-okバッジ、status=errorの行はstatus-errorバッジになる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10' },
      { id: 2, status: 'error', model: 'm', prompt_length: 3, image_bytes: 100, error_message: 'boom', created_at: '2026-08-10' },
    ]);
    expect(html).toContain('status-ok">OK</span>');
    expect(html).toContain('status-error">ERROR</span>');
  });

  it('error_messageのHTML特殊文字はエスケープされる', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'error', model: 'm', prompt_length: 3, image_bytes: 100, error_message: '<script>alert(1)</script>', created_at: '2026-08-10' },
    ]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('error_messageがnullのときはハイフンを表示する', () => {
    const html = buildMoondreamAnalyzeLogRowsHtml([
      { id: 1, status: 'ok', model: 'm', prompt_length: 3, image_bytes: 100, error_message: null, created_at: '2026-08-10' },
    ]);
    expect(html).toContain('<td class="error-cell">-</td>');
  });
});

describe('getMoondreamAnalyzeLogPage', () => {
  it('script タグに構文エラーがない(ページ自体に<script>がなくてもOK)', () => {
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
});
