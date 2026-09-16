import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIN_REMOTE_USER_QUERY_LENGTH,
  REMOTE_SEARCH_DEBOUNCE_MS,
  sanitizePeopleResults,
  createPeopleSearchController,
  toPeopleResult,
} from '../src/forum/utils/peopleSearch.js';
import { suggestPeople } from '../src/forum/utils/suggestPeople.js';
import searchConversations from '../src/forum/utils/searchConversations.js';
import flattenDiscoveryOptions from '../src/forum/utils/flattenDiscoveryOptions.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET = 'SECRET_MESSAGE_BODY_006UI';

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function user(id, name, extra = {}) {
  return {
    id: () => String(id),
    displayName: () => name,
    avatarUrl: () => extra.avatarUrl || null,
    email: () => extra.email || 'secret@example.com',
    phone: () => extra.phone || '555-0100',
  };
}

test('people search constants prefer 2-char remote queries with debounce', () => {
  assert.equal(MIN_REMOTE_USER_QUERY_LENGTH, 2);
  assert.ok(REMOTE_SEARCH_DEBOUNCE_MS >= 250 && REMOTE_SEARCH_DEBOUNCE_MS <= 400);
});

test('sanitizePeopleResults excludes self, dedupes, and strips private fields from row shape', () => {
  const rows = sanitizePeopleResults(
    [user(1, 'me'), user(2, 'tech_a', { email: 'a@x.com' }), user(2, 'tech_a_dup'), user(3, 'tech_b')],
    '1'
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['2', '3']
  );
  for (const row of rows) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'email'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'phone'), false);
    assert.ok(row.displayName);
    assert.ok(row.user);
  }
});

test('createPeopleSearchController ignores stale responses', async () => {
  const calls = [];
  let resolveSlow;
  const slow = new Promise((resolve) => {
    resolveSlow = resolve;
  });

  const controller = createPeopleSearchController({
    debounceMs: 0,
    actorId: '1',
    findUsers: async (q) => {
      calls.push(q);
      if (q === 'ab') {
        await slow;
        return [user(9, 'stale')];
      }
      return [user(4, 'fresh')];
    },
  });

  const results = [];
  controller.schedule('ab', (r) => results.push(r));
  // Allow the zero-debounce timer to queue the first search.
  await new Promise((r) => setTimeout(r, 5));
  controller.schedule('abc', (r) => results.push(r));
  await new Promise((r) => setTimeout(r, 5));
  resolveSlow([user(9, 'stale')]);
  await new Promise((r) => setTimeout(r, 5));

  const ready = results.filter((r) => r.status === 'ready');
  assert.ok(ready.length >= 1);
  assert.equal(ready[ready.length - 1].query, 'abc');
  assert.deepEqual(
    ready[ready.length - 1].users.map((u) => u.id),
    ['4']
  );
  assert.ok(!ready.some((r) => r.users.some((u) => u.id === '9')));
});

test('suggestPeople ranks Direct counterparts and never includes message bodies', () => {
  const people = suggestPeople({
    actorId: '1',
    conversations: [
      {
        kind: 'direct',
        userId: '7',
        title: 'tech_7',
        avatarUrl: null,
        activityAt: '2026-09-15T12:00:00.000Z',
        body: SECRET,
        preview: SECRET,
      },
      {
        kind: 'live',
        title: 'Live',
        activityAt: '2026-09-15T13:00:00.000Z',
        preview: SECRET,
      },
    ],
    followedUsers: [user(8, 'followed')],
  });

  assert.ok(people.some((p) => p.id === '7'));
  assert.ok(people.some((p) => p.id === '8' && p.hint === 'Following'));
  const serialized = JSON.stringify(people);
  assert.ok(!serialized.includes(SECRET));
  assert.ok(!serialized.includes('email'));
});

test('conversation identity search still ignores message body needles', () => {
  const rows = [
    {
      id: 'direct:1',
      kind: 'direct',
      title: 'Wrench',
      identities: ['tech_327'],
      body: 'transmission secret 74992',
      preview: 'transmission secret 74992',
    },
  ];
  assert.equal(searchConversations(rows, '74992').length, 0);
  assert.equal(searchConversations(rows, 'wrench').length, 1);
});

test('MessagesPage discovery wires people search and Direct reuse/start', () => {
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /Search messages or people|search_placeholder/);
  assert.match(page, /createPeopleSearchController/);
  assert.match(page, /suggestPeople/);
  assert.match(page, /openDirectToUser/);
  assert.match(page, /MessagesDiscoveryResults/);
  assert.match(page, /ArrowDown/);
  assert.match(page, /Escape/);
  assert.doesNotMatch(page, /No messages containing/);

  const locale = read('locale/en.yml');
  assert.match(locale, /search_placeholder:\s*Search messages or people/);
  assert.match(locale, /discovery_empty:\s*No conversations or people found/);
  assert.doesNotMatch(locale, /No messages containing/);

  const discovery = read('js/src/forum/components/MessagesDiscoveryResults.js');
  assert.doesNotMatch(discovery, /lastMessage|last_message\.message|messageBody|snippet|excerpt/);
  assert.doesNotMatch(discovery, /conversation\.(body|preview|message)\b/);
  assert.ok(!discovery.includes(SECRET));
});

test('composition still reuses existing Direct and starts when missing', () => {
  const service = read('js/src/forum/createMessagingService.js');
  assert.match(service, /findConversationWithUser/);
  assert.match(service, /startConversationWithUser/);
  assert.match(service, /openDirectToUser/);
});

test('flattenDiscoveryOptions orders conversations then people', () => {
  const options = flattenDiscoveryOptions([{ id: 'c1' }], [{ id: 'p1' }]);
  assert.equal(options[0].type, 'conversation');
  assert.equal(options[1].type, 'person');
});

test('toPeopleResult keeps only public-safe fields on the row', () => {
  const row = toPeopleResult(user(2, 'tech_x', { email: 'x@y.z', phone: '1' }));
  assert.deepEqual(Object.keys(row).sort(), ['avatarUrl', 'displayName', 'hint', 'id', 'user'].sort());
});
