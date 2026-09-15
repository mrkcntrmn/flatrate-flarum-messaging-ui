/**
 * Parse canonical Messages paths. False prefixes such as /messaging are ignored.
 *
 * @param {string} path
 * @returns {{ kind: 'live'|'direct'|null, key: string|null, route: string }|null}
 */
export function parseMessagingPath(path) {
  const normalized = normalizePath(String(path || '').split('?')[0]);
  const live = normalized.match(/^\/messages\/live\/([^/]+)$/);
  if (live) {
    return {
      kind: 'live',
      key: decodeURIComponent(live[1]),
      route: 'flatrate-messaging.live',
    };
  }
  const direct = normalized.match(/^\/messages\/direct\/([^/]+)$/);
  if (direct) {
    return {
      kind: 'direct',
      key: decodeURIComponent(direct[1]),
      route: 'flatrate-messaging.direct',
    };
  }
  if (normalized === '/messages') {
    return { kind: null, key: null, route: 'flatrate-messaging.index' };
  }
  return null;
}

export function conversationPath(kind, key) {
  if (kind === 'live' && key != null && key !== '') {
    return `/messages/live/${encodeURIComponent(String(key))}`;
  }
  if (kind === 'direct' && key != null && key !== '') {
    return `/messages/direct/${encodeURIComponent(String(key))}`;
  }
  return '/messages';
}

/**
 * True for unified Messages routes only (/messages and conversation children).
 * False prefixes such as /messaging are excluded.
 *
 * @param {string} [path]
 * @returns {boolean}
 */
export function isUnifiedMessagesRoute(path) {
  const resolved = runtimePath(path);
  return resolved == null ? false : parseMessagingPath(resolved) != null;
}

/**
 * True only for the Messages directory route. Conversation routes return false.
 *
 * @param {string} [path]
 * @returns {boolean}
 */
export function isMessagesIndexRoute(path) {
  const resolved = runtimePath(path);
  if (resolved == null) {
    return false;
  }
  const route = parseMessagingPath(resolved);
  return !!route && route.kind == null;
}

function runtimePath(path) {
  if (path != null) {
    return path;
  }
  if (typeof m !== 'undefined' && m.route && typeof m.route.get === 'function') {
    return m.route.get();
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.pathname || '';
  }
  return null;
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

export default {
  parseMessagingPath,
  conversationPath,
  isUnifiedMessagesRoute,
  isMessagesIndexRoute,
};
