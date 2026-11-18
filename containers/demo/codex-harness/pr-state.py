#!/usr/bin/env python3
"""Codex PreToolUse hook: do not create a PR from a branch with a prior PR."""
import json
import os
import re
import subprocess
import sys

CREATE_PR = re.compile(r"(?:^|[;&|]\s*)gh\s+pr\s+create(?:\s|$)")


def respond(payload):
    if payload.get("hook_event_name") != "PreToolUse":
        return {}
    if payload.get("tool_name") != "Bash":
        return {}
    tool_input = payload.get("tool_input")
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    if not isinstance(command, str) or not CREATE_PR.search(command):
        return {}

    cwd = payload.get("cwd")
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()

    def run(args):
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=15)

    branch = run(["git", "branch", "--show-current"])
    if branch.returncode or not branch.stdout.strip():
        return {"decision": "block", "reason": "現在のGitブランチを特定できないため、PR作成を止めました。ブランチを確認してください。"}
    branch_name = branch.stdout.strip()

    try:
        prs = run([
            "gh", "pr", "list", "--state", "all", "--head", branch_name,
            "--limit", "1000", "--json", "number,state,url,headRefName,baseRefName,mergedAt",
        ])
    except (OSError, subprocess.TimeoutExpired):
        return {"decision": "block", "reason": "GitHub上の既存PRを確認できないため、PR作成を止めました。ghの認証と接続を確認してください。"}
    if prs.returncode:
        return {"decision": "block", "reason": "GitHub上の既存PRを確認できませんでした。ghの認証と接続を確認してから再試行してください。"}
    try:
        rows = json.loads(prs.stdout)
        if not isinstance(rows, list):
            raise ValueError("PR list is not an array")
    except (ValueError, TypeError):
        return {"decision": "block", "reason": "GitHubのPR一覧を読み取れないため、重複作成を避けて停止しました。"}

    matches = [row for row in rows if isinstance(row, dict) and row.get("headRefName") == branch_name]
    closed = [row for row in matches if row.get("state") in ("CLOSED", "MERGED") or row.get("mergedAt")]
    if closed:
        refs = ", ".join(
            f"#{row.get('number')} ({'マージ済み' if row.get('mergedAt') or row.get('state') == 'MERGED' else 'クローズ済み'})"
            for row in closed
        )
        return {
            "decision": "block",
            "reason": f"このブランチには過去のPR {refs} があります。同じPRを再利用せず、最新のデフォルトブランチから新しいブランチを作り、未反映の必要な差分だけを移してから、新しい番号のPRを作成してください。",
        }
    opened = [row for row in matches if row.get("state") == "OPEN"]
    if opened:
        refs = ", ".join(f"#{row.get('number')} {row.get('url', '')}".strip() for row in opened)
        return {
            "decision": "block",
            "reason": f"このブランチにはオープン中のPR {refs} があります。新しいPRを重複作成せず、既存PRを更新してください。",
        }
    return {}


if __name__ == "__main__":
    try:
        event = json.load(sys.stdin)
        result = respond(event) if isinstance(event, dict) else {}
    except (ValueError, TypeError):
        result = {}
    print(json.dumps(result, ensure_ascii=False))
