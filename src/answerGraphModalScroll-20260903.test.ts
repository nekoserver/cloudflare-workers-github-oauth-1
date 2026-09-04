import { describe, it, expect } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graphページの質問文モーダル(answer-modal, id="answerModalBackdrop")。
// フッターのボタン列(キーワードハイライト・ベクタ化・キーワード一覧等)が
// 多く並んで折り返すと、ヘッダー+フッターの必要高さだけでモーダルの
// max-height(86vh/760px)を超えてしまい、以前はanswer-modal-bodyだけが
// overflow-y:autoでフッターは外に固定(flex-shrink:0)されていたため、
// ボタンが画面外に見切れて押せなくなっていた。
//
// 故障シナリオ:
//   (1) head/body/footを1つのスクロール領域(answer-modal-scroll)にまとめ忘れ、
//       以前と同様にフッターだけが画面外に固定されたままになる
//   (2) スクロール領域を追加した際に、既存のanswerModalBody/answerModalQuestion等の
//       id・要素の親子関係(ヘッダーがbodyより前にある等)を崩してしまう

describe('/answer-graphページ: 質問文モーダルのスクロール', () => {
  it('answer-modal直下にanswer-modal-scrollがあり、その中にhead/body/footが並ぶ', () => {
    const html = getAnswerGraphPage('testuser');
    const modalIdx = html.indexOf('class="answer-modal" role="dialog"');
    const scrollIdx = html.indexOf('class="answer-modal-scroll"');
    const headIdx = html.indexOf('class="answer-modal-head"');
    const bodyIdx = html.indexOf('id="answerModalBody"');
    const footIdx = html.indexOf('class="answer-modal-foot"');
    expect(modalIdx).toBeGreaterThan(-1);
    expect(scrollIdx).toBeGreaterThan(modalIdx);
    expect(headIdx).toBeGreaterThan(scrollIdx);
    expect(bodyIdx).toBeGreaterThan(headIdx);
    expect(footIdx).toBeGreaterThan(bodyIdx);
  });

  it('.answer-modal-scrollがoverflow-y:autoでスクロール領域になっている', () => {
    const html = getAnswerGraphPage('testuser');
    const idx = html.indexOf('.answer-modal-scroll {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, html.indexOf('}', idx));
    expect(block).toContain('overflow-y:auto');
  });

  it('answer-modal-body/answer-modal-footはもうそれ自体でスクロールせず(flex-shrink:0)、外側のscroll領域に委ねる', () => {
    const html = getAnswerGraphPage('testuser');
    const bodyRuleIdx = html.indexOf('.answer-modal-body {');
    const bodyRule = html.slice(bodyRuleIdx, html.indexOf('}', bodyRuleIdx));
    expect(bodyRule).not.toContain('overflow-y:auto');
    expect(bodyRule).toContain('flex-shrink:0');

    const footRuleIdx = html.indexOf('.answer-modal-foot {');
    const footRule = html.slice(footRuleIdx, html.indexOf('}', footRuleIdx));
    expect(footRule).toContain('flex-shrink:0');
  });
});
