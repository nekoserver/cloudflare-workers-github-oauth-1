import { describe, it, expect } from 'vitest';
import { getRubyWasmPage } from './views/rubyWasm';

// 対象: /ruby-wasmページの「クリア」ボタン・「保存」ボタン(実行成功時のみ
// 表示)・保存済みスニペット一覧モーダル(選択→編集可能なコード欄→実行→
// さらに上のレイヤーの結果モーダル)。
//
// 故障シナリオ:
//   (1) モーダルのz-indexを固定値で書いてしまい、複数モーダルが同時に
//       開いたときに後から開いた方が裏に隠れる(CLAUDE.mdルール26)
//   (2) 実行に失敗した(例外が出た)のに保存ボタンが表示され、動作しない
//       コードを保存できてしまう
//   (3) 一覧モーダルの実行結果モーダルより先に一覧モーダル自体が閉じて
//       しまう、または結果モーダルのz-indexが一覧モーダルより低い
//   (4) 保存時に動作確認(verifications)の記録が漏れる
//   (5) <script type="module">内のJSに構文エラーがある

describe('/ruby-wasmページ: クリア・保存・スニペット一覧モーダル', () => {
  it('クリアボタンがinputCode・resultBlock・saveBtnをリセットする', () => {
    const html = getRubyWasmPage('tester');
    const idx = html.indexOf("clearBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("inputCode.value = ''");
    expect(block).toContain("resultBlock.style.display = 'none'");
    expect(block).toContain("saveBtn.style.display = 'none'");
  });

  it('実行結果が正常(result.ok)な場合のみ保存ボタンを表示する', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain("saveBtn.style.display = result.ok ? 'inline-block' : 'none';");
  });

  it('保存時にスニペット保存APIと動作確認(verified:true)記録APIの両方を呼ぶ', () => {
    const html = getRubyWasmPage('tester');
    const idx = html.indexOf("saveBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1600);
    expect(block).toContain("fetch('/api/ruby-wasm/snippets'");
    expect(block).toContain('/verifications');
    expect(block).toContain('JSON.stringify({ verified: true })');
  });

  it('保存リクエストにexecutedSuccessfully:trueを含める(サーバー側の構文ヒューリスティックによる誤判定で保存を拒否されないようにするため)', () => {
    const html = getRubyWasmPage('tester');
    const idx = html.indexOf("saveBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('JSON.stringify({ code: code, executedSuccessfully: true })');
  });

  it('モーダルのz-indexは固定値を書かず、getNextZ()で毎回算出してから設定する(CLAUDE.mdルール26)', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('function getNextZ()');
    expect(html).toContain("overlay.style.zIndex = String(getNextZ());");
    // z-indexの固定値直書き(例: "z-index: 1000" のようなCSS宣言以外での
    // 決め打ち代入)が無いことを、JSでの"zIndex ="代入箇所すべてが
    // getNextZ()を経由していることで確認する。
    const assignMatches = html.match(/\.zIndex = [^;]+;/g) || [];
    assignMatches.forEach((assign) => {
      expect(assign).toContain('getNextZ()');
    });
  });

  it('一覧モーダルを開くとスニペット一覧を取得し、選択するとコード欄が上書きされる', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('function loadModalSnippetList()');
    expect(html).toContain("fetch('/api/ruby-wasm/snippets'");
    expect(html).toContain('modalCodeTextarea.value = res.data.code;');
  });

  it('一覧モーダルの実行ボタンはrunRubyCode()を使い、結果を一覧モーダルよりさらに上のレイヤーの結果モーダルに表示する', () => {
    const html = getRubyWasmPage('tester');
    const idx = html.indexOf("modalRunBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('runRubyCode(code)');
    expect(block).toContain('openModal(resultModalOverlay)');
  });

  it('モーダルの開閉ボタン・オーバーレイ外クリックでそれぞれ閉じられる', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain("listModalCloseBtn.addEventListener('click', function() { closeModal(listModalOverlay); });");
    expect(html).toContain("resultModalCloseBtn.addEventListener('click', function() { closeModal(resultModalOverlay); });");
    expect(html).toContain('if (e.target === listModalOverlay) closeModal(listModalOverlay);');
    expect(html).toContain('if (e.target === resultModalOverlay) closeModal(resultModalOverlay);');
  });

  it('<script type="module">内のJSに構文エラーがない', () => {
    const html = getRubyWasmPage('tester');
    const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    expect(() => new Function('return (async () => { ' + m![1].replace(/import\(/g, 'Promise.resolve(') + ' })')).not.toThrow();
  });

  it('旧来の選択式スニペットピッカー(select/load/reloadボタン)は撤去され、モーダル方式に一本化されている', () => {
    const html = getRubyWasmPage('tester');
    expect(html).not.toContain('id="snippetSelect"');
    expect(html).not.toContain('id="snippetLoadBtn"');
    expect(html).not.toContain('id="snippetReloadBtn"');
  });

  it('モーダル内のテキスト(タイトル)にテーマの文字色が明示指定されている(固定色任せで黒地に黒文字等にならないようにするため)', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('.modal-box {');
    const modalBoxRule = html.slice(html.indexOf('.modal-box {'), html.indexOf('.modal-box {') + 300);
    expect(modalBoxRule).toContain('color: var(--text-primary)');
  });

  it('保存ボタンは実行成功時のみ有効化し、保存成功後は重複登録防止のため無効化したままにする', () => {
    const html = getRubyWasmPage('tester');
    // 実行成功時、保存ボタンを表示しつつ有効化する。
    const runIdx = html.indexOf("runBtn.addEventListener('click'");
    const runBlock = html.slice(runIdx, runIdx + 700);
    expect(runBlock).toContain("saveBtn.style.display = result.ok ? 'inline-block' : 'none';");
    expect(runBlock).toContain('if (result.ok) saveBtn.disabled = false;');

    // 保存成功時はsaveSucceededをtrueにし、失敗時のみ再有効化する
    // (成功時はdisabled=trueのまま、グレーアウトし続ける)。
    const saveIdx = html.indexOf("saveBtn.addEventListener('click'");
    const saveBlock = html.slice(saveIdx, saveIdx + 2000);
    expect(saveBlock).toContain('var saveSucceeded = false;');
    expect(saveBlock).toContain('saveSucceeded = true;');
    expect(saveBlock).toContain('if (!saveSucceeded) saveBtn.disabled = false;');
  });

  // 一覧モーダルの行のスワイプ削除UI(swipe-to-delete)自体の構造・挙動は
  // ./ruby-wasm-snippet-swipe-delete-20260911.test.ts で検証する
  // (確認モーダル付きの実装に一本化されたため、こちらでは重複させない)。
});
