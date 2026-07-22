#!/usr/bin/env bash
set -euo pipefail

# Deploy the committed Loop OS v1 HEAD without copying local worktree changes.

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$APP_DIR"

while [[ "$REPO_ROOT" != "/" ]] && [[ ! -d "$REPO_ROOT/.git" ]]; do
  REPO_ROOT="$(dirname "$REPO_ROOT")"
done

if [[ ! -d "$REPO_ROOT/.git" ]]; then
  echo "Error: could not find repository root." >&2
  exit 1
fi

HOST="${ALIYUN_HOST:-47.95.199.142}"
USER="${ALIYUN_USER:-root}"
KEY="${ALIYUN_KEY:-$HOME/.ssh/daodecision_aliyun.pem}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/carbon-silicon-org-book}"
APP_NAME="${APP_NAME:-carbon-silicon-loop-designer}"
REMOTE_APP="$REMOTE_ROOT/apps/loop-designer"
PUBLIC_URL="${PUBLIC_URL:-https://csi-org.com/loop-designer/}"
PREWORK_URL="${LOOP_OS_PREWORK_URL:-https://csi-org.com/loop-designer/prework/624}"
STATUS_URL="${LOOP_OS_STATUS_URL:-https://csi-org.com/loop-designer/api/loop-os/status}"
BUILD_MODE="${LOOP_OS_HEAD_BUILD_MODE:-local}"
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)"
ARCHIVE_PATH="$(mktemp -t "loop-os-v1-head-$HEAD_SHA.XXXXXX.tar")"
LOCAL_STAGE=""
REMOTE_ARCHIVE="/tmp/loop-os-v1-head-$HEAD_SHA.tar"
REMOTE_STAGE="$REMOTE_ROOT/.deploy/loop-designer-$HEAD_SHA"

cleanup() {
  rm -f "$ARCHIVE_PATH"
  if [[ -n "$LOCAL_STAGE" ]]; then
    rm -rf "$LOCAL_STAGE"
  fi
}
trap cleanup EXIT

if [[ ! -f "$KEY" ]]; then
  echo "Error: SSH key not found: $KEY" >&2
  exit 1
fi

echo "Deploying Loop OS v1 from committed HEAD $HEAD_SHA"
echo "Repository: $REPO_ROOT"
echo "Remote: $USER@$HOST:$REMOTE_APP"
echo "Build mode: $BUILD_MODE"
echo ""

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "Notice: local worktree has uncommitted changes; they will not be deployed."
fi

if [[ "$BUILD_MODE" == "local" ]]; then
  LOCAL_STAGE="$(mktemp -d -t "loop-os-v1-head-build-$HEAD_SHA.XXXXXX")"
  git -C "$REPO_ROOT" archive HEAD apps/loop-designer packages/types | tar -x -C "$LOCAL_STAGE"
  (
    cd "$LOCAL_STAGE/apps/loop-designer"
    npm ci --no-audit --no-fund
    npm run build
    rm -rf node_modules .next/cache .deploy-package-lock.sha256
  )
  COPYFILE_DISABLE=1 tar --no-xattrs -C "$LOCAL_STAGE" -cf "$ARCHIVE_PATH" apps/loop-designer packages/types
elif [[ "$BUILD_MODE" == "remote" ]]; then
  git -C "$REPO_ROOT" archive \
    --format=tar \
    --output="$ARCHIVE_PATH" \
    HEAD \
    apps/loop-designer \
    packages/types
else
  echo "Error: LOOP_OS_HEAD_BUILD_MODE must be 'local' or 'remote'." >&2
  exit 1
fi

ssh -i "$KEY" "$USER@$HOST" "mkdir -p '$REMOTE_ROOT/.deploy'"
scp -i "$KEY" "$ARCHIVE_PATH" "$USER@$HOST:$REMOTE_ARCHIVE"

ssh -i "$KEY" "$USER@$HOST" \
  "REMOTE_ROOT='$REMOTE_ROOT' REMOTE_APP='$REMOTE_APP' REMOTE_STAGE='$REMOTE_STAGE' REMOTE_ARCHIVE='$REMOTE_ARCHIVE' APP_NAME='$APP_NAME' PUBLIC_URL='$PUBLIC_URL' PREWORK_URL='$PREWORK_URL' STATUS_URL='$STATUS_URL' HEAD_SHA='$HEAD_SHA' bash -s" <<'REMOTE_DEPLOY'
set -euo pipefail

STAGE_APP="$REMOTE_STAGE/apps/loop-designer"
STAGE_TYPES="$REMOTE_STAGE/packages/types"
CURRENT_TYPES="$REMOTE_ROOT/packages/types"
PREV_APP="$REMOTE_ROOT/apps/loop-designer.previous-head-deploy"
PREV_TYPES="$REMOTE_ROOT/packages/types.previous-head-deploy"

run_low_priority() {
  local limit="$1"
  shift
  if command -v ionice >/dev/null 2>&1; then
    timeout "$limit" ionice -c2 -n7 nice -n 10 "$@"
  else
    timeout "$limit" nice -n 10 "$@"
  fi
}

start_app() {
  cd "$REMOTE_APP"
  for env_file in .env.production .env.local; do
    if [[ -f "$env_file" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$env_file"
      set +a
    fi
  done

  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
  else
    pm2 start ecosystem.config.cjs --update-env
  fi
}

rollback() {
  local status=$?
  echo "Remote HEAD-only deployment failed with status $status" >&2
  if [[ -d "$PREV_APP" ]]; then
    rm -rf "$REMOTE_APP"
    mv "$PREV_APP" "$REMOTE_APP"
  fi
  if [[ -d "$PREV_TYPES" ]]; then
    rm -rf "$CURRENT_TYPES"
    mkdir -p "$REMOTE_ROOT/packages"
    mv "$PREV_TYPES" "$CURRENT_TYPES"
  fi
  start_app || true
  exit "$status"
}

rm -rf "$REMOTE_STAGE"
mkdir -p "$REMOTE_STAGE"
tar -xf "$REMOTE_ARCHIVE" -C "$REMOTE_STAGE"
rm -f "$REMOTE_ARCHIVE"

if [[ ! -d "$STAGE_APP" ]]; then
  echo "Missing staged app: $STAGE_APP" >&2
  exit 1
fi

if [[ ! -d "$STAGE_TYPES" ]]; then
  echo "Missing staged package: $STAGE_TYPES" >&2
  exit 1
fi

for env_file in .env.local .env.production; do
  if [[ -f "$REMOTE_APP/$env_file" ]]; then
    cp "$REMOTE_APP/$env_file" "$STAGE_APP/$env_file"
  fi
done

if [[ -d "$REMOTE_APP/node_modules" ]]; then
  cp -a "$REMOTE_APP/node_modules" "$STAGE_APP/node_modules"
fi

if [[ -f "$REMOTE_APP/.deploy-package-lock.sha256" ]]; then
  cp "$REMOTE_APP/.deploy-package-lock.sha256" "$STAGE_APP/.deploy-package-lock.sha256"
fi

SERVER_FILE=".next/standalone/apps/loop-designer/server.js"

cd "$STAGE_APP"
if [[ -f "$SERVER_FILE" ]]; then
  echo "Using locally prebuilt standalone bundle."
else
  LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
  INSTALLED_HASH="$(cat .deploy-package-lock.sha256 2>/dev/null || true)"

  if [[ -d node_modules && "$LOCK_HASH" == "$INSTALLED_HASH" ]]; then
    echo "Dependencies unchanged. Skipping npm ci."
  else
    echo "Installing dependencies..."
    run_low_priority 20m npm ci --no-audit --no-fund --prefer-offline
    echo "$LOCK_HASH" > .deploy-package-lock.sha256
  fi

  echo "Building staged HEAD $HEAD_SHA..."
  run_low_priority 15m npm run build
fi

if [[ ! -f "$SERVER_FILE" ]]; then
  echo "Missing standalone server file: $SERVER_FILE" >&2
  exit 1
fi

mkdir -p "$STAGE_APP/logs" "$REMOTE_ROOT/apps" "$REMOTE_ROOT/packages"

trap rollback ERR

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 stop "$APP_NAME" || true
fi

rm -rf "$PREV_APP" "$PREV_TYPES"
if [[ -d "$REMOTE_APP" ]]; then
  mv "$REMOTE_APP" "$PREV_APP"
fi
if [[ -d "$CURRENT_TYPES" ]]; then
  mv "$CURRENT_TYPES" "$PREV_TYPES"
fi

mv "$STAGE_APP" "$REMOTE_APP"
mv "$STAGE_TYPES" "$CURRENT_TYPES"

start_app
pm2 save

echo "Verifying local app response..."
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3010/loop-designer/ >/dev/null; then
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "App did not respond on 127.0.0.1:3010 after 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

echo "Verifying local Loop OS status route..."
LOCAL_STATUS_CODE="$(curl -sS -o /tmp/loop-os-local-status.json -w '%{http_code}' --max-time 10 http://127.0.0.1:3010/loop-designer/api/loop-os/status || true)"
if [[ "$LOCAL_STATUS_CODE" != "200" && "$LOCAL_STATUS_CODE" != "503" ]]; then
  echo "Unexpected local status route HTTP $LOCAL_STATUS_CODE" >&2
  cat /tmp/loop-os-local-status.json >&2 || true
  exit 1
fi

echo "Verifying local prework questionnaire route..."
LOCAL_PREWORK_CODE="$(curl -sS -o /tmp/loop-os-local-prework.html -w '%{http_code}' --max-time 10 http://127.0.0.1:3010/loop-designer/prework/624 || true)"
if [[ "$LOCAL_PREWORK_CODE" != "200" ]]; then
  echo "Unexpected local prework route HTTP $LOCAL_PREWORK_CODE" >&2
  cat /tmp/loop-os-local-prework.html >&2 || true
  exit 1
fi

rm -rf "$REMOTE_STAGE" "$PREV_APP" "$PREV_TYPES"
pm2 list
REMOTE_DEPLOY

echo "Verifying public app URL..."
PUBLIC_APP_CODE="$(curl -sS -o /tmp/loop-os-public-app.html -w '%{http_code}' --max-time 15 "$PUBLIC_URL" || true)"
if [[ "$PUBLIC_APP_CODE" != "200" && "$PUBLIC_APP_CODE" != "307" && "$PUBLIC_APP_CODE" != "308" ]]; then
  echo "Unexpected public app URL HTTP $PUBLIC_APP_CODE" >&2
  cat /tmp/loop-os-public-app.html >&2 || true
  exit 1
fi

echo "Verifying public prework questionnaire URL..."
PUBLIC_PREWORK_CODE="$(curl -sS -o /tmp/loop-os-public-prework.html -w '%{http_code}' --max-time 15 "$PREWORK_URL" || true)"
if [[ "$PUBLIC_PREWORK_CODE" != "200" ]]; then
  echo "Unexpected public prework URL HTTP $PUBLIC_PREWORK_CODE" >&2
  cat /tmp/loop-os-public-prework.html >&2 || true
  exit 1
fi

echo "Verifying public Loop OS status route..."
PUBLIC_STATUS_CODE="$(curl -sS -o /tmp/loop-os-public-status.json -w '%{http_code}' --max-time 15 "$STATUS_URL" || true)"
if [[ "$PUBLIC_STATUS_CODE" != "200" && "$PUBLIC_STATUS_CODE" != "503" ]]; then
  echo "Unexpected public status route HTTP $PUBLIC_STATUS_CODE" >&2
  cat /tmp/loop-os-public-status.json >&2 || true
  exit 1
fi

echo "Loop OS v1 HEAD deployment finished with status route HTTP $PUBLIC_STATUS_CODE."
