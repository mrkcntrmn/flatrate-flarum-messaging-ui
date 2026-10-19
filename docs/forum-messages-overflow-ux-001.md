# FORUM-MESSAGES-OVERFLOW-UX-001 — Remove redundant All messages menu action

**Date:** 2026-10-19
**Work order:** FORUM-LIVE-UI-CLEANUP-001-R2
**Status:** source implemented, built, and CI-qualified on draft PR #25. Not merged, not deployed, not production-verified.

**Qualified source SHA:** `4d9dffc7541f587f968b7481bd49458a98e6afc5` (JavaScript and bundle). This documentation note does not change those assets.
**CI:** pull request run [39308834734](https://github.com/mrkcntrmn/flatrate-flarum-messaging-ui/actions/runs/39308834734) success (`validate`). Push run [39308824230](https://github.com/mrkcntrmn/flatrate-flarum-messaging-ui/actions/runs/39308824230) success on the same SHA.

## Work contract

- **WORK_ORDER:** FORUM-MESSAGES-OVERFLOW-UX-001
- **OUTCOME:** The Messages conversation overflow menu no longer displays All messages, or its inbox icon, for General Live, Brand Live, or Direct.
- **BOUNDARIES:** menu presentation only. Keep the existing header Back control and its General, Brand, and Direct destinations, New message, provider Live controls, Direct provider actions, and sound/notification choices.
- **SOURCE_OF_TRUTH:** `js/src/forum/utils/shellOverflowPolicy.js` and `js/src/forum/utils/buildShellHeaderOverflowItems.js`.
- **DONE:** the shell plan is `newMessage` when Direct compose is available and never `allMessages`; merge drops a provider `allMessages` key; tests pass; tracked `js/dist` matches a Node 20 production build.
- **CONSEQUENTIAL_BOUNDARY:** no release, production package install, feature activation, or deployment without authorization.

The `onBack` argument remains on the builder so existing header calls stay valid. The header Back button is the navigation control. `back_to_messages` may remain in locale files; this source no longer renders it. Browser history is unchanged: neither the builder nor `MessagesPage` registers `popstate` or calls `history.back`.

## Overflow contract

| Action | Result |
| --- | --- |
| New message | Kept when Direct compose is available |
| All messages | Removed, including a provider item keyed `allMessages` |
| Room info / settings | Kept via the Live provider (`liveSettings`) |
| Sounds and notifications | Kept via the Live provider |
| Other provider actions | Kept |

`/messages`, conversation listings, and message history stay in place.

## PR #22 reconciliation

Messaging UI draft PR **#22** (`feat/forum-live-header-unify-001-messaging`, HEAD `7a31f0e917c1d3939d0ff606883ab094be444e3b`) is open and `CONFLICTING` with current `main` (`cd0ce85c60af60ed698dfc41c3bf8c8954f90f76`).

Inspected overlap:

- PR #22 edits `js/tests/ui-polish-001ui.test.js` and `MessagesConversationHeader.js`.
- PR #22 does not edit `buildShellHeaderOverflowItems.js`.
- This PR edits the overflow builder, `shellOverflowPolicy.js`, the overflow assertions in `ui-polish-001ui.test.js`, and `shell-overflow-policy.test.js`.
- The shared test hunks do not rewrite PR #22's header assertions. This PR does not change `MessagesConversationHeader.js`.

The accepted header already on `main`, and preserved here, is:

- centered General Live title
- `PUBLIC`, globe, and `LIVE`
- optional trusted presence count
- Direct title and avatar
- 44px back and overflow slots

PR #22's remaining branch still describes an older header shape (`isPublicLive`, a `FLATRATE.WIKI` title expression, and `resolveLiveHeaderConversation.js`). Merging that branch onto current `main` would conflict with the landed header and is a separate reconciliation. It is not pulled into this PR.

`HEADER_RECONCILIATION=PRESERVED_MAIN_HEADER_PR22_NOT_MERGED`

## Local qualification

- Node `v20.19.5` (CI uses Node 20).
- `cd js && npm ci && npm test && npm run build`: 143 tests passed.
- Behavioral coverage: shell plan, provider reintroduction of `allMessages` for General, Brand, and Direct, retired-key removal, and Back destinations (`/` for General Live, board href for Toyota Live, `/messages` for Direct).
- Tracked assets changed: `js/dist/forum.js`, `js/dist/forum.js.map`. Admin assets were not modified.
- A second `npm run build` produced byte-identical `js/dist` output.
- Production bundle contains `newMessage` and `fa-pen`. It does not contain `fa-inbox` or `back_to_messages`. The string `allMessages` remains only as the retired key that merge removes.

A green check is not a deployment. The disposable Flarum 1.8.19 compiled asset contains the retired key `allMessages` and shell set `newMessage`, and does not contain `back_to_messages`. `fa-inbox` appears only in the Font Awesome catalog, not as a menu action. Signed-in overflow was not clicked because that disposable forum has no provisioned conversations. Physical Android acceptance was not run.

## Lifecycle

| Stage | State |
| --- | --- |
| Source implemented | yes, on draft PR #25 |
| Built | yes, local Node 20 production build |
| CI qualified | yes, runs 39308834734 and 39308824230 at `4d9dffc7` |
| Draft PR ready | yes, still draft |
| Merged | no |
| Deployed | no |
| Production verified | no |

**Paired candidate:** `flatrate-flarum-live-chat` PR #52 hides participant chips in read-only Live Room info.

## R3 signed-in acceptance

**Work order:** FORUM-LIVE-UI-CLEANUP-001-R3
**Date:** 2026-10-19
**Product source:** unchanged at `4f50e9d084bcfe064aa6e85fa89ff2cbfad18634`
**Bundle:** `js/dist/forum.js` sha256 `c9cb4ebe1d7eb420b081a8dda2d5187184db3797c571e28fdc2349d4a6c3e95b`
**CI still valid for that product head:** run [39310136750](https://github.com/mrkcntrmn/flatrate-flarum-messaging-ui/actions/runs/39310136750) success. This note does not change JavaScript or `js/dist`.

The R2 statement that signed-in overflow was not clicked is historical. R3 reused the same disposable Flarum 1.8.19 forum (`http://127.0.0.1:8137`, disposable database only).

| Surface | Actor | Overflow | Back |
| --- | --- | --- | --- |
| General Live | member `r3member` | New message, Room info, Disable sounds, Enable notifications. All messages absent. Sounds and notifications toggled and restored. | `/` |
| Toyota Live | moderator `r3mod` | New message, Room info, Disable sounds, Enable notifications. All messages absent. | `/t/toyota` |
| Toyota Live | administrator | New message, Room settings, Disable sounds, Enable notifications. All messages absent. | `/t/toyota` |
| Direct `/messages/direct/1` | member `r3member` | New message only. Header class `MessagesConversationHeader--direct`. Recipient title preserved. No PUBLIC/LIVE treatment. History present. | `/messages` |
| Toyota Live exact route | member `r3member` | Not opened. The route shows "This live chat isn't available." | n/a |

Keyboard: Space on the focused General Live overflow button opened the menu. Enter did not. Removed All messages is absent from the accessibility tree, not only hidden.

Measured CSS viewports, authenticated:

| Viewport | General Live | Toyota Live | Direct |
| --- | --- | --- | --- |
| 360 | overflow 0, slots 44px | overflow 0, slots 44px, menu inside the viewport | overflow 0, slots 44px |
| 390 | overflow 0, slots 44px | overflow 0, slots 44px | overflow 0, slots 44px |
| 412 | overflow 0, slots 44px | overflow 0, slots 44px | overflow 0, slots 44px |
| Desktop | innerWidth 1766, scrollWidth 1751 (scrollbar rounding) | room info open, overflow 0 | innerWidth 1766, scrollWidth 1751, header `--direct` |

Physical Samsung SM-S916U / Android 16 was not connected. The attached Pixel 5 / Android 14 was not treated as that device. `ANDROID_PHYSICAL_ACCEPTANCE=NOT_PROVEN`.

PR #22 was not changed. Head remains `7a31f0e917c1d3939d0ff606883ab094be444e3b`. `HEADER_RECONCILIATION=PRESERVED_MAIN_HEADER_PR22_NOT_MERGED`.

Local evidence, not committed: `/home/ilove/dev/_disposable/forum-live-ui-cleanup-001-r3/evidence/`.

Follow-ups outside this work order: the disposable maintenance banner overlaps the mobile conversation header, and a generic full-site load alert can appear alongside an otherwise rendered conversation. Neither changed these overflow results.

## R5 Pixel 5 physical acceptance

**Work order:** FORUM-LIVE-UI-CLEANUP-001-R5
**Date:** 2026-10-19
**Merged:** PR #25 merge commit `336acce1c52329a86595204a5bd99c8ecbe91ecc`
**Installed revision during the phone test:** `42df3062727922ffd5f0eae3890280a9d68da765`

The R3 Samsung result remains unproven. Samsung-specific and Android 16 testing are not required for this overflow change. The physical browser was Pixel 5, Android 14, Chrome 155.0.8059.79.

Portrait CSS viewport: 392 by 721, devicePixelRatio 2.75, no horizontal overflow. The first tap opened the overflow. General Live and Toyota Live showed New message, Room info, Disable sounds, and Enable notifications, without All messages or its inbox icon. Sounds toggled and were restored. Direct kept the recipient title and direct header class; its overflow was New message only. Back went to `/`, `/t/toyota`, and `/messages`.

Landscape CSS viewport was 801 by 284. The overflow remained reachable and did not show All messages. Back was `display: none` because the width crossed the existing 768px rule. Portrait restored the 44px Back control. R5 did not treat that hidden control as a failure of the All messages removal. R6 addresses the missing route-aware exit below.

PR #22 was not changed. Production was not deployed.

`PHYSICAL_ANDROID_WEB_UI_ACCEPTANCE=PASS` on Pixel 5. `SAMSUNG_ANDROID16=NOT_TESTED`.

## R6 Landscape conversation exit

On the same Pixel 5 landscape viewport, 801 by 284:

| Check | Result |
| --- | --- |
| Back in the DOM | yes |
| Back computed display | `none` |
| Responsible rule | `@media (min-width: 768px)` in `resources/less/forum.less` |
| Directory | visible, 320px, links stay on `/messages/...` |
| Site navigation | `display: none` |

The directory is the wide-layout conversation list. It does not navigate to `/`, `/t/toyota`, or `/messages`. Browser Back is not treated as the in-app exit. The correction restores the existing Back button when the viewport is at least 768px wide and at most 500px tall. Desktop heights still hide Back. All messages stays out of the overflow.

Pixel 5 retest: landscape 801 by 284 showed Back at 44 by 44. Physical taps went from General Live to `/`, Toyota Live to `/t/toyota`, and Direct to `/messages`. At 1280 by 800, Back stayed `display: none`. Portrait 392 by 721 kept the 44px Back control.
