import { describe, expect, it } from 'vitest';
import { getRubyWasmPage } from './views/rubyWasm';

describe('/ruby-wasm 保存済みスニペットのスワイプ削除', () => {
  const html = getRubyWasmPage('test-user');

  it('各行に左スワイプ用コンテナと赤い削除ボタンを生成する', () => {
    expect(html).toContain('snippet-swipe-row');
    expect(html).toContain('snippet-swipe-content');
    expect(html).toContain('snippet-delete-btn');
    expect(html).toContain("deleteBtn.textContent = '削除';");
  });

  it('タッチとマウスに共通利用できるスワイプ検知関数を持つ', () => {
    expect(html).toContain('function setupSwipeReveal(row, content, actionButton)');
    expect(html).toContain("row.addEventListener('touchstart'");
    expect(html).toContain("content.addEventListener('mousedown'");
    expect(html).toContain("row.classList.add('swipe-open')");
  });

  it('確認関数はPromise<boolean>相当の承認結果のみを返し、最上位で表示する', () => {
    expect(html).toContain('function requestDeleteConfirmation(title)');
    expect(html).toContain('return new Promise(function(resolve)');
    expect(html).toContain('openModal(deleteConfirmOverlay);');
    expect(html).toContain('finish(true)');
    expect(html).toContain('finish(false)');
  });

  it('承認後だけDELETE APIを呼び、成功後に対象行を一覧から消す', () => {
    expect(html).toContain('if (!approved) return;');
    expect(html).toContain("method: 'DELETE'");
    expect(html).toContain("row.remove();");
  });
});
