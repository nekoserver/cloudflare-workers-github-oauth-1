import { describe, it, expect } from 'vitest';
import { AICHAT_DRAFT_SCRIPT } from './aichatDraft';
import { getAiChatPage } from './aichat';

// ユーザー指定(2026-11-07): AIチャットの入力中の文字を、タブの切り替えやページの再読み込みで消さない。
type Draft = {
  AICHAT_DRAFT_KEY: string;
  AICHAT_DRAFT_MAX_CHARS: number;
  saveAichatDraft(storage: Storage | null, text: string): void;
  loadAichatDraft(storage: Storage | null): string;
};
const draft = new Function(`${AICHAT_DRAFT_SCRIPT}\nreturn { AICHAT_DRAFT_KEY, AICHAT_DRAFT_MAX_CHARS, saveAichatDraft, loadAichatDraft };`)() as Draft;

class MemoryStorage {
  items = new Map<string, string>();
  getItem(k: string) { return this.items.get(k) ?? null; }
  setItem(k: string, v: string) { this.items.set(k, String(v)); }
  removeItem(k: string) { this.items.delete(k); }
}

describe('AIチャットの入力の下書き', () => {
  it('入力をlocalStorageへ保存して読み戻し、空になったら消す', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    draft.saveAichatDraft(storage, '途中まで書いた\n質問');
    expect(draft.loadAichatDraft(storage)).toBe('途中まで書いた\n質問');
    draft.saveAichatDraft(storage, '');
    expect(storage.getItem(draft.AICHAT_DRAFT_KEY)).toBeNull();
    expect(draft.loadAichatDraft(storage)).toBe('');
  });
  it('長すぎる入力は上限で切り、保存できない環境でも例外を出さない', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    draft.saveAichatDraft(storage, 'a'.repeat(draft.AICHAT_DRAFT_MAX_CHARS + 10));
    expect(draft.loadAichatDraft(storage)).toHaveLength(draft.AICHAT_DRAFT_MAX_CHARS);
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } } as unknown as Storage;
    expect(() => draft.saveAichatDraft(broken, 'x')).not.toThrow();
    expect(draft.loadAichatDraft(broken)).toBe('');
    expect(draft.loadAichatDraft(null)).toBe('');
  });
  it('ページは読み込み時に下書きを戻し、入力・タブを隠す・離れるときに保存し、送信で消す', () => {
    const page = getAiChatPage({ username: 'u', aiChatModel: 'm' });
    expect(page).toContain('restoreAichatDraft();');
    expect(page).toContain("chatInput.addEventListener('input', persistAichatDraft);");
    expect(page).toContain("document.addEventListener('visibilitychange', persistAichatDraft);");
    expect(page).toContain("window.addEventListener('pagehide', persistAichatDraft);");
    const submitAt = page.indexOf("chatForm.addEventListener('submit'");
    const submit = page.slice(submitAt, page.indexOf('var assistantBubbleEl = null;', submitAt));
    expect(submit).toContain("chatInput.value = '';");
    expect(submit).toContain("saveAichatDraft(aichatDraftStorage, '');");
  });
});
