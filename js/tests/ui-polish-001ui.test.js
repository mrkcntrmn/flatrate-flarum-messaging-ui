import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMessagesIndexRoute, isUnifiedMessagesRoute } from '../src/forum/utils/messagingRoutes.js';
import normalizeConversation from '../src/forum/utils/normalizeConversation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

test('Messages brand link is removed from Messages routes', () => {
  assert.equal(existsSync(join(ROOT, 'js/src/forum/components/MessagesBrandLink.js')), false);
  const index = read('js/src/forum/index.js');
  assert.doesNotMatch(index, /MessagesBrandLink|FlatRateMessagesBrand|HeaderPrimary/);
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.doesNotMatch(page, /MessagesBrandLink|BRAND_HREF|mobilePinned.*Brand/);
  const less = read('resources/less/forum.less');
  assert.doesNotMatch(less, /MessagesBrandLink/);
});

test('visible Messages heading is replaced with accessible hidden heading', () => {
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /MessagesPage-title visually-hidden/);
  assert.doesNotMatch(page, /MessagesPage-directoryHeader/);
  assert.doesNotMatch(page, /MessagesPage-compose/);
  const less = read('resources/less/forum.less');
  assert.match(less, /\.MessagesPage-title\.visually-hidden/);
});

test('compose lives in directory app bar via canonical service, not conversation chrome', () => {
  const index = read('js/src/forum/index.js');
  assert.match(index, /HeaderSecondary/);
  assert.match(index, /FlatRateMessagesCompose/);
  assert.match(index, /MessagesComposeButton/);
  const compose = read('js/src/forum/components/MessagesComposeButton.js');
  assert.match(compose, /fas fa-pen/);
  assert.match(compose, /composeDirect/);
  assert.match(compose, /isMessagesIndexRoute/);
  assert.doesNotMatch(compose, /isUnifiedMessagesRoute/);
  assert.match(compose, /session\.user/);
  assert.match(compose, /sources\(\)\.direct|sources\.direct/);
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /MessagesComposeButton--mobilePinned|mobilePinned=\{true\}/);
  assert.match(page, /app\.flatrateMessaging\.composeDirect\(\)/);
  assert.doesNotMatch(page, /composeDirect\s*\(\s*\)\s*\{/); // no local compose method
  const service = read('js/src/forum/createMessagingService.js');
  assert.match(service, /composeDirect\s*\(\)\s*\{/);
  assert.match(service, /startConversationWithUser\(null/);
});

test('Messages index route helper excludes Direct and Live conversations', () => {
  assert.equal(isMessagesIndexRoute('/messages'), true);
  assert.equal(isMessagesIndexRoute('/messages?filter=unread'), true);
  assert.equal(isMessagesIndexRoute('/messages/direct/17'), false);
  assert.equal(isMessagesIndexRoute('/messages/live/community-general-live'), false);
  assert.equal(isMessagesIndexRoute('/messaging'), false);
});

test('ConversationRow exposes kind semantic classes', () => {
  const row = read('js/src/forum/components/ConversationRow.js');
  assert.match(row, /ConversationRow--live/);
  assert.match(row, /ConversationRow--direct/);
});

test('Live directory accent uses adaptive lime token', () => {
  const less = read('resources/less/forum.less');
  assert.match(less, /--messages-live-accent/);
  assert.match(less, /#84cc16/);
  assert.match(less, /\.ConversationRow--live \.ConversationRow-kind/);
  assert.match(less, /\.ConversationRow--live \.ConversationRow-privacy i/);
});

test('conversation header is shared back-title-overflow chrome', () => {
  const header = read('js/src/forum/components/MessagesConversationHeader.js');
  assert.match(header, /Button--flat MessagesConversationHeader-back/);
  assert.match(header, /MessagesConversationHeader-main/);
  assert.match(header, /MessagesConversationHeader-title/);
  assert.match(header, /Dropdown/);
  assert.match(header, /MessagesConversationHeader-menu/);
  assert.match(header, /fas fa-ellipsis-v/);
  assert.match(header, /conversation_options/);
  assert.match(header, /back_to_messages/);
  const less = read('resources/less/forum.less');
  assert.match(less, /\.MessagesConversationHeader-back/);
  assert.match(less, /\.MessagesConversationHeader-menuButton/);
  assert.match(less, /background:\s*transparent/);
});

test('mobile directory search is pinned between nav and compose controls', () => {
  const less = read('resources/less/forum.less');
  assert.match(
    less,
    /\.MessagesPage:not\(\.viewing-conversation\) \.MessagesPage-search\s*\{[\s\S]*position:\s*fixed[\s\S]*left:\s*60px[\s\S]*right:\s*60px/
  );
  assert.match(
    less,
    /\.MessagesPage:not\(\.viewing-conversation\) \.MessagesPage-search \.FormControl\s*\{[\s\S]*height:\s*44px/
  );
});

test('mobile conversation header replaces site chrome for Direct and Live', () => {
  const less = read('resources/less/forum.less');
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader\s*\{[\s\S]*position:\s*fixed[\s\S]*height:\s*var\(--messages-header-offset\)/
  );
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader-avatar,[\s\S]*\.MessagesConversationHeader-icon\s*\{[\s\S]*display:\s*none/
  );
  assert.match(less, /back \| title \| overflow/);
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
