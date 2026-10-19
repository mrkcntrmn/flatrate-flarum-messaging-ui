import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import resolveConversationBackHref from '../src/forum/utils/resolveConversationBackHref.js';
import { omitRetiredOverflowKeys, shellHeaderOverflowPlan, visibleOverflowKeys } from '../src/forum/utils/shellOverflowPolicy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fakeItemList(keys) {
  const items = new Map(keys.map((key) => [key, { key }]));
  return {
    items,
    remove(key) {
      items.delete(key);
      return this;
    },
    keys() {
      return [...items.keys()];
    },
  };
}

const liveProviderKeys = ['liveSettings', 'liveSound', 'liveNotifications', 'allMessages'];

test('shell overflow plan keeps New message and drops All messages', () => {
  assert.deepEqual(shellHeaderOverflowPlan({ canCompose: true }), ['newMessage']);
  assert.deepEqual(shellHeaderOverflowPlan({ canCompose: false }), []);
  assert.equal(shellHeaderOverflowPlan({ canCompose: true }).includes('allMessages'), false);
});

test('General, Brand, and Direct overflow cannot regain All messages from a provider', () => {
  for (const label of ['general-live', 'brand-live', 'direct']) {
    const keys = visibleOverflowKeys({
      canCompose: true,
      providerKeys: label === 'direct' ? ['directMute', 'allMessages'] : liveProviderKeys,
    });
    assert.equal(keys.includes('allMessages'), false, label);
    assert.equal(keys.includes('newMessage'), true, label);
    if (label === 'direct') {
      assert.deepEqual(keys, ['directMute', 'newMessage']);
    } else {
      assert.deepEqual(keys, ['liveSettings', 'liveSound', 'liveNotifications', 'newMessage']);
    }
  }
});

test('retired overflow keys are removed from a merged item list', () => {
  const list = fakeItemList(['liveSettings', 'allMessages', 'newMessage']);
  omitRetiredOverflowKeys(list);
  assert.deepEqual(list.keys(), ['liveSettings', 'newMessage']);
});

test('header Back destinations stay on the existing route contract', () => {
  const routes = {
    hrefForBoardKey(key) {
      return key === 'toyota' ? '/t/toyota' : null;
    },
  };
  assert.equal(resolveConversationBackHref('live', { sourceId: 'community-general-live' }, routes), '/');
  assert.equal(resolveConversationBackHref('live', { sourceId: 'toyota-live' }, routes), '/t/toyota');
  assert.equal(resolveConversationBackHref('direct', { sourceId: '42' }, routes), '/messages');

  const page = read('js/src/forum/components/MessagesPage.js');
  const overflow = read('js/src/forum/utils/buildShellHeaderOverflowItems.js');
  const header = read('js/src/forum/components/MessagesConversationHeader.js');
  assert.match(page, /backFromConversation\(kind, conversation\)/);
  assert.match(page, /resolveConversationBackHref/);
  assert.doesNotMatch(overflow, /history\.back|popstate/);
  assert.doesNotMatch(page, /history\.back|popstate/);
  assert.match(header, /accessibleToggleLabel=\{menuLabel\}/);
  assert.match(header, /MessagesConversationHeader-back/);
  assert.match(header, /<span>PUBLIC<\/span>/);
  assert.match(header, /fas fa-globe MessagesConversationHeader-liveGlobe/);
  assert.match(header, /<span>LIVE<\/span>/);
  assert.match(header, /MessagesConversationHeader-liveCount/);
  assert.match(header, /MessagesConversationHeader-avatar/);
});
