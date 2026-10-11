import { describe, it, expect, vi } from 'vitest';
import { buildClefScoreQuestions, callClefScoreApi } from './clefScoreApi';
import type { JevLabel } from './jevEvaluation';

// 対象: Jevのラベル(JevLabel、jev_labels由来)をClef(Workers AI決定モデル)で
// 評価するための変換・呼び出し(src/utils/clefScoreApi.ts)。
// PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.mdのステップ②。
//
// 既存のcallJevApi(jevEvaluation.ts)と同じ入出力形(JevApiResult)を保つことで、
// 呼び出し元(将来の/api/aichat/clef-score)がJev/Clefの違いを気にせず使える
// ようにする。既存のJev呼び出し6箇所・jev_evaluationsには一切影響しない
// (このファイルは新規追加のみ)。
//
// 故障シナリオ:
//   (1) 質問テキストをquestionフィールドで送ってしまう(本体Worker/
//       dynamicneko双方で実機確認済みの不具合の再発。instructionsが正しい)
//   (2) labelsが空なのにai.run()を呼んでしまう(無駄な課金)
//   (3) ai.run()が例外を投げた時に握りつぶして成功扱いにする
//   (4) レスポンスのanswersに一部ラベルの結果が無いのに成功扱いにする
//   (5) model未指定時にデフォルト(clef-flash)以外が使われる

const LABELS: JevLabel[] = [
  { id: 1, question_text: '回答に具体的な根拠が示されているか', criteria: ['根拠が無い', '根拠が十分にある'] },
  { id: 2, question_text: '回答は質問に正確に答えているか', criteria: ['答えていない', '正確に答えている'] },
];

function makeAi(run: ReturnType<typeof vi.fn>) {
  return { run };
}

describe('buildClefScoreQuestions', () => {
  it('各ラベルをtype=score・instructions=question_text・criteriaそのままのquestionsオブジェクトへ変換する', () => {
    const questions = buildClefScoreQuestions(LABELS);
    expect(questions).toEqual({
      '1': { type: 'score', instructions: '回答に具体的な根拠が示されているか', criteria: ['根拠が無い', '根拠が十分にある'] },
      '2': { type: 'score', instructions: '回答は質問に正確に答えているか', criteria: ['答えていない', '正確に答えている'] },
    });
  });

  it('questionフィールドは含めない(Clefのスキーマに存在しないフィールドのため)', () => {
    const questions = buildClefScoreQuestions(LABELS);
    expect(questions['1']).not.toHaveProperty('question');
  });
});

describe('callClefScoreApi', () => {
  it('labelsが空の場合はai.run()を呼ばずに成功(空配列)を返す', async () => {
    const run = vi.fn();
    const result = await callClefScoreApi({ ai: makeAi(run), state: 'state', labels: [] });
    expect(result).toEqual({ ok: true, scores: [] });
    expect(run).not.toHaveBeenCalled();
  });

  it('既定モデルはclef-flash。ai.run()の第一引数は完全なID、input.modelは短い名前', async () => {
    const run = vi.fn().mockResolvedValue({
      model: '@cf/cloudflare/clef-flash',
      answers: { '1': { type: 'score', score: 0.9 }, '2': { type: 'score', score: 0.2 } },
      usage: { input_tokens: 1, output_tokens: 0 },
    });
    await callClefScoreApi({ ai: makeAi(run), state: '評価対象の文章', labels: LABELS });
    expect(run).toHaveBeenCalledWith(
      '@cf/cloudflare/clef-flash',
      expect.objectContaining({
        model: 'clef-flash',
        state: '評価対象の文章',
        questions: buildClefScoreQuestions(LABELS),
      })
    );
  });

  it('model指定時はそれに応じたカタログID・短い名前を使う', async () => {
    const run = vi.fn().mockResolvedValue({ model: '@cf/cloudflare/clef', answers: { '1': { score: 0.5 }, '2': { score: 0.5 } } });
    await callClefScoreApi({ ai: makeAi(run), state: 's', labels: LABELS, model: '@cf/cloudflare/clef' });
    expect(run).toHaveBeenCalledWith('@cf/cloudflare/clef', expect.objectContaining({ model: 'clef' }));
  });

  it('正常系: answersからscoreを取り出し、JevApiResultと同じ形({ok:true, scores:[{labelId,value}]})で返す', async () => {
    const run = vi.fn().mockResolvedValue({
      model: '@cf/cloudflare/clef-flash',
      answers: { '1': { type: 'score', score: 0.87 }, '2': { type: 'score', score: 0.13 } },
    });
    const result = await callClefScoreApi({ ai: makeAi(run), state: 's', labels: LABELS });
    expect(result).toEqual({ ok: true, scores: [{ labelId: 1, value: 0.87 }, { labelId: 2, value: 0.13 }] });
  });

  it('ai.run()が例外を投げた場合は握りつぶさずerrorCode=http_errorで失敗を返す', async () => {
    const run = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const result = await callClefScoreApi({ ai: makeAi(run), state: 's', labels: LABELS });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('http_error');
      expect(result.detail).toContain('binding unavailable');
    }
  });

  it('answersに一部ラベルの結果が無い場合はunexpected_shapeで失敗を返す(黒く成功扱いにしない)', async () => {
    const run = vi.fn().mockResolvedValue({ model: '@cf/cloudflare/clef-flash', answers: { '1': { score: 0.5 } } });
    const result = await callClefScoreApi({ ai: makeAi(run), state: 's', labels: LABELS });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('unexpected_shape');
      expect(result.detail).toContain('2');
    }
  });
});
