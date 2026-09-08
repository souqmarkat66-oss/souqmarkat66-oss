#!/usr/bin/env bash
# Push already-reviewed commits to origin/main without storing credentials in git config.
set -euo pipefail
IFS=$'\n\t'

[ "$(git branch --show-current)" = "main" ] || {
  echo "Refusing push: checkout the main branch first." >&2
  exit 1
}

[ -z "$(git status --porcelain --untracked-files=normal)" ] || {
  echo "Refusing push: commit or discard all working-tree changes first." >&2
  exit 1
}

: "${GITHUB_TOKEN:?GITHUB_TOKEN must be configured in the trusted operator environment}"

askpass="$(mktemp "${TMPDIR:-/tmp}/git-askpass.XXXXXX")"
cleanup() {
  rm -f "$askpass"
}
trap cleanup EXIT
cat >"$askpass" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "$GITHUB_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
chmod 700 "$askpass"

export GIT_ASKPASS="$askpass"
export GIT_TERMINAL_PROMPT=0
git -c credential.helper= fetch --quiet origin main

local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse origin/main)"
merge_base="$(git merge-base HEAD origin/main)"

[ "$merge_base" = "$remote_head" ] || {
  echo "Refusing push: local main is behind or has diverged from origin/main." >&2
  exit 1
}

if [ "$local_head" = "$remote_head" ]; then
  echo "origin/main is already up to date."
  exit 0
fi

git -c credential.helper= push origin HEAD:main
echo "Pushed reviewed commits to origin/main."