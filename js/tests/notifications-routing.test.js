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
import { createNotificationsRouteComponent, selectNotificationsRouteComponent } from '../src/forum/notifications/notificationsRouteComponent.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const index = readFileSync(join(root, 'js/src/forum/index.js'), 'utf8');
const page = readFileSync(join(root, 'js/src/forum/components/NotificationsPage.js'), 'utf8');

test('notifications route is canonical and preserves the native component for ineligible actors', () => {
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
  assert.match(index, /const nativeNotificationsPage = app\.routes\.notifications\.component/);
  assert.match(index, /createNotificationsRouteComponent/);
  assert.match(index, /session\.logout = wrapped/);
  assert.match(index, /inbox\.state\.setSignedIn\(false\)/);
});

test('only strict confirmed eligibility selects the unified notifications page', () => {
  const nativeComponent = { name: 'native' };
  const unifiedComponent = { name: 'unified' };

  assert.equal(selectNotificationsRouteComponent({ nativeComponent, unifiedComponent, available: true }), unifiedComponent);
  assert.equal(selectNotificationsRouteComponent({ nativeComponent, unifiedComponent, available: false }), nativeComponent);
  assert.equal(selectNotificationsRouteComponent({ nativeComponent, unifiedComponent, available: undefined }), nativeComponent);
  assert.equal(selectNotificationsRouteComponent({ nativeComponent, unifiedComponent, available: 'true' }), nativeComponent);
  assert.equal(selectNotificationsRouteComponent({ nativeComponent: null, unifiedComponent, available: false }), null);
});

test('the route revalidates on entry and switches components after eligibility changes', () => {
  const nativeComponent = { name: 'native' };
  const unifiedComponent = { name: 'unified' };
  const rendered = [];
  const reasons = [];
  const app = {
    session: { user: { id: () => '6' } },
    flatrateNotificationState: { available: false },
    flatrateNotifications: { revalidate: (reason) => reasons.push(reason) },
  };
  const route = createNotificationsRouteComponent({
    app,
    nativeComponent,
    unifiedComponent,
    render(component, attrs) {
      rendered.push({ component, attrs });
      return component;
    },
  });

  route.oninit();
  assert.deepEqual(reasons, ['notifications-route']);
  assert.equal(route.view({ attrs: { from: 'header' } }), nativeComponent);
  app.flatrateNotificationState.available = true;
  assert.equal(route.view({ attrs: { from: 'header' } }), unifiedComponent);
  app.session.user = null;
  assert.equal(route.view({ attrs: {} }), nativeComponent);
  assert.deepEqual(rendered[0].attrs, { from: 'header' });
});

test('scroll position is restored per filter', () => {
  const storage = new Map();
  const memory = {
    setItem(key, value) {
      storage.set(key, value);
    },
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
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
