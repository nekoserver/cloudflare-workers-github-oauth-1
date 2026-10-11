/**
 * getClefPlaygroundPage() が生成するリクエストJSONサンプルのテスト
 *
 * 対象: /clef-playground ページ(src/views/clefPlayground.ts)が各質問タイプの
 * カードに埋め込む、デフォルトのリクエストJSON(textarea初期値)。
 *
 * 故障シナリオ: 2026-10-11、実機で全タイプ(noul/choice/score)のデフォルトリクエストを
 * 実行すると、Workers AI側のClefから次のエラーが返ってきた(ユーザー報告・裏取り済み):
 *   {"error": "5006: Error: required properties at '/' are 'model,state,questions'"}
 *
 * 原因: jevPlayground.tsのテンプレートをそのまま流用し、質問テキストを`question`
 * フィールドに入れていたが、Cloudflareの公式モデルスキーマ(cloudflare/cloudflare-docsの
 * src/content/workers-ai-models/clef-flash.jsonで確認。`questions`配下のoneOf、
 * noul/choice/score共通で`instructions`が必須、`question`という名前のフィールドは
 * スキーマに存在しない)によると、質問テキストは`instructions`フィールドで渡す必要がある。
 * `question`は未知のフィールドとして扱われ、かつ必須の`instructions`が無いため、
 * questionsのoneOfがどの質問タイプにも一致せず、バリデータがフォールバックで
 * ルート直下の必須プロパティ(model/state/questions)の不足として報告していた
 * (noul/choice/scoreのどのタイプでも同じ症状になっていたのはこのため)。
 *
 * なお、noulの`criteria`(true/falseの意味を説明するオブジェクト)は公式スキーマ上
 * 任意のため省略可能。choice(オプションIDをキーにしたオブジェクト)・
 * score(順序付き配列)の`criteria`は必須で、この2タイプの形式自体は従来通りで正しい。
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
  it('全タイプのデフォルトリクエストJSONは、質問テキストをinstructionsフィールドで渡す(questionフィールドは使わない)', () => {
    const html = getClefPlaygroundPage();
    for (const cardType of ['noul', 'choice', 'score']) {
      const body = extractRequestJson(html, cardType);
      const questions = body.questions as Record<string, Record<string, unknown>>;
      const question = Object.values(questions)[0];
      expect(question).toHaveProperty('instructions');
      expect(typeof question.instructions).toBe('string');
      expect(question).not.toHaveProperty('question');
    }
  });

  it('noulタイプの質問オブジェクトはtype/instructionsのみを持つ(criteriaは任意のため省略)', () => {
    const html = getClefPlaygroundPage();
    const body = extractRequestJson(html, 'noul');
    const questions = body.questions as Record<string, Record<string, unknown>>;
    const question = Object.values(questions)[0];
    expect(Object.keys(question).sort()).toEqual(['instructions', 'type']);
  });

  it('choice/scoreタイプは必須のcriteriaフィールドを持つ', () => {
    const html = getClefPlaygroundPage();
    for (const cardType of ['choice', 'score']) {
      const body = extractRequestJson(html, cardType);
      const questions = body.questions as Record<string, Record<string, unknown>>;
      const question = Object.values(questions)[0];
      expect(question).toHaveProperty('criteria');
    }
  });

  it('choiceタイプのcriteriaはオプションIDをキーにしたオブジェクト、scoreタイプのcriteriaは順序付き配列', () => {
    const html = getClefPlaygroundPage();
    const choiceBody = extractRequestJson(html, 'choice');
    const choiceQuestions = choiceBody.questions as Record<string, Record<string, unknown>>;
    const choiceQuestion = Object.values(choiceQuestions)[0];
    expect(choiceQuestion.criteria).not.toBeInstanceOf(Array);
    expect(typeof choiceQuestion.criteria).toBe('object');

    const scoreBody = extractRequestJson(html, 'score');
    const scoreQuestions = scoreBody.questions as Record<string, Record<string, unknown>>;
    const scoreQuestion = Object.values(scoreQuestions)[0];
    expect(Array.isArray(scoreQuestion.criteria)).toBe(true);
  });
});
