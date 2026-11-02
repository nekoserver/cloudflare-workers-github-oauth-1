import { describe, expect, it } from 'vitest';
import { CFC_CONTAINER_ORIGIN, MAIN_CONTAINER_ORIGIN } from './containerEndpoints';
import {
  conversationStreamEndpoints,
  conversationStreamFrameOrigins,
  resolveConversationStreamRoutes,
} from './conversationStreamRoutes';

describe('conversationStreamEndpoints', () => {
  it('derives the embed page and every stream transport from one tunnel origin', () => {
    expect(conversationStreamEndpoints('https://stream2.example.work')).toEqual({
      embed: 'https://stream2.example.work/lib/conversation-embed.html',
      websocket: 'wss://stream2.example.work/lib/api/chat/ws',
      sse: 'https://stream2.example.work/lib/api/chat/sse',
      ndjson: 'https://stream2.example.work/lib/api/chat/ndjson',
      jsonseq: 'https://stream2.example.work/lib/api/chat/jsonseq',
    });
  });

  it('rejects anything but a bare HTTPS origin', () => {
    for (const origin of ['http://a.example', 'https://a.example/lib', 'https://u:p@a.example', 'https://a.example/?x=1', 'not a url']) {
      expect(() => conversationStreamEndpoints(origin), origin).toThrow();
    }
  });
});

describe('resolveConversationStreamRoutes', () => {
  it('keeps the current hosts, picker order and auto-selection priority by default', () => {
    const { routes, autoPriority } = resolveConversationStreamRoutes();
    expect(routes.map(route => route.id)).toEqual(['mygw', 'mynw', 'testcfc', 'redmine']);
    expect(routes.map(route => route.label)).toEqual(['mygw.nekomaneki.work', 'mynw.nekomaneki.work', 'stream.test.cfc.nekomaneki.work', 'r9.nekomaneki.work']);
    expect(autoPriority).toEqual(['redmine', 'mygw', 'mynw', 'testcfc']);
    expect(routes.find(route => route.id === 'mygw')?.origin).toBe(MAIN_CONTAINER_ORIGIN);
    expect(routes.find(route => route.id === 'testcfc')?.origin).toBe(CFC_CONTAINER_ORIGIN);
    expect(routes.find(route => route.id === 'redmine')?.endpoints.embed).toBe('https://r9.nekomaneki.work/lib/conversation-embed.html');
  });

  it('switches to the tunnel routes of whichever containers are started, without code changes', () => {
    const resolved = resolveConversationStreamRoutes(({
      autoPriority: ['next', 'mygw'],
      routes: [
        { id: 'mygw', origin: 'https://mygw.nekomaneki.work' },
        { id: 'next', origin: 'https://stream.next.nekomaneki.work', label: '次のコンテナ' },
        { id: 'old', origin: 'https://old.nekomaneki.work', enabled: false },
      ],
    }));
    expect(resolved.routes.map(route => [route.id, route.label, route.endpoints.websocket])).toEqual([
      ['mygw', 'mygw.nekomaneki.work', 'wss://mygw.nekomaneki.work/lib/api/chat/ws'],
      ['next', '次のコンテナ', 'wss://stream.next.nekomaneki.work/lib/api/chat/ws'],
    ]);
    expect(resolved.autoPriority).toEqual(['next', 'mygw']);
    expect(conversationStreamFrameOrigins(resolved)).toBe('https://stream.next.nekomaneki.work https://mygw.nekomaneki.work');
  });

  it('defaults auto priority to the picker order and drops disabled routes from it', () => {
    const resolved = resolveConversationStreamRoutes(({
      autoPriority: ['b', 'a'],
      routes: [{ id: 'a', origin: 'https://a.example' }, { id: 'b', origin: 'https://b.example', enabled: false }],
    }));
    expect(resolved.autoPriority).toEqual(['a']);
    expect(resolveConversationStreamRoutes(({ routes: [{ id: 'x', origin: 'https://x.example' }, { id: 'y', origin: 'https://y.example' }] })).autoPriority).toEqual(['x', 'y']);
  });

  it('stops instead of using an invalid ledger', () => {
    const invalid = [
      null,
      [],
      {},
      { routes: [] },
      { routes: [{ id: 'a', origin: 'https://a.example', enabled: false }] },
      { routes: [{ id: 'a', origin: 'https://a.example' }, { id: 'a', origin: 'https://b.example' }] },
      { routes: [{ id: 'auto', origin: 'https://a.example' }] },
      { routes: [{ id: 'Bad Id', origin: 'https://a.example' }] },
      { routes: [{ id: 'a', origin: 'http://a.example' }] },
      { routes: [{ id: 'a', origin: 'https://a.example/lib/conversation-embed.html' }] },
      { routes: [{ id: 'a', origin: 'https://a.example', enabled: 'yes' }] },
      { routes: [{ id: 'a', origin: 'https://a.example', label: 3 }] },
      { autoPriority: ['missing'], routes: [{ id: 'a', origin: 'https://a.example' }] },
      { autoPriority: ['a', 'a'], routes: [{ id: 'a', origin: 'https://a.example' }] },
    ];
    for (const value of invalid) {
      expect(() => resolveConversationStreamRoutes(value), JSON.stringify(value)).toThrow(/会話ストリーム/);
    }
  });
});
