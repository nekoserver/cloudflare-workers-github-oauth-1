#!/usr/bin/env python3
"""Codex lifecycle hook: Japanese context and bounded Stop validation. No I/O beyond stdin/stdout."""
import json
import re
import sys

INSTRUCTION = '応答はすべて日本語で書いてください。説明・報告・質問・レビュー・コミットメッセージ・PRのタイトルと本文も日本語にしてください。コード・コマンド・識別子・ファイル名・URLは原文のままで構いません。'

def needs_japanese(text):
    prose = re.sub(r'```[\s\S]*?```|`[^`]*`|https?://\S+', ' ', text)
    japanese = len(re.findall(r'[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f]', prose))
    latin = len(re.findall(r'[A-Za-z]', prose))
    return japanese < 5 and latin >= 30

def respond(payload):
    event = payload.get('hook_event_name')
    if event in ('SessionStart', 'UserPromptSubmit'):
        return {'hookSpecificOutput': {'hookEventName': event, 'additionalContext': INSTRUCTION}}
    if event == 'Stop' and not payload.get('stop_hook_active'):
        reply = payload.get('last_assistant_message')
        if isinstance(reply, str) and needs_japanese(reply):
            return {'decision': 'block', 'reason': '直前の応答を、同じ内容の日本語で書き直してください。コード・識別子・URLはそのままで構いません。'}
    return {}

if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        result = respond(payload) if isinstance(payload, dict) else {}
    except (ValueError, TypeError):
        result = {}
    print(json.dumps(result, ensure_ascii=False))
