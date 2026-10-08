import test from 'node:test';
import assert from 'node:assert/strict';
import NotificationInboxState from '../src/forum/notifications/NotificationInboxState.js';
import {
  REVALIDATION_INTERVAL_MS,
  classifyEligibilityFailure,
  classifyEligibilityHttpStatus,
  eligibilityTickAllowed,
} from '../src/forum/notifications/eligibilityRevalidation.js';

function ready() {
  const state = new NotificationInboxState();
  state.setSignedIn(true);
  state.setActor('6');
  state.setAvailable(true);
  state.forum = { status: 'known', rowsStatus: 'known', count: 4, rows: [{ id: 'forum:1' }], error: null };
  return state;
}

test('unread probe statuses stay distinct from transport failure', () => {
  assert.equal(classifyEligibilityHttpStatus(200), 'authorized');
  assert.equal(classifyEligibilityHttpStatus(403), 'denied');
  assert.equal(classifyEligibilityHttpStatus(401), 'signed-out');
  assert.equal(classifyEligibilityHttpStatus(500), 'unconfirmed');
  assert.equal(classifyEligibilityHttpStatus(undefined), 'unconfirmed');
  assert.equal(classifyEligibilityFailure({ status: 403 }), 'denied');
  assert.equal(classifyEligibilityFailure({ name: 'TypeError' }), 'unconfirmed');
  assert.equal(classifyEligibilityFailure(new Error('forum notification count unavailable')), null);
  assert.equal(REVALIDATION_INTERVAL_MS, 30000);
  assert.equal(eligibilityTickAllowed({ signedIn: true, visible: true, active: true }), true);
  assert.equal(eligibilityTickAllowed({ signedIn: true, visible: false, active: true }), false);
  assert.equal(eligibilityTickAllowed({ signedIn: false, visible: true, active: true }), false);
  assert.equal(eligibilityTickAllowed({ signedIn: true, visible: true, active: false }), false);
});

test('a newer denial wins over an older success', () => {
  const state = ready();
  const older = state.beginEligibilityProbe();
  const newer = state.beginEligibilityProbe();
  assert.equal(state.applyEligibility(newer, '6', 'denied'), true);
  assert.equal(state.available, false);
  assert.equal(state.rows().length, 0);
  assert.equal(state.forum.count, null);
  assert.equal(state.applyEligibility(older, '6', 'authorized'), false);
  assert.equal(state.available, false);
  assert.equal(state.unread().count, null);
});

test('a previous actor cannot restore eligibility after a switch', () => {
  const state = ready();
  const seq = state.beginEligibilityProbe();
  state.setActor('1');
  assert.equal(state.applyEligibility(seq, '6', 'authorized'), false);
  assert.equal(state.available, false);
  assert.equal(state.rows().length, 0);
  const next = state.beginEligibilityProbe();
  assert.equal(state.applyEligibility(next, '1', 'authorized'), true);
  assert.equal(state.available, true);
});

test('network failure fails closed without pretending the server denied the actor', () => {
  const state = ready();
  const seq = state.beginEligibilityProbe();
  assert.equal(state.applyEligibility(seq, '6', 'unconfirmed'), true);
  assert.equal(state.available, false);
  assert.equal(state.signedIn, true);
  assert.equal(state.rows().length, 0);
});

test('a 403 from the in-flight count drops rows and the badge', async () => {
  const error = Object.assign(new Error('denied'), { status: 403 });
  const state = new NotificationInboxState({
    loadForumCount: () => Promise.reject(error),
    loadForumNotifications: () => Promise.resolve([]),
    loadDirect: () => Promise.resolve({ rows: [], unreadTotal: 1 }),
    loadLive: () => Promise.resolve({ rows: [], unreadTotal: 2 }),
  });
  state.setSignedIn(true);
  state.setActor('6');
  state.setAvailable(true);
  await state.refresh();
  assert.equal(state.available, false);
  assert.equal(state.rows().length, 0);
  assert.equal(state.forum.count, null);
  assert.equal(state.direct.unreadTotal, null);
});
