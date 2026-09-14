import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MessagingState from '../src/forum/state/MessagingState.js';
import directConversationPaneStatus from '../src/forum/utils/directConversationPaneStatus.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageSrc = readFileSync(join(ROOT, 'src/forum/components/MessagesPage.js'), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('direct canonical route pane starts in loading, not a blank empty state', () => {
  assert.equal(directConversationPaneStatus({ status: 'idle' }, '5'), 'loading');
  assert.equal(directConversationPaneStatus(null, '5'), 'loading');
  assert.equal(directConversationPaneStatus({ status: 'loading', kind: 'direct', key: '5' }, '5'), 'loading');
  assert.match(pageSrc, /paneStatus === 'loading'/);
  assert.match(pageSrc, /<LoadingIndicator \/>/);
  assert.doesNotMatch(pageSrc, /empty_title/);
});

test('resolved conversation is the only Direct path that renders the provider view', () => {
  assert.equal(directConversationPaneStatus({ status: 'ready', kind: 'direct', key: '5' }, '5'), 'ready');
  const loadingReturn = pageSrc.indexOf("paneStatus === 'loading'");
  const renderCall = pageSrc.indexOf('provider.renderConversation');
  assert.ok(loadingReturn >= 0 && renderCall > loadingReturn);
});

test('not-found Direct route uses a generic unavailable state', () => {
  assert.equal(directConversationPaneStatus({ status: 'not-found', kind: 'direct', key: '5' }, '5'), 'not-found');
  assert.match(pageSrc, /conversation_unavailable/);
  assert.doesNotMatch(pageSrc, /tech_alpha|tech_beta|participant/);
});

test('provider error does not leave a permanent blank pane', () => {
  assert.equal(directConversationPaneStatus({ status: 'error', kind: 'direct', key: '5' }, '5'), 'error');
  assert.match(pageSrc, /conversation_error/);
  assert.match(pageSrc, /conversation_retry/);
  assert.match(pageSrc, /resolveDirectSelection\(selected\.key\)/);
});

test('MessagingState Direct resolve: loading then ready', async () => {
  const pending = deferred();
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        resolveConversation: (id) => {
          assert.equal(id, '5');
          return pending.promise;
        },
      },
    }),
  });

  const resolving = state.resolveDirectSelection('5');
  assert.equal(state.selection.status, 'loading');
  assert.equal(directConversationPaneStatus(state.selection, '5'), 'loading');
  pending.resolve({ id: () => '5', recipients: () => [{}] });
  const result = await resolving;
  assert.equal(result.status, 'ready');
  assert.equal(state.selection.status, 'ready');
  assert.equal(state.selection.key, '5');
});

test('MessagingState Direct resolve: null is not-found', async () => {
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        async resolveConversation() {
          return null;
        },
      },
    }),
  });
  const result = await state.resolveDirectSelection('999');
  assert.equal(result.status, 'not-found');
  assert.equal(result.error, null);
});

test('MessagingState Direct resolve: thrown error is retryable error state', async () => {
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        async resolveConversation() {
          throw new Error('provider exploded');
        },
      },
    }),
  });
  const result = await state.resolveDirectSelection('5');
  assert.equal(result.status, 'error');
  assert.equal(result.error, 'provider exploded');
});

test('route id change resolves the new target', async () => {
  const seen = [];
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        async resolveConversation(id) {
          seen.push(id);
          return { id: () => id, recipients: () => [{}] };
        },
      },
    }),
  });
  await state.resolveDirectSelection('5');
  await state.resolveDirectSelection('6');
  assert.deepEqual(seen, ['5', '6']);
  assert.equal(state.selection.key, '6');
  assert.equal(state.selection.status, 'ready');
});

test('stale prior Direct resolution cannot overwrite the current target', async () => {
  const pending = {
    5: deferred(),
    6: deferred(),
  };
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        resolveConversation(id) {
          return pending[id].promise;
        },
      },
    }),
  });

  const first = state.resolveDirectSelection('5');
  const second = state.resolveDirectSelection('6');
  pending[5].resolve({ id: () => '5', recipients: () => [{}] });
  await first;
  assert.equal(state.selection.key, '6');
  assert.equal(state.selection.status, 'loading');
  pending[6].resolve({ id: () => '6', recipients: () => [{}] });
  await second;
  assert.equal(state.selection.key, '6');
  assert.equal(state.selection.status, 'ready');
});

test('loaded Direct conversation is a store hit and skips fetch', () => {
  let fetches = 0;
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        getLoadedConversation(id) {
          return id === '5' ? { id: () => '5', recipients: () => [{}] } : null;
        },
        async resolveConversation() {
          fetches += 1;
          return { id: () => '5' };
        },
      },
    }),
  });
  const started = state.ensureDirectSelection('5');
  assert.equal(started, null);
  assert.equal(state.selection.status, 'ready');
  assert.equal(fetches, 0);
  assert.equal(state.ensureDirectSelection('5'), null);
});

test('ensureDirectSelection does not restart an in-flight or terminal resolve', async () => {
  let fetches = 0;
  const pending = deferred();
  const state = new MessagingState({
    sources: () => ({
      live: null,
      direct: {
        resolveConversation() {
          fetches += 1;
          return pending.promise;
        },
      },
    }),
  });
  const first = state.ensureDirectSelection('5');
  assert.equal(typeof first.then, 'function');
  assert.equal(state.ensureDirectSelection('5'), null);
  pending.resolve({ id: () => '5', recipients: () => [{}] });
  await first;
  assert.equal(state.ensureDirectSelection('5'), null);
  assert.equal(fetches, 1);
});
