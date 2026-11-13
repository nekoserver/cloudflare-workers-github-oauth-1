# Codexの日本語応答ハーネス

`hooks.json`がリポジトリで管理する定義、`japanese.py`がCodexイベントを処理する実体、`restore.py`が既存設定を保持して復元する入口。

- SessionStart / UserPromptSubmit: すべて日本語で応答する指示をCodexのadditionalContextへ渡す。
- Stop: Codexのlast_assistant_messageから英語中心の応答を検出し、JSONのblock/reasonで日本語への書き直しを促す。コード・URLは判定から除外し、既にStopで継続したターンは再度止めない。これは言語判定の補助であり、すべての混在文を完全判定するものではない。
- 他のhook、config.toml、認証、権限、hookの信頼データは変更しない。壊れた既存JSONは上書きせず失敗する。置換前は非公開バックアップを保存し、原子的に0600で更新する。同じ定義の再適用では重複させない。

Dockerfileはこのディレクトリを `/usr/local/share/codex-harness/` へCOPYし、entrypointが毎回 `python3 /usr/local/share/codex-harness/restore.py` を実行する。配置先は明示CODEX_HOMEがあればそのディレクトリ、なければ起動ユーザーの `~/.codex/hooks.json`（root起動では/root/.codex）。codex-web等の別ユーザーへ自動で広げない。

現コンテナにも同じファイルと復元呼び出しを配置した。実コンテナ再起動・イメージ再ビルドは行っていないため、再作成後の実機確認は未実施。イメージに含めるには許可された環境で今後ビルドが必要。今回の復元検査は隔離CODEX_HOMEで2回行った。

## 信頼確認

Codexは新しい非管理hookの定義に利用者のレビュー・信頼確認を要求する。ファイル復元だけでは承認済みにしない。CLIの `/hooks`、または対応するhookレビュー画面で、実行する3定義とローカルスクリプトを確認する。trustデータの直接書き換えやbypassフラグは使わない。

現セッションの再読込・自動発火は未確認。Codex CLI 0.167.2でhooks機能が有効であることと、strict-configでの設定検証を確認した。既存のClaude用hook形式はそのまま流用せず、CodexのJSON出力とlast_assistant_messageを使用する。

公式仕様: https://learn.chatgpt.com/docs/hooks

## 検証

```
python3 scripts/codex-harness-hooks.test.py
bash -n containers/demo/entrypoint.sh
```

テストは追加コンテキスト、英語応答のStop、正常な日本語、停止ループ回避、他のhookの保持、冪等な復元、壊れた既存設定の保持、起動/COPY設定を確認する。モデルへの新規推論要求や外部送信は行わない。
