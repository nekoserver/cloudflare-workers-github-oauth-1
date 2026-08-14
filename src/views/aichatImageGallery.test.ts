import { describe, expect, it } from 'vitest';
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
});
