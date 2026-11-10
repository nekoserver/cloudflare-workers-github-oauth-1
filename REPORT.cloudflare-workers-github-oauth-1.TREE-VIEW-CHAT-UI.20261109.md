# tree-viewのMuse画面・切り替え・切り離し時接続（2026-11-09）

公開反映済み。dynamicneko Version `442cccee-9c7c-40b3-b14c-113196fe87df`、本体Worker Version `28186cee-4b5b-4ab6-bf4c-d269bae6adba`。どちらもcontainers-rollout none / keep-varsで反映。Dockerビルド・コンテナ更新・Git pushなし。

設定モーダルの表示を「本体」「経路」「コンテナ」「ワーカー」へ変更した。画面上部にMuse／ワーカーボタンを並べ、選択中を塗りつぶす。新しい会話ボタンとMuseの経路説明ヘッダは撤去し、切り替え時は両画面をマウントしたまま履歴・下書き・送信中の処理を維持する。浮動窓のタイトルバー中央には選択先のMuse／ワーカーを表示し、AIチャットの見出しは表示しない。

Museへの送信直後に入力を空にし、送信文は会話欄に表示する。返信待機中は窓の中心座標と会話欄左下にアイコンを出す。送信失敗時も送信文とエラーを会話側に残し、自動再送・別経路fallbackはしない。入力ラベルは指定どおり「接続中」。入力欄と送信ボタンを同じ下端へ揃え、下に1lhの余白を設けた。右下のアクションボタンは撤去し、切り離し操作は上部へ移した。

切り離しでは、同じworker iframeを保持してconversation-startを既存の認証境界内で通知する。iframeのload／ready後も開始要求を再通知するので、認証後に手動で表示開始を押す必要がない。Museでは既存のowner・同一Origin・署名付きuser capability中継へaction=connectを追加し、選択中の経路のhealthを確認する。切り離しによる推論POST・コンテナの自動起動・他経路への切り替えは行わない。HTTP200でもhealthy=trueでなければ未接続として表示する。

## 検証

根拠: artifacts/tree-view-chat-ui-20261109。

- 新仕様のテストを先に更新し、未実装時の失敗を確認。
- Chrome UI検証はMuse6件とchat window4件が成功。中央見出しと中央ローディングの中心座標、左下ローディング位置、入力欄下の1lh余白、切り替えと履歴保持、即時入力クリア、切り離し時の開始通知・healthのみの要求を含む。
- 同時実行した既存window tabsの1件は初期操作で時間切れとなった。単独再実行では既存の時間制限を変えず2件成功。ui-validation.logは11 passed / 1 failed、window-tabs-isolated.logは2 passed。全体スイート成功とは扱わない。
- dynamicnekoの型検査、server relayのNode検証、Vite本番ビルド成功。
- 本体の関連28テスト成功。接続確認経路の小整理後、route9件を再検証して成功。container経路でhealth以外の推論を送らないことを検証した。
- 公開tree-view?pwa=1は200。正規PWA shellのRefererを付けて取得したindex-ClzImiRd.jsとindex-0mpZN_Mf.cssは200で、ローカル本番ビルドとSHA256一致。

本番ログイン済みtree-viewの操作、iPhone PWA実機、今回変更したUIからのMuse実推論は未確認。ブラウザの送信・health検証は制御した応答を用いる。公開版IDとファイルハッシュは配備の証拠であり、実推論成功の証拠ではない。ページを再読み込みして新UIを読み込む必要がある。

## 後続: Typewriter待機表示・吹き出し・送信ボタン枠の点滅

2026-11-09、dynamicneko Version `5386105d-cb99-4d7f-9c15-550d4b8bda91`へcontainers-rollout none/keep-varsで公開。本体Workerの追加変更・配備なし。

待機中の左下アイコンに「Museの応答を待っています」のTypewriter表示を添え、既存Composerと同じ60ms/文字・約7秒の繰り返しとカーソル点滅を適用した。中央/左下のアイコンは維持。返信受信/失敗時に待機表示を消す。送信文は応答前から右寄せの吹き出しに表示し、返信は左寄せの吹き出しに表示する。改行を保持し、新着文の位置へ会話欄内で自動スクロールする。返信到着時に送信文を重複させない。送信ボタンは処理中だけ枠線が点滅し、成功・失敗どちらでも停止する。二重送信の抑止を維持。動きを減らすOS設定では全文/枠色を静止表示する。

未実装時の回帰失敗を確認してから修正。Chrome2ファイル9テスト成功。文字の段階表示・受信後の非表示、即時送信吹き出し・左右配置・長文自動スクロール・重複防止、待機中の枠線animation/aria-busyと失敗後/成功後の停止を検証。型検査とVite本番ビルド成功。公開index-BrHGhohA.jsとindex-D1I-Fn5V.cssは200、検証ビルドとSHA256一致。根拠はartifacts/muse-chat-polish-20261109。制御したAPI応答によるブラウザ検証で、今回のUIからの本番Muse実推論は未実施。Dockerビルド・コンテナ更新・Git pushなし。
