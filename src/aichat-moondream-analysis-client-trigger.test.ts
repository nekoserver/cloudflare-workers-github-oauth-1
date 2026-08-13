import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat ページの chatForm submit ハンドラ。画像添付付き投稿で
// /api/aichat(回答本体・shareId)と/api/moondream-analyze(画像分析)が並行に
// 呼ばれた後、両方が揃った時点で /api/aichat/moondream-analysis へ保存
// リクエストを送る処理(tryAppendMoondream内)。
//
// 故障シナリオ:
//   (1) shareIdの取得より前に画像分析結果が届いた場合、保存されないまま
//       取りこぼされる(pendingShareIdForMoondreamが設定される前に判定されて
//       しまう実装だと発生する)
//   (2) 画像分析結果よりshareIdの方が先に届いた場合も同様に取りこぼされる
//   (3) 同じ投稿で保存APIが複数回呼ばれてしまう(サーバー側もUNIQUE制約で
//       防いではいるが、クライアント側でも冪等に振る舞うべき)
//   (4) 画像を添付していない投稿でもshareIdをpendingShareIdForMoondreamに
//       入れてしまい、無駄な保存リクエストが飛ぶ

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};

describe('/aichat ページ: Moondream画像分析結果の保存トリガー', () => {
  const html = getAiChatPage(minimalUser);
  const idx = html.indexOf("chatForm.addEventListener('submit'");
  const fn = html.slice(idx, idx + 3600);

  it('tryAppendMoondream内で /api/aichat/moondream-analysis へPOSTする', () => {
    expect(fn).toContain("fetch('/api/aichat/moondream-analysis'");
    expect(fn).toContain('method: \'POST\'');
  });

  it('moondreamAnalysisTextとpendingShareIdForMoondreamの両方が揃うまで保存しない', () => {
    expect(fn).toContain('if (!moondreamAnalysisSaved && moondreamAnalysisText && pendingShareIdForMoondream)');
  });

  it('保存済みフラグ(moondreamAnalysisSaved)で二重送信を防ぐ', () => {
    const guardIdx = fn.indexOf('if (!moondreamAnalysisSaved');
    const setTrueIdx = fn.indexOf('moondreamAnalysisSaved = true;');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(setTrueIdx).toBeGreaterThan(guardIdx);
  });

  it('画像添付時のみpendingShareIdForMoondreamをdata.shareIdで設定する', () => {
    expect(fn).toContain('if (attachedImage && data.shareId) pendingShareIdForMoondream = data.shareId;');
  });

  it('保存リクエストのbodyにshareIdとanalysisTextを含める', () => {
    const sendIdx = fn.indexOf("fetch('/api/aichat/moondream-analysis'");
    const block = fn.slice(sendIdx, sendIdx + 300);
    expect(block).toContain('shareId: pendingShareIdForMoondream');
    expect(block).toContain('analysisText: moondreamAnalysisText');
  });
});
