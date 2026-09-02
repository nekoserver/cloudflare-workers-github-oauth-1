/**
 * /wasm-modulesページのPWA(standalone表示)時、画面右上のユーザーメニュー
 * (ホーム・AIチャット・リポジトリ・設定・キー管理・アカウント切替・ログアウトへの
 * リンクを含むドロップダウン)を非表示にする。
 *
 * CLAUDE.md「PWA UI ルール」: PWA版アプリ(display: standalone)の画面右上には
 * 外部リンク・ナビゲーションリンクを一切配置しない(アドレスバーが無いため
 * デッドリンクになりやすくUXを損なう)。既存の他ページ(webglSphere.ts等)と
 * 同じ `.pwa-hide` クラス + `@media (display-mode: standalone)` パターンを踏襲する。
 *
 * 故障シナリオ:
 *   (1) `.pwa-hide` クラスがユーザーメニュー(トリガー+ドロップダウン全体)に
 *       付いておらず、standalone表示でもリンクが見えたままになる
 *   (2) `@media (display-mode: standalone)` のCSSルール自体が定義されておらず、
 *       クラスを付けても実際には非表示にならない
 *   (3) ページに専用の<link rel="manifest">が無く、ホーム画面に追加しても
 *       ブラウザが`display: standalone`のアプリとして認識しない(この場合、
 *       (1)(2)を満たしていても display-mode: standalone が一切成立せず、
 *       pwa-hideのCSSがどれだけ正しくても永久に発動しない。実際にこの
 *       manifest欠落が原因で「CSSは合っているのにPWAで消えない」という
 *       不具合が起きた。/workflowページで同種の不具合が既に一度発生していた
 *       (workflow-page-20260819.test.ts参照)ため、この教訓を踏まえて追加した)
 *   (4) 共有の/manifest.json(別アプリ=WebGL地球儀用、start_urlが異なる)へ
 *       linkしてしまうと、ホーム画面追加時に誤った名前・起動先になる
 */
import { describe, it, expect } from 'vitest';
import { getWasmModulesPage } from './views/wasmModules';

describe('getWasmModulesPage: PWA(standalone)時の右上リンク非表示', () => {
  const html = getWasmModulesPage('tester');

  it('ユーザーメニュー(user-menu-container)にpwa-hideクラスが付いている', () => {
    expect(html).toMatch(/<div class="user-menu-container pwa-hide">/);
  });

  it('ユーザー名表示(user-name)にもpwa-hideクラスが付いている(他ページのwebglSphere.ts等と同じ扱い)', () => {
    expect(html).toMatch(/<span class="user-name pwa-hide">/);
  });

  it('standalone表示時にpwa-hideを非表示にするCSSルールが定義されている', () => {
    expect(html).toContain('@media (display-mode: standalone) { .pwa-hide { display: none !important; } }');
  });

  it('共有の/manifest.json(WebGL地球儀アプリ用)へはlinkせず、専用のmanifest-wasm-modules.jsonへlinkする', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest-wasm-modules.json">');
    expect(html).not.toContain('href="/manifest.json"');
  });

  it('iOS向けのapple-mobile-web-app系メタタグが揃っている', () => {
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="WASMモジュール">');
  });
});
