/** シグナル送信(Museの死活確認)の既定の間隔(秒)。 */
export const AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS = 600;
const AICHAT_MUSE_SIGNAL_MIN_SECONDS = 60;
const AICHAT_MUSE_SIGNAL_MAX_SECONDS = 86_400;

/**
 * /aichatのページscriptへ埋め込む、Museの死活確認と設定モーダル。ページ本体のscriptは
 * 動作を検証しにくいので、依存を受け取る関数に分けてaichatMuseHealth.test.tsで動かす。
 *
 * Museを選択中かつシグナル送信がONの間だけ信号を送り、稼働中なら入力窓の枠をMuseの色に
 * する。確認の途中で選択や設定が変わったら、古い応答は捨てる(generationが一致しない)。
 * 設定はパラメータ調整と同じくCookieに保存する(ブラウザごと)。
 */
export const AICHAT_MUSE_HEALTH_SCRIPT = `
    var AICHAT_MUSE_SIGNAL_COOKIE = 'aichat_muse_signal';
    var AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS = ${AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS};
    var AICHAT_MUSE_SIGNAL_MIN_SECONDS = ${AICHAT_MUSE_SIGNAL_MIN_SECONDS};
    var AICHAT_MUSE_SIGNAL_MAX_SECONDS = ${AICHAT_MUSE_SIGNAL_MAX_SECONDS};

    function isValidMuseSignalSeconds(seconds) {
      return typeof seconds === 'number' && Math.floor(seconds) === seconds
        && seconds >= AICHAT_MUSE_SIGNAL_MIN_SECONDS && seconds <= AICHAT_MUSE_SIGNAL_MAX_SECONDS;
    }

    function normalizeMuseSignalSettings(value) {
      var settings = (value && typeof value === 'object') ? value : {};
      return {
        transport: settings.transport === 'worker' ? 'worker' : 'container',
        enabled: settings.enabled !== false,
        intervalSeconds: isValidMuseSignalSeconds(settings.intervalSeconds) ? settings.intervalSeconds : AICHAT_MUSE_SIGNAL_DEFAULT_SECONDS
      };
    }

    function readMuseSignalSettings(cookieText) {
      var prefix = AICHAT_MUSE_SIGNAL_COOKIE + '=';
      var parts = String(cookieText || '').split(';');
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.indexOf(prefix) !== 0) continue;
        try {
          return normalizeMuseSignalSettings(JSON.parse(decodeURIComponent(part.slice(prefix.length))));
        } catch (e) {
          break;
        }
      }
      return normalizeMuseSignalSettings(null);
    }

    function writeMuseSignalSettings(settings) {
      document.cookie = AICHAT_MUSE_SIGNAL_COOKIE + '=' + encodeURIComponent(JSON.stringify(settings)) + '; path=/; max-age=' + (60 * 60 * 24 * 365) + '; SameSite=Lax';
    }

    function clearMuseSignalSettings() {
      document.cookie = AICHAT_MUSE_SIGNAL_COOKIE + '=; path=/; max-age=0; SameSite=Lax';
    }

    function createMuseHealthWatch(options) {
      var selected = null;
      var timer = null;
      var generation = 0;
      var lastCheckAt = null;
      var submissionPending = false;
      var warnedUnavailable = false;
      function applyHealth(healthy) {
        if (!isActive()) return;
        options.setBorderColor(healthy ? options.getColor() : '');
        if (healthy) warnedUnavailable = false;
        else if (!warnedUnavailable) {
          warnedUnavailable = true;
          if (options.notifyUnavailable) options.notifyUnavailable('Tailscaleの接続状況を確認してください');
        }
      }
      function isActive() {
        return selected === 'muse' && options.getSettings().enabled;
      }
      function check() {
        if (!isActive() || options.isHidden() || submissionPending) return;
        lastCheckAt = Date.now();
        var current = ++generation;
        options.fetchHealth().then(function(healthy) {
          if (current === generation) applyHealth(healthy);
        }).catch(function() {
          if (current === generation) applyHealth(false);
        });
      }
      function restart() {
        generation += 1;
        submissionPending = false;
        warnedUnavailable = false;
        clearInterval(timer);
        timer = null;
        lastCheckAt = null;
        options.setBorderColor('');
        if (!isActive()) return;
        check();
        timer = setInterval(check, options.getSettings().intervalSeconds * 1000);
      }
      return {
        setModel: function(model) {
          if (model === selected) return;
          selected = model;
          restart();
        },
        applySettings: restart,
        beginSubmission: function() {
          submissionPending = true;
          generation += 1;
          options.setBorderColor('');
        },
        finishSubmission: function(connected) {
          submissionPending = false;
          generation += 1;
          lastCheckAt = Date.now();
          options.setBorderColor('');
          if (connected) check();
          else applyHealth(false);
        },
        // タブが表示に戻ったとき用。行き来するたびに送らないよう、間隔が空いたときだけ確認する。
        checkIfDue: function() {
          if (!isActive()) return;
          if (lastCheckAt !== null && Date.now() - lastCheckAt < options.getSettings().intervalSeconds * 1000) return;
          check();
        }
      };
    }

    function openMuseSignalModal(options) {
      var current = options.getSettings();
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;';
      overlay.style.zIndex = String(options.getNextZ());
      function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:10px;padding:20px;min-width:280px;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.22);';
      var title = document.createElement('div');
      title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:14px;';
      title.textContent = 'Muse の接続・シグナル設定';
      box.appendChild(title);

      var enabledField = document.createElement('div');
      enabledField.className = 'aichat-tune-field';
      var enabledLabel = document.createElement('label');
      enabledLabel.style.justifyContent = 'flex-start';
      enabledLabel.style.gap = '8px';
      enabledLabel.style.cursor = 'pointer';
      var enabledInput = document.createElement('input');
      enabledInput.type = 'checkbox';
      enabledInput.checked = current.enabled;
      enabledLabel.appendChild(enabledInput);
      enabledLabel.appendChild(document.createTextNode('シグナル送信'));
      enabledField.appendChild(enabledLabel);
      box.appendChild(enabledField);

      var intervalField = document.createElement('div');
      intervalField.className = 'aichat-tune-field';
      var intervalLabel = document.createElement('label');
      intervalLabel.textContent = '送信間隔（秒）';
      var intervalInput = document.createElement('input');
      intervalInput.type = 'number';
      intervalInput.min = String(AICHAT_MUSE_SIGNAL_MIN_SECONDS);
      intervalInput.max = String(AICHAT_MUSE_SIGNAL_MAX_SECONDS);
      intervalInput.step = '1';
      intervalInput.value = String(current.intervalSeconds);
      intervalInput.disabled = !current.enabled;
      intervalLabel.appendChild(intervalInput);
      intervalField.appendChild(intervalLabel);
      var intervalError = document.createElement('div');
      intervalError.style.cssText = 'color:#dc2626;font-size:11px;margin-top:4px;';
      intervalField.appendChild(intervalError);
      box.appendChild(intervalField);
      var routeField = document.createElement('fieldset');
      var routeTitle = document.createElement('legend');
      routeTitle.textContent = 'Muse + Tailscale の接続方式';
      routeField.appendChild(routeTitle);
      var routeInputs = {};
      var selectedTransport = current.transport === 'worker' ? 'worker' : 'container';
      [['container', 'コンテナから直接（デフォルト）'], ['worker', 'Worker内WASM']].forEach(function(entry) {
        var label = document.createElement('label');
        label.style.cssText = 'display:block;margin:8px 0;';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('data-muse-transport', entry[0]);
        input.checked = selectedTransport === entry[0];
        routeInputs[entry[0]] = input;
        input.addEventListener('change', function() {
          selectedTransport = entry[0];
          Object.keys(routeInputs).forEach(function(key) { routeInputs[key].checked = key === selectedTransport; });
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(entry[1]));
        routeField.appendChild(label);
      });
      var routeNote = document.createElement('p');
      routeNote.textContent = '接頭語なしでMuseへ送る場合に適用します。接続できない場合は送信を停止します。';
      routeNote.style.cssText = 'font-size:12px;';
      routeField.appendChild(routeNote);
      box.appendChild(routeField);
      enabledInput.addEventListener('change', function() {
        intervalInput.disabled = !enabledInput.checked;
        intervalError.textContent = '';
      });

      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;margin-top:4px;';
      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.textContent = 'デフォルトに戻す';
      resetBtn.style.cssText = 'flex:1;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;';
      resetBtn.addEventListener('click', function() {
        options.resetSettings();
        close();
      });
      var saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = '保存';
      saveBtn.style.cssText = 'flex:1;padding:8px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;cursor:pointer;font-size:12px;font-weight:600;';
      saveBtn.addEventListener('click', function() {
        var seconds = intervalInput.value === '' ? NaN : Number(intervalInput.value);
        if (!isValidMuseSignalSeconds(seconds)) {
          if (enabledInput.checked) {
            intervalError.textContent = AICHAT_MUSE_SIGNAL_MIN_SECONDS + '〜' + AICHAT_MUSE_SIGNAL_MAX_SECONDS + 'の整数で入力してください';
            return;
          }
          // OFFのときは入力が無効で直せないので、元の間隔を残す。
          seconds = current.intervalSeconds;
        }
        options.saveSettings({ enabled: enabledInput.checked, intervalSeconds: seconds, transport: selectedTransport });
        close();
      });
      btnRow.appendChild(resetBtn);
      btnRow.appendChild(saveBtn);
      box.appendChild(btnRow);

      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
    }
`;
