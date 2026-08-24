import { afterEach } from 'vitest';

// heritage-journeyページの出発地・到着地(#start-city/#end-city)は
// Cookie(heritage_journey_start_city / heritage_journey_end_city)に保存され、
// ページ読み込みのたびに復元される仕様になった。jsdom環境のdocument.cookieは
// 同一テストファイル内の複数のit()や、同一workerで実行される他のテストファイルを
// またいで永続してしまう(実ブラウザでCookieがページ遷移をまたいで残るのと同じ)。
// このため、出発地・到着地を変更するテスト(swap-btnや#start-city/#end-cityの
// change等)を1つでも含むテストが先に実行されると、後続の無関係なテストが
// 「既定は出発地Paris・到着地Rome」という前提のまま書かれていても、Cookieに
// 残った値で上書きされてしまい失敗する。
// 個々のテストファイルを1つずつ直すのではなく、全テストのafterEachでこの2つの
// Cookieを必ず削除することで、テスト間の意図しない状態リークを一括で防ぐ。
afterEach(() => {
  if (typeof document === 'undefined') return;
  document.cookie = 'heritage_journey_start_city=; Path=/; Max-Age=0';
  document.cookie = 'heritage_journey_end_city=; Path=/; Max-Age=0';
});
