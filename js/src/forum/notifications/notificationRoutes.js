export const NOTIFICATIONS_ROUTE = 'flatrate-notifications.index';
export const NOTIFICATIONS_PATH = '/notifications';

export function isNotificationsPath(path) {
  const normalized = normalizePath(String(path || '').split('?')[0]);
  return normalized === NOTIFICATIONS_PATH;
}

/**
 * Back follows Flarum's in-app history stack, not window.history.length.
 * A hard load only has the current entry, so Back goes to MAIN instead of
 * leaving through whatever external page happened to sit behind the tab.
 */
export function notificationsBackPlan({ canGoBack } = {}) {
  if (canGoBack === true) {
    return { type: 'history' };
  }
  return { type: 'main', href: '/' };
}

export function scrollRestoreKey(actorId, filter) {
  const actor = actorId == null || actorId === '' ? '0' : String(actorId);
  return `flatrate-notifications-scroll:${actor}:${filter || 'all'}`;
}

export function rememberScroll(storage, actorId, filter, top) {
  if (!storage || typeof storage.setItem !== 'function') {
    return;
  }
  const value = Number(top);
  storage.setItem(scrollRestoreKey(actorId, filter), Number.isFinite(value) && value >= 0 ? String(Math.floor(value)) : '0');
}

export function restoreScroll(storage, actorId, filter) {
  if (!storage || typeof storage.getItem !== 'function') {
    return 0;
  }
  const value = Number(storage.getItem(scrollRestoreKey(actorId, filter)));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * The inbox list is not a scrollport in the forum layout. Prefer it only when
 * it actually overflows. Otherwise the document, or another element that
 * already scrolls, owns the position.
 */
export function selectNotificationsScroller(list, documentScroller) {
  if (list && Number(list.scrollHeight) > Number(list.clientHeight) + 1) {
    return list;
  }
  return documentScroller || null;
}

/**
 * A zero sample from a container that cannot scroll must not erase a real
 * position that was stored for the actor.
 */
export function shouldPersistScroll(scroller) {
  if (!scroller) return false;
  const top = Number(scroller.scrollTop) || 0;
  if (top > 0) return true;
  return Number(scroller.scrollHeight) > Number(scroller.clientHeight) + 1;
}

function normalizePath(path) {
  if (!path) {
    return '/';
  }
  let value = path[0] === '/' ? path : `/${path}`;
  if (value !== '/' && value.endsWith('/')) {
    value = value.replace(/\/+$/, '');
  }
  return value || '/';
}
