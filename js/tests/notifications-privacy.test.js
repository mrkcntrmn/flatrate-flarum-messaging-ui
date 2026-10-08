import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const page = read('js/src/forum/components/NotificationsPage.js');
const empty = read('js/src/forum/components/NotificationInboxEmpty.js');
const inbox = read('js/src/forum/notifications/createNotificationInbox.js');
const policy = read('src/Seo/MessagingIndexingPolicy.php');

test('signed-out notifications do not render private rows or counts', () => {
  assert.match(empty, /Sign in to view notifications/);
  assert.match(page, /mode="signed-out"/);
  assert.match(page, /if \(app\.session\.user && notificationsAvailable\(app\) && state\.available === true\)/);
  assert.match(page, /state\.setSignedIn\(!!app\.session\.user\)/);
  assert.doesNotMatch(page, /You're all caught up/);
  assert.match(page, /mode === 'signed-out'|NotificationInboxEmpty mode="signed-out"/);
});

test('notifications are noindex and do not copy private payloads elsewhere', () => {
  assert.match(policy, /\$normalized === '\/notifications'/);
  const combined = [
    page,
    inbox,
    read('js/src/forum/notifications/normalizeForumNotification.js'),
    read('js/src/forum/notifications/normalizeMessageConversation.js'),
  ].join('\n');
  assert.doesNotMatch(combined, /supabase/i);
  assert.doesNotMatch(combined, /gtag|ga\(/);
  assert.doesNotMatch(combined, /new WebSocket/);
  assert.doesNotMatch(combined, /lastMessage/);
});

test('profile and post message actions remain on the canonical service', () => {
  const index = read('js/src/forum/index.js');
  assert.match(index, /UserControls/);
  assert.match(index, /PostControls/);
  assert.match(index, /openDirectToUser\(user\)/);
  assert.match(index, /openDirectToUser\(target\)/);
  const row = read('js/src/forum/components/NotificationInboxRow.js');
  assert.match(row, /openDirectToUser\(target\)/);
  assert.doesNotMatch(row, /startConversationWithUser/);
  assert.doesNotMatch(row, /conversations\.create/);
});
