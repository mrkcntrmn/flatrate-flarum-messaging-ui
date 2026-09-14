import test from 'node:test';
import assert from 'node:assert/strict';
import combinedUnread from '../src/forum/utils/combinedUnread.js';

const source = (n) => ({ getUnreadTotal: () => n });

test('combined unread math', () => {
  assert.equal(combinedUnread(source(3), source(2)), 5);
  assert.equal(combinedUnread(source(0), source(4)), 4);
});

test('provider missing gracefully', () => {
  assert.equal(combinedUnread(null, source(2)), 2);
  assert.equal(combinedUnread(source(3), undefined), 3);
  assert.equal(combinedUnread(null, null), 0);
  assert.equal(combinedUnread({ listConversations() {} }, source(1)), 1);
});

test('provider failure gracefully for unread', () => {
  const throwing = {
    getUnreadTotal() {
      throw new Error('boom');
    },
  };
  assert.equal(combinedUnread(throwing, source(2)), 2);
  assert.equal(combinedUnread(source(3), throwing), 3);
});
