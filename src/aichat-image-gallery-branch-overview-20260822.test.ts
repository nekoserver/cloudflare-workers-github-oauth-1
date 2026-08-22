import { describe, expect, it } from 'vitest';
import { buildAichatImageBranchItems } from './index';

// 対象: /aichat-image-gallery プレビューモーダルの「🌳 分派を見る」機能。
// 1枚の画像(image_id)に対する、llama-4側(ai_chat_shares)とmoondream3.1側
// (aichat_moondream_analyses)の出力をまとめてフラットな配列に整形する
// 純粋関数 buildAichatImageBranchItems のテスト。
//
// 故障シナリオ:
//   (1) moondream3.1側の回答文にai_chat_shares.answer(そもそも渡していないので
//       混入しようがないが、念のため出所を確認する)が紛れ込む(PR #1445と同じ
//       誤りの再発)
//   (2) llama-4側・moondream3.1側のどちらかが空配列でも例外にならない
//   (3) 順序が壊れて呼び出し元(canvasのノード配置)が意図しない順で描画される

describe('buildAichatImageBranchItems', () => {
  it('llama-4側はquestion/answerをそのまま、moondream3.1側はanalysis_textをanswerとして返す', () => {
    const items = buildAichatImageBranchItems(
      [{ id: 's1', question: '何が写っていますか', answer: '猫です', model: 'llama-4', created_at: '2026-08-01T00:00:00Z' }],
      [{ share_id: 's1', analysis_text: '画像には猫が写っています', model: 'moondream3.1', created_at: '2026-08-01T00:00:01Z' }],
    );
    expect(items).toHaveLength(2);
    const llama = items.find((i) => i.modelFamily === 'llama-4');
    const moondream = items.find((i) => i.modelFamily === 'moondream3.1');
    expect(llama).toEqual({
      modelFamily: 'llama-4', shareId: 's1', question: '何が写っていますか', answer: '猫です',
      model: 'llama-4', created_at: '2026-08-01T00:00:00Z',
    });
    // moondream3.1側はanswerにanalysis_textが入り、questionはnull(ai_chat_shares.answerは一切参照しない)
    expect(moondream).toEqual({
      modelFamily: 'moondream3.1', shareId: 's1', question: null, answer: '画像には猫が写っています',
      model: 'moondream3.1', created_at: '2026-08-01T00:00:01Z',
    });
  });

  it('moondream3.1側の分析結果はai_chat_shares.answerと異なる文言でも正しく反映される(PR #1445再発防止)', () => {
    // shareRowsのanswerと、moondreamRowsのanalysis_textをわざと異なる文言にして、
    // 混同が起きていないことを確認する
    const items = buildAichatImageBranchItems(
      [{ id: 's1', question: 'q', answer: 'llama-4による回答文', model: 'llama-4', created_at: 't1' }],
      [{ share_id: 's1', analysis_text: 'moondreamによる画像分析結果', model: 'moondream3.1', created_at: 't2' }],
    );
    const moondream = items.find((i) => i.modelFamily === 'moondream3.1');
    expect(moondream?.answer).toBe('moondreamによる画像分析結果');
    expect(moondream?.answer).not.toBe('llama-4による回答文');
  });

  it('片方が空配列でも例外にならず、もう片方だけの配列を返す', () => {
    const onlyLlama = buildAichatImageBranchItems(
      [{ id: 's1', question: 'q', answer: 'a', model: 'llama-4', created_at: 't1' }],
      [],
    );
    expect(onlyLlama).toHaveLength(1);
    expect(onlyLlama[0].modelFamily).toBe('llama-4');

    const onlyMoondream = buildAichatImageBranchItems(
      [],
      [{ share_id: 's2', analysis_text: 'text', model: 'moondream3.1', created_at: 't2' }],
    );
    expect(onlyMoondream).toHaveLength(1);
    expect(onlyMoondream[0].modelFamily).toBe('moondream3.1');
  });

  it('両方空配列なら空配列を返す', () => {
    expect(buildAichatImageBranchItems([], [])).toEqual([]);
  });

  it('llama-4側が先、moondream3.1側が後の順で返る(呼び出し元のノード配置順の前提)', () => {
    const items = buildAichatImageBranchItems(
      [{ id: 's1', question: 'q', answer: 'a', model: 'llama-4', created_at: 't1' }],
      [{ share_id: 's1', analysis_text: 'text', model: 'moondream3.1', created_at: 't2' }],
    );
    expect(items.map((i) => i.modelFamily)).toEqual(['llama-4', 'moondream3.1']);
  });
});
