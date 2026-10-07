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

export function scrollRestoreKey(filter) {
  return `flatrate-notifications-scroll:${filter || 'all'}`;
}

export function rememberScroll(storage, filter, top) {
  if (!storage || typeof storage.setItem !== 'function') {
    return;
  }
  const value = Number(top);
  storage.setItem(scrollRestoreKey(filter), Number.isFinite(value) && value >= 0 ? String(Math.floor(value)) : '0');
}

export function restoreScroll(storage, filter) {
  if (!storage || typeof storage.getItem !== 'function') {
    return 0;
  }
  const value = Number(storage.getItem(scrollRestoreKey(filter)));
  return Number.isFinite(value) && value >= 0 ? value : 0;
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
