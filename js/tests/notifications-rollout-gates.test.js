import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notificationsAvailable } from '../src/forum/notifications/notificationsAvailability.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('forum client accepts only a strict true availability boolean', () => {
  const app = (value) => ({ forum: { attribute: () => value } });
  assert.equal(notificationsAvailable(app(true)), true);
  assert.equal(notificationsAvailable(app(false)), false);
  assert.equal(notificationsAvailable(app('true')), false);
  assert.equal(notificationsAvailable(app(1)), false);
  assert.equal(notificationsAvailable(app(undefined)), false);
  assert.equal(notificationsAvailable({}), false);
});

test('forum payload path does not receive raw gates or the beta marker', () => {
  const forum = [
    read('js/src/forum/notifications/notificationsAvailability.js'),
    read('js/src/forum/notifications/createNotificationInbox.js'),
    read('js/src/forum/components/NotificationsPage.js'),
    read('js/src/forum/index.js'),
  ].join('\n');
  assert.match(forum, /flatrate-messaging-ui\.notifications_available/);
  assert.doesNotMatch(forum, /notifications_admin_preview_enabled/);
  assert.doesNotMatch(forum, /notifications_member_beta_enabled/);
  assert.doesNotMatch(forum, /notifications_member_enabled/);
  assert.doesNotMatch(forum, /BetaTesterProjection|is_beta_tester|beta_tester_active/);
  assert.match(read('js/src/admin/index.js'), /notifications_admin_preview_enabled/);
  assert.match(read('js/src/admin/index.js'), /notifications_member_beta_enabled/);
  assert.match(read('js/src/admin/index.js'), /notifications_member_enabled/);
});

test('an unavailable actor does not load the inbox and falls back to MAIN', () => {
  const page = read('js/src/forum/components/NotificationsPage.js');
  const inbox = read('js/src/forum/notifications/createNotificationInbox.js');
  assert.match(page, /notificationsAvailable\(app\)/);
  assert.match(page, /MAIN/);
  assert.match(page, /mode="signed-out"/);
  assert.match(inbox, /!notificationsAvailable\(app\)/);
  assert.doesNotMatch(page, /markAsRead|unread_messages|unreaded/);
  assert.doesNotMatch(inbox, /markAsRead|unread_messages|unreaded/);
});
