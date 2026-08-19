/**
 * 「回答文をベクタ化して予備知識キーワードを抽出し、未登録キーワードを
 * 一括で回答文に紐付け登録する」処理をページ非依存の関数として切り出した
 * クライアントサイドスクリプト文字列。answer-graphページ専用だった実装を、
 * 他のページ(画像ギャラリー等)からも同じ処理を再利用できるよう抽象化した。
 *
 * <script>ブロック内に埋め込むと、以下の2関数が使えるようになる:
 *   - vectorizeAnswerAndExtractKeywords(shareId, model): /api/aichat/vectorize-answer
 *     を呼び、{ status, data } を返すPromiseを返す。modelは埋め込みモデル名
 *     (省略時はサーバー側のデフォルト(plamo-embedding-1b)が使われる)。
 *     サーバー無応答が長時間続く場合に画面が固まって見える不具合を防ぐため、
 *     クライアント側でも一定時間(VECTORIZE_FETCH_TIMEOUT_MS)で打ち切り、
 *     タイムアウトを明示するエラーとして返す。
 *   - bulkRegisterUnregisteredKeywords(originShareId, keywords, callbacks):
 *     未登録キーワード配列を1件ずつ順番に回答文へ紐付け登録する。
 *
 * UI(モーダル・チップのハイライト等)は各ページ側の責務のまま据え置き、
 * ここではネットワーク呼び出しと登録ロジックだけを共通化する。
 */
export function getVectorizeAndBulkRegisterScript(): string {
  return `
    var VECTORIZE_FETCH_TIMEOUT_MS = 30000;

    function vectorizeAnswerAndExtractKeywords(shareId, model) {
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timedOut = false;
      var timer = controller ? setTimeout(function() { timedOut = true; controller.abort(); }, VECTORIZE_FETCH_TIMEOUT_MS) : null;
      var body = { shareId: shareId };
      if (model) body.model = model;
      return fetch('/api/aichat/vectorize-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      })
        .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
        .catch(function(err) {
          if (timedOut) {
            return { status: 0, data: { error: 'ベクタ化処理が' + (VECTORIZE_FETCH_TIMEOUT_MS / 1000) + '秒以内に応答しませんでした(タイムアウト)。時間をおいて再度お試しください。' } };
          }
          throw err;
        })
        .finally(function() { if (timer) clearTimeout(timer); });
    }

    // 根本原因: gemmaが抽出する予備知識キーワードは、回答文中の文字列と
    // 完全一致するとは限らない(要約・言い換え・画像の内容を説明する語句等)。
    // 従来はサイドバー検索窓と同じテキスト検索(INSTR)でヒットした回答文
    // だけを登録対象にしていたため、抽出元の回答文自体がテキスト検索で
    // ヒットしない場合は0件のまま何も登録されず、「一括登録を押しても
    // 何も起きない」ように見える不具合になっていた(特に、画像添付投稿は
    // 回答文が短い相槌程度で、画像の内容を表すキーワードが本文中に
    // 現れないことが多く発生しやすい)。抽出元のshareId(originShareId)を
    // 検索結果に関わらず必ず対象へ含めることで、少なくとも「このキーワードを
    // 抽出したその回答文」には確実に紐付けられるようにする。
    // 根本原因(その2): 従来はここのfetchチェーンがどのステップも
    // response.ok/レスポンスボディのok・errorフィールドを一切確認して
    // いなかったため、サーバー側がHTTPエラーやエラーJSON({ok:false,error:...})
    // を返しても例外を投げず、呼び出し元(bulkRegisterUnregisteredKeywords)からは
    // 常に「成功した」ようにしか見えなかった。これにより「一括登録」ボタンは
    // 全件「登録完了」と表示するのに、実際にはDBへ書き込まれていないキーワードが
    // 残り、後で「キーワード一覧」を開き直す(=クライアント側キャッシュではなく
    // サーバーへ再問い合わせする)と未登録のまま表示される不具合になっていた。
    // 各ステップでHTTPステータス・エラーフィールドを検査し、失敗時は例外を
    // 投げて呼び出し元に伝播させる(CLAUDE.mdルール8: 握りつぶすなら記録・
    // 通知・テストの3つを満たすこと)。
    function registerKeywordViaSearchLogFlow(keyword, originShareId) {
      return fetch('/api/aichat/shares/search?q=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
        .then(function(r) {
          if (!r.ok) throw new Error('キーワード検索に失敗しました(HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function(d) {
          var shareIds = (d && d.results ? d.results : []).map(function(r) { return String(r.id); });
          if (originShareId && shareIds.indexOf(String(originShareId)) === -1) {
            shareIds.push(String(originShareId));
          }
          if (!shareIds.length) return true;
          return fetch('/api/aichat/search-log/open-modal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ keyword: keyword, shareIds: shareIds }),
          })
            .then(function(r) {
              if (!r.ok) throw new Error('登録候補の取得に失敗しました(HTTP ' + r.status + ')');
              return r.json();
            })
            .then(function(d2) {
              var newIds = (d2 && d2.entries ? d2.entries : [])
                .filter(function(e) { return e.isNew; })
                .map(function(e) { return e.shareId; });
              if (!newIds.length) return true;
              return fetch('/api/aichat/search-log/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ keyword: keyword, shareIds: newIds }),
              })
                .then(function(r) {
                  if (!r.ok) throw new Error('登録の保存に失敗しました(HTTP ' + r.status + ')');
                  return r.json();
                })
                .then(function(d3) {
                  if (d3 && d3.ok === false) throw new Error(d3.error || '登録の保存に失敗しました');
                  return true;
                });
            });
        });
    }

    // 未登録キーワードの配列を1件ずつ順番に紐付け登録する。
    //   originShareId: これらのキーワードを抽出した回答文のshareId
    //     (常に登録対象へ含められる。詳細はregisterKeywordViaSearchLogFlow参照)
    //   keywords: 未登録キーワードの文字列配列
    //   callbacks.onStart(index, keyword): 各件の処理開始時に呼ばれる
    //     (呼び出し元ページでの進捗ハイライト用)
    //   callbacks.onItemDone(index, keyword, success): 各件の処理完了時
    //     (成功/失敗どちらでも)に呼ばれる。successはregisterKeywordViaSearchLogFlow
    //     が実際にサーバーへの登録まで完了できたかどうかを表す真偽値。
    //     呼び出し元は、successがfalseの場合にキャッシュを楽観的に更新
    //     しない(=未登録のまま扱う)こと。1件の失敗で全体のループを
    //     止めない(既存の要件どおり)が、失敗そのものは呼び出し元へ
    //     必ず伝える(CLAUDE.mdルール8: 握りつぶさない)。
    // 戻り値はループ完了時にresolveするPromise。
    function bulkRegisterUnregisteredKeywords(originShareId, keywords, callbacks) {
      var onStart = (callbacks && callbacks.onStart) || function() {};
      var onItemDone = (callbacks && callbacks.onItemDone) || function() {};
      var i = 0;
      function step() {
        if (i >= keywords.length) return Promise.resolve();
        onStart(i, keywords[i]);
        return registerKeywordViaSearchLogFlow(keywords[i], originShareId)
          .then(function() { return true; })
          .catch(function() { return false; })
          .then(function(success) {
            onItemDone(i, keywords[i], success);
            i++;
            return step();
          });
      }
      return step();
    }
  `;
}
