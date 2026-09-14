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
};
