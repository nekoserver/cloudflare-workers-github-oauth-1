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
//
// 追加要件: 回答モーダルの見た目をAIチャットページの履歴モーダル(質問=userバブル・
// 回答=assistantバブル、コードブロックを含むMarkdown描画)と同じスタイルに揃える。
// 故障シナリオ:
//   (8) 回答モーダルにchat-bubble構造(user/assistant)が使われておらず、
//       AIチャット履歴モーダルと見た目が異なったまま
//   (9) コードブロック(<pre><code>)用のCSS(.preview-area pre 等)が
//       回答モーダルに定義されておらず、無装飾のまま表示されてしまう

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

describe('/answer-graph ページ: 回答モーダルはAIチャット履歴モーダルと同じスタイル(chat-bubble/preview-area)を使う', () => {
  const html = buildPage();

  it('AIチャットページのchat-bubble/preview-areaと同名のCSSクラスを使ってバブルを組み立てる', () => {
    expect(html).toContain('.answer-modal-body .chat-bubble.user');
    expect(html).toContain('.answer-modal-body .chat-bubble.assistant');
  });

  it('コードブロック(pre/code)・見出し・テーブル等のMarkdown要素にCSSが定義されている(無装飾で表示されない)', () => {
    expect(html).toContain('.preview-area pre {');
    expect(html).toContain('.preview-area pre code {');
    expect(html).toContain('.preview-area code {');
    expect(html).toContain('.preview-area h1 {');
    expect(html).toContain('.preview-area table {');
  });

  it('AIチャットページの履歴モーダルと同様、質問(user)は左寄せ・回答(assistant)は右寄せに配置する', () => {
    const userIdx = html.indexOf('.answer-modal-body .chat-bubble.user {');
    const assistantIdx = html.indexOf('.answer-modal-body .chat-bubble.assistant {');
    expect(userIdx).toBeGreaterThan(-1);
    expect(assistantIdx).toBeGreaterThan(-1);
    const userRule = html.slice(userIdx, html.indexOf('}', userIdx));
    const assistantRule = html.slice(assistantIdx, html.indexOf('}', assistantIdx));
    expect(userRule).toContain('align-self:flex-start');
    expect(assistantRule).toContain('align-self:flex-end');
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

  it('appendAnswerModalBubble はAIチャット履歴モーダルと同様、assistant(回答)のみparseMdでマークダウン描画しuserは素のtextContentにする', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAnswerModalBubble');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 500);
    expect(block).toContain("el.className = 'chat-bubble assistant preview-area';");
    expect(block).toContain('el.innerHTML = parseMd(text);');
    expect(block).toContain("el.className = 'chat-bubble user';");
    expect(block).toContain('el.textContent = text;');
  });

  it('openAnswerModal は質問をuserバブル、回答をassistantバブルとして追加する(AIチャット履歴モーダルと同じ構造)', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("appendAnswerModalBubble(d.question, 'user');");
    expect(block).toContain("appendAnswerModalBubble(d.answer, 'assistant');");
  });
});

describe('/answer-graph ページ: parseMd (マークダウン描画、共有ユーティリティmarkdownRenderer.tsを利用)', () => {
  function loadParseMd(html: string) {
    const idx = html.indexOf('function parseMd');
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
    const mdStartIdx = html.indexOf('function parseMd');
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

  it('成功時: 質問はuserバブル(素のテキスト)、回答はassistantバブル(マークダウン描画)として追加され、backdropにopenクラスが付く', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ id: 's1', question: '**富士山**の高さは?', answer: '**3776m**です' }),
    })) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const body = document.getElementById('answerModalBody')!;
    expect(document.getElementById('answerModalBackdrop')!.classList.contains('open')).toBe(true);
    const userBubble = body.querySelector('.chat-bubble.user')!;
    const assistantBubble = body.querySelector('.chat-bubble.assistant')!;
    expect(userBubble.textContent).toBe('**富士山**の高さは?');
    expect(userBubble.innerHTML).not.toContain('<strong>');
    expect(assistantBubble.innerHTML).toContain('<strong>3776m</strong>');
  });

  it('回答内のコードブロックがpre>codeとして忠実に再現される(class="language-xxx"付き)', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ id: 's1', question: 'サンプルコードを教えて', answer: '```js\nconst x = 1;\n```' }),
    })) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const assistantBubble = document.getElementById('answerModalBody')!.querySelector('.chat-bubble.assistant')!;
    const codeEl = assistantBubble.querySelector('pre > code.language-js');
    expect(codeEl, 'コードブロックがpre>code.language-jsとして描画されていない').not.toBeNull();
    expect(codeEl!.textContent).toBe('const x = 1;');
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
