import test from 'node:test';
import assert from 'node:assert/strict';
import MessagingState from '../src/forum/state/MessagingState.js';
import { productMode } from '../src/forum/utils/discoverSources.js';

const liveRow = { id: 'general', title: 'General', activityAt: 20, unreadCount: 1 };
const directRow = { id: '9', title: 'Wrench', kind: 'direct', activityAt: 10, unreadCount: 0 };

function liveProvider(rows = [liveRow]) {
  return {
    listConversations: async () => rows,
    getUnreadTotal: () => 1,
    renderConversation() {
      return null;
    },
  };
}

function directProvider(rows = [directRow]) {
  return {
    listConversations: async () => rows,
    getUnreadTotal: () => 0,
    findConversationWithUser() {
      return null;
    },
    startConversationWithUser() {},
    renderConversation() {
      return null;
    },
  };
}

test('fixtures: live-only, direct-only, both, neither', async () => {
  const liveOnly = new MessagingState({ sources: () => ({ live: liveProvider(), direct: null }) });
  await liveOnly.refresh();
  assert.equal(liveOnly.productMode(), 'live');
  assert.equal(liveOnly.conversations.length, 1);
  assert.equal(liveOnly.conversations[0].kind, 'live');

  const directOnly = new MessagingState({ sources: () => ({ live: null, direct: directProvider() }) });
  await directOnly.refresh();
  assert.equal(directOnly.productMode(), 'direct');
  assert.equal(directOnly.conversations.length, 1);
  assert.equal(directOnly.conversations[0].kind, 'direct');

  const both = new MessagingState({ sources: () => ({ live: liveProvider(), direct: directProvider() }) });
  await both.refresh();
  assert.equal(both.productMode(), 'unified');
  assert.equal(both.conversations.length, 2);

  const neither = new MessagingState({ sources: () => ({ live: null, direct: null }) });
  await neither.refresh();
  assert.equal(neither.productMode(), 'unavailable');
  assert.equal(neither.conversations.length, 0);
  assert.equal(productMode({ live: null, direct: null }), 'unavailable');
});

test('provider missing gracefully for listConversations', async () => {
  const state = new MessagingState({ sources: () => ({ live: { getUnreadTotal: () => 4 }, direct: null }) });
  await state.refresh();
  assert.deepEqual(state.conversations, []);
  assert.equal(state.errors.live, null);
  assert.equal(state.unreadTotal(), 4);
});

test('provider failure gracefully (listConversations throw -> empty + error flag, not crash)', async () => {
  const state = new MessagingState({
    sources: () => ({
      live: {
        async listConversations() {
          throw new Error('live down');
        },
        getUnreadTotal: () => 0,
      },
      direct: directProvider(),
    }),
  });
  const rows = await state.refresh();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'direct');
  assert.equal(state.errors.live, 'live down');
  assert.equal(state.errors.direct, null);
});
