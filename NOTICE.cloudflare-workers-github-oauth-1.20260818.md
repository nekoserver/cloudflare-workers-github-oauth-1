# NOTICE 2026-08-18

## Rust/WASM: wasm-bindgenのUint8ArrayをそのままfetchのbodyへはTypeScript的に渡せない

`wasm-bindgen`(`--target web`)がRustの`Vec<u8>`戻り値から生成する`Uint8Array`は、
Cloudflare Workersの型定義(`@cloudflare/workers-types`)における`fetch`の
`BodyInit`(`ArrayBuffer`を要求し、より緩い`ArrayBufferLike`は不可)とは
`tsc --noEmit`で型エラーになる場合がある(`dig-wasm`で発生)。

```
No overload matches this call.
  Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BodyInit | null | undefined'.
```

**対処**: `queryBytes.slice().buffer as ArrayBuffer` のように、一度コピーして
プレーンな`ArrayBuffer`に正規化してから`fetch`の`body`に渡す
(`src/utils/digWasmServer.ts`参照)。実行時には元々問題なく動く場合が
多いが、型検査(`npx tsc --noEmit`)で必ず引っかかるため、WASM側から
バイト列を受け取ってfetchのbodyにそのまま渡す新しいコードを書くときは
毎回この変換を入れること。

## Cloudflare Workersからは生のDNS(UDP:53)問い合わせができない

`dig`風のDNS問い合わせコマンドを実装する際、実際のDNSサーバーへの
UDPソケット送信はCloudflare Workersのサンドボックスでは行えない
(生のUDP/TCPソケットAPIはWorkers自体には無く、`fetch`によるHTTPアクセス
のみが基本)。そのため、実際の名前解決はDNS over HTTPS(例:
`https://cloudflare-dns.com/dns-query`に`Content-Type: application/dns-message`
でPOSTし、生のDNSワイヤーフォーマットのバイト列をそのまま送受信する)経由で
行う。DNSワイヤーフォーマット自体の組み立て・解析(パケット生成・応答パース)
はRust/WASM側で行い、実際のネットワークI/O(DoHへの`fetch`)だけを
TypeScript側(Worker)が担当する、という役割分担にすると
`.wasm`静的importの制約(dynamic importが必須)を守りながら実装できる。
