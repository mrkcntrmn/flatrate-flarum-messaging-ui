import test from 'node:test';
import assert from 'node:assert/strict';
import { markForumNotificationRead } from '../src/forum/notifications/markForumNotificationRead.js';

test('forum row read uses the stored Flarum notification and skips other sources', () => {
  const calls = [];
  const store = {
    getById(type, id) {
      assert.equal(type, 'notifications');
      assert.equal(id, '15');
      return {
        isRead: () => false,
        save(attrs) {
          calls.push(attrs);
        },
      };
    },
  };
  assert.equal(markForumNotificationRead(store, { source: 'forum', id: 'forum:15' }), true);
  assert.deepEqual(calls, [{ isRead: true }]);
  assert.equal(markForumNotificationRead(store, { source: 'direct', id: 'direct:3' }), false);
  assert.equal(calls.length, 1);
});

test('an already-read forum notification is not saved again', () => {
  const store = {
    getById() {
      return { isRead: () => true, save() { throw new Error('saved'); } };
    },
  };
  assert.equal(markForumNotificationRead(store, { source: 'forum', id: 'forum:3' }), false);
});
