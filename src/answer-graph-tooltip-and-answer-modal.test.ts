// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)のノードクリック時の挙動。
//
// 背景: これまでノードをクリックすると画面上部の「回答（質問）」エリア(サイドパネル)にのみ
// 詳細が表示されていたが、(1) タップした地点にもツールチップとして詳細を表示する、
// (2) サイドパネル・ツールチップの両方の質問行をクリックすると、AIチャットページの
// 履歴モーダルと同様に最上位レイヤーのモーダルで質問への回答本文を読めるようにする、
// (3) 質問行のリンクはアンダーラインを表示しない、
// (4) 回答モーダル内の文章はマークダウンとして描画する、という4点を実装した。
//
// 故障シナリオ:
//   (1) ツールチップがクリック位置と無関係な固定位置に表示される
//   (2) キーワードノードでも質問行が生成され、存在しないshareIdでAPIを叩いてしまう
//   (3) 回答モーダルがAPIエラー時に無反応または例外を投げる
//   (4) ツールチップ表示用のnode-tooltip要素・回答モーダル用のDOM要素が生成HTMLに存在しない
//   (5) ツールチップ内の質問行がサイドパネルと違って回答モーダルを開けない(コードの重複により
//       片方だけ機能が実装されている状態)
//   (6) .question-line に下線が表示されてしまう(text-decoration:none指定漏れ)
//   (7) parseMdをコピーする際にテンプレートリテラルのエスケープが壊れ、正規表現が正しく動かない

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

describe('/answer-graph ページ: 質問行(.question-line)は下線を表示しない', () => {
  it('.question-line の text-decoration が none である', () => {
    const html = buildPage();
    const idx = html.indexOf('.question-line {');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx));
    expect(rule).toContain('text-decoration:none');
    expect(rule).not.toContain('underline');
  });
});

describe('/answer-graph ページ: canvasクリック時にツールチップを表示する', () => {
  it('canvas click ハンドラが showNodeTooltip を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("canvas.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain('showNodeTooltip(hit, e.pageX, e.pageY);');
  });

  it('showNodeTooltip はクリック位置(pageX/pageY)を基準にツールチップを配置し、質問行(buildNodeLabelLine)を含める', () => {
    const html = buildPage();
    const idx = html.indexOf('function showNodeTooltip');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('pageX');
    expect(block).toContain('pageY');
    expect(block).toContain("nodeTooltip.style.display = 'block';");
    expect(block).toContain('buildNodeLabelLine(node)');
  });
});

describe('/answer-graph ページ: サイドパネル・ツールチップ共通の質問行から回答モーダルを開く', () => {
  it('buildNodeLabelLine は回答(answer)ノードのみ質問行(question-line)としてクリック可能にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildNodeLabelLine');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('<div class="question-line"');
    expect(block).toContain('node.id.slice(2)');
  });

  it('canvas click ハンドラは buildNodeLabelLine を使い回している(サイドパネルとツールチップで重複実装しない)', () => {
    const html = buildPage();
    const idx = html.indexOf("canvas.addEventListener('click'");
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('buildNodeLabelLine(hit)');
  });

  it('document への単一のクリック委譲ハンドラが .question-line を検知して openAnswerModal を呼ぶ(サイドパネル/ツールチップ両対応)', () => {
    const html = buildPage();
    const idx = html.indexOf("document.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
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

  it('openAnswerModal は質問・回答の両方を parseMd (マークダウン) で描画する(素のescHtmlではない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('parseMd(d.question)');
    expect(block).toContain('parseMd(d.answer)');
  });
});

describe('/answer-graph ページ: parseMd (マークダウン描画、aichat.tsからの移植)', () => {
  function loadParseMd(html: string) {
    const idx = html.indexOf('function mdEsc');
    const endIdx = html.indexOf('function openAnswerModal');
    expect(idx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(idx);
    const src = html.slice(idx, endIdx);
    const fn = new Function(`${src}\nreturn parseMd;`);
    return fn() as (src: string) => string;
  }

  it('見出し・太字・箇条書きを正しいHTMLへ変換する(エスケープ破損がないことの実動作確認)', () => {
    const parseMd = loadParseMd(buildPage());
    const out = parseMd('# 見出し\n\n**太字**と*斜体*\n\n- 項目1\n- 項目2');
    expect(out).toContain('<h1>見出し</h1>');
    expect(out).toContain('<strong>太字</strong>');
    expect(out).toContain('<em>斜体</em>');
    expect(out).toContain('<li>項目1</li>');
    expect(out).toContain('<li>項目2</li>');
  });

  it('コードブロックを<pre><code>として描画する', () => {
    const parseMd = loadParseMd(buildPage());
    const out = parseMd('```js\nconst x = 1;\n```');
    expect(out).toContain('<pre><code class="language-js">const x = 1;</code></pre>');
  });
});

describe('/answer-graph ページ: openAnswerModal/closeAnswerModal のDOM実動作(jsdom)', () => {
  function loadModalFns(html: string, fetchImpl: typeof fetch) {
    document.body.innerHTML = `
      <div class="answer-modal-backdrop" id="answerModalBackdrop"></div>
      <div id="answerModalBody"></div>
    `;
    const mdStartIdx = html.indexOf('function mdEsc');
    const closeEndIdx = html.indexOf('\n  }', html.indexOf('function closeAnswerModal')) + 4;
    const src = html.slice(mdStartIdx, closeEndIdx);
    const fn = new Function(
      'document', 'fetch', 'answerModalBody', 'answerModalBackdrop',
      `${src}\nreturn { openAnswerModal: openAnswerModal, closeAnswerModal: closeAnswerModal };`
    );
    return fn(
      document,
      fetchImpl,
      document.getElementById('answerModalBody'),
      document.getElementById('answerModalBackdrop'),
    ) as { openAnswerModal: (id: string) => void; closeAnswerModal: () => void };
  }

  it('成功時: 質問と回答がマークダウン描画され、backdropにopenクラスが付く', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ id: 's1', question: '**富士山**の高さは?', answer: '3776mです' }),
    })) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(document.getElementById('answerModalBackdrop')!.classList.contains('open')).toBe(true);
    expect(document.getElementById('answerModalBody')!.innerHTML).toContain('<strong>富士山</strong>');
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

describe('/answer-graph ページ: script タグに構文エラーがない(ツールチップ・回答モーダル・markdown追加後)', () => {
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
