# FORUM-F2-ANDROID-ACCEPTANCE-001 — Pixel 5 receipt

**Date (UTC):** 2026-10-27T21:28:15Z  
**Device:** Google Pixel 5 / Android 14 / Chrome 155.0.8059.84  
**Connection:** USB ADB reverse (`tcp:18771`, `tcp:18772`)  
**Production mutated:** false

## Exact heads

| Component | SHA |
| --- | --- |
| Messaging UI (#28) | `4ea2812ad46654d15307bc5c62b46cfce9609956` |
| Direct Messages (#11) | `d2c7480b3b705adae4fc5506f0ecf4dd68e316cd` |
| Live Chat (#55) | `b048f30a6bdef3e8bb1d29ded9ebd1975688603c` |

DM runtime delta vs Chromium-exercised `38281d9…`: HTTP assertion-only change in `scripts/ci-flarum-f2-http.sh` (no product runtime delta).

Exact-head Chromium CI reused: https://github.com/mrkcntrmn/flatrate-flarum-messaging-ui/actions/runs/40580143128

## Result

`PIXEL5_ACCEPTANCE=PASS`

See `ACCEPTANCE_RECEIPT.txt` for the full criterion matrix. Supporting screenshots are in this directory (synthetic fixture only).

## Fixture notes

- Extended `scripts/ci-flarum-f2-browser.sh` with `ANDROID_DEVICE_ACCEPTANCE_HOLD=1` (bounded marker + max duration).
- PHP 8.4 rejects `PHP_CLI_SERVER_WORKERS=1`; fixture leaves workers unset for single-process mode.
- Disposable install uses `debug: false` after assets publish for stable multi-request serving over ADB reverse.
- Isolated DM/Live pins were used so F2 LESS stubs did not mutate shared labs checkouts.

## Remaining deployment gates (unchanged)

```
MESSAGING_CHROMIUM=PASS
MESSAGING_PIXEL5=PASS
MEDIA_PRIVACY_CI=PASS
CLOUDFLARE_R2=NOT_PROVEN
CLOUDFLARE_PUBLISH_EDGE=LEFT_UNTESTED
REALTIME_REVOCATION_WINDOW_SECONDS=296
REALTIME_REVOCATION_POLICY=PENDING_OWNER
FORUM_DB_RECOVERY_REHEARSAL=NOT_PROVEN
PRODUCTION_DEPLOYMENT_AUTHORIZED=false
```

## Evidence hygiene (FORUM-F2-R4-RELEASE-QUALIFICATION)

- `fixture.json` synthetic passwords redacted to `REDACTED_SYNTHETIC`.
- Raw HTTP diagnostic bodies removed from distributable evidence.
- `PIXEL5_ACCEPTANCE=PASS` preserved.
- `POST_HOLD_FIXTURE_EXIT=127` remains a separate post-hold cleanup note, not a device failure.
- Screenshots are synthetic disposable fixture UI only.
