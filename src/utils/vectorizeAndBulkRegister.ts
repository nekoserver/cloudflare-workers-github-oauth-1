/**
 * 「回答文をベクタ化して予備知識キーワードを抽出し、未登録キーワードを
 * 一括で回答文に紐付け登録する」処理をページ非依存の関数として切り出した
 * クライアントサイドスクリプト文字列。answer-graphページ専用だった実装を、
 * 他のページ(画像ギャラリー等)からも同じ処理を再利用できるよう抽象化した。
 *
 * <script>ブロック内に埋め込むと、以下の2関数が使えるようになる:
 *   - vectorizeAnswerAndExtractKeywords(shareId): /api/aichat/vectorize-answer
 *     を呼び、{ status, data } を返すPromiseを返す。
 *   - bulkRegisterUnregisteredKeywords(originShareId, keywords, callbacks):
 *     未登録キーワード配列を1件ずつ順番に回答文へ紐付け登録する。
 *
 * UI(モーダル・チップのハイライト等)は各ページ側の責務のまま据え置き、
 * ここではネットワーク呼び出しと登録ロジックだけを共通化する。
 */
export function getVectorizeAndBulkRegisterScript(): string {
  return `
    function vectorizeAnswerAndExtractKeywords(shareId) {
      return fetch('/api/aichat/vectorize-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ shareId: shareId }),
      }).then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); });
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
    function registerKeywordViaSearchLogFlow(keyword, originShareId) {
      return fetch('/api/aichat/shares/search?q=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var shareIds = (d && d.results ? d.results : []).map(function(r) { return String(r.id); });
          if (originShareId && shareIds.indexOf(String(originShareId)) === -1) {
            shareIds.push(String(originShareId));
          }
          if (!shareIds.length) return;
          return fetch('/api/aichat/search-log/open-modal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ keyword: keyword, shareIds: shareIds }),
          })
            .then(function(r) { return r.json(); })
            .then(function(d2) {
              var newIds = (d2 && d2.entries ? d2.entries : [])
                .filter(function(e) { return e.isNew; })
                .map(function(e) { return e.shareId; });
              if (!newIds.length) return;
              return fetch('/api/aichat/search-log/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ keyword: keyword, shareIds: newIds }),
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
    //   callbacks.onItemDone(index, keyword): 各件の処理完了時(成功/失敗どちらでも)
    //     に呼ばれる(呼び出し元ページでのキャッシュ更新・バッジ更新用)
    // 戻り値はループ完了時にresolveするPromise。
    function bulkRegisterUnregisteredKeywords(originShareId, keywords, callbacks) {
      var onStart = (callbacks && callbacks.onStart) || function() {};
      var onItemDone = (callbacks && callbacks.onItemDone) || function() {};
      var i = 0;
      function step() {
        if (i >= keywords.length) return Promise.resolve();
        onStart(i, keywords[i]);
        return registerKeywordViaSearchLogFlow(keywords[i], originShareId)
          .catch(function() {})
          .then(function() {
            onItemDone(i, keywords[i]);
            i++;
            return step();
          });
      }
      return step();
    }
  `;
}
