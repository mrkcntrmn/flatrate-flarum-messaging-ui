import test from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenFlarumPlusMessaging, unifiedUnread } from '../src/forum/notifications/unifiedUnread.js';
import NotificationInboxState from '../src/forum/notifications/NotificationInboxState.js';

test('unified badge adds non-message forum, direct, and live unread', () => {
  const badge = unifiedUnread({
    forum: { discovered: true, value: 5 },
    direct: { discovered: true, value: 2 },
    live: { discovered: true, value: 1 },
  });
  assert.equal(badge.status, 'known');
  assert.equal(badge.count, 8);
  assert.equal(badge.parts.forum.count, 5);
  assert.equal(badge.parts.direct.count, 2);
  assert.equal(badge.parts.live.count, 1);
});

test('one direct message is not counted twice', () => {
  const flarumTotalUnread = 7;
  const newPrivateMessageUnread = 2;
  const nonMessageFlarumUnread = flarumTotalUnread - newPrivateMessageUnread;
  const directUnread = 2;
  const liveUnread = 1;
  const badge = unifiedUnread({
    forum: { discovered: true, value: nonMessageFlarumUnread },
    direct: { discovered: true, value: directUnread },
    live: { discovered: true, value: liveUnread },
  });
  assert.equal(badge.count, 8);
  assert.notEqual(badge.count, forbiddenFlarumPlusMessaging(flarumTotalUnread, directUnread, liveUnread));
});

test('source failure is unknown rather than zero', () => {
  const badge = unifiedUnread({
    forum: { discovered: true, value: 4 },
    direct: { discovered: true, value: null, error: new Error('direct down') },
    live: { discovered: true, value: 1 },
  });
  assert.equal(badge.status, 'unknown');
  assert.equal(badge.count, null);
});

test('installed-absent providers are known zeroes and unresolved counts are not', () => {
  assert.equal(unifiedUnread({
    forum: { discovered: true, value: 0 },
    direct: { discovered: false },
    live: { discovered: false },
  }).count, 0);

  assert.equal(unifiedUnread({
    forum: { discovered: true, value: null },
    direct: { discovered: true, value: 0 },
    live: { discovered: true, value: 0 },
  }).status, 'unknown');
});

test('inbox state keeps forum rows when direct refresh fails and does not claim caught up', async () => {
  const state = new NotificationInboxState({
    loadForumCount: async () => 2,
    loadForumNotifications: async () => [{
      id: '9',
      contentType: 'postLiked',
      isRead: false,
      createdAt: '2026-10-07T12:00:00.000Z',
      href: '/d/1',
      fromUser: { id: '4', username: 'tech_4', displayName: 'tech_4' },
    }],
    loadDirect: async () => {
      throw new Error('direct down');
    },
    loadLive: async () => ({ rows: [], unreadTotal: 0 }),
  });
  state.setSignedIn(true);
  state.setAvailable(true);
  assert.equal(await state.refresh(), 'partial');
  assert.equal(state.rows().length, 1);
  assert.equal(state.unread().status, 'unknown');
  assert.notEqual(state.emptyState(), 'caught-up');
});
