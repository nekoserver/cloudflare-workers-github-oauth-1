import { describe, it, expect } from 'vitest';
import { getMegaminxPage } from './views/megaminx';

// 対象: /megaminx ページ(src/views/megaminx.ts の getMegaminxPage)。
// Megaminx(正十二面体パズル)を実際に操作可能なWebGLパズルとして表示する。
// 幾何・パズルロジック自体はsrc/utils/megaminxGeometry.ts・src/utils/megaminx.ts
// (自動テスト済み)から埋め込みスクリプトへ移植したもの。移植先の埋め込み
// スクリプトは実際にwrangler devを起動し、ブラウザで/megaminxを開いて
// スクリーンショットで目視確認済み(1回転で未ソルブになる・同じ面を5回転
// すると360度でソルブに戻る・隣接面へ色が伝播する・面のステッカー分割
// [中心5角形+角5枚+辺5枚]に隙間が無いことを確認した)。
//
// 故障シナリオ:
//   (1) script タグに構文エラーがあり、ページ全体が白紙になる
//   (2) 画面右上にユーザー名が表示されてしまう(PWAでホーム画面から
//       起動した場合、アドレスバーが無いためデッドリンク化しやすい
//       要素をそもそもマークアップに含めないというCLAUDE.mdのPWA UI
//       ルールに反する)
//   (3) 面を回すボタン・スクランブル・リセットの要素が欠落し、
//       クライアント側スクリプトがnullアクセスで例外になる

describe('getMegaminxPage', () => {
  const html = getMegaminxPage('tester');

  it('script タグに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('画面右上にユーザー名を一切表示しない(PWA対応、条件分岐なしでマークアップから除外)', () => {
    expect(html).not.toContain('tester');
    const otherUserHtml = getMegaminxPage('another-user');
    expect(otherUserHtml).not.toContain('another-user');
  });

  it('WebGLキャンバス・面選択グリッド・スクランブル/ソルブ/リセットボタン・手順表示の要素を含む', () => {
    expect(html).toContain('id="c"');
    expect(html).toContain('id="faceGrid"');
    expect(html).toContain('id="btnS"');
    expect(html).toContain('id="btnV"');
    expect(html).toContain('id="btnR"');
    expect(html).toContain('id="st"');
    expect(html).toContain('id="mb"');
  });

  it('頂点シェーダー・フラグメントシェーダーの定義を含む', () => {
    expect(html).toContain('id="vs"');
    expect(html).toContain('id="fs"');
    expect(html).toContain('type="x-shader/x-vertex"');
    expect(html).toContain('type="x-shader/x-fragment"');
  });
});

describe('getMegaminxPage — ルート配線', () => {
  it("app.get('/megaminx', authMiddleware, ...) が index.ts に登録されている", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/megaminx', authMiddleware, async (c) => {");
  });
});
