// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getAichatImageGalleryPage } from './aichatImageGallery';

// 対象: /aichat-image-gallery ページ(閲覧専用)。ai_chat_shares を検索対象に
// 画像添付済みの会話をギャラリー表示し、タップで質問/回答のチャットバブルを
// 表示する。行データはサーバー側でHTMLに埋め込まず、/api/aichat/
// image-gallery-search からのJSONをクライアント側でDOM生成して表示するため、
// このページ自体はユーザー名以外に動的な文字列をHTMLへ直接埋め込まない
// (modelColorsは例外で、AIチャットページ(/aichat)と同じaichat_model_colors
// テーブルの値をJSONとしてそのまま埋め込む)。
//
// 故障シナリオ:
//   (1) script タグに構文エラーがあり、ページ全体が白紙になる
//   (2) ユーザー名がエスケープされずXSSになる
//   (3) 検索API・プレビューモーダル・ギャラリーグリッドの要素が欠落し、
//       クライアント側スクリプトがnullアクセスで例外になる
//   (4) 応答バブル(assistant)がMarkdownパーサーを通らず生テキストのまま
//       表示される
//   (5) モデル名の色分けにAIチャットページと異なる仕組み(色マップ)を使って
//       しまい、表示色が食い違う
//   (6) 検索窓の入力(input)イベントにハンドラが無く、インクリメントサーチが
//       効かない(ボタン/Enter押下でしか検索できない)
//   (7) 検索対象ドロップダウン(llama-4/moondream3.1)が無い、またはリクエストに
//       targetパラメータが含まれず、常に同じ検索対象(質問文・回答文)しか
//       検索できない

describe('getAichatImageGalleryPage', () => {
  it('script タグに構文エラーがない', () => {
    const html = getAichatImageGalleryPage('testuser');
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    while ((m = scriptRe.exec(html)) !== null) {
      expect(() => new Function(m![1])).not.toThrow();
    }
  });

  it('ユーザー名がHTMLエスケープされて出力される', () => {
    const html = getAichatImageGalleryPage('<b>evil</b>');
    expect(html).not.toContain('<b>evil</b>');
    expect(html).toContain('&lt;b&gt;evil&lt;/b&gt;');
  });

  it('検索窓・検索API呼び出し・ギャラリーグリッド・プレビューモーダルの要素を埋め込む', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('id="gallerySearchInput"');
    expect(html).toContain('id="gallerySearchBtn"');
    expect(html).toContain('id="galleryGrid"');
    expect(html).toContain('/api/aichat/image-gallery-search?q=');
    expect(html).toContain('id="previewOverlay"');
    expect(html).toContain('id="previewChat"');
    expect(html).toContain('preview-bubble user');
    expect(html).toContain('preview-bubble assistant');
  });

  it('応答バブル(assistant)はMarkdownパーサー(parseMd)経由でinnerHTMLへ描画する', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('function parseMd(src)');
    expect(html).toContain("assistantBubble.innerHTML = parseMd(item.answer)");
    expect(html).toContain("assistantBubble.className = 'preview-bubble assistant preview-area'");
  });

  it('質問バブル(user)はMarkdown解釈せずtextContentのまま描画する', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('qText.textContent = item.question');
  });

  it('AIチャットページと同じmodelColorsをJSONで埋め込み、プレビューのモデル名に色を適用する', () => {
    const html = getAichatImageGalleryPage('testuser', { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' });
    expect(html).toContain('var MODEL_COLORS = {"@cf/meta/llama-3.3-70b-instruct-fp8-fast":"#4f46e5"}');
    expect(html).toContain('modelSpan.style.color = modelColor');
  });

  it('modelColors省略時は空オブジェクトを埋め込む(色未設定でも例外にならない)', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('var MODEL_COLORS = {}');
  });

  it('検索窓のinputイベントでインクリメントサーチ(デバウンス付き)が発火する', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain("searchInput.addEventListener('input'");
    expect(html).toContain('setTimeout(doSearch, INCREMENTAL_SEARCH_DEBOUNCE_MS)');
  });

  it('検索リクエストには連番を振り、古いリクエストの応答で新しい結果を上書きしない', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('if (seq !== searchRequestSeq) return;');
  });

  it('検索対象ドロップダウン(llama-4/moondream3.1)を持ち、llama-4がデフォルト選択されている', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('id="gallerySearchTarget"');
    expect(html).toContain('<option value="llama-4" selected>');
    expect(html).toContain('<option value="moondream3.1">');
  });

  it('検索リクエストのURLにドロップダウンで選択中のtargetを含める', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain("var target = searchTarget.value;");
    expect(html).toContain("'/api/aichat/image-gallery-search?q=' + encodeURIComponent(q) + '&target=' + encodeURIComponent(target)");
  });

  it('ドロップダウンのchangeイベントで(キーワード入力済みなら)再検索する', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain("searchTarget.addEventListener('change'");
  });

  // 対象: 「画像添付会話のプレビュー」モーダルに移植したキーワードハイライト
  // ON/OFFトグルボタン(🔑)。AIチャットの「詳細プレビュー」モーダル
  // (history-modal)にある同機能と、applyKeywordHighlight/clearKeywordHighlights
  // 本体(../utils/keywordHighlight.getKeywordHighlightScript)を共通化している。
  //
  // 故障シナリオ:
  //   (1) トグルボタン自体がマークアップに存在しない
  //   (2) applyKeywordHighlight/clearKeywordHighlightsが埋め込まれず
  //       ReferenceErrorになる
  //   (3) プレビューを開いた時点で検索キーワードがハイライトされない
  //   (4) トグルボタンを押しても /api/aichat/share-keywords を呼ばない、
  //       または呼んだ結果がハイライトに反映されない
  //   (5) 別の会話をプレビューし直した際、前の会話のDB取得済みフラグや
  //       ハイライト状態が引き継がれてしまう
  it('プレビューモーダルにキーワードハイライトのトグルボタン(#previewHighlightToggle)を持つ', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('id="previewHighlightToggle"');
  });

  it('applyKeywordHighlight/clearKeywordHighlightsが埋め込まれている(AIチャットの詳細プレビューモーダルと共通)', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toContain('function applyKeywordHighlight(el, keyword)');
    expect(html).toContain('function clearKeywordHighlights(container)');
  });

  it('トグルボタン押下時、DB由来のキーワードが未取得ならshare-keywordsを取得してハイライトに反映する', () => {
    const html = getAichatImageGalleryPage('testuser');
    const idx = html.indexOf('previewHighlightToggle.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 1200);
    expect(snippet).toContain('/api/aichat/share-keywords?shareId=');
    expect(snippet).toContain('applyKeywordHighlight(previewChat, allKws)');
  });

  function setupWithSearchResult() {
    const html = getAichatImageGalleryPage('testuser');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const searchResult = {
      id: 'share-1', user_hash: 'u1', question: 'ねこの写真です', answer: 'かわいいねこですね',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-08-20 10:00',
      image_data_url: 'data:image/png;base64,AAAA',
    };
    const fetchMock = vi.fn((url: string) => {
      if (String(url).indexOf('/api/aichat/image-gallery-search') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ results: [searchResult] }) });
      }
      if (String(url).indexOf('/api/aichat/share-keywords') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ keywords: [{ keyword: '写真', count: 3, is_classified: true }] }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    return { fetchMock };
  }

  afterEach(() => { vi.unstubAllGlobals(); });

  it('(DOM実動作) プレビューを開くと検索キーワードが即座にハイライトされ、トグルボタンが有効化される', async () => {
    setupWithSearchResult();
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'ねこ';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const item = document.querySelector('.gallery-item') as HTMLElement;
    expect(item).not.toBeNull();
    item.click();

    const previewChat = document.getElementById('previewChat')!;
    const marks = previewChat.querySelectorAll('.kw-highlight');
    expect(marks.length).toBeGreaterThan(0);
    expect(Array.from(marks).some((m) => m.textContent === 'ねこ')).toBe(true);

    const toggleBtn = document.getElementById('previewHighlightToggle') as HTMLButtonElement;
    expect(toggleBtn.style.opacity).toBe('1');
  });

  it('(DOM実動作) トグルボタンを押すとshare-keywordsを取得してDB由来のキーワードも合わせてハイライトする', async () => {
    const { fetchMock } = setupWithSearchResult();
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'ねこ';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const item = document.querySelector('.gallery-item') as HTMLElement;
    item.click();

    const toggleBtn = document.getElementById('previewHighlightToggle') as HTMLButtonElement;
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/aichat/share-keywords?shareId=share-1',
      expect.objectContaining({ credentials: 'same-origin' })
    );
    const previewChat = document.getElementById('previewChat')!;
    const marks = Array.from(previewChat.querySelectorAll('.kw-highlight'));
    expect(marks.some((m) => m.textContent === '写真')).toBe(true);
  });

  it('(DOM実動作) トグルボタンを2回目に押すとfetchせず、ハイライトの表示/非表示だけを切り替える', async () => {
    const { fetchMock } = setupWithSearchResult();
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'ねこ';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    (document.querySelector('.gallery-item') as HTMLElement).click();

    const toggleBtn = document.getElementById('previewHighlightToggle') as HTMLButtonElement;
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockClear();

    const previewChat = document.getElementById('previewChat')!;
    toggleBtn.click();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(previewChat.classList.contains('highlights-hidden')).toBe(true);

    toggleBtn.click();
    expect(previewChat.classList.contains('highlights-hidden')).toBe(false);
  });

  it('(DOM実動作) 別の会話をプレビューし直すと、前の会話のDB取得済みフラグ・ハイライト状態を引き継がない', async () => {
    const html = getAichatImageGalleryPage('testuser');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const resultA = {
      id: 'share-a', user_hash: 'u1', question: 'ねこの写真です', answer: 'かわいいねこですね',
      model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,AAAA',
    };
    const resultB = {
      id: 'share-b', user_hash: 'u1', question: 'いぬの写真です', answer: 'かわいいいぬですね',
      model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,BBBB',
    };
    const fetchMock = vi.fn((url: string) => {
      if (String(url).indexOf('/api/aichat/image-gallery-search') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ results: [resultA, resultB] }) });
      }
      if (String(url).indexOf('/api/aichat/share-keywords') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ keywords: [{ keyword: '写真', count: 1, is_classified: false }] }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = '写真';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const items = document.querySelectorAll('.gallery-item');
    (items[0] as HTMLElement).click();
    const toggleBtn = document.getElementById('previewHighlightToggle') as HTMLButtonElement;
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockClear();

    (items[1] as HTMLElement).click();
    // 2件目を開いた直後はまだDB由来キーワードを取得していないため、
    // トグルを押すと再度share-keywordsを呼びに行くはず(前の会話のフラグを
    // 引き継いで「取得済み」扱いになっていないこと)
    toggleBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/aichat/share-keywords?shareId=share-b',
      expect.objectContaining({ credentials: 'same-origin' })
    );
  });

  // 対象: プレビューモーダルの「🌳 分派を見る」ボタン(#previewBranchToggle)。
  // /api/aichat/image-branches の応答(自分以外の出力件数)を反映し、
  // (1) 件数>0: ラベルに"(N)"を付け、有効化し、薄黄色の点滅枠を付ける
  // (2) 件数===0: ラベルは素のまま、disabled属性で機能的にクリック不可にする
  //     (CSSで見た目を暗くするだけでクリックが効いてしまう実装を禁止する
  //     ハウスルールに従い、クリックハンドラ側にも早期returnガードを持たせる)
  // (3) 別のプレビューへ切り替えた際、前の会話のボタン状態を引き継がない
  //
  // 故障シナリオ:
  //   (1) ボタンの初期状態(プレビューを開く前)がdisabledでなく、誤ってクリック可能
  //   (2) 件数0の応答なのに何らかの理由でボタンが有効化されてしまう
  //   (3) 件数>0の応答なのにhas-branches(blink)クラスが付かない
  //   (4) 前の会話でN>0だった状態が、N=0の次の会話に引き継がれてしまう(表示のみ
  //       ならず内部状態=previewBranchCache/previewBranchRequestSeqの競合含む)
  //   (5) previewBranchToggleのfetchが完了する前に別プレビューに切り替えた場合、
  //       古い応答が新しいプレビューの状態を上書きしてしまう(レースコンディション)
  function setupWithBranches(branchesByImageId: Record<string, unknown[]>) {
    const html = getAichatImageGalleryPage('testuser');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const resultMany = {
      id: 'share-many', user_hash: 'u1', question: 'ねこの写真です', answer: 'かわいいねこですね',
      model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,AAAA', image_id: 'img-many',
    };
    const resultNone = {
      id: 'share-none', user_hash: 'u1', question: 'いぬの写真です', answer: 'かわいいいぬですね',
      model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,BBBB', image_id: 'img-none',
    };
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.indexOf('/api/aichat/image-gallery-search') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ results: [resultMany, resultNone] }) });
      }
      if (u.indexOf('/api/aichat/image-branches') === 0) {
        const m = /imageId=([^&]+)/.exec(u);
        const imageId = m ? decodeURIComponent(m[1]) : '';
        return Promise.resolve({ json: () => Promise.resolve({ items: branchesByImageId[imageId] || [] }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    return { fetchMock };
  }

  it('分派ボタンはプレビューを開く前はdisabledで、クリック不可能な状態のマークアップになっている', () => {
    const html = getAichatImageGalleryPage('testuser');
    expect(html).toMatch(/id="previewBranchToggle"[^>]*disabled/);
  });

  it('(DOM実動作) 分派が他に存在する(N>0)場合、ラベルに(N)を付け有効化しblinkクラスを付ける', async () => {
    setupWithBranches({
      'img-many': [
        { modelFamily: 'llama-4', shareId: 'share-many', question: 'q', answer: 'a', model: 'm', created_at: 't' },
        { modelFamily: 'moondream3.1', shareId: 'share-other', question: null, answer: 'x', model: 'm2', created_at: 't' },
      ],
    });
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'ねこ';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const items = document.querySelectorAll('.gallery-item');
    (items[0] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const toggleBtn = document.getElementById('previewBranchToggle') as HTMLButtonElement;
    expect(toggleBtn.textContent).toContain('分派を見る (1)');
    expect(toggleBtn.disabled).toBe(false);
    expect(toggleBtn.classList.contains('has-branches')).toBe(true);
  });

  it('(DOM実動作) 分派が他に存在しない(N=0)場合、ラベルは素のまま・disabled・クリックしても分派オーバーレイが開かない', async () => {
    setupWithBranches({
      'img-none': [
        { modelFamily: 'llama-4', shareId: 'share-none', question: 'q', answer: 'a', model: 'm', created_at: 't' },
      ],
    });
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'いぬ';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const items = document.querySelectorAll('.gallery-item');
    (items[1] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const toggleBtn = document.getElementById('previewBranchToggle') as HTMLButtonElement;
    expect(toggleBtn.textContent.trim()).toBe('🌳 分派を見る');
    expect(toggleBtn.disabled).toBe(true);
    expect(toggleBtn.classList.contains('has-branches')).toBe(false);

    toggleBtn.click();
    const branchOverlay = document.getElementById('branchOverlay')!;
    expect(branchOverlay.classList.contains('open')).toBe(false);
  });

  it('(DOM実動作) 別の会話(分派件数が異なる)をプレビューし直すと、前の会話のボタン状態を引き継がない', async () => {
    setupWithBranches({
      'img-many': [
        { modelFamily: 'llama-4', shareId: 'share-many', question: 'q', answer: 'a', model: 'm', created_at: 't' },
        { modelFamily: 'moondream3.1', shareId: 'share-other', question: null, answer: 'x', model: 'm2', created_at: 't' },
      ],
      'img-none': [
        { modelFamily: 'llama-4', shareId: 'share-none', question: 'q', answer: 'a', model: 'm', created_at: 't' },
      ],
    });
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = '写真';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const items = document.querySelectorAll('.gallery-item');
    const toggleBtn = document.getElementById('previewBranchToggle') as HTMLButtonElement;

    (items[0] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toggleBtn.textContent).toContain('(1)');
    expect(toggleBtn.disabled).toBe(false);

    (items[1] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toggleBtn.textContent.trim()).toBe('🌳 分派を見る');
    expect(toggleBtn.disabled).toBe(true);
    expect(toggleBtn.classList.contains('has-branches')).toBe(false);
  });

  // 対象: 検索結果グリッド(renderGallery)のカード枠色。プレビューを開く前の
  // 段階で「他モデルの分派出力が存在する画像(branch_count>0)」を一目で
  // 判別できるよう、サーバー(GET /api/aichat/image-gallery-search)が付与した
  // branch_count に応じて .gallery-item へ静的な(点滅しない)クラスを付ける。
  // PR #1447のプレビューモーダル内ボタンの点滅枠(has-branches/blink)とは
  // 別物であり、グリッドカード側は同じ点滅演出を流用しない。
  //
  // 故障シナリオ:
  //   (1) branch_count>0でもクラスが付かず、他分派の存在に気づけない
  //   (2) branch_count===0またはフィールド自体が無い行にもクラスが付いて
  //       しまい、常に枠色が付いてしまう(意味を持たなくなる)
  //   (3) プレビューモーダル用の点滅クラス(has-branches)を誤って使い回して
  //       しまい、グリッド全体が点滅して見づらくなる
  function setupWithGalleryBranchCounts(results: Array<Record<string, unknown>>) {
    const html = getAichatImageGalleryPage('testuser');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.indexOf('/api/aichat/image-gallery-search') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ results }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    return { fetchMock };
  }

  it('(DOM実動作) branch_count>0の結果カードには静的な分派枠クラス(has-other-branches)が付く', async () => {
    setupWithGalleryBranchCounts([
      { id: 's1', user_hash: 'u1', question: 'q1', answer: 'a1', model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,AAAA', image_id: 'img-1', branch_count: 2 },
    ]);
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'q';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const item = document.querySelector('.gallery-item') as HTMLElement;
    expect(item.classList.contains('has-other-branches')).toBe(true);
    expect(item.classList.contains('has-branches')).toBe(false);
  });

  it('(DOM実動作) branch_count===0の結果カードには分派枠クラスが付かない', async () => {
    setupWithGalleryBranchCounts([
      { id: 's1', user_hash: 'u1', question: 'q1', answer: 'a1', model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,AAAA', image_id: 'img-1', branch_count: 0 },
    ]);
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'q';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const item = document.querySelector('.gallery-item') as HTMLElement;
    expect(item.classList.contains('has-other-branches')).toBe(false);
  });

  it('(DOM実動作) branch_countフィールド自体が無い結果カードにも分派枠クラスが付かない(欠落時のフォールバック)', async () => {
    setupWithGalleryBranchCounts([
      { id: 's1', user_hash: 'u1', question: 'q1', answer: 'a1', model: 'm', created_at: 't', image_data_url: 'data:image/png;base64,AAAA', image_id: 'img-1' },
    ]);
    const searchInput = document.getElementById('gallerySearchInput') as HTMLInputElement;
    const searchBtn = document.getElementById('gallerySearchBtn') as HTMLButtonElement;
    searchInput.value = 'q';
    searchBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const item = document.querySelector('.gallery-item') as HTMLElement;
    expect(item.classList.contains('has-other-branches')).toBe(false);
  });
});
