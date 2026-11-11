#!/usr/bin/env node
// Claude Codeのフック(.claude/settings.json)。応答を日本語に強制する。ユーザー指定(2026-11-11)。
// 指示を差し込むだけでは英語で答えてしまったことがあるため、2段で行う。
//   - UserPromptSubmit・SessionStart: 日本語で書く指示を標準出力に出す(エージェントの文脈に入る)。
//   - Stop: 直前のユーザー発言より後の応答の文章を調べ、日本語(かな・漢字)がほとんど無ければ
//     終了コード2で止める。標準エラーの内容がエージェントに返り、書き直させる。
// 作業を妨げないため、記録が読めない・壊れている・書き直しの最中(stop_hook_active)のときは止めない。
'use strict';

const fs = require('node:fs');

const INSTRUCTION = [
  'ユーザー指定(2026-11-11): 応答はすべて日本語で書くこと。',
  'ユーザーへの説明・報告・質問、コミットメッセージ、プルリクエストのタイトルと本文、レビューの返信も日本語で書く。',
  'コード・コマンド・識別子・ファイル名・URLはそのままでよい。英語で書いた場合は、Stopフックが止めて書き直しを求める。',
].join('\n');

// これ未満の文字数(コード・URLを除く)の応答は判定しない(「OK」やコマンドだけの返事を止めない)。
const MIN_LATIN_LETTERS = 30;
// かな・漢字がこれ以上あれば日本語の応答とみなす。
const MIN_JAPANESE_CHARS = 5;

function proseOf(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

/** 日本語で書き直させるべき応答か。 */
function needsJapanese(text) {
  const prose = proseOf(text);
  const japanese = (prose.match(/[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/g) || []).length;
  const latin = (prose.match(/[A-Za-z]/g) || []).length;
  return japanese < MIN_JAPANESE_CHARS && latin >= MIN_LATIN_LETTERS;
}

function textBlocks(content) {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text);
}

/** ユーザーが書いた発言か(ツールの結果を返すuser行は除く)。 */
function isUserPrompt(entry) {
  if (!entry || entry.type !== 'user' || !entry.message) return false;
  const content = entry.message.content;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && content.some((b) => b && b.type === 'text');
}

/** 記録(JSONL)から、直前のユーザー発言より後の応答の文章をまとめて返す。読めなければnull。 */
function lastReply(transcriptPath) {
  let raw;
  try { raw = fs.readFileSync(transcriptPath, 'utf8'); } catch { return null; }
  const entries = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* 壊れた行は飛ばす */ }
  }
  const texts = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (isUserPrompt(entry)) break;
    if (entry && entry.type === 'assistant' && entry.message) texts.unshift(...textBlocks(entry.message.content));
  }
  return texts.length ? texts.join('\n') : null;
}

function main() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  const event = input.hook_event_name;
  if (event === 'UserPromptSubmit' || event === 'SessionStart') {
    process.stdout.write(INSTRUCTION + '\n');
    process.exit(0);
  }
  if (event === 'Stop' || event === 'SubagentStop') {
    if (input.stop_hook_active) process.exit(0);
    const reply = typeof input.transcript_path === 'string' ? lastReply(input.transcript_path) : null;
    if (reply && needsJapanese(reply)) {
      process.stderr.write('直前の応答が日本語ではありません。ユーザー指定(2026-11-11)により、同じ内容を日本語で書き直してください(コード・コマンド・識別子・URLはそのままでよい)。\n');
      process.exit(2);
    }
  }
  process.exit(0);
}

if (require.main === module) main();
module.exports = { needsJapanese, lastReply, INSTRUCTION };
