import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// POST /webhook/github の pull_request イベント処理は、以前は
// `if (pr && slackToken && slackChannel)` という条件でAI要約・DBへの記録
// (ai_summary_log / commit_agent_log / ai_summary_reviews) までまるごと
// Slack設定の有無にゲートしていた。
// Slack依存を減らすため、AI要約とDBへの記録は pr さえあれば常に行い、
// Slackへの実際の投稿(postSlackMessage呼び出し)だけを
// slackToken && slackChannel の条件にする「常時書き込み方式」に変更した。
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

  it('Slackへの実際の投稿(postSlackMessage)だけが slackToken && slackChannel でゲートされている', () => {
    const prSectionIdx = webhookBlock.indexOf("eventType === 'pull_request'");
    const idx = webhookBlock.indexOf('if (slackToken && slackChannel) {', prSectionIdx);
    expect(idx).toBeGreaterThan(-1);
    const block = webhookBlock.slice(idx, idx + 400);
    expect(block).toContain('postSlackMessage(');
  });

  it('Slack投稿ブロックとDB書き込みブロックは同じ階層(if (pr) の直下)にあり、DB書き込みがSlackブロックの内側に入れ子になっていない', () => {
    expect(webhookBlock).toContain('\n        if (slackToken && slackChannel) {\n');
    expect(webhookBlock).toContain('\n        if (db) {\n');
  });

  it('DBへの記録(ai_summary_log / commit_agent_log / ai_summary_reviews)は3件とも書き込まれる', () => {
    expect(webhookBlock).toContain('INSERT INTO ai_summary_log');
    expect(webhookBlock).toContain('INSERT INTO commit_agent_log');
    expect(webhookBlock).toContain('INSERT INTO ai_summary_reviews');
  });

  it('Slack未設定時は「Slack通知のみスキップ」であることをログに残す（DBは継続する旨を明記）', () => {
    expect(webhookBlock).toContain('skipping Slack notification only');
  });

  it('slack_notified はSlackへの投稿が実際に成功した場合のみ1になる（Slack未設定時は0のまま記録される）', () => {
    const slackVarIdx = webhookBlock.indexOf('let slackNotified = false;');
    const gateIdx = webhookBlock.indexOf('if (slackToken && slackChannel) {', slackVarIdx);
    const successIdx = webhookBlock.indexOf('slackNotified = true;', gateIdx);
    const insertIdx = webhookBlock.indexOf('INSERT INTO ai_summary_log', successIdx);
    expect(slackVarIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(slackVarIdx);
    expect(successIdx).toBeGreaterThan(gateIdx);
    expect(insertIdx).toBeGreaterThan(successIdx);
    expect(webhookBlock).toContain('slackNotified ? 1 : 0');
  });
});
