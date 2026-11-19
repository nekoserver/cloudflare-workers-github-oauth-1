import { describe, expect, it } from 'vitest';
import { resolveConversationStreamRoutes } from './conversationStreamRoutes';
import {
  applyConversationStreamOverrides,
  normalizeConversationStreamHost,
  type ConversationStreamHostRecord,
} from './conversationStreamOverrides';

// 対象: 台帳(src/data/conversation-stream-routes.json)を既定とし、D1 conversation_stream_hosts の行で
// 上書きする処理。台帳が正の既定で、D1の行は「同じIDの上書き・新しいIDの追加・enabled=0での除外」だけを行う。
const ledger = {
  autoPriority: ['mygw'],
  routes: [
    { id: 'mygw', origin: 'https://mygw.nekomaneki.work' },
    { id: 'mynw', origin: 'https://mynw.nekomaneki.work' },
    { id: 'redmine', origin: 'https://r9.nekomaneki.work' },
  ],
};
const base = () => resolveConversationStreamRoutes(ledger);
const row = (value: Partial<ConversationStreamHostRecord> & { id: string }): ConversationStreamHostRecord => ({
  label: value.id, origin: `https://${value.id}.nekomaneki.work`, priority: 100, enabled: true, ...value,
});

describe('applyConversationStreamOverrides', () => {
  it('D1に行が無ければ、台帳の解決結果をそのまま返す(使っていない接続先を確認しない動きを保つ)', () => {
    const result = applyConversationStreamOverrides(base(), []);
    expect(result).toEqual({ ok: true, config: base(), applied: 0, skipped: [] });
  });

  it('同じIDの行は、台帳の位置を保ったままoriginと表示名を上書きし、各URLを作り直す', () => {
    const result = applyConversationStreamOverrides(base(), [row({ id: 'mynw', label: '予備', origin: 'https://spare.nekomaneki.work', priority: 50 })]);
    if (!result.ok) throw new Error(result.detail);
    expect(result.config.routes.map(route => route.id)).toEqual(['mygw', 'mynw', 'redmine']);
    const mynw = result.config.routes.find(route => route.id === 'mynw')!;
    expect(mynw).toMatchObject({ label: '予備', origin: 'https://spare.nekomaneki.work' });
    expect(mynw.endpoints.embed).toBe('https://spare.nekomaneki.work/lib/conversation-embed.html');
    expect(mynw.endpoints.websocket).toBe('wss://spare.nekomaneki.work/lib/api/chat/ws');
  });

  it('D1の有効な行は自動選択の候補になり、台帳の自動選択(先頭から10,20,…)と優先度の昇順で並ぶ', () => {
    const result = applyConversationStreamOverrides(base(), [row({ id: 'mynw', priority: 5 }), row({ id: 'redmine', priority: 15 })]);
    if (!result.ok) throw new Error(result.detail);
    expect(result.config.autoPriority).toEqual(['mynw', 'mygw', 'redmine']);
  });

  it('enabled=0の行は、その接続先を選択肢と自動選択の両方から外す', () => {
    const result = applyConversationStreamOverrides(base(), [row({ id: 'mygw', origin: 'https://mygw.nekomaneki.work', enabled: false })]);
    if (!result.ok) throw new Error(result.detail);
    expect(result.config.routes.map(route => route.id)).toEqual(['mynw', 'redmine']);
    expect(result.config.autoPriority).toEqual([]);
  });

  it('台帳に無いIDの行は、選択肢の末尾(優先度順)と自動選択に加える', () => {
    const result = applyConversationStreamOverrides(base(), [row({ id: 'next', priority: 30 }), row({ id: 'early', priority: 1 })]);
    if (!result.ok) throw new Error(result.detail);
    expect(result.config.routes.map(route => route.id)).toEqual(['mygw', 'mynw', 'redmine', 'early', 'next']);
    expect(result.config.autoPriority).toEqual(['early', 'mygw', 'next']);
  });

  it('不正な行は使わずに飛ばし、理由をskippedに残す(ほかの行と台帳は使う)', () => {
    const result = applyConversationStreamOverrides(base(), [
      row({ id: 'evil', origin: 'https://evil.example.com' }),
      row({ id: 'Auto' }),
      row({ id: 'auto' }),
      row({ id: 'ok', priority: 1 }),
    ]);
    if (!result.ok) throw new Error(result.detail);
    expect(result.skipped).toEqual([
      { id: 'evil', errorCode: 'origin_not_allowed' },
      { id: 'Auto', errorCode: 'invalid_id' },
      { id: 'auto', errorCode: 'invalid_id' },
    ]);
    expect(result.applied).toBe(1);
    expect(result.config.autoPriority).toEqual(['ok', 'mygw']);
  });

  it('D1で接続先がすべて外れたときは、上書きを使わずに失敗として返す(呼び出し側は台帳で動く)', () => {
    const result = applyConversationStreamOverrides(base(), ['mygw', 'mynw', 'redmine'].map(id => row({ id, enabled: false })));
    expect(result).toMatchObject({ ok: false, errorCode: 'no_enabled_routes', skipped: [] });
  });
});

describe('normalizeConversationStreamHost', () => {
  it('許可済みドメイン配下のHTTPSオリジンだけを受け付け、末尾のスラッシュを落とす', () => {
    expect(normalizeConversationStreamHost({ id: 'new-host', label: '新', origin: 'https://new.nekomaneki.work/', priority: 15 }))
      .toEqual({ ok: true, value: { id: 'new-host', label: '新', origin: 'https://new.nekomaneki.work', priority: 15 } });
    expect(normalizeConversationStreamHost({ id: 'w', label: 'w', origin: 'https://x.nekoflare.workers.dev', priority: 0 }).ok).toBe(true);
  });

  it.each([
    [{ id: 'bad_id', label: 'x', origin: 'https://a.nekomaneki.work', priority: 1 }, 'invalid_id'],
    [{ id: 'auto', label: 'x', origin: 'https://a.nekomaneki.work', priority: 1 }, 'invalid_id'],
    [{ id: 'a', label: '', origin: 'https://a.nekomaneki.work', priority: 1 }, 'invalid_label'],
    [{ id: 'a', label: 'x'.repeat(81), origin: 'https://a.nekomaneki.work', priority: 1 }, 'invalid_label'],
    [{ id: 'a', label: 'x', origin: 'http://a.nekomaneki.work', priority: 1 }, 'origin_not_allowed'],
    [{ id: 'a', label: 'x', origin: 'https://a.nekomaneki.work/lib', priority: 1 }, 'origin_not_allowed'],
    [{ id: 'a', label: 'x', origin: 'https://a.nekomaneki.work:8443', priority: 1 }, 'origin_not_allowed'],
    [{ id: 'a', label: 'x', origin: 'https://nekomaneki.work.evil.example', priority: 1 }, 'origin_not_allowed'],
    [{ id: 'a', label: 'x', origin: 'not a url', priority: 1 }, 'invalid_origin'],
    [{ id: 'a', label: 'x', origin: 'https://a.nekomaneki.work', priority: 1.5 }, 'invalid_priority'],
    [{ id: 'a', label: 'x', origin: 'https://a.nekomaneki.work', priority: 10_001 }, 'invalid_priority'],
    [null, 'invalid_body'],
  ])('不正な値を理由のコード付きで拒否する %#', (input, errorCode) => {
    expect(normalizeConversationStreamHost(input)).toMatchObject({ ok: false, errorCode });
  });
});
