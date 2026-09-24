# NOTICE — ワークフロー実行時のリポジトリアクセス要件

## `/workflow/0021` の前提条件

`/workflow/0021`（tree view の JSON データ更新）は、このリポジトリだけでは完結しません。
生成した JSON を `nekoserver/dynamicneko` の
`src/data/tree-view-sample-data.ts` に反映し、同リポジトリで type-check とテストを実行した後、
ブランチの作成、commit、push、および Pull Request の作成まで行う手順です。

したがって、このワークフローを正常に完了するには、実行者または実行エージェントが次の条件を
すべて満たす必要があります。

- `nekoserver/dynamicneko` リポジトリを clone または checkout して読み取れること。
- 同リポジトリ内のファイルを編集し、ローカルブランチへ commit できること。
- GitHub 上の `nekoserver/dynamicneko` へブランチを push し、Pull Request を作成できる権限と認証情報を持つこと。

`dynamicneko` が読み取り専用である場合や、リポジトリへアクセスできない場合は、JSON の生成まで
実施できても、反映、検証、push、Pull Request 作成を含む `/workflow/0021` 全体は正常に完了しません。
着手前にリポジトリアクセスと GitHub の書き込み権限を確認してください。
