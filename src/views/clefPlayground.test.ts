/**
 * getClefPlaygroundPage() が生成するリクエストJSONサンプルのテスト
 *
 * 対象: /clef-playground ページ(src/views/clefPlayground.ts)が各質問タイプの
 * カードに埋め込む、デフォルトのリクエストJSON(textarea初期値)。
 *
 * 故障シナリオ: 2026-10-11、実機でnoulタイプのデフォルトリクエストを実行すると
 * Workers AI側のClefから次のエラーが返ってきた(ユーザー報告・裏取り済み):
 *   {"error":{"type":"invalid_request","message":"Request body failed validation",
 *     "details":{"formErrors":[],"fieldErrors":{"questions":["Extra inputs are not permitted"]}}}}
 * jevPlayground.tsと同じテンプレートをそのまま流用し、noulタイプの質問オブジェクトに
 * `instructions`フィールドを含めていたことが原因(Jev APIは許容するが、Clef側の
 * スキーマはadditionalPropertiesを許可しておらず、type/question以外の未知フィールドを
 * 含むquestionsオブジェクト全体を拒否する)。
 */
import { describe, it, expect } from 'vitest';
import { getClefPlaygroundPage } from './clefPlayground';

function extractRequestJson(html: string, cardType: string): Record<string, unknown> {
  const marker = `id="request-${cardType}"`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`textarea#request-${cardType} が見つかりません`);
  const openTag = html.indexOf('>', start) + 1;
  const close = html.indexOf('</textarea>', openTag);
  const raw = html
    .slice(openTag, close)
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>');
  return JSON.parse(raw);
}

describe('getClefPlaygroundPage', () => {
  it('noulタイプのデフォルトリクエストJSONに、Clefのスキーマが拒否するinstructionsフィールドを含めない', () => {
    const html = getClefPlaygroundPage();
    const body = extractRequestJson(html, 'noul');
    const questions = body.questions as Record<string, Record<string, unknown>>;
    const question = Object.values(questions)[0];
    expect(question).not.toHaveProperty('instructions');
  });

  it('noulタイプの質問オブジェクトはtype/questionのみを持つ(additionalPropertiesなし)', () => {
    const html = getClefPlaygroundPage();
    const body = extractRequestJson(html, 'noul');
    const questions = body.questions as Record<string, Record<string, unknown>>;
    const question = Object.values(questions)[0];
    expect(Object.keys(question).sort()).toEqual(['question', 'type']);
  });

  it('choice/scoreタイプは従来通りcriteriaフィールドを持つ', () => {
    const html = getClefPlaygroundPage();
    for (const cardType of ['choice', 'score']) {
      const body = extractRequestJson(html, cardType);
      const questions = body.questions as Record<string, Record<string, unknown>>;
      const question = Object.values(questions)[0];
      expect(question).toHaveProperty('criteria');
    }
  });
});
