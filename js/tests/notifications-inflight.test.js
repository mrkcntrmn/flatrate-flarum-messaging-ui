import test from 'node:test';
import assert from 'node:assert/strict';
import NotificationInboxState from '../src/forum/notifications/NotificationInboxState.js';

function deferred() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function stateWith(gate) {
  return new NotificationInboxState({
    loadForumCount: () => gate.promise.then(() => 4),
    loadForumNotifications: () => gate.promise.then(() => [{
      id: '1',
      contentType: 'newPost',
      href: '/d/1/2',
      fromUser: { id: '8', username: 'tech_8', displayName: 'tech_8' },
    }]),
    loadDirect: () => gate.promise.then(() => ({ rows: [], unreadTotal: 1 })),
    loadLive: () => gate.promise.then(() => ({ rows: [], unreadTotal: 1 })),
  });
}

test('logout, account switch, and gate loss drop in-flight rows', async () => {
  const logoutGate = deferred();
  const logout = stateWith(logoutGate);
  logout.setSignedIn(true);
  logout.setAvailable(true);
  logout.setActor('1');
  const logoutRefresh = logout.refresh();
  logout.setSignedIn(false);
  logoutGate.release();
  await logoutRefresh;
  assert.equal(logout.rows().length, 0);
  assert.equal(logout.forum.count, null);

  const switchGate = deferred();
  const switched = stateWith(switchGate);
  switched.setSignedIn(true);
  switched.setAvailable(true);
  switched.setActor('1');
  const switchRefresh = switched.refresh();
  switched.setActor('2');
  switchGate.release();
  await switchRefresh;
  assert.equal(switched.rows().length, 0);

  const gateOff = deferred();
  const closed = stateWith(gateOff);
  closed.setSignedIn(true);
  closed.setAvailable(true);
  closed.setActor('1');
  const closedRefresh = closed.refresh();
  closed.setAvailable(false);
  gateOff.release();
  await closedRefresh;
  assert.equal(closed.rows().length, 0);
  assert.equal(closed.available, false);
});

test('a forum count refresh after logout does not apply', async () => {
  const gate = deferred();
  const state = new NotificationInboxState({
    loadForumCount: () => gate.promise.then(() => 9),
  });
  state.setSignedIn(true);
  state.setAvailable(true);
  state.setActor('1');
  const pending = state.refreshForumCount();
  state.setSignedIn(false);
  gate.release();
  await pending;
  assert.equal(state.forum.count, null);
});
