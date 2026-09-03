import { describe, it, expect } from 'vitest';
import { getMarkdownPreviewPage } from './views/markdown-preview';

// 対象: /md-previewページの「Text→.md」ボタン(Editボタンの左)。押すと画面左半分が
// 広いプレーンテキスト入力欄、右半分がMarkdownコードブロック出力窓になり、
// 左に入力したテキストが右にリアルタイムで反映される。
//
// 故障シナリオ:
//   (1) ボタンをHTMLに置いただけでswitchTab('text2md')の分岐が無く、
//       クリックしても何も切り替わらない
//   (2) 入力欄(text2mdInput)にinputイベントの配線が無く、右の出力窓が
//       更新されない
//   (3) 出力ロジックがsrc/utils/textToMarkdown.tsのwrapAsMarkdownCodeBlockと
//       食い違う(フェンスの本数決定など)

describe('/md-previewページ: Text→.mdタブ', () => {
  it('Editボタンの左にText→.mdボタンが配置されている', () => {
    const html = getMarkdownPreviewPage();
    const text2mdIdx = html.indexOf('data-tab="text2md"');
    const editIdx = html.indexOf('data-tab="edit"');
    expect(text2mdIdx).toBeGreaterThan(-1);
    expect(editIdx).toBeGreaterThan(-1);
    expect(text2mdIdx).toBeLessThan(editIdx);
  });

  it('左に広いテキストエリア(text2mdInput)、右に出力窓(text2mdOutput)がある', () => {
    const html = getMarkdownPreviewPage();
    expect(html).toContain('id="text2mdInput"');
    expect(html).toContain('id="text2mdOutput"');
  });

  it('switchTab関数がtext2mdタブを処理する', () => {
    const html = getMarkdownPreviewPage();
    const start = html.indexOf('function switchTab(tab)');
    const body = html.slice(start, start + 1100);
    expect(body).toContain("tab === 'text2md'");
    expect(body).toContain('updateText2md()');
  });

  it('text2mdInputのinputイベントでupdateText2mdが呼ばれる', () => {
    const html = getMarkdownPreviewPage();
    expect(html).toContain("document.getElementById('text2mdInput').addEventListener('input', updateText2md)");
  });

  it('フェンス生成ロジックがバッククォート最長連続数+1本(最低3本)を使う(wrapAsMarkdownCodeBlockと同じ方針)', () => {
    const html = getMarkdownPreviewPage();
    const start = html.indexOf('function wrapAsMarkdownCodeBlockClient(text)');
    expect(start).toBeGreaterThan(-1);
    const body = html.slice(start, start + 600);
    expect(body).toContain('Math.max(3, longestRun + 1)');
  });
});
