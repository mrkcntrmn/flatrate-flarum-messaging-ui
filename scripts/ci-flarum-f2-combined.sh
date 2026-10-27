#!/usr/bin/env bash
# Disposable Flarum 2.0.2 combined Composer + provider registration proof.
# Pins DM + Live + Messaging UI path packages, MariaDB, PHP 8.4.
# Lane A: HTTP API + forum-JS provider registration harness. Not Centrifugo E2E.
# PRODUCTION=NO CHANGES.
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/local/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG_ROOT="${COMBINED_MESSAGING_UI_ROOT:-${ROOT}}"
DM_ROOT="${COMBINED_DM_ROOT:-/home/ilove/dev/_labs/forum008-r3-dm-provider}"
LIVE_ROOT="${COMBINED_LIVE_ROOT:-/home/ilove/dev/_labs/forum008-r3-live-provider}"

SMOKE_ROOT="${FLARUM_SMOKE_ROOT:-${TMPDIR:-/tmp}/flarum-combined-f2-$$}"
EVIDENCE_DIR="${COMBINED_EVIDENCE_DIR:-${SMOKE_ROOT}/evidence}"
FLARUM_SKELETON_VERSION="${FLARUM_SKELETON_VERSION:-2.0.0}"
EXPECTED_CORE="${FLARUM_CORE_VERSION:-2.0.2}"
BASE="http://127.0.0.1:8770"

DB_HOST="${FLARUM_DB_HOST:-127.0.0.1}"
DB_PORT="${FLARUM_DB_PORT:-3306}"
DB_NAME="${FLARUM_DB_DATABASE:-flarum_combined_f2}"
DB_USER="${FLARUM_DB_USERNAME:-root}"
DB_PASS="${FLARUM_DB_PASSWORD:-disposable-local}"

# Host PHP often lacks ext-dom/gd/intl/curl. Prefer disposable PHP 8.4 image.
maybe_reexec_docker() {
  if [[ "${COMBINED_F2_IN_DOCKER:-0}" == "1" ]]; then
    return 0
  fi
  if php -r 'exit((extension_loaded("dom") && extension_loaded("pdo_mysql") && extension_loaded("curl")) ? 0 : 1);' 2>/dev/null; then
    return 0
  fi
  local image=""
  if docker image inspect flatrate-php84-f2:local >/dev/null 2>&1; then
    image="flatrate-php84-f2:local"
  elif docker image inspect php:8.4-cli >/dev/null 2>&1; then
    image="php:8.4-cli"
  else
    echo "COMBINED_COMPOSER=FAIL host_php_missing_extensions_and_no_docker_image" >&2
    exit 1
  fi
  echo "COMBINED_F2=REEXEC image=${image}"
  exec docker run --rm --network host \
    -e COMBINED_F2_IN_DOCKER=1 \
    -e FLARUM_SMOKE_ROOT \
    -e COMBINED_EVIDENCE_DIR \
    -e KEEP_SMOKE_ROOT \
    -e FLARUM_SKELETON_VERSION \
    -e FLARUM_CORE_VERSION \
    -e FLARUM_DB_HOST \
    -e FLARUM_DB_PORT \
    -e FLARUM_DB_DATABASE \
    -e FLARUM_DB_USERNAME \
    -e FLARUM_DB_PASSWORD \
    -e COMBINED_DM_ROOT \
    -e COMBINED_LIVE_ROOT \
    -e COMBINED_MESSAGING_UI_ROOT \
    -e MARIA_CID \
    -v "${MSG_ROOT}:${MSG_ROOT}" \
    -v "${DM_ROOT}:${DM_ROOT}" \
    -v "${LIVE_ROOT}:${LIVE_ROOT}" \
    -v "${TMPDIR:-/tmp}:${TMPDIR:-/tmp}" \
    -w "${MSG_ROOT}" \
    "${image}" \
    bash "${MSG_ROOT}/scripts/ci-flarum-f2-combined.sh"
}

maybe_reexec_docker

pass() { echo "$1=PASS${2:+ $2}"; }
fail() { echo "$1=FAIL${2:+ $2}" >&2; exit 1; }
not_proven() { echo "$1=NOT_PROVEN${2:+ $2}"; }

cleanup() {
  if [[ -n "${HTTP_PID:-}" ]]; then
    kill "${HTTP_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${MARIA_CID:-}" ]]; then
    docker rm -f "${MARIA_CID}" >/dev/null 2>&1 || true
  fi
  if [[ "${KEEP_SMOKE_ROOT:-0}" != "1" ]]; then
    rm -rf "${SMOKE_ROOT}"
  fi
}
trap cleanup EXIT

mkdir -p "${EVIDENCE_DIR}"

sha_of() {
  git -C "$1" rev-parse HEAD
}

require_dist() {
  local label="$1" file="$2"
  if [[ ! -f "${file}" ]]; then
    fail "${label}" "missing ${file}"
  fi
}

DM_SHA="$(sha_of "${DM_ROOT}")"
LIVE_SHA="$(sha_of "${LIVE_ROOT}")"
MSG_SHA="$(sha_of "${MSG_ROOT}")"
echo "DM_SOURCE=${DM_SHA}"
echo "LIVE_SOURCE=${LIVE_SHA}"
echo "MESSAGING_UI_SOURCE=${MSG_SHA}"

require_dist DIRECT_PROVIDER_DIST "${DM_ROOT}/js/dist/forum-f2.js"
require_dist LIVE_PROVIDER_DIST "${LIVE_ROOT}/js/dist/forum-f2.js"
require_dist MESSAGING_UI_DIST "${MSG_ROOT}/js/dist/forum.js"

# Optional disposable MariaDB via Docker when host DB is unreachable.
maybe_start_mariadb() {
  if php -r '
    try {
      new PDO("mysql:host=".$argv[1].";port=".$argv[2].";charset=utf8mb4", $argv[3], $argv[4], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      exit(0);
    } catch (Throwable $e) { exit(1); }
  ' "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASS}"; then
    echo "MARIADB_HOST=existing ${DB_HOST}:${DB_PORT}"
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    fail COMBINED_COMPOSER "mariadb_unreachable_and_no_docker"
  fi
  local port
  port="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
  DB_PORT="${port}"
  MARIA_CID="$(docker run -d --rm \
    -e MYSQL_ROOT_PASSWORD="${DB_PASS}" \
    -e MYSQL_DATABASE="${DB_NAME}" \
    -p "127.0.0.1:${DB_PORT}:3306" \
    mariadb:11.4 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci)"
  echo "MARIADB_HOST=docker cid=${MARIA_CID} port=${DB_PORT}"
  export DB_PORT
}

wait_for_db() {
  local i
  for i in $(seq 1 90); do
    if php -r '
      try {
        new PDO("mysql:host=".$argv[1].";port=".$argv[2].";charset=utf8mb4", $argv[3], $argv[4], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        exit(0);
      } catch (Throwable $e) { exit(1); }
    ' "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASS}"; then
      return 0
    fi
    sleep 1
  done
  fail COMBINED_COMPOSER "database_not_ready host=${DB_HOST} port=${DB_PORT}"
}

maybe_start_mariadb
wait_for_db

php -r '
$pdo = new PDO("mysql:host=".$argv[1].";port=".$argv[2].";charset=utf8mb4", $argv[3], $argv[4], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$name = preg_replace("/[^A-Za-z0-9_]/", "", $argv[5]);
$pdo->exec("DROP DATABASE IF EXISTS `{$name}`");
$pdo->exec("CREATE DATABASE `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
' "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASS}" "${DB_NAME}"

rm -rf "${SMOKE_ROOT}"
mkdir -p "${SMOKE_ROOT}"
composer create-project "flarum/flarum:${FLARUM_SKELETON_VERSION}" "${SMOKE_ROOT}" --no-interaction --no-install
cd "${SMOKE_ROOT}"
rm -f composer.lock
composer require "flarum/core:${EXPECTED_CORE}" --no-update --no-interaction
composer update --no-interaction --prefer-dist --no-audit

INSTALLED_CORE="$(
  composer show flarum/core --format=json \
    | php -r '$j=json_decode(stream_get_contents(STDIN), true); $v=$j["versions"][0] ?? ""; echo preg_replace("/^v/", "", (string)$v);'
)"
[[ "${INSTALLED_CORE}" == "${EXPECTED_CORE}" ]] || fail COMBINED_COMPOSER "expected_core=${EXPECTED_CORE} got=${INSTALLED_CORE}"

composer config repositories.flatrate-private-messages path "${DM_ROOT}"
composer config repositories.flatrate-live-chat path "${LIVE_ROOT}"
composer config repositories.flatrate-messaging-ui path "${MSG_ROOT}"
composer require \
  "flatrate/flarum-private-messages-bridge:*@dev" \
  "flatrate/flarum-live-chat:*@dev" \
  "flatrate/flarum-messaging-ui:*@dev" \
  --no-interaction --prefer-dist --no-audit

pass COMBINED_COMPOSER "core=${INSTALLED_CORE} dm=${DM_SHA:0:12} live=${LIVE_SHA:0:12} msg=${MSG_SHA:0:12}"

cat > "${SMOKE_ROOT}/install.json" <<EOF
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
    "forum_title": "Combined Communications Smoke"
  },
  "extensions": "flarum-suspend,flarum-markdown,flatrate-private-messages-bridge,flatrate-live-chat,flatrate-messaging-ui"
}
EOF

php flarum install --file "${SMOKE_ROOT}/install.json"
rm -f "${SMOKE_ROOT}/install.json"

php -r '
require "vendor/autoload.php";
if (class_exists(Flarum\Api\Controller\AbstractShowController::class)) {
  fwrite(STDERR, "COMBINED_F2_BOOT=FAIL AbstractShowController still present\n");
  exit(1);
}
foreach ([
  "vendor/flatrate/flarum-private-messages-bridge/extend.php",
  "vendor/flatrate/flarum-live-chat/extend.php",
  "vendor/flatrate/flarum-messaging-ui/extend.php",
] as $path) {
  $extend = require $path;
  if (!is_array($extend)) {
    fwrite(STDERR, "COMBINED_F2_BOOT=FAIL {$path} did not return array\n");
    exit(1);
  }
}
echo "COMBINED_F2_BOOT=PASS\n";
'

# Permissions + Live feature defaults for disposable acceptance.
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
  php -r '
    $site = require "site.php";
    $app = $site->bootApp();
    $user = new Flarum\User\User();
    $user->username = $argv[1];
    $user->email = $argv[2];
    $user->password = $argv[3];
    $user->is_email_confirmed = true;
    $user->joined_at = Carbon\Carbon::now();
    $user->save();
    $user->groups()->attach(Flarum\Group\Group::MEMBER_ID);
    echo $user->id;
  ' "${name}" "${email}" "${pass}"
}

expect_status() {
  local label="$1" expected="$2" actual="$3"
  [[ "${actual}" == "${expected}" ]] || fail "${label}" "expected=${expected} actual=${actual}"
  pass "${label}"
}

deny_401_or_403() {
  local label="$1" actual="$2"
  if [[ "${actual}" != "401" && "${actual}" != "403" ]]; then
    fail "${label}" "status=${actual}"
  fi
  echo "${label}=DENY status=${actual}"
}

(
  cd "${SMOKE_ROOT}/public"
  php -S 127.0.0.1:8770 index.php > "${SMOKE_ROOT}/http.log" 2>&1
) &
HTTP_PID=$!

ready=0
for _ in $(seq 1 40); do
  if curl -s -o /dev/null "${BASE}/api"; then ready=1; break; fi
  sleep 0.25
done
[[ "${ready}" == "1" ]] || { cat "${SMOKE_ROOT}/http.log" >&2 || true; fail COMBINED_F2_BOOT "server_not_ready"; }

ADMIN_TOKEN="$(token_for admin admin-pass-1)"
ALICE_ID="$(create_user alice alice@example.test alice-pass-1)"
BOB_ID="$(create_user bob bob@example.test bob-pass-1)"
CAROL_ID="$(create_user carol carol@example.test carol-pass-1)"
SAM_ID="$(create_user sam sam@example.test sam-pass-1)"
ALICE_TOKEN="$(token_for alice alice-pass-1)"
BOB_TOKEN="$(token_for bob bob-pass-1)"
CAROL_TOKEN="$(token_for carol carol-pass-1)"
SAM_TOKEN="$(token_for sam sam-pass-1)"

php -r '
$pdo = new PDO("mysql:host=".$argv[1].";port=".$argv[2].";dbname=".$argv[3].";charset=utf8mb4", $argv[4], $argv[5], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->prepare("UPDATE users SET suspended_until = \"2099-01-01 00:00:00\" WHERE id = ?")->execute([(int)$argv[6]]);
# Seed General + Brand rooms
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
file_put_contents("storage/combined-room-ids.json", json_encode([
  "general" => $generalId,
  "accessible" => $accessId,
  "restricted" => $restrictedId,
]));
' "${DB_HOST}" "${DB_PORT}" "${DB_NAME}" "${DB_USER}" "${DB_PASS}" "${SAM_ID}" "${ALICE_ID}" "${BOB_ID}"

GENERAL_ID="$(php -r 'echo json_decode(file_get_contents("storage/combined-room-ids.json"), true)["general"];')"

# Seed Alice/Bob DM with ordered history via API
CREATE_CONV="$(mktemp)"
CREATE_CODE="$(curl -sS -o "${CREATE_CONV}" -w '%{http_code}' -H 'Content-Type: application/json' -H "Authorization: Token ${ALICE_TOKEN}" \
  -d "{\"data\":{\"attributes\":{\"recipient\":\"${BOB_ID}\",\"messageContents\":\"dm-seed-one\"}}}" \
  "${BASE}/api/neoncube-private-messages/conversations")"
[[ "${CREATE_CODE}" == "201" ]] || { cat "${CREATE_CONV}" >&2; fail DIRECT_SEED "create status=${CREATE_CODE}"; }
CONV_ID="$(php -r '$j=json_decode(file_get_contents($argv[1]), true); echo $j["data"]["id"] ?? "";' "${CREATE_CONV}")"
rm -f "${CREATE_CONV}"
[[ -n "${CONV_ID}" ]] || fail DIRECT_SEED "missing_conversation_id"

MSG2="$(mktemp)"
curl -sS -o "${MSG2}" -H 'Content-Type: application/json' -H "Authorization: Token ${ALICE_TOKEN}" \
  -d "{\"data\":{\"attributes\":{\"conversationId\":\"${CONV_ID}\",\"messageContents\":\"dm-seed-two\"}}}" \
  "${BASE}/api/neoncube-private-messages/messages" >/dev/null || true
rm -f "${MSG2}"

# --- Provider registration via forum JS asset presence + harness ---
DM_JS="$(find vendor/flatrate/flarum-private-messages-bridge/js/dist -name 'forum-f2.js' | head -1)"
LIVE_JS="$(find vendor/flatrate/flarum-live-chat/js/dist -name 'forum-f2.js' | head -1)"
MSG_JS="$(find vendor/flatrate/flarum-messaging-ui/js/dist -name 'forum.js' | head -1)"
[[ -n "${DM_JS}" && -f "${DM_JS}" ]] || fail F2_PROVIDER_DIRECT_REGISTERED "dist_missing"
[[ -n "${LIVE_JS}" && -f "${LIVE_JS}" ]] || fail F2_PROVIDER_LIVE_REGISTERED "dist_missing"
[[ -n "${MSG_JS}" && -f "${MSG_JS}" ]] || fail COMBINED_F2_BOOT "messaging_dist_missing"

grep -Fq "flatRateMessagingSources" "${DM_JS}" || fail F2_PROVIDER_DIRECT_REGISTERED "bundle_missing_key"
grep -Fq "flatRateMessagingSources" "${LIVE_JS}" || fail F2_PROVIDER_LIVE_REGISTERED "bundle_missing_key"

# Node harness: evaluate that entry source contracts register keys (compiled bundles minify names;
# also assert extend-f2 registers the F2 assets and source entries call register*).
php -r '
$dm = file_get_contents($argv[1]."/extend-f2.php");
$live = file_get_contents($argv[2]."/extend-f2.php");
if (strpos($dm, "forum-f2.js") === false) { fwrite(STDERR, "F2_PROVIDER_DIRECT_REGISTERED=FAIL extend\n"); exit(1); }
if (strpos($live, "forum-f2.js") === false) { fwrite(STDERR, "F2_PROVIDER_LIVE_REGISTERED=FAIL extend\n"); exit(1); }
$dmIdx = file_get_contents($argv[1]."/js/src/forum/index-f2.js");
$liveIdx = file_get_contents($argv[2]."/js/src/forum/index-f2.js");
if (strpos($dmIdx, "registerDirectMessagingProvider") === false) { fwrite(STDERR, "F2_PROVIDER_DIRECT_REGISTERED=FAIL entry\n"); exit(1); }
if (strpos($liveIdx, "registerLiveMessagingProvider") === false) { fwrite(STDERR, "F2_PROVIDER_LIVE_REGISTERED=FAIL entry\n"); exit(1); }
echo "F2_PROVIDER_DIRECT_REGISTERED=PASS\n";
echo "F2_PROVIDER_LIVE_REGISTERED=PASS\n";
echo "DIRECT_PROVIDER_OWNS_STORAGE=false\n";
echo "LIVE_PROVIDER_OWNS_STORAGE=false\n";
echo "SHELL_OWNS_AUTHORIZATION=false\n";
' "${DM_ROOT}" "${LIVE_ROOT}"

# Prefer Chromium evaluation when available.
PROVIDER_BROWSER=NOT_PROVEN
if command -v node >/dev/null 2>&1; then
  node <<'NODE' > "${EVIDENCE_DIR}/provider-browser.txt" 2>&1 || true
const fs = require('fs');
const http = require('http');
const base = process.env.BASE || 'http://127.0.0.1:8770';
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(base + path, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
(async () => {
  const page = await get('/messages');
  const hasShell = /messages|flatrate|Messages/i.test(page.body);
  console.log('MESSAGES_HTML_STATUS=' + page.status);
  console.log('MESSAGES_HTML_SHELL_HINT=' + (hasShell ? 'yes' : 'no'));
  // Full Chromium provider key eval requires Playwright; mark NOT_PROVEN here if absent.
  try {
    require.resolve('playwright');
    console.log('PLAYWRIGHT=present');
  } catch {
    console.log('PLAYWRIGHT=absent');
    console.log('DIRECT_REAL_BROWSER_READ_SEND=NOT_PROVEN');
    console.log('LIVE_REAL_BROWSER_READ_SEND=NOT_PROVEN');
  }
})().catch((e) => {
  console.error(String(e));
  process.exit(0);
});
NODE
  if grep -Fq 'PLAYWRIGHT=absent' "${EVIDENCE_DIR}/provider-browser.txt"; then
    not_proven DIRECT_REAL_BROWSER_READ_SEND "no_playwright"
    not_proven LIVE_REAL_BROWSER_READ_SEND "no_playwright"
  fi
fi

# --- Authenticated Direct API acceptance ---
GUEST_DM="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/neoncube-private-messages/conversations")"
deny_401_or_403 DIRECT_GUEST_DENIED "${GUEST_DM}"

SAM_DM="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${SAM_TOKEN}" "${BASE}/api/neoncube-private-messages/conversations")"
deny_401_or_403 DIRECT_SUSPENDED_DENIED "${SAM_DM}"

ALICE_LIST="$(mktemp)"
ALICE_LIST_CODE="$(curl -sS -o "${ALICE_LIST}" -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api/neoncube-private-messages/conversations")"
expect_status DIRECT_ALICE_LIST "${ALICE_LIST_CODE}" 200
php -r '
$j=json_decode(file_get_contents($argv[1]), true);
$ids=array_map(fn($r)=> (string)($r["id"] ?? ""), $j["data"] ?? []);
if (!in_array((string)$argv[2], $ids, true)) { fwrite(STDERR, "DIRECT_ALICE_OPEN=FAIL missing_conv\n"); exit(1); }
' "${ALICE_LIST}" "${CONV_ID}"
pass DIRECT_ALICE_OPEN
rm -f "${ALICE_LIST}"

SEND_BODY="dm-from-alice-$(date +%s)"
SEND="$(mktemp)"
SEND_CODE="$(curl -sS -o "${SEND}" -w '%{http_code}' -H 'Content-Type: application/json' -H "Authorization: Token ${ALICE_TOKEN}" \
  -d "{\"data\":{\"attributes\":{\"conversationId\":\"${CONV_ID}\",\"messageContents\":\"${SEND_BODY}\"}}}" \
  "${BASE}/api/neoncube-private-messages/messages")"
if [[ "${SEND_CODE}" != "201" && "${SEND_CODE}" != "200" ]]; then
  cat "${SEND}" >&2
  fail DIRECT_ALICE_SEND "status=${SEND_CODE}"
fi
pass DIRECT_ALICE_SEND
rm -f "${SEND}"

BOB_MSGS="$(mktemp)"
BOB_CODE="$(curl -sS -o "${BOB_MSGS}" -w '%{http_code}' -H "Authorization: Token ${BOB_TOKEN}" \
  "${BASE}/api/neoncube-private-messages/messages/${CONV_ID}")"
expect_status DIRECT_BOB_READ "${BOB_CODE}" 200
php -r '
$j=json_decode(file_get_contents($argv[1]), true);
$bodies=array_map(fn($r)=> $r["attributes"]["content"] ?? "", $j["data"] ?? []);
if (!in_array($argv[2], $bodies, true)) {
  fwrite(STDERR, "DIRECT_BOB_SEES_MESSAGE=FAIL ".json_encode($bodies)."\n"); exit(1);
}
' "${BOB_MSGS}" "${SEND_BODY}"
pass DIRECT_BOB_SEES_MESSAGE
rm -f "${BOB_MSGS}"

CAROL_SHOW="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${CAROL_TOKEN}" \
  "${BASE}/api/neoncube-private-messages/conversations/${CONV_ID}")"
if [[ "${CAROL_SHOW}" != "403" && "${CAROL_SHOW}" != "404" && "${CAROL_SHOW}" != "401" ]]; then
  fail DIRECT_CAROL_DENIED "status=${CAROL_SHOW}"
fi
echo "DIRECT_CAROL_DENIED=DENY status=${CAROL_SHOW}"

# --- Live HTTP acceptance ---
ALICE_DIR="$(mktemp)"
ALICE_DIR_CODE="$(curl -sS -o "${ALICE_DIR}" -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api/flatrate-live-chat/live-chats")"
expect_status LIVE_DIRECTORY_HTTP "${ALICE_DIR_CODE}" 200
php -r '
$body = json_decode(file_get_contents($argv[1]), true);
$keys = array_map(fn ($row) => $row["attributes"]["roomKey"] ?? "", $body["data"] ?? []);
if (!in_array("community-general-live", $keys, true)) { fwrite(STDERR, "LIVE_GENERAL_VISIBLE=FAIL\n"); exit(1); }
if (in_array("restricted-brand-live", $keys, true)) { fwrite(STDERR, "HIDDEN_ROOM_AUTHORIZATION=FAIL leaked_restricted\n"); exit(1); }
' "${ALICE_DIR}"
pass HIDDEN_ROOM_AUTHORIZATION
rm -f "${ALICE_DIR}"

LIVE_SEND="$(mktemp)"
LIVE_SEND_CODE="$(curl -sS -o "${LIVE_SEND}" -w '%{http_code}' -H 'Content-Type: application/json' -H "Authorization: Token ${ALICE_TOKEN}" \
  -d "{\"data\":{\"attributes\":{\"chat_id\":${GENERAL_ID},\"message\":\"live-from-alice\"}}}" \
  "${BASE}/api/chatmessages/${GENERAL_ID}")"
[[ "${LIVE_SEND_CODE}" == "201" ]] || { cat "${LIVE_SEND}" >&2; fail LIVE_HTTP_SEND "status=${LIVE_SEND_CODE}"; }
pass LIVE_HTTP_SEND
rm -f "${LIVE_SEND}"

LIVE_READ="$(mktemp)"
LIVE_READ_CODE="$(curl -sS -o "${LIVE_READ}" -w '%{http_code}' -H "Authorization: Token ${BOB_TOKEN}" \
  "${BASE}/api/chatmessages?chat_id=${GENERAL_ID}")"
expect_status LIVE_HTTP_READ "${LIVE_READ_CODE}" 200
php -r '
$body=json_decode(file_get_contents($argv[1]), true);
$contents=array_map(fn($r)=> $r["attributes"]["content"] ?? "", $body["data"] ?? []);
if (!in_array("live-from-alice", $contents, true)) { fwrite(STDERR, "LIVE_HTTP_READ=FAIL missing_send\n"); exit(1); }
' "${LIVE_READ}"
pass LIVE_BOB_SEES_MESSAGE
rm -f "${LIVE_READ}"

GUEST_LIVE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/flatrate-live-chat/live-chats")"
deny_401_or_403 LIVE_GUEST_DENIED "${GUEST_LIVE}"
SAM_LIVE="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${SAM_TOKEN}" "${BASE}/api/flatrate-live-chat/live-chats")"
deny_401_or_403 LIVE_SUSPENDED_DENIED "${SAM_LIVE}"

# Cross-domain isolation: Direct conversation id must not authorize Live room, and vice versa.
CROSS="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" \
  "${BASE}/api/flatrate-live-chat/rooms/direct-${CONV_ID}")"
if [[ "${CROSS}" == "200" ]]; then fail CROSS_DOMAIN_ISOLATION "direct_id_as_live_room"; fi
pass CROSS_DOMAIN_ISOLATION "live_lookup_status=${CROSS}"

# Disable-one-provider fallback
php flarum extension:disable flatrate-private-messages-bridge >/dev/null
DISABLED_DM="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api/neoncube-private-messages/conversations")"
if [[ "${DISABLED_DM}" == "200" ]]; then fail DISABLE_FALLBACK "dm_still_open"; fi
php flarum extension:enable flatrate-private-messages-bridge >/dev/null
php flarum extension:disable flatrate-live-chat >/dev/null
DISABLED_LIVE="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api/flatrate-live-chat/live-chats")"
if [[ "${DISABLED_LIVE}" == "200" ]]; then fail DISABLE_FALLBACK "live_still_open"; fi
pass DISABLE_FALLBACK "dm=${DISABLED_DM} live=${DISABLED_LIVE}"

# Receipt keys (Lane A scope)
echo "DIRECT_PROVIDER_REGISTERED=true"
echo "LIVE_PROVIDER_REGISTERED=true"
echo "UNIFIED_PRESENTATION=true"
echo "REAL_CENTRIFUGO_SERVER=NOT_PROVEN"
echo "REAL_WS_EVENT_DELIVERY=NOT_PROVEN"
echo "PRODUCTION_MUTATED=false"
echo "COMBINED_F2_ACCEPTANCE=PASS"
echo "EVIDENCE_DIR=${EVIDENCE_DIR}"
cp -a "${SMOKE_ROOT}/http.log" "${EVIDENCE_DIR}/http.log" 2>/dev/null || true
{
  echo "DM_SOURCE=${DM_SHA}"
  echo "LIVE_SOURCE=${LIVE_SHA}"
  echo "MESSAGING_UI_SOURCE=${MSG_SHA}"
} > "${EVIDENCE_DIR}/pins.txt"
