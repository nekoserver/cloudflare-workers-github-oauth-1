# CFコンテナ管理ページの期限切れトークン更新

## 背景と動作

**対象**: `/cf-containers` のトークン入力欄と `POST /api/cf-containers/secrets`。

従来は保存済みのCFトークンでSecret更新APIを呼んでいたため、期限切れになると入力欄から更新できなかった。`CF_CONTAINER_API_TOKEN` の保存時は入力した新しいトークンで認証し、保存済みの値が期限切れ・未設定でも更新可能にした。他のSecret更新では既存の認証情報を使う。

入力するCFトークンには、対象アカウントのWorkers Scripts:EditとCloudflare Tunnel:Readが必要。管理者認証とSecret名の許可リストを維持し、入力値は応答やエラーログに出さない。

## 修正内容

**対象**: Workerの更新API、管理ページ、DemoContainerの再起動処理。

| ファイル | 変更 |
| --- | --- |
| `src/index.ts` | 入力CFトークンで保存。型・空白検証、エラー内のキー伏せ字、保存後の反映失敗を警告として返す |
| `src/containers/demoContainer.ts` | ロック内のstop/start間で保存済みの新しい値をenvVarsに反映。既存DOが旧envを保持していても更新値で起動 |
| `src/views/cfContainers.ts` | 更新方法と必要権限の説明、保存・更新ボタン |
| `src/cf-containers-page.test.ts` | 旧トークン期限切れ・未設定、API拒否、再起動失敗を検証 |
| `src/containers/demoContainer.secrets.test.ts` | 新しい環境変数の反映、他の値の維持、排他制御、許可リストを検証 |

## 検証と反映状況

**対象**: Node上の軽量テストと本番への反映。

関連5ファイル39テストが成功。`git diff --check`も成功。全体の`tsc --noEmit`は既存箇所（DemoContainerの`DurableObject['ctx']`、index.tsの`pk+fk+idx`、他のテスト等）の型エラーで失敗。新しい実トークンを使った本番保存・再起動は未検証。AGENTS.md/AGENT.mdの実行条件に従いDockerビルドとビルドを含むデプロイは実施していない。

環境変数の指定方式: [Cloudflare Container class](https://developers.cloudflare.com/containers/api/container-class/)。
