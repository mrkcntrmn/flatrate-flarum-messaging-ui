# FORUM-MESSAGES-OVERFLOW-UX-001 — Remove redundant All messages menu action

**Date:** 2026-10-19
**Work order:** FORUM-LIVE-UI-CLEANUP-001-R2
**Status:** source implemented and locally built. Draft PR only. Not merged, not deployed, not production-verified.

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

GitHub check run IDs are recorded after the exact-head CI result. A green check is not a deployment.

## Lifecycle

| Stage | State |
| --- | --- |
| Source implemented | yes, on draft PR #25 |
| Built | yes, local Node 20 production build |
| CI qualified | pending the exact-head run for this revision |
| Draft PR ready | after that run is green |
| Merged | no |
| Deployed | no |
| Production verified | no |

**Paired candidate:** `flatrate-flarum-live-chat` PR #52 hides participant chips in read-only Live Room info.
