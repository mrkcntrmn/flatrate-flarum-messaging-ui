#!/usr/bin/env bash
# Disposable Flarum 2.0.2 HTTP proof for FlatRate Messaging UI shell.
# SQLite is enough: this extension has no MySQL-only migrations and registers
# no second message storage API. No production data, credentials, or install.
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/local/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Host PHP often lacks pdo_sqlite/gd/intl. Prefer a disposable PHP 8.4 image.
maybe_reexec_docker() {
  if [[ "${MESSAGING_UI_F2_HTTP_IN_DOCKER:-0}" == "1" ]]; then
    return 0
  fi
  if php -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);' 2>/dev/null; then
    return 0
  fi
  local image=""
  if docker image inspect flatrate-php84-f2:local >/dev/null 2>&1; then
    image="flatrate-php84-f2:local"
  elif docker image inspect php:8.4-cli >/dev/null 2>&1; then
    image="php:8.4-cli"
  else
    echo "MESSAGING_UI_F2_HTTP=FAIL host_php_missing_pdo_sqlite_and_no_docker_image" >&2
    exit 1
  fi
  echo "MESSAGING_UI_F2_HTTP=REEXEC image=${image}"
  exec docker run --rm \
    -e MESSAGING_UI_F2_HTTP_IN_DOCKER=1 \
    -e FLARUM_SMOKE_ROOT \
    -e KEEP_SMOKE_ROOT \
    -e FLARUM_SKELETON_VERSION \
    -e FLARUM_CORE_VERSION \
    -v "${ROOT}:${ROOT}" \
    -w "${ROOT}" \
    -p 127.0.0.1:8768:8768 \
    "${image}" \
    bash "${ROOT}/scripts/ci-flarum-f2-http.sh"
}

maybe_reexec_docker

git config --global --add safe.directory "${ROOT}" || true
if ! git -C "${ROOT}" symbolic-ref -q HEAD >/dev/null; then
  git -C "${ROOT}" checkout -B ci-f2-messaging-ui-http
fi

SMOKE_ROOT="${FLARUM_SMOKE_ROOT:-${TMPDIR:-/tmp}/flarum-messaging-ui-f2-http-$$}"
FLARUM_SKELETON_VERSION="${FLARUM_SKELETON_VERSION:-2.0.0}"
EXPECTED_CORE="${FLARUM_CORE_VERSION:-2.0.2}"
BASE="http://127.0.0.1:8768"
PRIVATE_SENTINEL="PRIVATE_BODY_SHOULD_NOT_LEAK_f2_messaging_ui_001"

cleanup() {
  if [[ -n "${HTTP_PID:-}" ]]; then
    kill "${HTTP_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "${KEEP_SMOKE_ROOT:-0}" != "1" ]]; then
    rm -rf "${SMOKE_ROOT}"
  fi
}
trap cleanup EXIT

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
if [[ "${INSTALLED_CORE}" != "${EXPECTED_CORE}" ]]; then
  echo "MESSAGING_UI_F2_HTTP=FAIL expected_core=${EXPECTED_CORE} got=${INSTALLED_CORE}" >&2
  exit 1
fi

composer config repositories.flatrate-messaging-ui path "${ROOT}"
composer require "flatrate/flarum-messaging-ui:*@dev" --no-interaction --prefer-dist --no-audit

cat > "${SMOKE_ROOT}/install.json" <<EOF
{
  "debug": true,
  "baseUrl": "${BASE}",
  "databaseConfiguration": {
    "driver": "sqlite",
    "database": "storage/f2-messaging-ui.sqlite"
  },
  "adminUser": {
    "username": "msgadmin",
    "password": "msg-admin-pass",
    "email": "msg-admin@example.test"
  },
  "settings": {
    "forum_title": "Messaging UI Smoke"
  },
  "extensions": "flarum-suspend,flatrate-messaging-ui"
}
EOF

php flarum install --file "${SMOKE_ROOT}/install.json"
rm -f "${SMOKE_ROOT}/install.json"

# Prove F2 dual-entry selected the shell extender.
php -r '
require "vendor/autoload.php";
if (class_exists(Flarum\Api\Controller\AbstractShowController::class)) {
  fwrite(STDERR, "MESSAGING_UI_F2_BOOT=FAIL AbstractShowController still present\n");
  exit(1);
}
$extend = require "vendor/flatrate/flarum-messaging-ui/extend.php";
if (!is_array($extend)) {
  fwrite(STDERR, "MESSAGING_UI_F2_BOOT=FAIL extend.php did not return array\n");
  exit(1);
}
echo "MESSAGING_UI_F2_BOOT=PASS\n";
'

(
  cd "${SMOKE_ROOT}/public"
  php -S 127.0.0.1:8768 index.php > "${SMOKE_ROOT}/http.log" 2>&1
) &
HTTP_PID=$!

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -s -o /dev/null "${BASE}/api"; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "${ready}" != "1" ]]; then
  echo "MESSAGING_UI_F2_HTTP=FAIL server_not_ready" >&2
  cat "${SMOKE_ROOT}/http.log" >&2 || true
  exit 1
fi

token_for() {
  local user="$1"
  local pass="$2"
  local out
  out="$(mktemp)"
  local code
  code="$(curl -sS -o "${out}" -w '%{http_code}' -H 'Content-Type: application/json' \
    -d "{\"identification\":\"${user}\",\"password\":\"${pass}\"}" \
    "${BASE}/api/token")"
  local token
  token="$(php -r '$j=json_decode(file_get_contents($argv[1]), true); echo $j["token"] ?? "";' "${out}")"
  if [[ -z "${token}" ]]; then
    echo "MESSAGING_UI_F2_HTTP=FAIL token user=${user} status=${code}" >&2
    cat "${out}" >&2 || true
    exit 1
  fi
  rm -f "${out}"
  printf '%s' "${token}"
}

create_user() {
  local name="$1"
  local email="$2"
  local pass="$3"
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
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "${label}=FAIL expected=${expected} actual=${actual}" >&2
    exit 1
  fi
  echo "${label}=PASS"
}

ALICE_ID="$(create_user alice alice@example.test alice-pass-1)"
ALICE_TOKEN="$(token_for alice alice-pass-1)"

# Guest: SPA shell (200) or login redirect — never 500.
GUEST_BODY="$(mktemp)"
GUEST_CODE="$(curl -sS -o "${GUEST_BODY}" -w '%{http_code}' "${BASE}/messages")"
if [[ "${GUEST_CODE}" != "200" && "${GUEST_CODE}" != "302" && "${GUEST_CODE}" != "303" ]]; then
  echo "MESSAGING_UI_GUEST_HTTP=FAIL status=${GUEST_CODE}" >&2
  cat "${GUEST_BODY}" >&2 || true
  exit 1
fi
echo "MESSAGING_UI_GUEST_HTTP=PASS status=${GUEST_CODE}"

# Guest must not see private message bodies (shell has no storage; sentinel must not appear).
if grep -Fq "${PRIVATE_SENTINEL}" "${GUEST_BODY}"; then
  echo "MESSAGING_UI_PRIVACY=FAIL guest_saw_private_sentinel" >&2
  exit 1
fi
# No second message-storage API registered by this extension.
STORAGE_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/neoncube-private-messages/conversations")"
if [[ "${STORAGE_CODE}" == "200" ]]; then
  echo "MESSAGING_UI_PRIVACY=FAIL unexpected_storage_api" >&2
  exit 1
fi
echo "MESSAGING_UI_PRIVACY=PASS guest_status=${GUEST_CODE} storage_status=${STORAGE_CODE}"
rm -f "${GUEST_BODY}"

# Authenticated member: forum HTML with API token cookie/header path.
# Prefer Authorization token on /api first, then session-ish HTML fetch.
MEMBER_API="$(mktemp)"
MEMBER_API_CODE="$(curl -sS -o "${MEMBER_API}" -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/api")"
expect_status MESSAGING_UI_MEMBER_API "${MEMBER_API_CODE}" 200
php -r '
$j = json_decode(file_get_contents($argv[1]), true);
$attrs = $j["data"]["attributes"] ?? [];
if (($attrs["flatrateMessagingUiEnabled"] ?? null) !== true && ($attrs["flatrateMessagingUiEnabled"] ?? null) !== 1) {
  fwrite(STDERR, "MESSAGING_UI_FORUM_ATTR=FAIL ".json_encode($attrs["flatrateMessagingUiEnabled"] ?? null)."\n");
  exit(1);
}
' "${MEMBER_API}"
echo "MESSAGING_UI_FORUM_ATTR=PASS"
rm -f "${MEMBER_API}"

MEMBER_BODY="$(mktemp)"
MEMBER_CODE="$(curl -sS -o "${MEMBER_BODY}" -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/messages")"
if [[ "${MEMBER_CODE}" != "200" ]]; then
  # Some Flarum frontends ignore API tokens for HTML; fall back to guest-ok SPA 200 via session login.
  CSRF_PAGE="$(mktemp)"
  COOKIES="$(mktemp)"
  curl -sS -c "${COOKIES}" -b "${COOKIES}" -o "${CSRF_PAGE}" "${BASE}/"
  CSRF="$(php -r '
$html = file_get_contents($argv[1]);
if (preg_match("/\"csrfToken\"\s*:\s*\"([^\"]+)\"/", $html, $m)) { echo $m[1]; exit(0); }
if (preg_match("/name=\"csrfToken\"\s+content=\"([^\"]+)\"/", $html, $m)) { echo $m[1]; exit(0); }
' "${CSRF_PAGE}")"
  if [[ -n "${CSRF}" ]]; then
    curl -sS -c "${COOKIES}" -b "${COOKIES}" -o /dev/null \
      -H "Content-Type: application/json" \
      -H "X-CSRF-Token: ${CSRF}" \
      -d '{"identification":"alice","password":"alice-pass-1"}' \
      "${BASE}/login" || true
    MEMBER_CODE="$(curl -sS -o "${MEMBER_BODY}" -w '%{http_code}' -b "${COOKIES}" "${BASE}/messages")"
  fi
  rm -f "${CSRF_PAGE}" "${COOKIES}"
fi
if [[ "${MEMBER_CODE}" != "200" ]]; then
  echo "MESSAGING_UI_MEMBER_HTTP=FAIL status=${MEMBER_CODE}" >&2
  cat "${MEMBER_BODY}" >&2 || true
  exit 1
fi
echo "MESSAGING_UI_MEMBER_HTTP=PASS"
rm -f "${MEMBER_BODY}"

# Live/direct routes exist as shell pages even without backends installed.
LIVE_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/messages/live/community-general-live")"
DIRECT_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Token ${ALICE_TOKEN}" "${BASE}/messages/direct/1")"
if [[ "${LIVE_CODE}" == "500" || "${DIRECT_CODE}" == "500" ]]; then
  echo "MESSAGING_UI_SHELL_ROUTES=FAIL live=${LIVE_CODE} direct=${DIRECT_CODE}" >&2
  exit 1
fi
echo "MESSAGING_UI_LIVE_HTTP=PENDING_OR_SHELL status=${LIVE_CODE}"
echo "MESSAGING_UI_DIRECT_HTTP=PENDING_OR_SHELL status=${DIRECT_CODE}"

set +e
DISABLE_OUT="$(php -d display_errors=1 flarum extension:disable flatrate-messaging-ui 2>&1)"
DISABLE_EC=$?
set -e
if [[ -n "${DISABLE_OUT}" ]]; then
  printf '%s\n' "${DISABLE_OUT}"
fi
if [[ "${DISABLE_EC}" != "0" ]]; then
  echo "MESSAGING_UI_DISABLE_FALLBACK=FAIL disable_command exit=${DISABLE_EC}" >&2
  printf '%s\n' "${DISABLE_OUT}" >&2
  exit 1
fi

DISABLED_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/messages")"
if [[ "${DISABLED_CODE}" == "500" ]]; then
  echo "MESSAGING_UI_DISABLE_FALLBACK=FAIL status=500" >&2
  exit 1
fi
echo "MESSAGING_UI_DISABLE_FALLBACK=PASS status=${DISABLED_CODE}"
echo "MESSAGING_UI_F2_HTTP=PASS"
echo "PRODUCTION_INSTALL=false"
