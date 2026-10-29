# GitHub規約ガイドの分類メニューと日本語要約

## 対象と背景

**対象**: `public/github-policy-guide/` の入口と14分類の要約ページ。既に作成した234項目の二値判定文を、リポジトリ適合性の確認という共通の観点で参照できるようにする。

入口の配信パスは `/github-policy-guide/`。本体Workerの既存 `assets = { directory = "./public" }` を利用する。API、認証、D1、コンテナ設定、welcomeのナビゲーションは変更しない。

## 実装前の故障想定と検証設計

**対象**: メニューから要約へ至る静的ファイルの対応、分類データ、URL選択、表示用JavaScript。

| 故障シナリオ | 検出・対処 |
|---|---|
| 分類と要約ディレクトリがずれ、右画面が404になる | 全14リンクと初期iframeの実在ファイルを検証。生成元のslugから両方を生成する |
| 234項目が欠落・重複する | 元IDと分類所属の集合・件数を照合し、不整合時は生成を停止する |
| 元のYes/Noをリポジトリの合否と誤読する | 各要約ページで解答の意味を明示し、証拠・判断の限界を併記する |
| 埋め込んだJavaScriptの構文が壊れる | 全HTMLのscriptをNodeのJavaScriptパーサーで検証する |
| ハッシュから任意の外部URL・パスを右画面へ渡してしまう | 分類IDの許可リストを通し、不明なIDは先頭分類へ戻す |
| JavaScriptを無効にするとページが読めない | aのtargetとiframeのnameを使うネイティブな遷移を基本とし、noscriptでモバイルにもメニューを出す |
| スマートフォンでメニューが使えない | 分類ボタンで開閉、Escapeで閉じてフォーカスを戻す。800px以下では右画面の左余白を解除する |
| ダーク表示で文字・背景・罫線が同化する | 共通テーマと同じ意味別パレットをライト・ダーク両方で定義する。実ブラウザ目視確認は別途必要 |

生成時のデータ不整合は例外で停止し、エラーを標準エラーへ出す。未知のハッシュは有効な先頭分類へ戻す。クライアントに新たな外部API取得処理や例外の握りつぶしを追加しない。

## 変更内容

**対象**: 生成元、生成済みHTML、独立して実行できる軽量テスト。

| ファイル | 内容 |
|---|---|
| `public/github-policy-guide/index.html` | 幅240pxの左分類メニュー、44pxの上部帯、右側の要約iframe |
| `public/github-policy-guide/r*/index.html` | 14の分類別要約、確認観点、必要な証拠、判断の限界、234判定文、公式原文リンク |
| `scripts/github-policy-guide-data.json` | 14分類、元の判定文・解答・根拠、ディレクトリ名、日本語要約の生成元 |
| `scripts/build-github-policy-guide.py` | Python標準ライブラリだけで15の自己完結HTMLを再生成 |
| `scripts/github-policy-guide.check.mjs` | Node標準ライブラリによる8件の軽量検証 |

要約の参照元は [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) と [GitHub Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies)。原文確認日は2026-10-20、利用規約の発効日は2026-04-27。

各HTMLは外部CSS、JavaScript、フォント、CDNに依存しない。分類リンクは同じサイト内のディレクトリを開く。公式原文へのリンクは別タブで開く。入口のハッシュで分類を指定できる。特定リポジトリへの実査・採点・自動違反判定は行わない。

## 検証結果と再実行

**対象**: この変更の軽量検証と、本体Worker全体の既存テスト。

実装前に8件すべてが生成物の不存在で失敗することを確認し、実装後は以下で8件すべて成功した。

```bash
python3 scripts/build-github-policy-guide.py
node --test --test-isolation=none scripts/github-policy-guide.check.mjs
```

全体のVitestは、この環境では依存パッケージが取得されておらず、オフライン実行が `ENOTCACHED` で終了した。完全なリポジトリのcloneも通信制限でできていないため、全体テスト成功とは報告しない。

実ブラウザによる画面表示、ライト／ダークの目視確認、Worker上の実際の配信確認は未実施。Dockerビルドとデプロイは実行していない。

TypeScriptの本体ソースへの変更はないため、新関数のD1カタログ更新は対象外。

## 関連コミット

**対象**: この変更のリモート反映状況。

ユーザーのプルリクエスト作成依頼により、全体テスト未実施を明記して新規ブランチへ反映する。関連コミットはプルリクエストのコミット一覧を参照。マージ・デプロイはこの変更には含めない。
