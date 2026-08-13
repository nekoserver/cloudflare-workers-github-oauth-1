import { describe, expect, it } from 'vitest';
import { getAichatImageGalleryPage } from './aichatImageGallery';

// 対象: /aichat-image-gallery ページ(閲覧専用)。ai_chat_shares を検索対象に
// 画像添付済みの会話をギャラリー表示し、タップで質問/回答のチャットバブルを
// 表示する。行データはサーバー側でHTMLに埋め込まず、/api/aichat/
// image-gallery-search からのJSONをクライアント側でDOM生成して表示するため、
// このページ自体はユーザー名以外に動的な文字列をHTMLへ直接埋め込まない。
//
// 故障シナリオ:
//   (1) script タグに構文エラーがあり、ページ全体が白紙になる
//   (2) ユーザー名がエスケープされずXSSになる
//   (3) 検索API・プレビューモーダル・ギャラリーグリッドの要素が欠落し、
//       クライアント側スクリプトがnullアクセスで例外になる

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
});
