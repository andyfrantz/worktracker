#!/usr/bin/env bash
set -euo pipefail

ISSUES_FILE="ISSUES.md"
REPO=""
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage:
  ./create-github-issues.sh [--dry-run] [--repo OWNER/REPO] [ISSUES_FILE]

Examples:
  ./create-github-issues.sh --dry-run
  ./create-github-issues.sh --dry-run --repo andyfrantz/worktracker
  ./create-github-issues.sh --repo andyfrantz/worktracker ISSUES.md
  ./create-github-issues.sh ISSUES.md

Options:
  --dry-run           Parse and print all issues without creating them.
  --repo OWNER/REPO   Explicit GitHub repository. If omitted, gh uses the
                      repository associated with the current directory.
  -h, --help          Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --repo)
      if [[ $# -lt 2 ]]; then
        echo "Error: --repo requires OWNER/REPO." >&2
        exit 1
      fi
      REPO="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      ISSUES_FILE="$1"
      shift
      ;;
  esac
done

if [[ ! -f "$ISSUES_FILE" ]]; then
  echo "Error: $ISSUES_FILE not found." >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI (gh) is not installed." >&2
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "Error: gh is not authenticated. Run: gh auth login" >&2
    exit 1
  fi
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Parse every "## Issue NNN — Title" section. The section ends at the next
# Issue heading or top-level heading.
awk -v dir="$tmpdir" '
  /^## Issue [0-9]+ — / {
    if (body != "") close(body)

    line = $0
    number = line
    sub(/^## Issue /, "", number)
    sub(/ .*/, "", number)

    title = line
    sub(/^## Issue [0-9]+ — /, "", title)

    titlefile = dir "/" number ".title"
    body = dir "/" number ".body"

    print title > titlefile
    close(titlefile)
    next
  }

  /^# / {
    if (body != "") {
      close(body)
      body = ""
    }
    next
  }

  body != "" {
    print $0 > body
  }
' "$ISSUES_FILE"

shopt -s nullglob
title_files=("$tmpdir"/*.title)

if (( ${#title_files[@]} == 0 )); then
  echo "No issues found in $ISSUES_FILE." >&2
  exit 1
fi

# Sort numerically by issue number.
mapfile -t title_files < <(
  printf '%s\n' "${title_files[@]}" |
  sort -t/ -k"$(awk -F/ '{print NF}' <<<"${title_files[0]}")"n
)

echo "Found ${#title_files[@]} issues in $ISSUES_FILE."
if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN: no GitHub issues will be created."
fi
echo

created=0

for titlefile in "${title_files[@]}"; do
  number="$(basename "$titlefile" .title)"
  bodyfile="$tmpdir/$number.body"
  title="$(cat "$titlefile")"

  # Ensure a body file exists even if the section is empty.
  touch "$bodyfile"

  # Trim leading and trailing blank lines portably.
  trimmed="$tmpdir/$number.trimmed"
  awk '
    BEGIN { started = 0; blank_count = 0 }
    {
      if (!started && $0 ~ /^[[:space:]]*$/) next
      started = 1

      if ($0 ~ /^[[:space:]]*$/) {
        blanks[++blank_count] = $0
        next
      }

      for (i = 1; i <= blank_count; i++) print blanks[i]
      delete blanks
      blank_count = 0
      print
    }
  ' "$bodyfile" > "$trimmed"
  mv "$trimmed" "$bodyfile"

  if [[ "$DRY_RUN" == true ]]; then
    echo "============================================================"
    echo "Issue $number"
    echo "Title: $title"
    echo "------------------------------------------------------------"
    cat "$bodyfile"
    echo
    echo
    continue
  fi

  echo "Creating Issue $number: $title"

  args=(issue create --title "$title" --body-file "$bodyfile")
  if [[ -n "$REPO" ]]; then
    args+=(--repo "$REPO")
  fi

  gh "${args[@]}"
  created=$((created + 1))
done

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run complete. ${#title_files[@]} issues parsed; nothing created."
else
  echo
  echo "Done. Created $created GitHub issues."
fi
