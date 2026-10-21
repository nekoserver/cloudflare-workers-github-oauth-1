# SPEC: ホスト名と系統の割り振り（2026-10-21）

**対象**: `nekomaneki.work` 配下のホスト名と、それを受ける仕組み（Worker・Tunnel・コンテナ）の割り振り。
`/cf-containers` の `NEKOROOT_HOSTNAME` 設定、resend webhook の送信先（`src/index.ts`）に関わる。
ホスト名ごとに「誰が受けるか」を1か所で確認できるようにする。

## 1. 2系統の全体像

| 系統 | 受ける仕組み | ホスト名 | 状態 |
|---|---|---|---|
| A: Worker 管理系 | Worker（cfc-standalone）の Custom Domain | `test.cfc.nekomaneki.work` | 残す。管理画面用 |
| B: ストリーム系 | Tunnel（コンテナ内の配信）。Worker は通さない | `stream.test.cfc.nekomaneki.work` | 残す。会話ストリーム用 |
| C: lib 系 | mynw 側の lib（コンテナ・Worker とは別） | `mynw.nekomaneki.work` | 残す。resend webhook など |
| D: nekoroot（コンテナのトンネル） | Tunnel `nekoroot`（SSH・Apache） | 未定 | 停止中。コンテナの置き場所が決まるまで触らない |

- A と B は cf-container の `NOTICE.custom-domain-tunnel-routing.md` に定義がある。
- C は本体 Worker が resend の webhook を受けた後、`src/index.ts` で転送する先（`https://mynw.nekomaneki.work/lib/resend-webhook.shtml`）。Resend 側の受信先は Worker の固定ドメインで、転送先（mynw）は lib がドキュメントルート下に置かれている前提で選んでいる。
- D の `NEKOROOT_HOSTNAME` は Worker のシークレット。値は未確定で、今は変更しない。

## 2. 重要な注意

- **`test.cfc.nekomaneki.work` は Worker の管理画面**。コンテナのトンネル先に使うと、Worker が先に要求を受けて届かない。
- Worker の Custom Domain と Tunnel の ingress は別の設定。同じホストに両方を定義しても、Worker が優先されることがある。
- ゾーンの Worker Routes に `*.cfc.nekomaneki.work/*` のような広いパターンがあると、新しいサブドメインも Worker に掛かる。新しいホストを決める前に確認する。

## 3. 今後の順序

1. mynw 側で証明書を取得（優先度は cfc より上）
2. コンテナの置き場所を確定
3. Tunnel を再配置し、D のホスト名を決める
4. `NEKOROOT_HOSTNAME` のシークレットを合わせる

## 4. 現在の変更履歴

- `src/index.ts`: resend webhook の送信先を一時的に `test.cfc` にしたが、`mynw` に戻した（系統 C）。
