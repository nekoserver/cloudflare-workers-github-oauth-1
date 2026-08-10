import { describe, it, expect } from 'vitest';
import { getMoondreamVlmPage } from './moondreamVlm';

// 故障シナリオ:
// (1) template literal内のエスケープ文字混入によるscriptタグの構文エラー
//     (CLAUDE.mdルール29。生成ページが白紙になる代表的な原因)
// (2) inline onclick等クォート混在ハンドラの使用(禁止パターン)
// (3) 主要なUI要素(ドロップゾーン・ファイル入力・プロンプト欄・分析ボタン・
//     結果表示欄)が生成HTMLに存在しない
// (4) /api/moondream-analyze への呼び出しが正しいエンドポイント名・
//     リクエスト形状になっていない
describe('getMoondreamVlmPage', () => {
  const html = getMoondreamVlmPage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('inline onclick等のクォート混在ハンドラを使っていない', () => {
    expect(html).not.toMatch(/onclick="/);
  });

  it('主要なUI要素(ドロップゾーン・ファイル入力・プロンプト欄・分析ボタン・結果欄)が存在する', () => {
    expect(html).toContain('id="dropZone"');
    expect(html).toContain('id="fileInput"');
    expect(html).toContain('accept="image/*"');
    expect(html).toContain('id="promptInput"');
    expect(html).toContain('id="analyzeBtn"');
    expect(html).toContain('id="resultBox"');
    expect(html).toContain('id="errorBox"');
  });

  it('分析ボタンは画像未選択時は無効(disabled)になっている', () => {
    expect(html).toMatch(/id="analyzeBtn"[^>]*disabled/);
  });

  it('/api/moondream-analyze へPOSTし、image・promptを含むJSONボディを送る', () => {
    expect(html).toContain("fetch('/api/moondream-analyze'");
    expect(html).toContain("method: 'POST'");
    expect(html).toContain('image: pendingImageDataUrl');
    expect(html).toContain('prompt: promptInput.value');
  });

  it('ドラッグ&ドロップのハンドラ(dragover/dragleave/drop)が登録されている', () => {
    expect(html).toContain("dropZone.addEventListener('dragover'");
    expect(html).toContain("dropZone.addEventListener('dragleave'");
    expect(html).toContain("dropZone.addEventListener('drop'");
  });

  it('ユーザー名はHTMLエスケープされて埋め込まれる(XSS対策)', () => {
    const xssHtml = getMoondreamVlmPage('<script>alert(1)</script>');
    expect(xssHtml).not.toContain('<script>alert(1)</script>');
  });
});
