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
// 追加要件1: 回答モーダルの見た目をAIチャットページの履歴モーダル(質問=userバブル・
// 回答=assistantバブル、コードブロックを含むMarkdown描画)と同じスタイルに揃える。
// 故障シナリオ:
//   (8) 回答モーダルにchat-bubble構造(user/assistant)が使われておらず、
//       AIチャット履歴モーダルと見た目が異なったまま
//   (9) コードブロック(<pre><code>)用のCSS(.preview-area pre 等)が
//       回答モーダルに定義されておらず、無装飾のまま表示されてしまう
//
// 追加要件2: ヘッダーの表記を「質問文」に変更し、質問自体をスクロールしないヘッダー内に
// 固定表示する(スクロールで流れるのは回答本文のみ)。さらにAIチャットの「AIチャットの
// 詳細プレビュー」モーダル(historyModal)が持つ機能のうち、shareId単体から再現可能な
// ものをできる限り移植する: 日時、モデル色ドット+モデル名、閲覧数、トークン数、
// 共有ページリンク、キーワードハイライトのON/OFFトグル、Escapeキーでの閉じる操作。
// (追加質問リンクの登録・重複質問間のスワイプ・キーワード分類編集モードは、AIチャット
// ページ固有のワークフローに深く依存し、このグラフ探索用の軽量モーダルには
// スコープ過剰と判断し移植していない)
// 故障シナリオ:
//   (10) 質問がanswer-modal-body(スクロール領域)の中に残ったままで、
//        長い回答をスクロールすると質問が見えなくなる
//   (11) キーワードハイライトのON/OFFがヘッダー(質問)側とボディ(回答)側で
//        独立して効いてしまい、一方だけハイライトが残る
//   (12) モーダルを開くたびに前回のメタ情報(日時・トークン数等)がクリアされず
//        残ってしまう

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

  it('ヘッダーのラベルが「質問文」であり、質問テキスト用の要素(answerModalQuestion)がヘッダー内(answerModalBody より前)にある', () => {
    const titleIdx = html.indexOf('id="answerModalTitle">質問文<');
    const questionIdx = html.indexOf('id="answerModalQuestion"');
    const bodyIdx = html.indexOf('id="answerModalBody"');
    expect(titleIdx, 'ヘッダーのタイトルが「質問文」になっていない').toBeGreaterThan(-1);
    expect(questionIdx).toBeGreaterThan(-1);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(questionIdx).toBeLessThan(bodyIdx);
    expect(html).not.toContain('<strong>回答</strong>');
  });

  it('AIチャット履歴モーダルの機能を移植したフッター要素(日時・メタ・トークン・共有リンク・ハイライトボタン)が存在する', () => {
    expect(html).toContain('id="answerModalDate"');
    expect(html).toContain('id="answerModalTime"');
    expect(html).toContain('id="answerModalMeta"');
    expect(html).toContain('id="answerModalTokens"');
    expect(html).toContain('id="answerModalShareLink"');
    expect(html).toContain('id="answerModalHighlightToggleBtn"');
  });
});

describe('/answer-graph ページ: 質問をヘッダーに固定表示し、回答モーダルのbodyは回答のみスクロールする', () => {
  it('answerModalQuestion は answer-modal-head の内側にあり、answer-modal-body の外にある(スクロール対象外)', () => {
    const html = buildPage();
    const headIdx = html.indexOf('class="answer-modal-head"');
    const questionIdx = html.indexOf('id="answerModalQuestion"');
    const headEndIdx = html.indexOf('class="answer-modal-body"');
    expect(headIdx).toBeGreaterThan(-1);
    expect(questionIdx).toBeGreaterThan(headIdx);
    expect(questionIdx).toBeLessThan(headEndIdx);
  });

  it('appendAnswerModalBubble は回答のみを追加する(質問バブルは作らない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAnswerModalBubble');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("el.className = 'chat-bubble assistant preview-area';");
    expect(block).toContain('el.innerHTML = parseMd(text);');
    expect(block).not.toContain("'chat-bubble user'");
  });

  it('openAnswerModal は取得した質問をanswerModalQuestionへ設定し、appendAnswerModalBubbleで回答のみ追加する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 3200);
    expect(block).toContain('answerModalQuestion.textContent = d.question;');
    expect(block).toContain('appendAnswerModalBubble(d.answer);');
  });
});

describe('/answer-graph ページ: AIチャット詳細プレビューモーダルの機能移植(日時・モデル・トークン・共有リンク・ハイライト)', () => {
  it('openAnswerModal がモデル色ドット・モデル名・閲覧数(answerModalMeta)を組み立てる', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    const block = html.slice(idx, idx + 2600);
    expect(block).toContain('MODEL_COLORS[d.model]');
    expect(block).toContain('shortModelName(d.model)');
    expect(block).toContain('answerModalMeta.innerHTML');
  });

  it('openAnswerModal がトークン数(in/out)をanswerModalTokensへ設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    const block = html.slice(idx, idx + 2600);
    expect(block).toContain("tokenParts.push('in:' + d.input_tokens);");
    expect(block).toContain("tokenParts.push('out:' + d.output_tokens);");
  });

  it('openAnswerModal が共有ページリンク(/s/user_hash/id)をanswerModalShareLinkへ設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAnswerModal');
    const block = html.slice(idx, idx + 2600);
    expect(block).toContain("answerModalShareLink.href = '/s/' + d.user_hash + '/' + d.id;");
  });

  it('loadAnswerModalKeywords が /api/aichat/share-keywords からキーワードを取得しヘッダー(質問)とボディ(回答)の両方にハイライトを適用する', () => {
    const html = buildPage();
    const idx = html.indexOf('function loadAnswerModalKeywords');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("fetch('/api/aichat/share-keywords?shareId=' + encodeURIComponent(shareId)");
    expect(block).toContain('applyKeywordHighlight(answerModalQuestion, answerModalKeywordsFromDB);');
    expect(block).toContain('applyKeywordHighlight(answerModalBody, answerModalKeywordsFromDB);');
  });

  it('ハイライトトグルボタンはanswerModalQuestion/answerModalBody双方のhighlights-hiddenクラスを連動して切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf("answerModalHighlightToggleBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 500);
    expect(block).toContain("answerModalQuestion.classList");
    expect(block).toContain("answerModalBody.classList");
  });

  it('Escapeキーでモーダルを閉じられる', () => {
    const html = buildPage();
    expect(html).toContain("e.key === 'Escape' && answerModalBackdrop.classList.contains('open')");
  });
});

describe('/answer-graph ページ: 回答モーダルはAIチャット履歴モーダルと同じスタイル(chat-bubble/preview-area)を使う', () => {
  const html = buildPage();

  it('AIチャットページのchat-bubble/preview-areaと同名のCSSクラスを使って回答バブルを組み立てる(質問はヘッダーへ移動したためbody内にuserバブルは無い)', () => {
    expect(html).not.toContain('.answer-modal-body .chat-bubble.user');
    expect(html).toContain('.answer-modal-body .chat-bubble.assistant');
  });

  it('コードブロック(pre/code)・見出し・テーブル等のMarkdown要素にCSSが定義されている(無装飾で表示されない)', () => {
    expect(html).toContain('.preview-area pre {');
    expect(html).toContain('.preview-area pre code {');
    expect(html).toContain('.preview-area code {');
    expect(html).toContain('.preview-area h1 {');
    expect(html).toContain('.preview-area table {');
  });

  it('AIチャットページの履歴モーダルの回答(assistant)バブルと同様、右寄せに配置する', () => {
    const assistantIdx = html.indexOf('.answer-modal-body .chat-bubble.assistant {');
    expect(assistantIdx).toBeGreaterThan(-1);
    const assistantRule = html.slice(assistantIdx, html.indexOf('}', assistantIdx));
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

  it('canvas click ハンドラは selectGraphNode 経由で buildNodeLabelLine を使い回している(サイドパネルとツールチップで重複実装しない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function selectGraphNode');
    expect(idx).toBeGreaterThan(-1);
    const selectBlock = html.slice(idx, idx + 700);
    expect(selectBlock).toContain('buildNodeLabelLine(node)');

    const clickIdx = html.indexOf("canvas.addEventListener('click'");
    const clickBlock = html.slice(clickIdx, clickIdx + 1200);
    expect(clickBlock).toContain('selectGraphNode(hit)');
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
    const block = html.slice(idx, idx + 1900);
    expect(block).toContain("'/api/aichat/shares/' + encodeURIComponent(shareId)");
    expect(block).toContain('回答の取得に失敗しました');
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
  function loadModalFns(html: string, fetchImpl: typeof fetch, modelColors: Record<string, string> = {}) {
    document.body.innerHTML = `
      <div class="answer-modal-backdrop" id="answerModalBackdrop">
        <span id="answerModalQuestion"></span>
        <span id="answerModalDate"></span>
        <span id="answerModalTime"></span>
        <span id="answerModalMeta"></span>
        <span id="answerModalTokens"></span>
        <a id="answerModalShareLink" href="#"></a>
        <button id="answerModalHighlightToggleBtn"></button>
        <button id="answerModalVectorizeBtn"></button>
        <span id="answerModalVectorizedBadge"></span>
        <button id="answerModalKeywordListBtn"></button>
        <button id="answerModalKeywordRecheckBtn"></button>
        <button id="answerModalKeywordExtractBtn"></button>
      </div>
      <div id="answerModalBody"></div>
    `;
    const startIdx = html.indexOf('function escHtml');
    const closeEndIdx = html.indexOf('\n  }', html.indexOf('function closeAnswerModal')) + 4;
    const src = html.slice(startIdx, closeEndIdx);
    const fn = new Function(
      'document', 'fetch', 'MODEL_COLORS',
      'answerModalBody', 'answerModalBackdrop', 'answerModalQuestion', 'answerModalDate', 'answerModalTime',
      'answerModalMeta', 'answerModalTokens', 'answerModalShareLink', 'answerModalHighlightToggleBtn',
      'answerModalVectorizeBtn', 'answerModalVectorizedBadge', 'answerModalKeywordListBtn', 'answerModalKeywordRecheckBtn', 'answerModalKeywordExtractBtn',
      `${src}\nreturn { openAnswerModal: openAnswerModal, closeAnswerModal: closeAnswerModal };`
    );
    return fn(
      document,
      fetchImpl,
      modelColors,
      document.getElementById('answerModalBody'),
      document.getElementById('answerModalBackdrop'),
      document.getElementById('answerModalQuestion'),
      document.getElementById('answerModalDate'),
      document.getElementById('answerModalTime'),
      document.getElementById('answerModalMeta'),
      document.getElementById('answerModalTokens'),
      document.getElementById('answerModalShareLink'),
      document.getElementById('answerModalHighlightToggleBtn'),
      document.getElementById('answerModalVectorizeBtn'),
      document.getElementById('answerModalVectorizedBadge'),
      document.getElementById('answerModalKeywordListBtn'),
      document.getElementById('answerModalKeywordRecheckBtn'),
      document.getElementById('answerModalKeywordExtractBtn'),
    ) as { openAnswerModal: (id: string) => void; closeAnswerModal: () => void };
  }

  function shareResponse(overrides: Record<string, unknown>) {
    return {
      id: 's1',
      question: '質問文',
      answer: '回答文',
      model: 'model-a',
      created_at: '2026-08-02T09:30:00.000Z',
      access_count: 3,
      user_hash: 'hash123',
      input_tokens: 10,
      output_tokens: 20,
      ...overrides,
    };
  }

  it('成功時: 質問はヘッダー(answerModalQuestion)に素のテキストで、回答はボディにassistantバブル(マークダウン描画)として設定され、backdropにopenクラスが付く', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).indexOf('share-keywords') >= 0) return { json: async () => ({ keywords: [] }) } as Response;
      return { json: async () => shareResponse({ question: '**富士山**の高さは?', answer: '**3776m**です' }) } as Response;
    }) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const body = document.getElementById('answerModalBody')!;
    const question = document.getElementById('answerModalQuestion')!;
    expect(document.getElementById('answerModalBackdrop')!.classList.contains('open')).toBe(true);
    expect(question.textContent).toBe('**富士山**の高さは?');
    expect(question.innerHTML).not.toContain('<strong>');
    const assistantBubble = body.querySelector('.chat-bubble.assistant')!;
    expect(assistantBubble.innerHTML).toContain('<strong>3776m</strong>');
    expect(body.querySelector('.chat-bubble.user')).toBeNull();
  });

  it('モデル色ドット・モデル名・閲覧数・日時・トークン数・共有リンクがメタ情報として反映される', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).indexOf('share-keywords') >= 0) return { json: async () => ({ keywords: [] }) } as Response;
      return { json: async () => shareResponse({}) } as Response;
    }) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock, { 'model-a': '#ff0000' });
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(document.getElementById('answerModalDate')!.textContent).toBe('2026-08-02');
    expect(document.getElementById('answerModalTime')!.textContent).toBe(' 09:30');
    const meta = document.getElementById('answerModalMeta')!;
    expect(meta.innerHTML).toContain('background:#ff0000');
    expect(meta.innerHTML).toContain('model-a');
    expect(meta.innerHTML).toContain('👁 3');
    expect(document.getElementById('answerModalTokens')!.textContent).toBe('📊 in:10 / out:20');
    expect((document.getElementById('answerModalShareLink') as HTMLAnchorElement).getAttribute('href')).toBe('/s/hash123/s1');
  });

  it('回答内のコードブロックがpre>codeとして忠実に再現される(class="language-xxx"付き)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).indexOf('share-keywords') >= 0) return { json: async () => ({ keywords: [] }) } as Response;
      return { json: async () => shareResponse({ question: 'サンプルコードを教えて', answer: '```js\nconst x = 1;\n```' }) } as Response;
    }) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const assistantBubble = document.getElementById('answerModalBody')!.querySelector('.chat-bubble.assistant')!;
    const codeEl = assistantBubble.querySelector('pre > code.language-js');
    expect(codeEl, 'コードブロックがpre>code.language-jsとして描画されていない').not.toBeNull();
    expect(codeEl!.textContent).toBe('const x = 1;');
  });

  it('キーワードハイライト: /api/aichat/share-keywords のキーワードを質問(ヘッダー)と回答(ボディ)の両方にmarkタグでハイライトする', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).indexOf('share-keywords') >= 0) return { json: async () => ({ keywords: [{ keyword: '富士山', count: 2, is_classified: false }] }) } as Response;
      return { json: async () => shareResponse({ question: '富士山の高さは?', answer: '富士山は3776mです' }) } as Response;
    }) as unknown as typeof fetch;
    const { openAnswerModal } = loadModalFns(buildPage(), fetchMock);
    openAnswerModal('s1');
    for (let i = 0; i < 10; i++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }
    expect(document.getElementById('answerModalQuestion')!.querySelectorAll('mark.kw-highlight').length).toBeGreaterThan(0);
    expect(document.getElementById('answerModalBody')!.querySelectorAll('mark.kw-highlight').length).toBeGreaterThan(0);
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
