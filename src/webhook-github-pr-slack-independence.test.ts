import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// POST /webhook/github の pull_request イベント処理は、以前は
// `if (pr && slackToken && slackChannel)` という条件でAI要約・DBへの記録
// (ai_summary_log / commit_agent_log / ai_summary_reviews) までまるごと
// Slack設定の有無にゲートしていた。
// Slack依存を減らすため、AI要約とDBへの記録は pr さえあれば常に行い、
// 実際の通知送信(dispatchNotification呼び出し。NOTIFY_TARGETでSlack/外部Worker
// を切替可能)だけを isNotifyConfigured(prNotifyConfig) の条件にする
// 「常時書き込み方式」に変更した。
// このテストはソーステキストの検証によりその構造を保証する。
// ---------------------------------------------------------------------------

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const webhookBlock = (() => {
  const idx = src.indexOf("app.post('/webhook/github'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe('POST /webhook/github: pull_request イベントのSlack非依存化', () => {
  it('webhookBlock が正しく抽出できている（前提条件）', () => {
    expect(webhookBlock.length).toBeGreaterThan(1000);
    expect(webhookBlock).toContain("eventType === 'pull_request'");
  });

  it('旧: pr と Slack設定の両方をまとめて要求するゲートが存在しない', () => {
    expect(webhookBlock).not.toContain('if (pr && slackToken && slackChannel) {');
  });

  it('新: pr さえあればAI要約・DB記録の処理ブロックに入る', () => {
    expect(webhookBlock).toContain('if (pr) {');
  });

  it('通知先はresolveNotifyConfigで解決し、実際の送信だけがisNotifyConfiguredでゲートされている（NOTIFY_TARGETで切替可能）', () => {
    const prSectionIdx = webhookBlock.indexOf("eventType === 'pull_request'");
    expect(webhookBlock.indexOf('const prNotifyConfig = resolveNotifyConfig(c.env);', prSectionIdx)).toBeGreaterThan(-1);
    const idx = webhookBlock.indexOf('if (isNotifyConfigured(prNotifyConfig)) {', prSectionIdx);
    expect(idx).toBeGreaterThan(-1);
    const block = webhookBlock.slice(idx, idx + 400);
    expect(block).toContain('dispatchNotification(prNotifyConfig, { text: slackPayload.text, blocks: slackPayload.blocks })');
  });

  it('通知送信ブロックとDB書き込みブロックは同じ階層(if (pr) 直下のtryブロック内)にあり、DB書き込みが通知ブロックの内側に入れ子になっていない', () => {
    expect(webhookBlock).toContain('\n          if (isNotifyConfigured(prNotifyConfig)) {\n');
    expect(webhookBlock).toContain('\n          if (db) {\n');
  });

  it('DBへの記録(ai_summary_log / commit_agent_log / ai_summary_reviews)は3件とも書き込まれる', () => {
    expect(webhookBlock).toContain('INSERT INTO ai_summary_log');
    expect(webhookBlock).toContain('INSERT INTO commit_agent_log');
    expect(webhookBlock).toContain('INSERT INTO ai_summary_reviews');
  });

  it('通知先未設定時は「通知のみスキップ」であることをログに残す（DBは継続する旨を明記）', () => {
    expect(webhookBlock).toContain('skipping notification only');
  });

  it('slack_notified は通知の送信が実際に成功した場合のみ1になる（未設定時は0のまま記録される）', () => {
    const slackVarIdx = webhookBlock.indexOf('let slackNotified = false;');
    const gateIdx = webhookBlock.indexOf('if (isNotifyConfigured(prNotifyConfig)) {', slackVarIdx);
    const successIdx = webhookBlock.indexOf('slackNotified = true;', gateIdx);
    const insertIdx = webhookBlock.indexOf('INSERT INTO ai_summary_log', successIdx);
    expect(slackVarIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(slackVarIdx);
    expect(successIdx).toBeGreaterThan(gateIdx);
    expect(insertIdx).toBeGreaterThan(successIdx);
    expect(webhookBlock).toContain('slackNotified ? 1 : 0');
  });

  it('PRコミット取得(fetchLatestPrCommitInfo)の失敗はcommitAgentFetchErrorに保持される（catchでlogger.warnのみに握りつぶさない）', () => {
    const catchIdx = webhookBlock.indexOf("logger.warn('Failed to fetch PR commits for agent detection'");
    expect(catchIdx).toBeGreaterThan(-1);
    const before = webhookBlock.slice(Math.max(0, catchIdx - 200), catchIdx);
    expect(before).toContain('commitAgentFetchError = error;');
  });

  it('commitAgentFetchErrorがある場合、ai_summary_logのINSERTより後にai_summary_reviewsへ診断コメントを記録する（FK違反を避けるため）', () => {
    const aiSummaryLogInsertIdx = webhookBlock.indexOf('INSERT INTO ai_summary_log');
    const commitFetchDiagnosisIdx = webhookBlock.indexOf('classifyCommitAgentFetchError(commitAgentFetchError)');
    expect(aiSummaryLogInsertIdx).toBeGreaterThan(-1);
    expect(commitFetchDiagnosisIdx).toBeGreaterThan(aiSummaryLogInsertIdx);
    const block = webhookBlock.slice(commitFetchDiagnosisIdx, commitFetchDiagnosisIdx + 600);
    expect(block).toContain('INSERT INTO ai_summary_reviews');
    expect(block).toContain("'auto-diagnosis'");
  });

  it('commitAgentFetchErrorがnullの場合は診断INSERTを行わない（if (commitAgentFetchError !== null) でガードされている）', () => {
    expect(webhookBlock).toContain('if (commitAgentFetchError !== null) {');
  });

  it('if (pr) ブロック全体がtry/catchで囲われている（想定外の例外がwebhook_logへの記録に到達する前に握りつぶされないようにするため）', () => {
    const prBlockIdx = webhookBlock.indexOf('if (pr) {');
    expect(prBlockIdx).toBeGreaterThan(-1);
    const afterPrBlock = webhookBlock.slice(prBlockIdx, prBlockIdx + 200);
    expect(afterPrBlock).toContain('if (pr) {\n        try {');
  });

  it('想定外の例外はunexpectedPrErrorとしてcatchされ、webhook_logへstatus=errorで記録される（logger.errorのみに握りつぶさない）', () => {
    const catchIdx = webhookBlock.indexOf('} catch (unexpectedPrError) {');
    expect(catchIdx).toBeGreaterThan(-1);
    const block = webhookBlock.slice(catchIdx, catchIdx + 500);
    expect(block).toContain("logWebhookEvent(c.env.DB, 'github', eventType, 'error'");
    expect(block).toContain('unexpectedPrErrorMessage');
  });
});
