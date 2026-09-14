import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUnifiedMessagesRoute } from '../src/forum/utils/messagingRoutes.js';
import normalizeConversation from '../src/forum/utils/normalizeConversation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

test('brand link contract', () => {
  const brand = read('js/src/forum/components/MessagesBrandLink.js');
  assert.match(brand, /FlatRate\.wiki/);
  assert.match(brand, /https:\/\/forum\.flatrate\.wiki/);
  assert.match(brand, /MessagesBrandLink/);
  assert.match(brand, /isUnifiedMessagesRoute/);
  assert.match(brand, /aria-label/);
  const index = read('js/src/forum/index.js');
  assert.match(index, /HeaderPrimary/);
  assert.match(index, /FlatRateMessagesBrand/);
  assert.match(index, /MessagesBrandLink/);
});

test('direct conversation pane is kind-scoped', () => {
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /conversationChrome\(pane, \{ kind: selected\.kind, conversation \}\)/);
  assert.match(page, /MessagesPage-conversationPane--\$\{kind\}/);
  assert.match(page, /MessagesConversationHeader/);
  assert.doesNotMatch(page, /MessagesPage-back/);
});

test('direct polish CSS is Messages-scoped and leaves legacy ConversationsList alone', () => {
  const less = read('resources/less/forum.less');
  assert.match(less, /\.MessagesPage-conversationPane--direct/);
  assert.match(less, /\.chat > \.chat-header/);
  assert.match(less, /\.startConvo/);
  assert.match(less, /list-style:\s*none/);
  assert.match(less, /\.MessagesBrandLink/);
  assert.doesNotMatch(less, /\.ConversationsList\s*\{/);
  assert.doesNotMatch(less, /\.ConversationsList\s+\.chat/);
});

test('primary Live label fallback and no body preview regression', () => {
  const row = normalizeConversation(
    {
      kind: 'live',
      key: 'community-general-live',
      title: ['FlatRate.wiki Live'],
      roomKey: 'community-general-live',
      preview: 'secret',
      body: 'secret',
    },
    'live'
  );
  assert.equal(row.title, 'FlatRate.wiki Live');
  assert.equal(row.sourceId, 'community-general-live');
  assert.equal('preview' in row, false);
  assert.equal('body' in row, false);
  assert.ok(isUnifiedMessagesRoute('/messages/live/community-general-live'));
});
