/**
 * 画面右下に常時表示する予定カウントダウンウィジェットの共通パーツ。
 * このリポジトリには全ページ共通のレイアウト機構が無く、各ページが独立した
 * HTMLを返す構造のため（他ページには埋め込まず`/countdown`ページのみで使う場合
 * でも）、`getThemeCSS()`/`getThemeToggleHTML()`/`getThemeToggleScript()`
 * (src/utils/theme.ts)と同じ「CSS・HTML・スクリプトをそれぞれ関数で返し、
 * 埋め込みたいページのテンプレートリテラル内で呼び出す」方式で切り出しておく。
 * これにより、この関数さえ呼べば他の任意のページにも同じウィジェットを
 * そのまま追加できる。
 *
 * 依存API: GET /api/countdown/next（ログイン中ユーザーの直近の未来予定を返す）。
 * 認証はページ側のCookie/JWTに乗るため、このモジュール自体は認証情報を持たない。
 */

/** <style>内に展開する、ウィジェット本体のCSS。 */
export function getCountdownWidgetCSS(): string {
  return `
    #countdownWidget {
      position: fixed;
      right: 20px;
      bottom: 20px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      padding: 14px 18px;
      min-width: 200px;
      z-index: 500;
      display: none;
    }
    #countdownWidget.visible { display: block; }
    .widget-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .widget-clock { font-size: 20px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  `;
}

/** <body>内に配置する、ウィジェットのマークアップ。 */
export function getCountdownWidgetHTML(): string {
  return `
  <div id="countdownWidget">
    <div class="widget-label" id="widgetLabel"></div>
    <div class="widget-clock" id="widgetClock">--:--:--</div>
  </div>
  `;
}

/**
 * ウィジェットの挙動(1秒ごとの残り時間表示更新・30秒ごとの/api/countdown/next
 * 再取得)。呼び出し元ページの<script type="module">内にそのまま展開する想定。
 * 呼び出し元のスクリプトが独自に`pad2`等の同名変数を持っていても衝突しないよう、
 * このスクリプト内で完結させ外部のグローバル関数には依存しない。
 */
export function getCountdownWidgetScript(): string {
  return `
    (function() {
      var widget = document.getElementById('countdownWidget');
      var widgetLabel = document.getElementById('widgetLabel');
      var widgetClock = document.getElementById('widgetClock');
      if (!widget || !widgetLabel || !widgetClock) return;
      var nextEvent = null; // { id, label, targetAt }

      function pad2(n) { return String(n).padStart(2, '0'); }

      function formatRemaining(ms) {
        var totalSeconds = Math.max(0, Math.floor(ms / 1000));
        var days = Math.floor(totalSeconds / 86400);
        var hours = Math.floor((totalSeconds % 86400) / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        var clock = pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
        return days > 0 ? (days + '日 ' + clock) : clock;
      }

      function tickWidget() {
        if (!nextEvent) {
          widget.classList.remove('visible');
          return;
        }
        var remaining = new Date(nextEvent.targetAt).getTime() - Date.now();
        if (remaining <= 0) {
          widget.classList.remove('visible');
          fetchNextEvent();
          return;
        }
        widget.classList.add('visible');
        widgetLabel.textContent = nextEvent.label;
        widgetClock.textContent = formatRemaining(remaining);
      }

      function fetchNextEvent() {
        fetch('/api/countdown/next').then(function(res) { return res.json(); }).then(function(data) {
          nextEvent = data.event || null;
          tickWidget();
        }).catch(function() {});
      }

      fetchNextEvent();
      setInterval(tickWidget, 1000);
      setInterval(fetchNextEvent, 30000);
    })();
  `;
}
