import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import normalizeConversation from '../src/forum/utils/normalizeConversation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const liveRaw = {
  id: '1',
  roomKey: 'general',
  title: 'General',
  unreadCount: 2,
  activityAt: '2026-09-14T12:00:00.000Z',
  preview: 'secret preview',
  body: 'secret body',
  lastMessage: { content: 'hello' },
  icon: 'fas fa-comments',
};

const directRaw = {
  id: '1',
  kind: 'direct',
  unreadCount: 4,
  updatedAt: '2026-09-14T11:00:00.000Z',
  preview: 'dm preview',
  body: 'dm body',
  lastMessage: { message: 'hi' },
  recipients: [{ username: 'tech_327', displayName: 'Wrench', avatarUrl: 'https://example.test/a.png' }],
};

test('normalizes Live row', () => {
  const row = normalizeConversation(liveRaw, 'live');
  assert.equal(row.kind, 'live');
  assert.equal(row.sourceId, 'general');
  assert.equal(row.id, 'live:general');
  assert.equal(row.title, 'General');
  assert.equal(row.privacy, 'public');
  assert.equal(row.privacyLabel, 'Public room');
  assert.equal(row.unreadCount, 2);
  assert.equal(row.icon, 'fas fa-comments');
  assert.equal(row.activityAt, Date.parse('2026-09-14T12:00:00.000Z'));
});

test('normalizes Direct row', () => {
  const row = normalizeConversation(directRaw, 'direct');
  assert.equal(row.kind, 'direct');
  assert.equal(row.sourceId, '1');
  assert.equal(row.id, 'direct:1');
  assert.equal(row.title, 'Wrench');
  assert.equal(row.privacy, 'private');
  assert.equal(row.privacyLabel, 'Private');
  assert.equal(row.unreadCount, 4);
  assert.equal(row.avatarUrl, 'https://example.test/a.png');
  assert.ok(row.identities.includes('tech_327'));
});

test('namespaced IDs do not collide', () => {
  const live = normalizeConversation(liveRaw, 'live');
  const direct = normalizeConversation({ ...directRaw, id: 'general', recipients: [] }, 'direct');
  assert.equal(live.id, 'live:general');
  assert.equal(direct.id, 'direct:general');
  assert.notEqual(live.id, direct.id);
});

test('no body preview field in normalized output', () => {
  const live = normalizeConversation(liveRaw, 'live');
  const direct = normalizeConversation(directRaw, 'direct');
  for (const row of [live, direct]) {
    assert.equal('body' in row, false);
    assert.equal('preview' in row, false);
    assert.equal('lastMessage' in row, false);
    assert.equal('last_message' in row, false);
    assert.equal('message' in row, false);
    assert.equal('content' in row, false);
  }
});

test('row contract source ignores body/preview', () => {
  const src = readFileSync(join(ROOT, 'js/src/forum/components/ConversationRow.js'), 'utf8');
  assert.match(src, /title/);
  assert.match(src, /privacy/);
  assert.match(src, /unreadCount/);
  assert.doesNotMatch(src, /\.body\b|\.preview\b|lastMessage/);
});
