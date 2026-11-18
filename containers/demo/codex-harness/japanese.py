#!/usr/bin/env python3
"""Codex lifecycle hook: Japanese context and bounded Stop validation. No I/O beyond stdin/stdout."""
import json
import re
import sys
from html.parser import HTMLParser

INSTRUCTION = '応答はすべて日本語で書いてください。説明・報告・質問・レビュー・コミットメッセージ・PRのタイトルと本文も日本語にしてください。コード・コマンド・識別子・ファイル名・URLは原文のままで構いません。HTML本文とHTML表示用の参照（visualize等）は日本語への書き直しの対象外です。通常の説明文には日本語を使ってください。'

class OutsideHtml(HTMLParser):
    """HTML本文を除き、外側の通常文だけを言語判定へ渡す。"""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self):
        super().__init__()
        self.stack = []
        self.prose = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            del self.stack[index:]

    def handle_data(self, data):
        if not self.stack:
            self.prose.append(data)

def needs_japanese(text):
    prose = re.sub(r'```[\s\S]*?```|`[^`]*`|https?://\S+', ' ', text)
    prose = re.sub(r'visualize[\s\S]*?', ' ', prose)
    parser = OutsideHtml()
    parser.feed(prose)
    parser.close()
    prose = ' '.join(parser.prose)
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
            return {'decision': 'block', 'reason': '直前の応答を、同じ内容の日本語で書き直してください。コード・識別子・URLはそのままで構いません。HTML本文とHTML表示用の参照は書き直し不要です。'}
    return {}

if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        result = respond(payload) if isinstance(payload, dict) else {}
    except (ValueError, TypeError):
        result = {}
    print(json.dumps(result, ensure_ascii=False))
