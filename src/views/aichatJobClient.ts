/**
 * AIチャットのジョブのブラウザ側(ページのscriptへ埋め込む)。ユーザー指定(2026-11-07)。
 *
 * 送信は /api/aichat/jobs に登録し、生成とログ保存はDurable Object(AICHAT_JOB)が接続と関係なく行う。
 * ブラウザは /api/aichat/jobs/:jobId?offset=N で途中経過を取りに行くだけ。送信したジョブはlocalStorageに残し、
 * タブを閉じて開き直したときは、残っているジョブを続きから表示する(resumePendingAichatJobs、aichat.ts)。
 *
 * template literalに埋め込むため、バックスラッシュのエスケープと正規表現リテラルを使わない(CLAUDE.md ルール29)。
 */
export const AICHAT_JOB_CLIENT_SCRIPT = `
    var AICHAT_PENDING_JOBS_KEY = 'aichat.pendingJobs';
    // サーバーがジョブを残す期間(AICHAT_JOB_RETENTION_MS)と同じ。
    var AICHAT_PENDING_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    var AICHAT_JOB_POLL_MS = 800;
    var AICHAT_JOB_RETRY_MAX_MS = 5000;
    // ジョブはalarmの上限(15分)で終わる。通信できない状態が続いたときに待つのをやめる時間。
    var AICHAT_JOB_GIVE_UP_MS = 20 * 60 * 1000;

    function readPendingAichatJobs(deps) {
      if (!deps.storage) return [];
      var list;
      try { list = JSON.parse(deps.storage.getItem(AICHAT_PENDING_JOBS_KEY) || '[]'); } catch (e) { return []; }
      if (!Array.isArray(list)) return [];
      var now = deps.now();
      return list.filter(function(job) {
        return job && typeof job.jobId === 'string' && typeof job.createdAt === 'number' && now - job.createdAt <= AICHAT_PENDING_JOB_MAX_AGE_MS;
      });
    }
    function writePendingAichatJobs(deps, list) {
      if (!deps.storage) return;
      try { deps.storage.setItem(AICHAT_PENDING_JOBS_KEY, JSON.stringify(list)); } catch (e) { /* 保存できなくても、このタブでは続けられる */ }
    }
    function removePendingAichatJob(deps, jobId) {
      writePendingAichatJobs(deps, readPendingAichatJobs(deps).filter(function(job) { return job.jobId !== jobId; }));
    }

    /** 送信をジョブとして登録し、ジョブIDを返す。質問はlocalStorageに残し、開き直したときの表示に使う。 */
    function startAichatJob(deps, payload, info) {
      return deps.fetch('/api/aichat/jobs', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(res) {
        return res.json().catch(function() { return {}; }).then(function(data) {
          if (!res.ok || !data || typeof data.jobId !== 'string') throw new Error((data && data.error) || ('AIチャットのジョブを登録できませんでした (HTTP ' + res.status + ')'));
          var list = readPendingAichatJobs(deps);
          list.push({ jobId: data.jobId, question: info.question, model: info.model, createdAt: deps.now() });
          writePendingAichatJobs(deps, list);
          return data.jobId;
        });
      });
    }

    /** 送信したジョブを止める(ユーザー指定 2026-11-12)。止まったかどうかは、続けている pollAichatJob が failed で受け取る。 */
    function cancelAichatJob(deps, jobId) {
      return deps.fetch('/api/aichat/jobs/' + encodeURIComponent(jobId) + '/cancel', { method: 'POST', credentials: 'same-origin' })
        .then(function(res) { if (res.body && res.body.cancel) res.body.cancel(); }, function() {});
    }
    /** 「考え中」の吹き出しにキャンセルボタンを置く。押すのは1回だけ有効。 */
    function addAichatCancelButton(deps, bubble, jobId) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'aichat-job-cancel-btn';
      button.textContent = 'キャンセル';
      button.style.cssText = 'margin-left:8px;padding:2px 10px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:inherit;cursor:pointer;font-size:12px;';
      button.addEventListener('click', function() {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = 'キャンセル中…';
        cancelAichatJob(deps, jobId);
      });
      bubble.appendChild(button);
      return button;
    }

    /** 途中経過を続きの位置から取り、onDeltaへ渡す。完了したら/api/aichatと同じ形の結果を返し、記録を消す。 */
    function pollAichatJob(deps, jobId, onDelta) {
      var offset = 0;
      var startedAt = deps.now();
      var retryMs = AICHAT_JOB_POLL_MS;
      var startMeta = {};
      /** 確定した失敗(404・failed)。記録を消し、取り直しの対象にしない。 */
      function fail(message) {
        removePendingAichatJob(deps, jobId);
        var error = new Error(message);
        error.aichatJobFinal = true;
        throw error;
      }
      function next(waitMs) {
        if (deps.now() - startedAt > AICHAT_JOB_GIVE_UP_MS) {
          return Promise.reject(new Error('応答を待てませんでした。ページを開き直すと、記録が残っていれば表示します'));
        }
        return deps.sleep(waitMs).then(step);
      }
      function step() {
        return deps.fetch('/api/aichat/jobs/' + encodeURIComponent(jobId) + '?offset=' + offset, { credentials: 'same-origin' })
          .then(function(res) {
            if (res.status === 404) fail('応答の記録が見つかりません(期限切れの可能性があります)');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            retryMs = AICHAT_JOB_POLL_MS;
            if (data.start) startMeta = data.start;
            if (data.text) {
              offset += data.text.length;
              onDelta(data.text, startMeta);
            }
            if (data.status === 'done') {
              removePendingAichatJob(deps, jobId);
              return data.result || {};
            }
            if (data.status === 'failed') fail(data.error || 'AIチャットのジョブが失敗しました');
            return next(AICHAT_JOB_POLL_MS);
          }, function(error) {
            // 404・failedは確定した失敗。それ以外(通信の失敗、5xx)は、ジョブ自体は続いているので間隔を空けて取り直す。
            if (error && error.aichatJobFinal) throw error;
            retryMs = Math.min(retryMs * 2, AICHAT_JOB_RETRY_MAX_MS);
            return next(retryMs);
          });
      }
      return step();
    }
`;
