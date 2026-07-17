import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

// ===========================================================================
// 根本原因:
//   世界遺産ツールチップの👀アイコンは「見どころ」トピックが
//   model='@cf/google/gemma-4-26b-a4b-it' でキャッシュされているかを判定する
//   (POST /api/aichat/check-heritage-mitokoro-gemma-batch)。
//   しかし askAI() は /api/aichat 呼び出し時に model を一切指定していなかったため、
//   サーバー側は wrangler.toml の AI_CHAT_MODEL（既定値は llama系モデル）で
//   回答を生成・保存していた。結果、見どころの回答は実際には存在していても
//   model が gemma-4-26b-a4b-it と一致せず、キャッシュ判定は常に失敗し
//   👀アイコンが表示されなかった。
//   本テストは askAI が「見どころ」トピックの時だけ model を明示指定し、
//   他のトピックでは指定しない（既存の動作を変えない）ことを保証する。
// ===========================================================================

function buildPage(): string {
  return getHeritageAccessPage('tester');
}

describe('askAI: 「見どころ」トピックはgemma-4-26b-a4b-itを明示指定する', () => {
  const html = buildPage();

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

  it('見どころ判定用の定数がgemma-4-26b-a4b-itを指している', () => {
    expect(html).toContain("var HERITAGE_MITOKORO_TOPIC = '見どころ';");
    expect(html).toContain("var HERITAGE_MITOKORO_MODEL = '@cf/google/gemma-4-26b-a4b-it';");
  });

  it('topic が見どころの場合のみ requestBody.model をセットする', () => {
    const idx = html.indexOf('function askAI(heritageName, topic, countryName, onComplete)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 800);
    expect(block).toMatch(/if \(topic === HERITAGE_MITOKORO_TOPIC\) requestBody\.model = HERITAGE_MITOKORO_MODEL;/);
  });

  it('fetch(/api/aichat) の body に requestBody をそのまま渡している（見どころ以外はmodel未指定のまま）', () => {
    const idx = html.indexOf('function askAI(heritageName, topic, countryName, onComplete)');
    const block = html.slice(idx, idx + 800);
    expect(block).toContain('body: JSON.stringify(requestBody)');
    // 見どころ以外のトピックでは model プロパティを追加するコードパスを通らない
    // （= 条件分岐の外側で無条件に model をセットしていない）ことを保証する。
    const modelAssignCount = (block.match(/requestBody\.model = /g) || []).length;
    expect(modelAssignCount).toBe(1);
  });
});
