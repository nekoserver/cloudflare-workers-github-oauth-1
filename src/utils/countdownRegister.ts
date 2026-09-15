/**
 * /welcome の「⏱️ カウントダウンに登録」ボタンが使う POST /api/countdown
 * 単発登録を、どのページのテンプレートからも同じ関数で呼べるようにしたもの。
 * getCountdownWidgetScript / getCountdownQuickAddModalScript と同じく、
 * 埋め込み用のスクリプト文字列を返す。
 *
 * 公開API: window.registerCountdownEvent({ label, targetAt, button, confirmNavigate, onSuccess, onError })
 * - welcome: confirmNavigate=true で登録後に /countdown へ進むか確認する
 * - /api-keys: confirmNavigate=false。生キーモーダルを消さない
 */

/** APIキー発行時に /countdown へ予約する固定ラベル。 */
export const API_KEY_DEADLINE_LABEL = 'PK期限';

/** /welcome のセッション期限ボタンが使う固定ラベル。 */
export const SESSION_DEADLINE_LABEL = 'セッション有効期限';

/** <script>内に展開する、単発カウントダウン登録の共通処理。 */
export function getCountdownRegisterScript(): string {
  return `
    (function() {
      window.registerCountdownEvent = function(opts) {
        opts = opts || {};
        var label = opts.label;
        var targetAt = opts.targetAt;
        var btn = opts.button || null;
        var confirmNavigate = opts.confirmNavigate === true;
        if (btn) btn.disabled = true;
        return fetch('/api/countdown', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: label, targetAt: targetAt })
        }).then(function(r) {
          return r.json().then(function(data) { return { ok: r.ok, data: data }; });
        }).then(function(res) {
          if (!res.ok) {
            var err = (res.data && res.data.error) ? res.data.error : 'カウントダウンへの登録に失敗しました';
            if (typeof opts.onError === 'function') opts.onError(err);
            else alert(err);
            if (btn) btn.disabled = false;
            return res;
          }
          if (btn) btn.textContent = '✅ 登録しました';
          if (typeof opts.onSuccess === 'function') opts.onSuccess(res.data);
          if (confirmNavigate && confirm('カウントダウンに登録しました。/countdownページを開きますか?')) {
            window.location.href = '/countdown';
          }
          return res;
        }).catch(function() {
          var err = 'カウントダウンへの登録に失敗しました';
          if (typeof opts.onError === 'function') opts.onError(err);
          else alert(err);
          if (btn) btn.disabled = false;
          return { ok: false, data: { error: err } };
        });
      };
    })();
  `;
}
