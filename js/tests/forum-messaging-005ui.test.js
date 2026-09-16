import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

test('compose control uses plus icon, not pencil', () => {
  const compose = read('js/src/forum/components/MessagesComposeButton.js');
  assert.match(compose, /fas fa-plus/);
  assert.doesNotMatch(compose, /fas fa-pen/);
  assert.match(compose, /composeDirect/);
});

test('directory search has magnifier and Search placeholder', () => {
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /MessagesPage-searchIcon/);
  assert.match(page, /fas fa-search/);
  assert.match(page, /MessagesPage-searchInput/);
  assert.match(page, /aria-hidden="true"/);
  const locale = read('locale/en.yml');
  assert.match(locale, /search_placeholder:\s*Search\s*$/m);
  assert.doesNotMatch(locale, /search_placeholder:\s*Search conversations/);
  const less = read('resources/less/forum.less');
  assert.match(less, /\.MessagesPage-searchIcon\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(less, /padding-left:\s*38px/);
});

test('MessagingFilters are not rendered on Messages directory', () => {
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.doesNotMatch(page, /MessagingFilters/);
  assert.doesNotMatch(page, /availableFilters/);
  assert.doesNotMatch(page, /applyFilter/);
  assert.match(page, /normalizeDirectoryFilterParam/);
  assert.match(page, /this\.filter = 'all'/);
  assert.match(page, /delete params\.filter/);
});

test('ConversationRow uses sibling link + overflow, not nested Dropdown in Link', () => {
  const row = read('js/src/forum/components/ConversationRow.js');
  assert.match(row, /className="ConversationRow-link"/);
  assert.match(row, /ConversationRow-overflow/);
  assert.match(row, /fas fa-ellipsis-h/);
  assert.match(row, /conversation_options/);
  assert.match(row, /buildShellDirectoryOverflowItems/);
  assert.match(row, /directoryOverflowItems/);
  // Root must be a div/listitem, not a Link wrapping Dropdown.
  assert.match(row, /role="listitem"/);
  assert.doesNotMatch(row, /return \(\s*<Link[\s\S]*Dropdown/);
  const less = read('resources/less/forum.less');
  assert.match(less, /\.ConversationRow-overflowToggle\s*\{[\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/);
});

test('directory overflow provides Open and Copy link without fake destructive actions', () => {
  const util = read('js/src/forum/utils/buildShellDirectoryOverflowItems.js');
  assert.match(util, /conversationPath/);
  assert.match(util, /m\.route\.set\(path\)/);
  assert.match(util, /copyConversationLink|navigator\.clipboard/);
  assert.match(util, /forum\.row\.open/);
  assert.match(util, /forum\.row\.copy_link/);
  assert.doesNotMatch(util, /Delete|Archive|Mute|Block|Leave/);
  const locale = read('locale/en.yml');
  assert.match(locale, /open:\s*Open/);
  assert.match(locale, /copy_link:\s*Copy conversation link/);
});

test('messages app-bar stacking stays below Flarum modal z-index', () => {
  const less = read('resources/less/forum.less');
  assert.match(less, /--messages-appbar-z/);
  assert.match(less, /calc\(var\(--zindex-header\) \+ 1\)/);
  assert.match(less, /BELOW[\s\S]*ModalManager|--zindex-modal:\s*1050/);
  // All three fixed Messages chrome surfaces share the safe token.
  const appbarUsages = less.match(/z-index:\s*var\(--messages-appbar-z\)/g) || [];
  assert.ok(appbarUsages.length >= 3, 'search, compose, and conversation header must use --messages-appbar-z');
});
