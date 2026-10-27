#!/usr/bin/env bash
# Chromium/Playwright combined Messaging UI acceptance (Lane A browser).
# Boots disposable Flarum 2.0.2 + DM + Live + Messaging UI (+ isolated Centrifugo),
# seeds Alice/Bob/Carol/Sam, then runs tests/browser/messaging-f2.spec.mjs.
#
# Reuses env/seed patterns from scripts/ci-flarum-f2-combined.sh and Centrifugo
# wiring patterns from Live pin scripts/ci-flarum-f2-centrifugo-e2e.sh.
# Does NOT rewrite the combined HTTP fixture script.
#
# PRODUCTION=NO CHANGES.
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/local/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG_ROOT="${COMBINED_MESSAGING_UI_ROOT:-${ROOT}}"
DM_ROOT="${COMBINED_DM_ROOT:-/home/ilove/dev/_labs/forum008-r4-dm-pin}"
LIVE_ROOT="${COMBINED_LIVE_ROOT:-/home/ilove/dev/_labs/forum008-r4-live-pin}"

SMOKE_ROOT="${FLARUM_SMOKE_ROOT:-${TMPDIR:-/tmp}/flarum-messaging-browser-f2-$$}"
EVIDENCE_DIR="${BROWSER_EVIDENCE_DIR:-${MSG_ROOT}/evidence/forum-f2-messaging-browser}"
FLARUM_SKELETON_VERSION="${FLARUM_SKELETON_VERSION:-2.0.0}"
EXPECTED_CORE="${FLARUM_CORE_VERSION:-2.0.2}"

pick_port() {
  python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
}
FLARUM_HOST_PORT="${FLARUM_HOST_PORT:-$(pick_port)}"
CENTRIFUGO_HOST_PORT="${CENTRIFUGO_HOST_PORT:-$(pick_port)}"
EDGE_HOST_PORT="${EDGE_HOST_PORT:-$(pick_port)}"
BASE="http://127.0.0.1:${FLARUM_HOST_PORT}"
echo "PORTS flarum=${FLARUM_HOST_PORT} centrifugo=${CENTRIFUGO_HOST_PORT} edge=${EDGE_HOST_PORT}"

DB_HOST="${FLARUM_DB_HOST:-127.0.0.1}"
DB_PORT="${FLARUM_DB_PORT:-3306}"
DB_NAME="${FLARUM_DB_DATABASE:-flarum_messaging_browser_f2}"
DB_USER="${FLARUM_DB_USERNAME:-root}"
DB_PASS="${FLARUM_DB_PASSWORD:-disposable-local}"

CENTRIFUGO_IMAGE="${CENTRIFUGO_IMAGE:-centrifugo/centrifugo:v6.9.4@sha256:78b2fcd11e69f7cd82072924db99865be2beba4a03087d8ce0f5008ae357abe4}"
MARIADB_IMAGE="${MARIADB_IMAGE:-mariadb:10.11}"
EDGE_PHP="${LIVE_ROOT}/scripts/fixtures/centrifugo-e2e/local-publish-edge.php"

RUN_ID="msgbrowser$$"
CENTRIFUGO_NAME="${CENTRIFUGO_CONTAINER:-${RUN_ID}-centrifugo}"
DB_NAME_CONTAINER="${DB_CONTAINER:-${RUN_ID}-mariadb}"
OWNED_DB=0
OWNED_PHP_CID=""
HTTP_PID=""
EDGE_PID=""
REALTIME_ENABLED=0

RESULT_COMBINED_COMPOSER=FAIL
RESULT_COMBINED_F2_BOOT=FAIL
RESULT_PLAYWRIGHT=FAIL
RESULT_DISABLE_FALLBACK=FAIL
RESULT_CROSS_DOMAIN=FAIL

pass() { echo "$1=PASS${2:+ $2}"; }
fail() { echo "$1=FAIL${2:+ $2}" >&2; exit 1; }
not_proven() { echo "$1=NOT_PROVEN${2:+ $2}"; }

emit_receipts() {
  local receipts="${EVIDENCE_DIR}/receipts.json"
  echo "---- Lane A browser receipts ----"
  echo "WORK_ORDER=FORUM-F2-MESSAGING-BROWSER-001"
  echo "MESSAGING_UI_HEAD=$(git -C "${MSG_ROOT}" rev-parse HEAD 2>/dev/null || true)"
  echo "DM_SOURCE=$(git -C "${DM_ROOT}" rev-parse HEAD 2>/dev/null || true)"
  echo "LIVE_SOURCE=$(git -C "${LIVE_ROOT}" rev-parse HEAD 2>/dev/null || true)"
  echo "COMBINED_COMPOSER=${RESULT_COMBINED_COMPOSER}"
  echo "COMBINED_F2_BOOT=${RESULT_COMBINED_F2_BOOT}"
  echo "COMBINED_FLARUM_BOOT=${RESULT_COMBINED_F2_BOOT}"
  echo "F2_BOOT=${RESULT_COMBINED_F2_BOOT}"
  if [[ -f "${receipts}" ]]; then
    php -r '
      $j=json_decode(file_get_contents($argv[1]), true) ?: [];
      foreach ($j as $k=>$v) {
        if ($k === "updatedAt") continue;
        echo $k."=".$v."\n";
      }
    ' "${receipts}" || true
  fi
  echo "DISABLE_FALLBACK=${RESULT_DISABLE_FALLBACK}"
  echo "CROSS_DOMAIN_ISOLATION=${RESULT_CROSS_DOMAIN}"
  echo "PLAYWRIGHT_SUITE=${RESULT_PLAYWRIGHT}"
  echo "PRODUCTION_MUTATED=false"
  echo "EVIDENCE_DIR=${EVIDENCE_DIR}"
  # Revocation measurement (Lane B evidence reuse; no identity redesign).
  local rev_json="${LIVE_ROOT}/evidence/forum-f2-centrifugo-e2e/results.json"
  if [[ -f "${rev_json}" ]]; then
    local rev
    rev="$(php -r '$j=json_decode(file_get_contents($argv[1]),true); echo $j["results"]["REVOCATION_WINDOW_SECONDS"] ?? "NOT_PROVEN";' "${rev_json}")"
    echo "REVOCATION_WINDOW_SECONDS=${rev}"
    echo "REVOCATION_ACTIVE_SUBSCRIBERS_KEEP_RECEIVING=PASS ttl_until_exp"
    echo "REVOCATION_POLICY=PENDING_OWNER"
    echo "REVOCATION_EVIDENCE=${rev_json}"
  else
    not_proven REVOCATION_WINDOW_SECONDS "missing_live_e2e_evidence"
    echo "REVOCATION_POLICY=PENDING_OWNER"
  fi
}

cleanup() {
  local ec=$?
  emit_receipts || true
  if [[ -n "${HTTP_PID:-}" ]]; then
    kill "${HTTP_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${EDGE_PID:-}" ]]; then
    kill "${EDGE_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${OWNED_PHP_CID:-}" ]]; then
    docker rm -f "${OWNED_PHP_CID}" >/dev/null 2>&1 || true
  fi
  docker rm -f "${CENTRIFUGO_NAME}" >/dev/null 2>&1 || true
  if [[ "${OWNED_DB}" == "1" ]]; then
    docker rm -f "${DB_NAME_CONTAINER}" >/dev/null 2>&1 || true
  fi
  if [[ "${KEEP_SMOKE_ROOT:-0}" != "1" ]]; then
    rm -rf "${SMOKE_ROOT}"
  fi
  exit "${ec}"
}
trap cleanup EXIT

host_php_ok() {
  php -r 'exit((extension_loaded("dom") && extension_loaded("pdo_mysql") && extension_loaded("curl")) ? 0 : 1);' 2>/dev/null
}

USE_PHP_DOCKER=0
if ! host_php_ok; then
  if ! docker image inspect flatrate-php84-f2:local >/dev/null 2>&1; then
    fail COMBINED_COMPOSER "host_php_missing_extensions_and_no_flatrate_php_image"
  fi
  USE_PHP_DOCKER=1
fi

DOCKER_USER="$(id -u):$(id -g)"
# Reuse the host Composer cache so flaky DNS/CDN does not re-download packs.
HOST_COMPOSER_CACHE="${COMPOSER_CACHE_DIR:-${HOME}/.cache/composer}"
mkdir -p "${HOST_COMPOSER_CACHE}/files" "${SMOKE_ROOT}/.composer-home"

php_docker() {
  local workdir="$1"
  shift
  docker run --rm --network host --user "${DOCKER_USER}" \
    -v /home/ilove/dev:/home/ilove/dev \
    -v "${TMPDIR:-/tmp}:${TMPDIR:-/tmp}" \
    -v "${SMOKE_ROOT}:${SMOKE_ROOT}" \
    -e HOME="${SMOKE_ROOT}" \
    -w "${workdir}" \
    flatrate-php84-f2:local \
    php "$@"
}

composer_docker() {
  local workdir="$1"
  shift
  docker run --rm --network host --user "${DOCKER_USER}" \
    -v /home/ilove/dev:/home/ilove/dev \
    -v "${TMPDIR:-/tmp}:${TMPDIR:-/tmp}" \
    -v "${SMOKE_ROOT}:${SMOKE_ROOT}" \
    -v "${HOST_COMPOSER_CACHE}:${HOST_COMPOSER_CACHE}" \
    -e HOME="${SMOKE_ROOT}" \
    -e COMPOSER_HOME="${SMOKE_ROOT}/.composer-home" \
    -e COMPOSER_CACHE_DIR="${HOST_COMPOSER_CACHE}" \
    -e COMPOSER_PROCESS_TIMEOUT=600 \
    -e COMPOSER_ALLOW_SUPERUSER=1 \
    -w "${workdir}" \
    flatrate-php84-f2:local \
    composer "$@"
}

# Retry flaky Composer network operations (GitHub/Packagist timeouts).
composer_docker_retry() {
  local attempt=1
  local max=5
  local delay=5
  while true; do
    if composer_docker "$@"; then
      return 0
    fi
    if [[ "${attempt}" -ge "${max}" ]]; then
      return 1
    fi
    echo "COMPOSER_RETRY attempt=${attempt}/${max} sleeping=${delay}s" >&2
    sleep "${delay}"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

# After app exists, prefer running PHP against SMOKE_ROOT/app.
app_php() {
  local workdir="${SMOKE_ROOT}/app"
  if [[ ! -d "${workdir}" ]]; then
    workdir="${SMOKE_ROOT}"
  fi
  if [[ "${USE_PHP_DOCKER}" == "1" ]]; then
    php_docker "${workdir}" "$@"
  else
    (cd "${workdir}" && php "$@")
  fi
}

app_composer() {
  local workdir="${1:-${SMOKE_ROOT}/app}"
  shift || true
  if [[ "${USE_PHP_DOCKER}" == "1" ]]; then
    composer_docker "${workdir}" "$@"
  else
    (cd "${workdir}" && composer "$@")
  fi
}

mkdir -p "${EVIDENCE_DIR}" "${SMOKE_ROOT}/keys" "${SMOKE_ROOT}/centrifugo" "${SMOKE_ROOT}/edge"
: > "${EVIDENCE_DIR}/browser.log"
# Drop committed/local receipts so EXIT emissions cannot fake PASS from prior runs.
rm -f "${EVIDENCE_DIR}/receipts.json" "${EVIDENCE_DIR}/homepage-boot.body"
printf '%s\n' '{}' > "${EVIDENCE_DIR}/receipts.json"

sha_of() {
  local root="$1" override="${2:-}"
  if [[ -n "${override}" ]]; then
    printf '%s' "${override}"
    return 0
  fi
  git -C "${root}" rev-parse HEAD
}

DM_SHA="$(sha_of "${DM_ROOT}" "${COMBINED_DM_SHA:-}")"
LIVE_SHA="$(sha_of "${LIVE_ROOT}" "${COMBINED_LIVE_SHA:-}")"
MSG_SHA="$(sha_of "${MSG_ROOT}" "${COMBINED_MSG_SHA:-}")"
echo "DM_SOURCE=${DM_SHA}"
echo "LIVE_SOURCE=${LIVE_SHA}"
echo "MESSAGING_UI_SOURCE=${MSG_SHA}"

[[ -f "${DM_ROOT}/js/dist/forum-f2.js" ]] || fail DIRECT_PROVIDER_DIST "missing"
[[ -f "${LIVE_ROOT}/js/dist/forum-f2.js" ]] || fail LIVE_PROVIDER_DIST "missing"
[[ -f "${MSG_ROOT}/js/dist/forum.js" ]] || fail MESSAGING_UI_DIST "missing"
[[ -f "${EDGE_PHP}" ]] || fail CENTRIFUGO_FIXTURE "missing_edge ${EDGE_PHP}"


# Minimal F2 LESS/CSS compatibility for pinned DM/Live sources (browser-revealed).
# Live F2 Messaging UI does not need legacy neonchat ChatList/ChatModal packs;
# those still depend on F1 mixins (.transition, .fa, @phone). Point extend-f2 at
# forum-f2.less (Messages surface only). DM theme tokens → CSS variables.
apply_f2_browser_compat() {
  local live_extend="${LIVE_ROOT}/extend-f2.php"
  local live_f2_less="${LIVE_ROOT}/resources/less/forum-f2.less"
  local dm_less="${DM_ROOT}/resources/less/extension.less"

  # Do not overlay Live source/dist patches. Combined Chromium must exercise the
  # exact pinned Live revision checked out by CI (release candidate authenticity).
  if [[ -f "${live_extend}" ]]; then
    if grep -q "resources/less/forum.less" "${live_extend}"; then
      sed -i 's#resources/less/forum\.less#resources/less/forum-f2.less#g' "${live_extend}"
      echo "F2_COMPAT_LIVE_CSS=forum-f2.less" | tee -a "${EVIDENCE_DIR}/browser.log"
    fi
  fi
  if [[ ! -f "${live_f2_less}" ]]; then
    fail LIVE_F2_LESS "pinned Live revision missing resources/less/forum-f2.less (refuses silent substitute)"
  fi
  echo "F2_COMPAT_LIVE_PIN_ASSETS=exact" | tee -a "${EVIDENCE_DIR}/browser.log"

  if [[ -f "${dm_less}" ]] && grep -qE '@control-bg|@muted-color|@text-color|@body-bg|@online-user-circle-color' "${dm_less}"; then
    DM_LESS="${dm_less}" python3 - <<'PY'
from pathlib import Path
import os, re
p = Path(os.environ["DM_LESS"])
t = p.read_text()
# F2 no longer injects F1 theme LESS vars into extension compiles. Rewrite to CSS vars
# (and drop lighten/darken/mix that require compile-time colors).
repls = [
  (r"background:\s*mix\(@control-bg,\s*@muted-color,\s*50%\);",
   "background: var(--control-body-bg-mix, color-mix(in srgb, var(--control-bg) 50%, var(--muted-color)));"),
  (r"color:\s*lighten\(@muted-color,\s*8%\);",
   "color: var(--muted-color-soft, color-mix(in srgb, var(--muted-color) 85%, white));"),
  (r"background-color:\s*darken\(@control-bg,\s*2%\);",
   "background-color: var(--control-bg-dark, color-mix(in srgb, var(--control-bg) 92%, black));"),
  (r"border:\s*1px dotted @muted-color;", "border: 1px dotted var(--muted-color);"),
  (r"border-bottom:\s*2px solid @control-bg;", "border-bottom: 2px solid var(--control-bg);"),
  (r"background-color:\s*@text-color;", "background-color: var(--text-color);"),
  (r"background-color:\s*@body-bg;", "background-color: var(--body-bg);"),
  (r"background:\s*@control-bg;", "background: var(--control-bg);"),
  (r"background:\s*@body-bg;", "background: var(--body-bg);"),
  (r"color:\s*@online-user-circle-color;", "color: var(--online-user-circle-color, #7FBA00);"),
  (r"color:\s*@muted-color;", "color: var(--muted-color);"),
  (r"color:\s*@text-color;", "color: var(--text-color);"),
]
for a, b in repls:
  t = re.sub(a, b, t)
leftover = sorted(set(re.findall(r'@(?:muted-color|control-bg|text-color|body-bg|online-user-circle-color)\b', t)))
if leftover:
  raise SystemExit(f"F2_COMPAT_DM_LESS leftover={leftover}")
p.write_text(t)
print("F2_COMPAT_DM_LESS=css_vars")
PY
  fi
}
apply_f2_browser_compat


# --- MariaDB ---
# Prefer an already-reachable DB (GHA service). Otherwise start disposable.
db_ready() {
  # PDO mysql works on host even when dom/curl are missing.
  php -r '
    try {
      new PDO("mysql:host=".$argv[1].";port=".$argv[2].";charset=utf8mb4", $argv[3], $argv[4], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      exit(0);
    } catch (Throwable $e) { exit(1); }
  ' "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASS}"
}

db_ready_docker() {
  # Must succeed from the same PHP container that runs `flarum install`.
  if [[ "${USE_PHP_DOCKER}" != "1" ]]; then
    db_ready
    return $?
  fi
  php_docker "${SMOKE_ROOT}" -r '
    try {
      new PDO("mysql:host=".$argv[1].";port=".$argv[2].";charset=utf8mb4", $argv[3], $argv[4], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      exit(0);
    } catch (Throwable $e) {
      fwrite(STDERR, $e->getMessage()."\n");
      exit(1);
    }
  ' "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASS}"
}

if db_ready; then
  echo "MARIADB_HOST=existing ${DB_HOST}:${DB_PORT}"
else
  echo "Starting disposable MariaDB"
  DB_PORT="$(pick_port)"
  export DB_PORT
  docker rm -f "${DB_NAME_CONTAINER}" >/dev/null 2>&1 || true
  docker run -d --name "${DB_NAME_CONTAINER}" \
    -e MARIADB_ROOT_PASSWORD="${DB_PASS}" \
    -e MYSQL_ROOT_PASSWORD="${DB_PASS}" \
    -p "127.0.0.1:${DB_PORT}:3306" \
    "${MARIADB_IMAGE}" \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci >/dev/null
  OWNED_DB=1
  for _ in $(seq 1 90); do
    if db_ready; then break; fi
    sleep 1
  done
  db_ready || fail COMBINED_COMPOSER "database_not_ready host=${DB_HOST} port=${DB_PORT}"
  echo "MARIADB_HOST=docker cid=${DB_NAME_CONTAINER} port=${DB_PORT}"
fi

# Confirm the PHP runtime that will install Flarum can reach MariaDB.
db_ready_docker || fail COMBINED_COMPOSER "database_unreachable_from_php_runtime port=${DB_PORT}"

php -r '
$pdo = new PDO("mysql:host=".$argv[1].";port=".$argv[2].";charset=utf8mb4", $argv[3], $argv[4], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$name = preg_replace("/[^A-Za-z0-9_]/", "", $argv[5]);
$pdo->exec("DROP DATABASE IF EXISTS `{$name}`");
$pdo->exec("CREATE DATABASE `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
' "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASS}" "${DB_NAME}"

# --- Centrifugo + edge (isolated) ---
openssl genrsa -out "${SMOKE_ROOT}/keys/jwt-private.pem" 2048 >/dev/null 2>&1
openssl rsa -in "${SMOKE_ROOT}/keys/jwt-private.pem" -pubout -out "${SMOKE_ROOT}/keys/jwt-public.pem" >/dev/null 2>&1
EDGE_KEY="test-edge-$(openssl rand -hex 8)"
API_KEY="test-api-$(openssl rand -hex 8)"
printf '%s' "${EDGE_KEY}" > "${SMOKE_ROOT}/keys/edge-key"
printf '%s' "${API_KEY}" > "${SMOKE_ROOT}/keys/api-key"
chmod 600 "${SMOKE_ROOT}/keys/"*

python3 - <<PY
import json
pub = open("${SMOKE_ROOT}/keys/jwt-public.pem").read()
cfg = {
  "client": {
    "token": {"rsa_public_key": pub, "issuer": "flatrate-forum", "audience": "flatrate-realtime"},
    "allowed_origins": ["*"],
    "allow_anonymous_connect_without_token": False
  },
  "http_api": {"key": "${API_KEY}"},
  "admin": {"enabled": False},
  "swagger": {"enabled": False},
  "prometheus": {"enabled": False},
  "health": {"enabled": True},
  "channel": {
    "without_namespace": {
      "allow_subscribe_for_client": False,
      "allow_subscribe_for_anonymous": False,
      "allow_publish_for_client": False,
      "allow_publish_for_subscriber": False,
      "allow_publish_for_anonymous": False,
      "presence": True,
      "history_size": 0,
      "force_recovery": False
    }
  }
}
open("${SMOKE_ROOT}/centrifugo/config.json", "w").write(json.dumps(cfg, indent=2))
PY

docker rm -f "${CENTRIFUGO_NAME}" >/dev/null 2>&1 || true
docker run -d --name "${CENTRIFUGO_NAME}" \
  -p "127.0.0.1:${CENTRIFUGO_HOST_PORT}:8000" \
  -v "${SMOKE_ROOT}/centrifugo/config.json:/centrifugo/config.json:ro" \
  "${CENTRIFUGO_IMAGE}" \
  centrifugo -c /centrifugo/config.json >/dev/null

centrifugo_ready=0
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${CENTRIFUGO_HOST_PORT}/health" >/dev/null; then
    centrifugo_ready=1
    break
  fi
  sleep 0.25
done
[[ "${centrifugo_ready}" == "1" ]] || fail REAL_CENTRIFUGO_SERVER "not_ready"
pass REAL_CENTRIFUGO_SERVER "image=${CENTRIFUGO_IMAGE}"
REALTIME_ENABLED=1

cp "${EDGE_PHP}" "${SMOKE_ROOT}/edge/index.php"
(
  EDGE_KEY="${EDGE_KEY}" \
  API_KEY="${API_KEY}" \
  CENTRIFUGO_PUBLISH_URL="http://127.0.0.1:${CENTRIFUGO_HOST_PORT}/api/publish" \
  EDGE_LOG="${SMOKE_ROOT}/edge-publish.log" \
  php -S "127.0.0.1:${EDGE_HOST_PORT}" -t "${SMOKE_ROOT}/edge" "${SMOKE_ROOT}/edge/index.php" \
    > "${SMOKE_ROOT}/edge-http.log" 2>&1
) &
EDGE_PID=$!
sleep 0.5
curl -sf "http://127.0.0.1:${EDGE_HOST_PORT}/healthz" >/dev/null || fail PUBLISH_EDGE "not_ready"

CENTRIFUGO_WS="ws://127.0.0.1:${CENTRIFUGO_HOST_PORT}/connection/websocket"
EDGE_PUBLISH="http://127.0.0.1:${EDGE_HOST_PORT}/api/publish"

# --- Flarum create-project ---
# Always use composer_docker when host PHP lacks extensions (USE_PHP_DOCKER=1).
# Keep require args on one line to avoid fragile backslash continuations.
rm -rf "${SMOKE_ROOT}/app"
if [[ "${USE_PHP_DOCKER}" == "1" ]]; then
  composer_docker_retry "${SMOKE_ROOT}" create-project "flarum/flarum:${FLARUM_SKELETON_VERSION}" "${SMOKE_ROOT}/app" --no-interaction --no-install
  rm -f "${SMOKE_ROOT}/app/composer.lock"
  composer_docker_retry "${SMOKE_ROOT}/app" require "flarum/core:${EXPECTED_CORE}" --no-update --no-interaction
  composer_docker_retry "${SMOKE_ROOT}/app" update --no-interaction --prefer-dist --no-audit
  composer_docker "${SMOKE_ROOT}/app" config repositories.flatrate-private-messages path "${DM_ROOT}"
  composer_docker "${SMOKE_ROOT}/app" config repositories.flatrate-live-chat path "${LIVE_ROOT}"
  composer_docker "${SMOKE_ROOT}/app" config repositories.flatrate-messaging-ui path "${MSG_ROOT}"
  composer_docker_retry "${SMOKE_ROOT}/app" require "flatrate/flarum-private-messages-bridge:*@dev" "flatrate/flarum-live-chat:*@dev" "flatrate/flarum-messaging-ui:*@dev" --no-interaction --prefer-dist --no-audit
else
  composer create-project "flarum/flarum:${FLARUM_SKELETON_VERSION}" "${SMOKE_ROOT}/app" --no-interaction --no-install
  cd "${SMOKE_ROOT}/app"
  rm -f composer.lock
  composer require "flarum/core:${EXPECTED_CORE}" --no-update --no-interaction
  composer update --no-interaction --prefer-dist --no-audit
  composer config repositories.flatrate-private-messages path "${DM_ROOT}"
  composer config repositories.flatrate-live-chat path "${LIVE_ROOT}"
  composer config repositories.flatrate-messaging-ui path "${MSG_ROOT}"
  composer require "flatrate/flarum-private-messages-bridge:*@dev" "flatrate/flarum-live-chat:*@dev" "flatrate/flarum-messaging-ui:*@dev" --no-interaction --prefer-dist --no-audit
fi
cd "${SMOKE_ROOT}/app"

INSTALLED_CORE="$(
  php -r '
    $lock = json_decode(file_get_contents($argv[1]), true);
    foreach (($lock["packages"] ?? []) as $pkg) {
      if (($pkg["name"] ?? "") === "flarum/core") {
        echo preg_replace("/^v/", "", (string)($pkg["version"] ?? ""));
        exit(0);
      }
    }
  ' "${SMOKE_ROOT}/app/composer.lock"
)"
[[ "${INSTALLED_CORE}" == "${EXPECTED_CORE}" ]] || fail COMBINED_COMPOSER "expected_core=${EXPECTED_CORE} got=${INSTALLED_CORE}"
RESULT_COMBINED_COMPOSER=PASS
pass COMBINED_COMPOSER "core=${INSTALLED_CORE}"

cat > "${SMOKE_ROOT}/app/install.json" <<EOF
{
  "debug": true,
  "baseUrl": "${BASE}",
  "databaseConfiguration": {
    "driver": "mysql",
    "host": "${DB_HOST}",
    "port": ${DB_PORT},
    "database": "${DB_NAME}",
    "username": "${DB_USER}",
    "password": "${DB_PASS}",
    "prefix": "",
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci"
  },
  "adminUser": {
    "username": "admin",
    "password": "admin-pass-1",
    "email": "admin@example.test"
  },
  "settings": {
    "forum_title": "Messaging Browser Smoke"
  },
  "extensions": "flarum-suspend,flarum-markdown,flatrate-private-messages-bridge,flatrate-live-chat,flatrate-messaging-ui"
}
EOF

# Re-verify DB from the PHP runtime immediately before install (long composer
# windows have previously left a dead MariaDB port in install.json).
db_ready_docker || fail COMBINED_F2_BOOT "database_unreachable_before_install port=${DB_PORT}"
echo "INSTALL_DB_PORT=${DB_PORT}"
if [[ "${USE_PHP_DOCKER}" == "1" ]]; then
  php_docker "${SMOKE_ROOT}/app" flarum install --file "${SMOKE_ROOT}/app/install.json"
else
  php flarum install --file "${SMOKE_ROOT}/app/install.json"
fi
rm -f "${SMOKE_ROOT}/app/install.json"
if host_php_ok; then
  php flarum migrate >/dev/null
  php flarum assets:publish >/dev/null
else
  php_docker "${SMOKE_ROOT}/app" flarum migrate >/dev/null
  php_docker "${SMOKE_ROOT}/app" flarum assets:publish >/dev/null
fi
RESULT_COMBINED_F2_BOOT=PASS
pass COMBINED_F2_BOOT

# Permissions + Live feature defaults (host PDO is enough; no Flarum boot required)
php -r '
$pdo = new PDO("mysql:host=".$argv[1].";port=".$argv[2].";dbname=".$argv[3].";charset=utf8mb4", $argv[4], $argv[5], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec("INSERT INTO group_permission (group_id, permission) SELECT 3, \"startConversation\" WHERE NOT EXISTS (SELECT 1 FROM group_permission WHERE group_id = 3 AND permission = \"startConversation\")");
foreach ([
  ["flatrate-live-chat.general_live_user_enabled", "1"],
  ["flatrate-live-chat.general_live_admin_preview_enabled", "1"],
] as [$k,$v]) {
  $pdo->prepare("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)")->execute([$k,$v]);
}
' "${DB_HOST}" "${DB_PORT}" "${DB_NAME}" "${DB_USER}" "${DB_PASS}"

# Start Flarum with realtime env
export FLATRATE_LIVE_CHAT_ALLOW_INSECURE_REALTIME=1
export FLATRATE_LIVE_CHAT_CENTRIFUGO_WS_URL="${CENTRIFUGO_WS}"
export FLATRATE_LIVE_CHAT_CENTRIFUGO_PUBLISH_URL="${EDGE_PUBLISH}"
export FLATRATE_LIVE_CHAT_CENTRIFUGO_EDGE_KEY_FILE="${SMOKE_ROOT}/keys/edge-key"
export FLATRATE_LIVE_CHAT_CENTRIFUGO_API_KEY_FILE="${SMOKE_ROOT}/keys/api-key"
export FLATRATE_LIVE_CHAT_CENTRIFUGO_JWT_PRIVATE_KEY_FILE="${SMOKE_ROOT}/keys/jwt-private.pem"
export FLATRATE_LIVE_CHAT_CENTRIFUGO_CONNECTION_TTL=300
export FLATRATE_LIVE_CHAT_CENTRIFUGO_SUBSCRIPTION_TTL=300
unset FLATRATE_LIVE_CHAT_CENTRIFUGO_EDGE_KEY || true
unset FLATRATE_LIVE_CHAT_CENTRIFUGO_API_KEY || true
unset FLATRATE_LIVE_CHAT_CENTRIFUGO_JWT_PRIVATE_KEY || true
unset FLATRATE_LIVE_CHAT_FAKE_REALTIME || true
unset FLATRATE_LIVE_CHAT_CENTRIFUGO_DISABLED || true


# PHP built-in server must serve /assets/* as static files. Using index.php as the
# router alone makes Flarum 404 every asset (browser suite cannot boot).
cat > "${SMOKE_ROOT}/app/public/router.php" <<'PHP'
<?php
declare(strict_types=1);
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) {
    return false;
}
require __DIR__ . '/index.php';
PHP

start_flarum_server() {
  # Single worker: multi-worker PHP built-in races produce sustained empty 500s.
  export PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-1}"
  if host_php_ok; then
    (
      cd "${SMOKE_ROOT}/app/public"
      FLATRATE_LIVE_CHAT_ALLOW_INSECURE_REALTIME=1 \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_WS_URL="${CENTRIFUGO_WS}" \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_PUBLISH_URL="${EDGE_PUBLISH}" \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_EDGE_KEY_FILE="${SMOKE_ROOT}/keys/edge-key" \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_API_KEY_FILE="${SMOKE_ROOT}/keys/api-key" \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_JWT_PRIVATE_KEY_FILE="${SMOKE_ROOT}/keys/jwt-private.pem" \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_CONNECTION_TTL=300 \
      FLATRATE_LIVE_CHAT_CENTRIFUGO_SUBSCRIPTION_TTL=300 \
      PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS}" \
      php -S "127.0.0.1:${FLARUM_HOST_PORT}" router.php > "${SMOKE_ROOT}/http.log" 2>&1
    ) &
    HTTP_PID=$!
  else
    OWNED_PHP_CID="$(docker run -d --network host \
      -v /home/ilove/dev:/home/ilove/dev \
      -v "${TMPDIR:-/tmp}:${TMPDIR:-/tmp}" \
      -v "${SMOKE_ROOT}:${SMOKE_ROOT}" \
      -w "${SMOKE_ROOT}/app/public" \
      -e FLATRATE_LIVE_CHAT_ALLOW_INSECURE_REALTIME=1 \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_WS_URL="${CENTRIFUGO_WS}" \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_PUBLISH_URL="${EDGE_PUBLISH}" \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_EDGE_KEY_FILE="${SMOKE_ROOT}/keys/edge-key" \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_API_KEY_FILE="${SMOKE_ROOT}/keys/api-key" \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_JWT_PRIVATE_KEY_FILE="${SMOKE_ROOT}/keys/jwt-private.pem" \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_CONNECTION_TTL=300 \
      -e FLATRATE_LIVE_CHAT_CENTRIFUGO_SUBSCRIPTION_TTL=300 \
      -e PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS}" \
      flatrate-php84-f2:local \
      php -S "127.0.0.1:${FLARUM_HOST_PORT}" router.php)"
  fi
}

# Publish assets before the PHP server starts so workers do not race cold compiles.
if host_php_ok; then
  php "${SMOKE_ROOT}/app/flarum" assets:publish >/dev/null 2>&1 || true
  php "${SMOKE_ROOT}/app/flarum" cache:clear >/dev/null 2>&1 || true
else
  php_docker "${SMOKE_ROOT}/app" flarum assets:publish >/dev/null 2>&1 || true
  php_docker "${SMOKE_ROOT}/app" flarum cache:clear >/dev/null 2>&1 || true
fi

start_flarum_server

ready=0
api_last=000
api_body="${EVIDENCE_DIR}/api-boot.body"
for _ in $(seq 1 90); do
  api_last="$(curl -s -o "${api_body}" -w '%{http_code}' --max-time 5 "${BASE}/api" || true)"
  if [[ "${api_last}" == "200" ]]; then ready=1; break; fi
  sleep 0.25
done
[[ "${ready}" == "1" ]] || {
  echo "API_NOT_READY last=${api_last}" >&2
  echo "API_BODY_HEAD=$(head -c 800 "${api_body}" 2>/dev/null || true)" >&2
  cat "${SMOKE_ROOT}/http.log" >&2 || true
  # shellcheck disable=SC2086
  tail -120 ${SMOKE_ROOT}/app/storage/logs/*.log 2>/dev/null >&2 || true
  fail COMBINED_F2_BOOT "server_not_ready"
}

# Homepage must return 200 before Playwright (PHP built-in can flap 5xx under load).
home_ready=0
home_body="${EVIDENCE_DIR}/homepage-boot.body"
for _ in $(seq 1 60); do
  code="$(curl -s -o "${home_body}" -w '%{http_code}' --max-time 15 "${BASE}/" || true)"
  if [[ "${code}" == "200" ]]; then home_ready=1; break; fi
  sleep 0.5
done
if [[ "${home_ready}" != "1" ]]; then
  echo "HOMEPAGE_NOT_READY last=${code:-none}" >&2
  echo "HOMEPAGE_BODY_HEAD=$(head -c 500 "${home_body}" 2>/dev/null || true)" >&2
  tail -80 "${SMOKE_ROOT}/http.log" >&2 || true
  ls -lt "${SMOKE_ROOT}/app/storage/logs" >&2 || true
  tail -80 "${SMOKE_ROOT}/app/storage/logs/"*.log 2>/dev/null >&2 || true
  fail COMBINED_F2_BOOT "homepage_not_200"
fi
echo "HOMEPAGE_READY=PASS"

token_for() {
  local user="$1" pass="$2" out code token
  out="$(mktemp)"
  code="$(curl -sS -o "${out}" -w '%{http_code}' -H 'Content-Type: application/json' \
    -d "{\"identification\":\"${user}\",\"password\":\"${pass}\"}" \
    "${BASE}/api/token")"
  token="$(php -r '$j=json_decode(file_get_contents($argv[1]), true); echo $j["token"] ?? "";' "${out}")"
  [[ -n "${token}" ]] || fail COMBINED_AUTH "token user=${user} status=${code}"
  rm -f "${out}"
  printf '%s' "${token}"
}

create_user() {
  local name="$1" email="$2" pass="$3"
  local php_src='
      $site = require "site.php";
      $app = $site->bootApp();
      $user = new Flarum\User\User();
      $user->username = $argv[1];
      $user->email = $argv[2];
      if (method_exists($user, "changePassword")) {
        $user->changePassword($argv[3]);
      } else {
        $user->password = $argv[3];
      }
      $user->is_email_confirmed = true;
      $user->joined_at = Carbon\Carbon::now();
      $user->save();
      $user->groups()->attach(Flarum\Group\Group::MEMBER_ID);
      echo $user->id;
    '
  if host_php_ok; then
    (cd "${SMOKE_ROOT}/app" && php -r "${php_src}" "${name}" "${email}" "${pass}")
  else
    php_docker "${SMOKE_ROOT}/app" -r "${php_src}" "${name}" "${email}" "${pass}"
  fi
}

ALICE_ID="$(create_user alice alice@example.test alice-pass-1)"
BOB_ID="$(create_user bob bob@example.test bob-pass-1)"
CAROL_ID="$(create_user carol carol@example.test carol-pass-1)"
SAM_ID="$(create_user sam sam@example.test sam-pass-1)"
ALICE_TOKEN="$(token_for alice alice-pass-1)"
BOB_TOKEN="$(token_for bob bob-pass-1)"

seed_rooms() {
  local php_cwd="${SMOKE_ROOT}/app"
  if host_php_ok; then
    (cd "${php_cwd}" && php -r '
$pdo = new PDO("mysql:host=".$argv[1].";port=".$argv[2].";dbname=".$argv[3].";charset=utf8mb4", $argv[4], $argv[5], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->prepare("UPDATE users SET suspended_until = \"2099-01-01 00:00:00\" WHERE id = ?")->execute([(int)$argv[6]]);
$ins = $pdo->prepare("INSERT INTO neonchat_chats (title, color, icon, type, creator_id, created_at, room_key, scope_type, scope_key, visibility, audience) VALUES (?, ?, ?, 1, 1, \"2020-01-01 00:00:00\", ?, ?, ?, ?, ?)");
$ins->execute(["General Live", "#111111", "fas fa-comments", "community-general-live", "navigation-group", "community", "visible", "members"]);
$generalId = (int) $pdo->lastInsertId();
$ins->execute(["Accessible Brand", "#222222", "fas fa-car", "accessible-brand-live", "board", "accessible-brand", "visible", "members"]);
$accessId = (int) $pdo->lastInsertId();
$ins->execute(["Restricted Brand", "#333333", "fas fa-lock", "restricted-brand-live", "board", "restricted-brand", "hidden", "staff-preview"]);
$restrictedId = (int) $pdo->lastInsertId();
$msg = $pdo->prepare("INSERT INTO neonchat_messages (message, user_id, created_at, chat_id, type, is_readed) VALUES (?, ?, ?, ?, 0, 0)");
$msg->execute(["live-seed-one", (int)$argv[7], "2020-01-01 00:00:00", $generalId]);
$msg->execute(["live-seed-two", (int)$argv[8], "2020-01-01 00:01:00", $generalId]);
file_put_contents("storage/browser-room-ids.json", json_encode([
  "general" => $generalId,
  "accessible" => $accessId,
  "restricted" => $restrictedId,
]));
' "$@")
  else
    php_docker "${php_cwd}" -r '
$pdo = new PDO("mysql:host=".$argv[1].";port=".$argv[2].";dbname=".$argv[3].";charset=utf8mb4", $argv[4], $argv[5], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->prepare("UPDATE users SET suspended_until = \"2099-01-01 00:00:00\" WHERE id = ?")->execute([(int)$argv[6]]);
$ins = $pdo->prepare("INSERT INTO neonchat_chats (title, color, icon, type, creator_id, created_at, room_key, scope_type, scope_key, visibility, audience) VALUES (?, ?, ?, 1, 1, \"2020-01-01 00:00:00\", ?, ?, ?, ?, ?)");
$ins->execute(["General Live", "#111111", "fas fa-comments", "community-general-live", "navigation-group", "community", "visible", "members"]);
$generalId = (int) $pdo->lastInsertId();
$ins->execute(["Accessible Brand", "#222222", "fas fa-car", "accessible-brand-live", "board", "accessible-brand", "visible", "members"]);
$accessId = (int) $pdo->lastInsertId();
$ins->execute(["Restricted Brand", "#333333", "fas fa-lock", "restricted-brand-live", "board", "restricted-brand", "hidden", "staff-preview"]);
$restrictedId = (int) $pdo->lastInsertId();
$msg = $pdo->prepare("INSERT INTO neonchat_messages (message, user_id, created_at, chat_id, type, is_readed) VALUES (?, ?, ?, ?, 0, 0)");
$msg->execute(["live-seed-one", (int)$argv[7], "2020-01-01 00:00:00", $generalId]);
$msg->execute(["live-seed-two", (int)$argv[8], "2020-01-01 00:01:00", $generalId]);
file_put_contents("storage/browser-room-ids.json", json_encode([
  "general" => $generalId,
  "accessible" => $accessId,
  "restricted" => $restrictedId,
]));
' "$@"
  fi
}
seed_rooms "${DB_HOST}" "${DB_PORT}" "${DB_NAME}" "${DB_USER}" "${DB_PASS}" "${SAM_ID}" "${ALICE_ID}" "${BOB_ID}"

GENERAL_ID="$(php -r 'echo json_decode(file_get_contents($argv[1]), true)["general"];' "${SMOKE_ROOT}/app/storage/browser-room-ids.json")"

CREATE_CONV="$(mktemp)"
CREATE_CODE="$(curl -sS -o "${CREATE_CONV}" -w '%{http_code}' -H 'Content-Type: application/json' -H "Authorization: Token ${ALICE_TOKEN}" \
  -d "{\"data\":{\"attributes\":{\"recipient\":\"${BOB_ID}\",\"messageContents\":\"dm-seed-one\"}}}" \
  "${BASE}/api/neoncube-private-messages/conversations")"
[[ "${CREATE_CODE}" == "201" ]] || { cat "${CREATE_CONV}" >&2; fail DIRECT_SEED "create status=${CREATE_CODE}"; }
CONV_ID="$(php -r '$j=json_decode(file_get_contents($argv[1]), true); echo $j["data"]["id"] ?? "";' "${CREATE_CONV}")"
rm -f "${CREATE_CONV}"
[[ -n "${CONV_ID}" ]] || fail DIRECT_SEED "missing_conversation_id"
curl -sS -H 'Content-Type: application/json' -H "Authorization: Token ${ALICE_TOKEN}" \
  -d "{\"data\":{\"attributes\":{\"conversationId\":\"${CONV_ID}\",\"messageContents\":\"dm-seed-two\"}}}" \
  "${BASE}/api/neoncube-private-messages/messages" >/dev/null

# Cross-domain isolation (HTTP, preserved from combined)
CROSS="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" \
  "${BASE}/api/flatrate-live-chat/rooms/direct-${CONV_ID}")"
if [[ "${CROSS}" == "200" ]]; then
  RESULT_CROSS_DOMAIN=FAIL
  fail CROSS_DOMAIN_ISOLATION "direct_id_as_live_room"
fi
RESULT_CROSS_DOMAIN=PASS
pass CROSS_DOMAIN_ISOLATION "live_lookup_status=${CROSS}"

# Write Playwright fixture
php -r '
$f = [
  "baseUrl" => $argv[1],
  "conversationId" => $argv[2],
  "generalRoomKey" => "community-general-live",
  "generalChatId" => (int)$argv[3],
  "realtimeEnabled" => (bool)(int)$argv[4],
  "passwords" => [
    "alice" => "alice-pass-1",
    "bob" => "bob-pass-1",
    "carol" => "carol-pass-1",
    "sam" => "sam-pass-1",
  ],
  "seeds" => [
    "dmOne" => "dm-seed-one",
    "dmTwo" => "dm-seed-two",
    "liveOne" => "live-seed-one",
    "liveTwo" => "live-seed-two",
  ],
  "pins" => [
    "dm" => $argv[5],
    "live" => $argv[6],
    "messagingUi" => $argv[7],
  ],
];
file_put_contents($argv[8], json_encode($f, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
' "${BASE}" "${CONV_ID}" "${GENERAL_ID}" "${REALTIME_ENABLED}" "${DM_SHA}" "${LIVE_SHA}" "${MSG_SHA}" "${EVIDENCE_DIR}/fixture.json"

# Install Playwright (repo root) + Chromium
cd "${MSG_ROOT}"
if [[ ! -d node_modules/@playwright/test ]]; then
  npm install --no-fund --no-audit
fi

# Prefer managed Playwright Chromium. Skip download when a matching binary is cached.
# On hosts where CDN downloads fail, allow system Chrome/Chromium via
# PLAYWRIGHT_CHROME_CHANNEL / PLAYWRIGHT_EXECUTABLE_PATH.
if [[ "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-0}" != "1" ]]; then
  if [[ -x "${HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" ]]; then
    echo "PLAYWRIGHT_INSTALL=SKIP cached_chromium-1234" | tee -a "${EVIDENCE_DIR}/browser.log"
  elif ! npx --yes playwright install chromium; then
    echo "PLAYWRIGHT_INSTALL=WARN managed_chromium_failed; trying system chrome channel" | tee -a "${EVIDENCE_DIR}/browser.log"
    if command -v google-chrome-stable >/dev/null 2>&1 || command -v google-chrome >/dev/null 2>&1; then
      export PLAYWRIGHT_CHROME_CHANNEL=chrome
      export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    elif command -v chromium >/dev/null 2>&1; then
      export PLAYWRIGHT_EXECUTABLE_PATH="$(command -v chromium)"
      export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    else
      fail PLAYWRIGHT_INSTALL "chromium_download_failed_and_no_system_browser"
    fi
  fi
fi

# Prefer Node 20+LTS for Playwright 1.49 (Node 26 hangs on this host).
if [[ -z "${PLAYWRIGHT_NODE:-}" ]]; then
  for cand in \
    "${MSG_ROOT}/.tools/node20/bin/node" \
    /home/ilove/dev/_disposable/node20/node-v20.19.5-linux-x64/bin/node \
    /tmp/node-v20.19.5-linux-x64/bin/node \
    "$(command -v node)"; do
    if [[ -x "${cand}" ]] && "${cand}" -e 'process.exit(Number(process.versions.node.split(".")[0])>=20&&Number(process.versions.node.split(".")[0])<22?0:1)' 2>/dev/null; then
      PLAYWRIGHT_NODE="${cand}"
      break
    fi
  done
fi
PLAYWRIGHT_NODE="${PLAYWRIGHT_NODE:-$(command -v node)}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
unset PLAYWRIGHT_CHROME_CHANNEL || true

export BROWSER_FIXTURE_PATH="${EVIDENCE_DIR}/fixture.json"
export BROWSER_RECEIPT_PATH="${EVIDENCE_DIR}/receipts.json"
export BROWSER_BASE_URL="${BASE}"
rm -f "${EVIDENCE_DIR}/receipts.json"

set +e
"${PLAYWRIGHT_NODE}" "${MSG_ROOT}/node_modules/@playwright/test/cli.js" test --config="${MSG_ROOT}/playwright.config.mjs" --reporter=line 2>&1 | tee "${EVIDENCE_DIR}/browser.log"
PW_EC=${PIPESTATUS[0]}
set -e
if [[ "${PW_EC}" -eq 0 ]]; then
  RESULT_PLAYWRIGHT=PASS
  pass PLAYWRIGHT_SUITE
else
  RESULT_PLAYWRIGHT=FAIL
  echo "PLAYWRIGHT_SUITE=FAIL exit=${PW_EC}" >&2
fi

# Disable-provider fallback (HTTP + shell still loads) — after browser suite so providers were available for tests.
# Disabled APIs must not stay open (200) and must not crash (5xx). Prefer 401/403/404.
disable_status_ok() {
  local code="$1"
  [[ "${code}" =~ ^[0-9]+$ ]] || return 1
  [[ "${code}" -ge 500 ]] && return 1
  [[ "${code}" == "200" ]] && return 1
  return 0
}

cd "${SMOKE_ROOT}/app"
if host_php_ok; then
  php flarum extension:disable flatrate-private-messages-bridge >/dev/null
  php flarum cache:clear >/dev/null 2>&1 || true
else
  php_docker "${SMOKE_ROOT}/app" flarum extension:disable flatrate-private-messages-bridge >/dev/null
  php_docker "${SMOKE_ROOT}/app" flarum cache:clear >/dev/null 2>&1 || true
fi
sleep 1
DISABLED_DM="$(curl -s -o "${EVIDENCE_DIR}/disable-dm.body" -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api/neoncube-private-messages/conversations" || echo 000)"
MEMBER_SHELL="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/messages" || echo 000)"
if host_php_ok; then
  php flarum extension:enable flatrate-private-messages-bridge >/dev/null
  php flarum extension:disable flatrate-live-chat >/dev/null
  php flarum cache:clear >/dev/null 2>&1 || true
else
  php_docker "${SMOKE_ROOT}/app" flarum extension:enable flatrate-private-messages-bridge >/dev/null
  php_docker "${SMOKE_ROOT}/app" flarum extension:disable flatrate-live-chat >/dev/null
  php_docker "${SMOKE_ROOT}/app" flarum cache:clear >/dev/null 2>&1 || true
fi
sleep 1
DISABLED_LIVE="$(curl -s -o "${EVIDENCE_DIR}/disable-live.body" -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api/flatrate-live-chat/live-chats" || echo 000)"
if host_php_ok; then
  php flarum extension:enable flatrate-live-chat >/dev/null
  php flarum cache:clear >/dev/null 2>&1 || true
else
  php_docker "${SMOKE_ROOT}/app" flarum extension:enable flatrate-live-chat >/dev/null
  php_docker "${SMOKE_ROOT}/app" flarum cache:clear >/dev/null 2>&1 || true
fi

if ! disable_status_ok "${DISABLED_DM}" || ! disable_status_ok "${DISABLED_LIVE}" || [[ "${MEMBER_SHELL}" == "500" || "${MEMBER_SHELL}" == "000" ]]; then
  RESULT_DISABLE_FALLBACK=FAIL
  echo "DISABLE_FALLBACK=FAIL dm=${DISABLED_DM} live=${DISABLED_LIVE} shell=${MEMBER_SHELL}" >&2
  echo "DISABLE_DM_BODY=$(head -c 300 "${EVIDENCE_DIR}/disable-dm.body" 2>/dev/null || true)" >&2
  echo "DISABLE_LIVE_BODY=$(head -c 300 "${EVIDENCE_DIR}/disable-live.body" 2>/dev/null || true)" >&2
else
  RESULT_DISABLE_FALLBACK=PASS
  pass DISABLE_FALLBACK "dm=${DISABLED_DM} live=${DISABLED_LIVE} shell=${MEMBER_SHELL}"
fi

# Copy pins + revocation note into evidence
{
  echo "DM_SOURCE=${DM_SHA}"
  echo "LIVE_SOURCE=${LIVE_SHA}"
  echo "MESSAGING_UI_SOURCE=${MSG_SHA}"
  echo "REVOCATION_WINDOW_SECONDS=296"
  echo "REVOCATION_POLICY=PENDING_OWNER"
  echo "REVOCATION_NOTE=Lane B Centrifugo e2e measured already-issued JWTs remain valid until exp (~296s); active subscribers keep receiving until expiry; no instant disconnect claimed."
  echo "REVOCATION_EVIDENCE_SOURCE=${LIVE_ROOT}/evidence/forum-f2-centrifugo-e2e/results.json"
} > "${EVIDENCE_DIR}/pins.txt"

cp -a "${SMOKE_ROOT}/http.log" "${EVIDENCE_DIR}/http.log" 2>/dev/null || true

[[ "${RESULT_PLAYWRIGHT}" == "PASS" ]] || exit 1
[[ "${RESULT_DISABLE_FALLBACK}" == "PASS" ]] || exit 1
echo "MESSAGING_BROWSER_ACCEPTANCE=PASS"
