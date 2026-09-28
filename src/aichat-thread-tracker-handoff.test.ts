import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

describe('thread tracker handoff', () => {
  it('URLの再質問IDを検証して既存スレッドへ追加質問できる', () => {
    const html = getAiChatPage({ username: 'alice', aiChatModel: '@cf/meta/llama-3.1-8b-instruct-fp8' });
    expect(html).toContain("trackerParams.get('threadId')");
    expect(html).toContain('/^[0-9a-f]{32}$/i.test(requestedThreadId)');
    expect(html).toContain("trackerParams.get('draft')");
    expect(html).toContain('if (trackerDraft) chatInput.value = trackerDraft');
  });
});
