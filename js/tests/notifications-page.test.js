import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import NotificationInboxState from '../src/forum/notifications/NotificationInboxState.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(root, 'js/src/forum/components/NotificationsPage.js'), 'utf8');
const header = readFileSync(join(root, 'js/src/forum/components/NotificationInboxHeader.js'), 'utf8');
const empty = readFileSync(join(root, 'js/src/forum/components/NotificationInboxEmpty.js'), 'utf8');
const tabs = readFileSync(join(root, 'js/src/forum/components/NotificationInboxTabs.js'), 'utf8');
const filters = readFileSync(join(root, 'js/src/forum/notifications/notificationFilters.js'), 'utf8');
const less = readFileSync(join(root, 'resources/less/forum.less'), 'utf8');

test('open chrome is back plus a non-clickable bell', () => {
  assert.match(header, /fas fa-arrow-left/);
  assert.match(header, /aria-label="Back"/);
  assert.match(header, /Notifications/);
  assert.match(header, /fas fa-bell/);
  assert.match(header, /pointer-events|NotificationInboxHeader-bell/);
  assert.doesNotMatch(header, /bell[\s\S]{0,80}onclick/);
  assert.match(less, /\.NotificationInboxHeader-bell[\s\S]*pointer-events:\s*none/);
});

test('caught up is withheld while a source is unknown', async () => {
  const state = new NotificationInboxState({
    loadForumCount: async () => 0,
    loadForumNotifications: async () => [],
    loadDirect: async () => ({ rows: [], unreadTotal: 0 }),
    loadLive: async () => {
      throw new Error('live down');
    },
  });
  state.setSignedIn(true);
  assert.equal(await state.refresh(), 'unavailable');
  assert.match(empty, /You're all caught up\./);
  assert.match(empty, /Some notifications could not be loaded\./);
  assert.match(page, /NotificationInboxEmpty/);
});

test('tabs and safe-area chrome exist', () => {
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-selected/);
  assert.match(filters, /label: 'All'/);
  assert.match(filters, /label: 'Forum'/);
  assert.match(filters, /label: 'Messages'/);
  assert.match(less, /safe-area-inset-bottom/);
  assert.match(less, /min-width:\s*768px/);
  assert.match(less, /min-width:\s*1100px/);
  assert.match(less, /:focus-visible/);
});
