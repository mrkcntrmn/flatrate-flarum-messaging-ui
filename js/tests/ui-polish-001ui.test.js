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
  assert.match(compose, /fas fa-plus/);
  assert.doesNotMatch(compose, /fas fa-pen/);
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
  const row = read('js/src/forum/components/ConversationRow.js');
  assert.match(row, /ConversationRow-livePresence/);
  assert.match(row, /var\(--messages-live-accent\)/);
  assert.match(row, /livePresenceText/);
  assert.match(row, /users live/);
});

test('directory status labels are PUBLIC for Live and PRIVATE for Direct', () => {
  const locale = read('locale/en.yml');
  assert.match(locale, /\n\s+live: PUBLIC\n/);
  assert.match(locale, /\n\s+direct: PRIVATE\n/);
  const row = read('js/src/forum/components/ConversationRow.js');
  assert.match(row, /fas fa-globe/);
  assert.match(row, /fas fa-lock/);
  assert.doesNotMatch(row, /ConversationRow-privacy-text/);
});

test('conversation header is shared back-title-overflow chrome', () => {
  const header = read('js/src/forum/components/MessagesConversationHeader.js');
  assert.match(header, /Button--flat MessagesConversationHeader-back/);
  assert.match(header, /MessagesConversationHeader-main/);
  assert.match(header, /MessagesConversationHeader-title/);
  assert.match(header, /Dropdown/);
  assert.match(header, /MessagesConversationHeader-overflow/);
  assert.match(header, /fas fa-ellipsis-v/);
  assert.doesNotMatch(header, /fas fa-ellipsis-h/);
  assert.match(header, /conversation_menu/);
  assert.match(header, /buildShellHeaderOverflowItems/);
  assert.match(header, /mergeHeaderOverflowItems/);
  // Overflow exists from shell items — not gated on provider item length.
  assert.doesNotMatch(header, /providerOverflowItems\?\.length/);
  assert.doesNotMatch(header, /overflowItems\.length\s*\?/);
  assert.doesNotMatch(header, /items\.length\s*\?\s*\n?\s*<Dropdown/);
  const less = read('resources/less/forum.less');
  assert.match(less, /\.MessagesConversationHeader-back/);
  assert.match(less, /\.MessagesConversationHeader-overflowToggle/);
  assert.match(less, /background:\s*transparent/);
  assert.match(
    less,
    /\.MessagesConversationHeader-back\s*\{[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center[\s\S]*padding:\s*0\s*!important/
  );
});

test('shell owns baseline overflow actions and merges provider items', () => {
  const util = read('js/src/forum/utils/buildShellHeaderOverflowItems.js');
  assert.match(util, /allMessages/);
  assert.match(util, /newMessage/);
  assert.match(util, /back_to_messages/);
  assert.match(util, /composeDirect/);
  assert.match(util, /mergeHeaderOverflowItems/);
  assert.match(util, /SHELL_OVERFLOW_KEYS/);
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /providerOverflowItems/);
  assert.match(page, /headerOverflowItems/);
  // Providers must be resolved from the Flarum app registry (not a bare discoverSources()).
  assert.match(page, /discoverSources\(app\)/);
  assert.doesNotMatch(page, /discoverSources\(\s*\)/);
  // Direct with null/empty provider contribution still renders shell overflow.
  const header = read('js/src/forum/components/MessagesConversationHeader.js');
  assert.match(header, /buildShellHeaderOverflowItems\(\{ onBack \}\)/);
  assert.match(header, /mergeHeaderOverflowItems\(shellItems, providerOverflowItems\)/);
});

test('mobile directory search is pinned between nav and compose controls', () => {
  const less = read('resources/less/forum.less');
  assert.match(
    less,
    /\.MessagesPage:not\(\.viewing-conversation\) \.MessagesPage-search\s*\{[\s\S]*position:\s*fixed[\s\S]*left:\s*60px[\s\S]*right:\s*60px/
  );
  assert.match(
    less,
    /\.MessagesPage:not\(\.viewing-conversation\) \.MessagesPage-searchInput,[\s\S]*\.MessagesPage-search \.FormControl\s*\{[\s\S]*height:\s*44px/
  );
  // App-bar overlays must stay below Flarum modal stack (--zindex-modal: 1050).
  assert.match(less, /--messages-appbar-z:\s*~?"?calc\(var\(--zindex-header\) \+ 1\)"?/);
  assert.match(less, /z-index:\s*var\(--messages-appbar-z\)/);
  assert.doesNotMatch(less, /z-index:\s*1100/);
  assert.doesNotMatch(less, /z-index:\s*1101/);
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

test('primary Live label canonicalizes for directory and no body preview regresses', () => {
  const row = normalizeConversation(
    {
      kind: 'live',
      key: 'community-general-live',
      title: ['FlatRate.wiki Live'],
      roomKey: 'community-general-live',
      liveUserCount: 4,
      preview: 'secret',
      body: 'secret',
    },
    'live'
  );
  assert.equal(row.title, 'FlatRate.wiki');
  assert.equal(row.sourceId, 'community-general-live');
  assert.equal(row.liveUserCount, 4);
  assert.equal('preview' in row, false);
  assert.equal('body' in row, false);
  assert.ok(isUnifiedMessagesRoute('/messages/live/community-general-live'));
});

test('directory Live presence consumes liveUserCount with LIVE fallback', () => {
  const rowSrc = read('js/src/forum/components/ConversationRow.js');
  assert.match(rowSrc, /liveUserCount/);
  assert.match(rowSrc, /hasLiveCount/);
  assert.match(rowSrc, /\$\{Math\.floor\(count\)\} LIVE/);
  assert.match(rowSrc, /livePresenceText = hasLiveCount \? `\$\{Math\.floor\(count\)\} LIVE` : 'LIVE'/);
  assert.match(rowSrc, /ConversationRow-livePresence/);
  assert.doesNotMatch(rowSrc, /ConversationRow-privacy-text/);

  const locale = read('locale/en.yml');
  assert.match(locale, /\n\s+live: PUBLIC\n/);
  assert.match(locale, /\n\s+direct: PRIVATE\n/);

  const withCount = normalizeConversation(
    {
      kind: 'live',
      roomKey: 'community-general-live',
      title: 'FlatRate.wiki Live',
      liveUserCount: 1,
    },
    'live'
  );
  assert.equal(withCount.title, 'FlatRate.wiki');
  assert.equal(withCount.liveUserCount, 1);

  const withoutCount = normalizeConversation(
    {
      kind: 'live',
      roomKey: 'community-general-live',
      title: 'FlatRate.wiki Live',
    },
    'live'
  );
  assert.equal(withoutCount.title, 'FlatRate.wiki');
  assert.equal(withoutCount.liveUserCount, null);
});

test('Live conversation header status reuses liveUserCount without inventing zero', async () => {
  const { default: resolveLiveHeaderStatus } = await import('../src/forum/utils/resolveLiveHeaderStatus.js');

  assert.deepEqual(resolveLiveHeaderStatus('live', { privacy: 'public', liveUserCount: 1 }), {
    privacy: 'PUBLIC',
    live: 'LIVE 1',
  });
  assert.deepEqual(resolveLiveHeaderStatus('live', { privacy: 'public', liveUserCount: 0 }), {
    privacy: 'PUBLIC',
    live: 'LIVE 0',
  });
  assert.deepEqual(resolveLiveHeaderStatus('live', { privacy: 'public' }), {
    privacy: 'PUBLIC',
    live: 'LIVE',
  });
  assert.deepEqual(resolveLiveHeaderStatus('live', { privacy: 'public', liveUserCount: null }), {
    privacy: 'PUBLIC',
    live: 'LIVE',
  });
  assert.deepEqual(resolveLiveHeaderStatus('live', { privacy: 'public', liveUserCount: undefined }), {
    privacy: 'PUBLIC',
    live: 'LIVE',
  });
  assert.deepEqual(resolveLiveHeaderStatus('live', { privacy: 'public', liveUserCount: Number.NaN }), {
    privacy: 'PUBLIC',
    live: 'LIVE',
  });
  assert.equal(resolveLiveHeaderStatus('direct', { privacy: 'private', liveUserCount: 3 }), null);
  assert.equal(resolveLiveHeaderStatus('live', { privacy: 'private', liveUserCount: 3 }), null);

  const header = read('js/src/forum/components/MessagesConversationHeader.js');
  assert.match(header, /MessagesConversationHeader-copy/);
  assert.match(header, /MessagesConversationHeader-liveStatus/);
  assert.match(header, /MessagesConversationHeader-liveGlobe/);
  assert.match(header, /fas fa-globe/);
  assert.doesNotMatch(header, /🌐/);
  assert.match(header, /resolveLiveHeaderStatus/);
  assert.match(header, /return 'FlatRate\.wiki'/);
  assert.doesNotMatch(header, /return 'FlatRate\.wiki Live'/);
});

test('mobile conversation header uses equal 44px side slots for geometric centering', () => {
  const less = read('resources/less/forum.less');
  assert.match(less, /--messages-live-accent/);
  assert.match(less, /--messages-live-globe:\s*#84cc16/);
  assert.match(less, /\.MessagesConversationHeader-liveStatus\s*\{[\s\S]*var\(--messages-live-accent\)/);
  assert.match(less, /\.MessagesConversationHeader-liveGlobe\s*\{[\s\S]*var\(--messages-live-globe\)/);
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader\s*\{[\s\S]*grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px/
  );
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader-back\s*\{[\s\S]*grid-column:\s*1[\s\S]*width:\s*44px/
  );
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader-main\s*\{[\s\S]*grid-column:\s*2/
  );
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader-overflow\s*\{[\s\S]*grid-column:\s*3[\s\S]*width:\s*44px/
  );
  assert.match(less, /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader-copy/);
  assert.match(less, /back \| title \| overflow|44px \| 1fr \| 44px/);
});
