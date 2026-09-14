import test from 'node:test';
import assert from 'node:assert/strict';
import filterConversations, { parseFilter } from '../src/forum/utils/filterConversations.js';
import searchConversations from '../src/forum/utils/searchConversations.js';

const rows = [
  { id: 'live:1', kind: 'live', title: 'General', identities: ['general'], unreadCount: 0, body: 'should not match needle-body' },
  { id: 'direct:1', kind: 'direct', title: 'Wrench', identities: ['tech_327', 'wrench'], unreadCount: 3, preview: 'needle-preview' },
  { id: 'live:2', kind: 'live', title: 'Toyota Live', identities: ['toyota-live'], unreadCount: 1 },
];

test('All/Unread/Direct/Live filters', () => {
  assert.equal(filterConversations(rows, 'all').length, 3);
  assert.deepEqual(
    filterConversations(rows, 'unread').map((row) => row.id),
    ['direct:1', 'live:2']
  );
  assert.deepEqual(
    filterConversations(rows, 'direct').map((row) => row.id),
    ['direct:1']
  );
  assert.deepEqual(
    filterConversations(rows, 'live').map((row) => row.id),
    ['live:1', 'live:2']
  );
});

test('invalid filter defaults to All', () => {
  assert.equal(parseFilter('nope'), 'all');
  assert.equal(parseFilter(''), 'all');
  assert.equal(filterConversations(rows, 'unknown').length, 3);
});

test('identity search', () => {
  assert.deepEqual(
    searchConversations(rows, 'tech_327').map((row) => row.id),
    ['direct:1']
  );
  assert.deepEqual(
    searchConversations(rows, 'toyota').map((row) => row.id),
    ['live:2']
  );
});

test('search does not use body preview fields', () => {
  assert.equal(searchConversations(rows, 'needle-body').length, 0);
  assert.equal(searchConversations(rows, 'needle-preview').length, 0);
});
