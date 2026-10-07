import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_FILTERS, filterNotificationRows, parseNotificationFilter, sortNotificationRows } from '../src/forum/notifications/notificationFilters.js';

const rows = [
  { id: 'b', source: 'direct', activityAt: '2026-10-07T12:00:00.000Z' },
  { id: 'a', source: 'forum', activityAt: '2026-10-07T12:00:00.000Z' },
  { id: 'c', source: 'live', activityAt: '2026-10-07T13:00:00.000Z' },
];

test('filters are exactly All, Forum, and Messages', () => {
  assert.deepEqual(NOTIFICATION_FILTERS.map((filter) => filter.label), ['All', 'Forum', 'Messages']);
  assert.throws(() => parseNotificationFilter('direct'));
  assert.throws(() => parseNotificationFilter('live'));
  assert.throws(() => parseNotificationFilter('following'));
});

test('forum and messages partitions do not cross sources', () => {
  assert.deepEqual(filterNotificationRows(rows, 'forum').map((row) => row.id), ['a']);
  assert.deepEqual(filterNotificationRows(rows, 'messages').map((row) => row.source), ['direct', 'live']);
  assert.equal(filterNotificationRows(rows, 'all').length, 3);
});

test('ordering is activity then source then id', () => {
  assert.deepEqual(sortNotificationRows(rows).map((row) => row.id), ['c', 'b', 'a']);
});
