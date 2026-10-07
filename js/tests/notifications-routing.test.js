import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isNotificationsPath,
  notificationsBackPlan,
  rememberScroll,
  restoreScroll,
} from '../src/forum/notifications/notificationRoutes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const index = readFileSync(join(root, 'js/src/forum/index.js'), 'utf8');
const page = readFileSync(join(root, 'js/src/forum/components/NotificationsPage.js'), 'utf8');

test('notifications route is canonical and hard-load back falls through to MAIN', () => {
  assert.equal(isNotificationsPath('/notifications'), true);
  assert.equal(isNotificationsPath('/notifications/'), true);
  assert.equal(isNotificationsPath('/notification'), false);
  assert.equal(isNotificationsPath('/messages'), false);
  assert.deepEqual(notificationsBackPlan({ canGoBack: false }), { type: 'main', href: '/' });
  assert.deepEqual(notificationsBackPlan({}), { type: 'main', href: '/' });
  assert.deepEqual(notificationsBackPlan({ canGoBack: true }), { type: 'history' });
  assert.doesNotMatch(readFileSync(join(root, 'js/src/forum/components/NotificationInboxHeader.js'), 'utf8'), /window\.history/);
  assert.match(index, /flatrate-notifications\.index/);
  assert.match(index, /path: '\/notifications'/);
  assert.match(index, /routes\.notifications\.component = NotificationsPage/);
});

test('scroll position is restored per filter', () => {
  const storage = new Map();
  const memory = {
    setItem(key, value) { storage.set(key, value); },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  };
  rememberScroll(memory, 'forum', 180);
  assert.equal(restoreScroll(memory, 'forum'), 180);
  assert.equal(restoreScroll(memory, 'all'), 0);
  assert.match(page, /restoreScroll/);
  assert.match(page, /rememberScroll/);
});
