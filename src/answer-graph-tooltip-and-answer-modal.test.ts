// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)のノードクリック時の挙動。
//
// 背景: これまでノードをクリックすると画面上部の「回答（質問）」エリア(サイドパネル)にのみ
// 詳細が表示されていたが、(1) タップした地点にもツールチップとして詳細を表示する、
// (2) サイドパネル内の質問行をクリックすると、AIチャットページの履歴モーダルと同様に
// 最上位レイヤーのモーダルで質問への回答本文を読めるようにする、という2点を追加した。
//
// 故障シナリオ:
//   (1) ツールチップがクリック位置と無関係な固定位置に表示される
//   (2) キーワードノードでも質問行が生成され、存在しないshareIdでAPIを叩いてしまう
//   (3) 回答モーダルがAPIエラー時に無反応または例外を投げる
//   (4) ツールチップ表示用のnode-tooltip要素・回答モーダル用のDOM要素が生成HTMLに存在しない

function buildPage(): string {
  return getAnswerGraphPage('testuser');
}

describe('/answer-graph ページのHTML構造', () => {
  const html = buildPage();

  it('ノードツールチップ用の要素が存在する', () => {
    expect(html).toContain('id="nodeTooltip"');
  });

  it('回答モーダル用の要素(バックドロップ・本文・閉じるボタン)が存在する', () => {
    expect(html).toContain('id="answerModalBackdrop"');
    expect(html).toContain('id="answerModalBody"');
    expect(html).toContain('id="answerModalClose"');
  });
});

describe('/answer-graph ページ: canvasクリック時にツールチップを表示する', () => {
  it('canvas click ハンドラが showNodeTooltip を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("canvas.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1800);
    expect(block).toContain('showNodeTooltip(hit, e.pageX, e.pageY);');
  });

  it('showNodeTooltip はクリック位置(pageX/pageY)を基準にツールチップを配置する', () => {
    const html = buildPage();
    const idx = html.indexOf('function showNodeTooltip');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('pageX');
    expect(block).toContain('pageY');
    expect(block).toContain("nodeTooltip.style.display = 'block';");
  });
});

describe('/answer-graph ページ: サイドパネルの質問行から回答モーダルを開く', () => {
  it('回答(answer)ノードのみ質問行(question-line)としてクリック可能にする', () => {
    const html = buildPage();
    const idx = html.indexOf("canvas.addEventListener('click'");
    const block = html.slice(idx, idx + 1400);
    expect(block).toMatch(/hit\.type === 'answer'\s*\n\s*\? '<div class="question-line"/);
  });

  it('質問行の data-share-id はノードidから "a:" プレフィックスを除いたもの', () => {
    const html = buildPage();
    const idx = html.indexOf("canvas.addEventListener('click'");
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain("hit.id.slice(2)");
  });

  it('sidePanel のクリックイベントが .question-line を検知して openAnswerModal を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("sidePanel.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("e.target.closest('.question-line')");
    expect(block).toContain('openAnswerModal(');
  });

  it('openAnswerModal は /api/aichat/shares/:id から取得し失敗時もエラー文言を表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("fetch('/api/aichat/shares/' + encodeURIComponent(shareId)");
    expect(block).toContain('回答の取得に失敗しました');
  });
});

describe('/answer-graph ページ: openAnswerModal/closeAnswerModal のDOM実動作(jsdom)', () => {
  function loadModalFns(html: string, fetchImpl: typeof fetch) {
    document.body.innerHTML = `
      <div class="answer-modal-backdrop" id="answerModalBackdrop"></div>
      <div id="answerModalBody"></div>
    `;
    const openIdx = html.indexOf('function openAnswerModal');
    const closeEndIdx = html.indexOf('\n  }', html.indexOf('function closeAnswerModal')) + 4;
    const src = html.slice(openIdx, closeEndIdx);
    const fn = new Function(
      'document', 'fetch', 'escHtml', 'answerModalBody', 'answerModalBackdrop',
      `${src}\nreturn { openAnswerModal: openAnswerModal, closeAnswerModal: closeAnswerModal };`
    );
    const escHtml = (s: unknown) => String(s ?? '');
    return fn(
      document,
      fetchImpl,
      escHtml,
      document.getElementById('answerModalBody'),
      document.getElementById('answerModalBackdrop'),
    ) as { openAnswerModal: (id: string) => void; closeAnswerModal: () => void };
  }

  it('成功時: 質問と回答が本文に描画され、backdropにopenクラスが付く', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ id: 's1', question: '富士山の高さは?', answer: '3776mです' }),
    })) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(document.getElementById('answerModalBackdrop')!.classList.contains('open')).toBe(true);
    expect(document.getElementById('answerModalBody')!.innerHTML).toContain('富士山の高さは?');
    expect(document.getElementById('answerModalBody')!.innerHTML).toContain('3776mです');
  });

  it('APIがエラーを返した場合、例外を投げずエラー文言を表示する', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ error: 'Not found' }),
    })) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    expect(() => openAnswerModal('missing')).not.toThrow();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(document.getElementById('answerModalBody')!.textContent).toContain('回答の取得に失敗しました');
  });
});

describe('/answer-graph ページ: script タグに構文エラーがない(ツールチップ・回答モーダル追加後)', () => {
  it('全<script>ブロックがnew Functionでパース可能', () => {
    const html = buildPage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});
