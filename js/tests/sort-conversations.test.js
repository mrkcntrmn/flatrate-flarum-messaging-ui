import test from 'node:test';
import assert from 'node:assert/strict';
import sortConversations from '../src/forum/utils/sortConversations.js';

test('activity sort descending', () => {
  const rows = sortConversations([
    { id: 'a', title: 'a', kind: 'live', activityAt: 100 },
    { id: 'b', title: 'b', kind: 'live', activityAt: 300 },
    { id: 'c', title: 'c', kind: 'live', activityAt: 200 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ['b', 'c', 'a']
  );
});

test('null activity sorts last', () => {
  const rows = sortConversations([
    { id: 'n', title: 'n', kind: 'live', activityAt: null },
    { id: 'a', title: 'a', kind: 'live', activityAt: 1 },
    { id: 'm', title: 'm', kind: 'direct', activityAt: undefined },
  ]);
  assert.equal(rows[0].id, 'a');
  assert.deepEqual(
    rows.slice(1).map((row) => row.id),
    ['m', 'n']
  );
});

test('stable tie sorting', () => {
  const rows = sortConversations([
    { id: 'live:b', title: 'Same', kind: 'live', activityAt: 50 },
    { id: 'direct:a', title: 'Same', kind: 'direct', activityAt: 50 },
    { id: 'live:a', title: 'Same', kind: 'live', activityAt: 50 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ['direct:a', 'live:a', 'live:b']
  );
});
