# コンテナの上位クラス料金比較と選択中モデルの緑色表示

## 背景

**対象**: `/cf-containers` のCloudflare Containers単価表。

現在のstandard-1に加え、ひとつ上のstandard-2の料金を比較できるようにする。現在選択中のモデル名は緑色で示す。

## 修正内容

**対象**: `src/views/cfContainers.ts` の料金表と状態描画。

| 項目 | 動作 |
| --- | --- |
| 料金比較 | standard-1（0.5 vCPU / 4 GiB / 8 GB）とstandard-2（1 vCPU / 6 GiB / 12 GB）のリソース別・合計USD/時間を表示 |
| 計算 | 既存のcomputeHourlyRateを共用。CPU上限使用時の合計はそれぞれ0.074016 / 0.129024 USD/時間 |
| 選択表示 | CONFIGURED_INSTANCE_TYPEに一致するモデル名を既存の緑色トークンで表示し、「選択中」も併記 |
| 状態取得 | 料金表はHTMLに含めるため、状態API・DBの失敗に影響されない。累計時間と予定支出の更新は継続 |
| 料金の説明 | CPUは実使用量、メモリ・ディスクは確保量で課金。無料枠未考慮、通信等は別料金と明記。公式料金へのリンクを付記 |

出典: https://developers.cloudflare.com/containers/platform/pricing/ （2026-10-19確認）。コンテナのクラス設定は変更しない。

## 検証

**対象**: ページ内JavaScript、料金計算、生成HTML。

既存の関連3ファイル14テスト成功。生成HTMLで2クラスのスペック・料金・選択表示・緑色の指定を確認。git diff --check成功。Dockerビルドとデプロイは実施していない。
