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
 */
import { describe, it, expect } from 'vitest';
import { getWasmModulesPage } from './views/wasmModules';

describe('getWasmModulesPage: PWA(standalone)時の右上リンク非表示', () => {
  const html = getWasmModulesPage('tester');

  it('ユーザーメニュー(user-menu-container)にpwa-hideクラスが付いている', () => {
    expect(html).toMatch(/<div class="user-menu-container pwa-hide">/);
  });

  it('standalone表示時にpwa-hideを非表示にするCSSルールが定義されている', () => {
    expect(html).toContain('@media (display-mode: standalone) { .pwa-hide { display: none !important; } }');
  });
});
