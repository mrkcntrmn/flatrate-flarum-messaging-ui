# FORUM-MESSAGES-OVERFLOW-UX-001 — Remove redundant All messages menu action

**Date:** 2026-10-19  
**Status:** source-only draft candidate. Production untouched.

## Work contract

- **WORK_ORDER:** FORUM-MESSAGES-OVERFLOW-UX-001
- **OUTCOME:** The Messages conversation overflow menu no longer displays `All messages` (and its inbox icon) for General Live, Brand Live, or Direct.
- **BOUNDARIES:** menu presentation only; keep the existing header Back control, its established General/Brand/Direct routing, `New message`, provider Live controls, Direct provider actions, and other notification/mute choices.
- **SOURCE_OF_TRUTH:** `js/src/forum/utils/buildShellHeaderOverflowItems.js` and the existing `ui-polish-001ui.test.js` contract.
- **DONE:** Shell produces `newMessage` when Direct compose is available, produces no `allMessages`; tests pass and distributable bundles are rebuilt and qualified.
- **CONSEQUENTIAL_BOUNDARY:** no release, production package install, feature activation or deployment without authorization.

The existing `onBack` argument is intentionally tolerated for header compatibility; the header's physical Back button remains the navigation affordance. The translation key can remain for backwards compatibility; this source no longer renders it.

## PR coordination

A concurrent header-unification candidate, messaging-ui **PR #22**, modifies `js/tests/ui-polish-001ui.test.js` and the header itself. This change edits only the shared overflow builder and the two existing test assertions about `All messages`; reconcile the tests with #22 before either merge. Do not overwrite #22 header changes.

## Qualify before promotion

1. Run `cd js && npm test && npm run build` and verify the exact-head tracked `js/dist` bundle requirements.
2. Confirm on mobile and desktop that Live/Direct overflow lacks `All messages`, New message remains when authorized, and Live Room info / sounds / notification controls still appear.
3. Confirm Back from General Live, Brand Live, and Direct reaches its previously approved destination, without using the removed overflow action.
4. Maintain separate production/release authorization. A green PR does not imply installed assets changed.

**Paired candidate:** `flatrate-flarum-live-chat` removes participant chips from read-only Live room info without changing membership or moderator user management.
