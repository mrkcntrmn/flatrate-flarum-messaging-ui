import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import createMessagingService from '../src/forum/createMessagingService.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FORUM = join(ROOT, 'js/src/forum');

function read(rel) {
  return readFileSync(join(FORUM, rel), 'utf8');
}

test('header nav is a single Messages destination for members', () => {
  const src = read('index.js');
  assert.match(src, /items\.add\(\s*'FlatRateMessages'\s*,\s*<MessagesNavButton\s*\/>\s*,\s*5\s*\)/);
  assert.match(src, /if \(!app\.session\.user\)/);
  assert.doesNotMatch(src, /LiveChats|Direct Messages|ConversationsDropdown/);
});

test('profile and post Message actions use the messaging service', () => {
  const src = read('index.js');
  assert.match(src, /UserControls/);
  assert.match(src, /PostControls/);
  assert.match(src, /'flatrateMessage'/);
  assert.match(src, /openDirectToUser\(user\)/);
  assert.match(src, /openDirectToUser\(target\)/);
  assert.match(src, /fas fa-paper-plane/);
  assert.doesNotMatch(src, /directMessage/);
  assert.doesNotMatch(src, /StartConversationModal|neoncube|clipboard|navigator\.clipboard/);
});

test('openDirectToUser does not call neoncube or copy the clipboard', () => {
  const src = read('createMessagingService.js');
  assert.match(src, /findConversationWithUser/);
  assert.match(src, /startConversationWithUser/);
  assert.match(src, /\/messages\/direct\/'/);
  assert.doesNotMatch(src, /StartConversationModal/);
  assert.doesNotMatch(src, /from ['"][^'"]*neoncube/);
  assert.doesNotMatch(src, /navigator\.clipboard|clipboard-copy|execCommand\(['"]copy['"]\)/);
});

test('openDirectToUser guest/missing user is a no-op; existing 1:1 navigates', async () => {
  const navigations = [];
  const drafts = [];
  const direct = {
    async findConversationWithUser(user) {
      return user?.id?.() === '2' ? { id: '44' } : null;
    },
    startConversationWithUser(user, { onConversationResolved }) {
      onConversationResolved({ id: '99' }, { created: true, draft: 'hello' });
    },
  };
  const app = {
    session: { user: { id: () => '1' } },
    flatRateMessagingSources: { direct },
  };
  const service = createMessagingService({
    app,
    state: { stashInitialDraft: (id, draft) => drafts.push({ id, draft }) },
    route: (path, replace) => navigations.push({ path, replace }),
  });

  await service.openDirectToUser(null);
  await service.openDirectToUser({ id: () => '2' });
  await service.openDirectToUser({ id: () => '3' });

  const guestService = createMessagingService({
    app: { session: { user: null }, flatRateMessagingSources: { direct } },
    state: { stashInitialDraft() {} },
    route: (path) => navigations.push({ path, guest: true }),
  });
  await guestService.openDirectToUser({ id: () => '2' });

  assert.deepEqual(navigations, [
    { path: '/messages/direct/44', replace: false },
    { path: '/messages/direct/99', replace: false },
  ]);
  assert.deepEqual(drafts, [{ id: '99', draft: 'hello' }]);
});

test('post action uses post.user() rather than discussion inference', () => {
  const src = read('index.js');
  assert.match(src, /const target = post && typeof post\.user === 'function' \? post\.user\(\) : null/);
  assert.doesNotMatch(src, /discussion\(\)|quoted|lastReply|starter/);
});

test('discovers providers from app.flatRateMessagingSources', () => {
  const src = read('utils/discoverSources.js');
  assert.match(src, /flatRateMessagingSources/);
  assert.doesNotMatch(src, /flatrateMessagingLive|flatrateMessagingDirect/);
});

test('shell renderConversation uses additive presentationVersion=2 context', () => {
  const src = read('components/MessagesPage.js');
  assert.match(src, /MESSAGES_PRESENTATION_VERSION\s*=\s*2/);
  assert.match(src, /presentationVersion:\s*MESSAGES_PRESENTATION_VERSION/);
  assert.match(src, /initialDraft/);
  assert.match(src, /conversation/);
  assert.match(src, /provider\.renderConversation\(\{\s*key: selected\.key,\s*context,/);
  assert.match(src, /MessagesShell/);
  assert.match(src, /MessagesProviderSurface/);
  assert.match(src, /directConversationPaneStatus/);
  assert.match(src, /syncDirectSelection/);
  assert.match(src, /MessagesConversationHeader/);
  assert.match(src, /MessagesPage-conversationPane--/);
});

test('shell viewport CSS constrains page height and owns message scroll', () => {
  const less = readFileSync(join(ROOT, 'resources/less/forum.less'), 'utf8');
  assert.match(less, /--messages-shell-height:\s*~?"calc\(100dvh - 52px\)"/);
  assert.match(less, /\.MessagesPage,\s*\n\.MessagesShell\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(less, /\.MessagesMessageViewport\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(less, /\.MessagesComposer\s*\{[\s\S]*flex:\s*0\s*0\s*auto/);
  assert.match(less, /--messages-directory-width:\s*320px/);
  assert.match(less, /safe-area-inset-bottom/);
  assert.match(less, /\.App--messages\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(less, /\.App--messages\s*\{[\s\S]*display:\s*flex/);
  assert.match(less, /\.App--messages[\s\S]*\.App-content\s*\{[\s\S]*min-height:\s*0\s*!important/);
  assert.match(less, /\.App-content\s*>\s*div:first-child\s*\{[\s\S]*position:\s*absolute/);
});

test('directory rows are keyed Flarum components', () => {
  const dir = read('components/ConversationDirectory.js');
  const row = read('components/ConversationRow.js');
  assert.match(dir, /key=\{conversation\.id\}/);
  assert.match(row, /export default class ConversationRow extends Component/);
});

test('composer.json does not require live-chat or the DM bridge', () => {
  const composer = JSON.parse(readFileSync(join(ROOT, 'composer.json'), 'utf8'));
  assert.equal(composer.name, 'flatrate/flarum-messaging-ui');
  assert.deepEqual(Object.keys(composer.require).sort(), ['flarum/core', 'php']);
  assert.equal(composer.require['flarum/core'], '^1.8.5');
  assert.equal(composer.require.php, '^8.1');
  assert.equal(composer.extra['flarum-extension'].title, 'Messages');
  assert.equal(composer.extra['flarum-extension'].icon.name, 'fas fa-paper-plane');
  assert.equal(composer.extra['flarum-extension'].category, 'feature');
});
