/**
 * /welcome の「⏱️ カウントダウンに登録」が POST /api/countdown する処理。
 * どのページからも同じ関数で、ラベルと日時を渡して単発登録する。
 * label は countdown_events の名前で、右下ウィジェットと完了トーストに出る表示名。
 *
 * window.registerCountdownEvent({ label, targetAt, button, confirmNavigate, onSuccess, onError })
 */

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
