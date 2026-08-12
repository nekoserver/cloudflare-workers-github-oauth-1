import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};

// 対象: /aichat ページが、サーバー側でCookieから解決した
// 「画像添付時にmoondreamを優先する」設定値(aichatPreferMoondream)を、
// クライアント側JSの初期値としてページ内に埋め込む処理。
//
// 故障シナリオ:
//   (1) aichatPreferMoondreamを渡さない場合にデフォルトがfalseになってしまう
//       (要件は「デフォルトでON」)
//   (2) trueを渡してもfalseとして埋め込まれてしまう(またはその逆)
describe('/aichat ページ: aichatPreferMoondream設定値の埋め込み', () => {
  it('aichatPreferMoondreamを指定しない場合はデフォルトでtrueが埋め込まれる', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('var aichatPreferMoondream = true;');
  });

  it('aichatPreferMoondream: false を渡すとfalseが埋め込まれる', () => {
    const html = getAiChatPage({ ...minimalUser, aichatPreferMoondream: false });
    expect(html).toContain('var aichatPreferMoondream = false;');
  });

  it('aichatPreferMoondream: true を渡すとtrueが埋め込まれる', () => {
    const html = getAiChatPage({ ...minimalUser, aichatPreferMoondream: true });
    expect(html).toContain('var aichatPreferMoondream = true;');
  });
});
