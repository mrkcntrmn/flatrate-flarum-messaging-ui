import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessagingPath, conversationPath, isUnifiedMessagesRoute } from '../src/forum/utils/messagingRoutes.js';

test('canonical live/direct route parse', () => {
  assert.deepEqual(parseMessagingPath('/messages'), {
    kind: null,
    key: null,
    route: 'flatrate-messaging.index',
  });
  assert.deepEqual(parseMessagingPath('/messages/live/x'), {
    kind: 'live',
    key: 'x',
    route: 'flatrate-messaging.live',
  });
  assert.deepEqual(parseMessagingPath('/messages/direct/1'), {
    kind: 'direct',
    key: '1',
    route: 'flatrate-messaging.direct',
  });
  assert.equal(conversationPath('live', 'general'), '/messages/live/general');
  assert.equal(conversationPath('direct', '9'), '/messages/direct/9');
});

test('false prefix and public forum paths are not messages routes', () => {
  assert.equal(parseMessagingPath('/messaging'), null);
  assert.equal(parseMessagingPath('/'), null);
  assert.equal(parseMessagingPath('/d/5-foo'), null);
  assert.equal(parseMessagingPath('/t/gm'), null);
  assert.equal(parseMessagingPath('/u/tech_x'), null);
  assert.equal(parseMessagingPath('/live/general'), null);
});

test('isUnifiedMessagesRoute guards brand injection', () => {
  assert.equal(isUnifiedMessagesRoute('/messages'), true);
  assert.equal(isUnifiedMessagesRoute('/messages?filter=live'), true);
  assert.equal(isUnifiedMessagesRoute('/messages/live/community-general-live'), true);
  assert.equal(isUnifiedMessagesRoute('/messages/direct/12'), true);
  assert.equal(isUnifiedMessagesRoute('/conversations'), false);
  assert.equal(isUnifiedMessagesRoute('/live'), false);
  assert.equal(isUnifiedMessagesRoute('/'), false);
  assert.equal(isUnifiedMessagesRoute('/messaging'), false);
});
