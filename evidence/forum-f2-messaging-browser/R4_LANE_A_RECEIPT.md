# R4 Lane A — Messaging browser receipt

WORK_ORDER=FORUM-F2-EXTENSION-RESTORATION-001-R4
DATE_UTC=2026-10-27T17:20:00Z
PRODUCTION_MUTATED=false

## Exact heads exercised

- DM baseline pin: ea9f7dadda8c0d305644282be78aa137fd570651 (PR #11)
- LIVE head: 7f08266363105f76f0202333039351c5c7b92be6 (PR #55)
- MESSAGING_UI branch: feat/forum-f2-messaging-browser-001 (PR #28 target feat/forum-f2-messaging-ui-001)

## Chromium results (disposable Flarum 2.0.2 + MariaDB + Centrifugo + local publish edge)

See `receipts.json`.

## Notes

- ANDROID_PIXEL5=NOT_PROVEN (no physical Pixel 5 attached); Chromium mobile emulation PASS.
- Cloudflare publish edge left untested; local publish-edge substitute used (same as R3 Centrifugo e2e).
- REVOCATION_WINDOW_SECONDS=296; REVOCATION_POLICY=PENDING_OWNER.
