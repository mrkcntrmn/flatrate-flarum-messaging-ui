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
  selectNotificationsScroller,
  shouldPersistScroll,
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
  assert.match(index, /session\.logout = wrapped/);
  assert.match(index, /inbox\.state\.setSignedIn\(false\)/);
});

test('scroll position is restored per filter', () => {
  const storage = new Map();
  const memory = {
    setItem(key, value) { storage.set(key, value); },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  };
  rememberScroll(memory, '6', 'forum', 180);
  assert.equal(restoreScroll(memory, '6', 'forum'), 180);
  assert.equal(restoreScroll(memory, '6', 'all'), 0);
  assert.equal(restoreScroll(memory, '1', 'forum'), 0);
  assert.match(page, /restoreScroll/);
  assert.match(page, /rememberScroll/);
  const list = { scrollHeight: 100, clientHeight: 100, scrollTop: 0 };
  const doc = { scrollHeight: 1481, clientHeight: 640, scrollTop: 420 };
  assert.equal(selectNotificationsScroller(list, doc), doc);
  assert.equal(selectNotificationsScroller({ scrollHeight: 900, clientHeight: 400, scrollTop: 80 }, doc).scrollTop, 80);
  assert.equal(shouldPersistScroll(list), false);
  assert.equal(shouldPersistScroll(doc), true);
  assert.match(page, /shouldPersistScroll/);
});
