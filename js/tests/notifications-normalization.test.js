import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForumNotification } from '../src/forum/notifications/normalizeForumNotification.js';
import { normalizeMessageConversation } from '../src/forum/notifications/normalizeMessageConversation.js';
import { forumInputFromResource } from '../src/forum/notifications/forumInputFromResource.js';
import { FORBIDDEN_PRESENTATION_FIELDS } from '../src/forum/notifications/forbiddenPresentationFields.js';

const forbidden = FORBIDDEN_PRESENTATION_FIELDS;

test('forum normalization drops message bodies and direct duplicates', () => {
  const kept = normalizeForumNotification({
    id: '15',
    contentType: 'newPost',
    isRead: false,
    createdAt: '2026-10-07T12:00:00.000Z',
    href: '/d/9',
    fromUser: { id: '725', username: 'tech_#725', displayName: 'tech_#725' },
    body: 'secret reply',
    message: 'secret reply',
    preview: 'secret',
    excerpt: 'secret',
  });
  assert.equal(kept.title, 'tech_#725 replied to your discussion');
  assert.equal(
    normalizeForumNotification({
      id: '18',
      contentType: 'postMentioned',
      fromUser: { id: '8', username: 'tech_8', displayName: 'tech_8' },
      href: '/d/9/5',
    }).title,
    'tech_8 replied to your post'
  );
  assert.equal(
    normalizeForumNotification({
      id: '19',
      contentType: 'groupMentioned',
      fromUser: { id: '2', username: 'admin_b', displayName: 'admin_b' },
      href: '/d/9/13',
    }).title,
    "admin_b mentioned a group you're a member of"
  );
  assert.equal(kept.source, 'forum');
  for (const field of forbidden) {
    assert.equal(Object.hasOwn(kept, field), false);
  }

  const duplicate = normalizeForumNotification({
    id: '16',
    contentType: 'newPrivateMessage',
    conversationId: '44',
    fromUser: { id: '8', username: 'tech_8' },
    message: 'dm body',
  }, new Set(['44']));
  assert.equal(duplicate, null);

  const unmatched = normalizeForumNotification({
    id: '17',
    contentType: 'newPrivateMessage',
    conversationId: '99',
    createdAt: '2026-10-07T12:00:00.000Z',
    fromUser: { id: '8', username: 'tech_8', displayName: 'tech_8' },
    message: 'dm body',
  }, new Set(['44']));
  assert.equal(unmatched.source, 'forum');
  assert.equal(Object.hasOwn(unmatched, 'message'), false);
});

test('api resource keeps conversation id and drops the message body', () => {
  const input = forumInputFromResource({
    id: '3',
    attributes: {
      contentType: 'newPrivateMessage',
      content: { message: 'private body', conversation: { id: 44 } },
      href: '/d/planted-by-the-api',
      isRead: false,
      createdAt: '2026-10-07T12:00:00.000Z',
    },
    relationships: { fromUser: { data: { type: 'users', id: '8' } } },
  }, [{
    id: '8',
    attributes: { username: 'tech_8', displayName: 'tech_8' },
  }]);
  assert.equal(input.conversationId, '44');
  assert.equal(input.href, '');
  assert.equal(input.targetUnavailable, true);
  assert.equal(Object.hasOwn(input, 'message'), false);
  assert.equal(JSON.stringify(input).includes('private body'), false);
});

test('message rows reject bodies and hidden live rooms', () => {
  const direct = normalizeMessageConversation({
    kind: 'direct',
    conversationId: '44',
    title: 'tech_8',
    unreadCount: 1,
    activityAt: '2026-10-07T12:00:00.000Z',
    message: 'dm body',
    lastMessage: { body: 'dm body' },
    preview: 'dm body',
  });
  assert.equal(direct.href, '/messages/direct/44');
  assert.equal(direct.canMessageActor, false);
  for (const field of forbidden) {
    assert.equal(Object.hasOwn(direct, field), false);
  }
  assert.equal(JSON.stringify(direct).includes('dm body'), false);

  const hidden = normalizeMessageConversation({
    kind: 'live',
    roomKey: 'aston-martin-live',
    title: 'Aston Martin',
    visibility: 'hidden',
    unreadCount: 4,
    activityAt: '2026-10-07T12:00:00.000Z',
    lastMessage: { message: 'hidden body' },
  });
  assert.equal(hidden, null);

  const unauthorized = normalizeMessageConversation({
    kind: 'live',
    roomKey: 'aston-martin-live',
    title: 'Aston Martin',
    unreadCount: 2,
    activityAt: '2026-10-07T12:00:00.000Z',
  }, { authorizedRoomKeys: new Set(['community-general-live']) });
  assert.equal(unauthorized, null);

  const live = normalizeMessageConversation({
    kind: 'live',
    roomKey: 'community-general-live',
    title: 'FlatRate.wiki',
    unreadCount: 2,
    activityAt: '2026-10-07T12:00:00.000Z',
    lastMessage: { message: 'live body' },
  }, { authorizedRoomKeys: new Set(['community-general-live']) });
  assert.equal(live.href, '/messages/live/community-general-live');
  assert.equal(JSON.stringify(live).includes('live body'), false);
});
