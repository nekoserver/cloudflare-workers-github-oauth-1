#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/audit-local-branches.sh [--base <ref>] [--delete-merged]

List local branches that have or have not been incorporated into the base ref.
The command is read-only by default. --delete-merged removes only fully merged
branches; the current branch and main/master are always protected.
EOF
}

base_ref=""
delete_merged=false

while (($#)); do
  case "$1" in
    --base)
      if (($# < 2)); then
        echo "error: --base requires a ref" >&2
        exit 2
      fi
      base_ref=$2
      shift 2
      ;;
    --delete-merged)
      delete_merged=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || {
  echo "error: not inside a Git repository" >&2
  exit 1
}

if [[ -z "$base_ref" ]]; then
  for candidate in origin/main main origin/master master; do
    if git rev-parse --verify --quiet "$candidate^{commit}" >/dev/null; then
      base_ref=$candidate
      break
    fi
  done
fi

if [[ -z "$base_ref" ]] || ! git rev-parse --verify --quiet "$base_ref^{commit}" >/dev/null; then
  echo "error: base ref not found; pass an existing ref with --base" >&2
  exit 1
fi

current_branch=$(git symbolic-ref --quiet --short HEAD || true)
merged_count=0
open_count=0
deleted_count=0

printf 'Base: %s\n' "$base_ref"
printf '%-9s %-7s %-7s %-30s %s\n' STATUS AHEAD BEHIND BRANCH LAST_COMMIT

while IFS= read -r branch; do
  [[ -z "$branch" ]] && continue

  counts=$(git rev-list --left-right --count "$base_ref...refs/heads/$branch")
  behind=${counts%%[[:space:]]*}
  ahead=${counts##*[[:space:]]}
  subject=$(git log -1 --format=%s "refs/heads/$branch")

  if git merge-base --is-ancestor "refs/heads/$branch" "$base_ref"; then
    status=merged
    ((merged_count += 1))
  else
    status=unmerged
    ((open_count += 1))
  fi

  marker=""
  [[ "$branch" == "$current_branch" ]] && marker=" *"
  printf '%-9s %-7s %-7s %-30s %s%s\n' "$status" "$ahead" "$behind" "$branch" "$subject" "$marker"

  if [[ "$delete_merged" == true && "$status" == merged ]]; then
    case "$branch" in
      "$current_branch"|main|master)
        ;;
      *)
        git branch -d -- "$branch" >/dev/null
        printf 'deleted: %s\n' "$branch"
        ((deleted_count += 1))
        ;;
    esac
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads | LC_ALL=C sort)

printf '\nSummary: %d unmerged, %d merged' "$open_count" "$merged_count"
if [[ "$delete_merged" == true ]]; then
  printf ', %d deleted' "$deleted_count"
fi
printf '\n'

if ((open_count > 0)); then
  cat <<'EOF'

Unmerged branches were not modified. Push/create their PR, merge or close the
PR, and rerun this command. Review the diff first with:
  git log --oneline --left-right <base>...<branch>
  git diff <base>...<branch>
EOF
fi
