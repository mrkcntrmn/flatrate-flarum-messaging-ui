const FILTERS = new Set(['all', 'unread', 'direct', 'live']);

/**
 * @param {string} filter
 * @returns {'all'|'unread'|'direct'|'live'}
 */
export function parseFilter(filter) {
  const normalized = String(filter || '').toLowerCase();
  return FILTERS.has(normalized) ? normalized : 'all';
}

/**
 * Invalid filter values default to All.
 *
 * @param {Array<object>} conversations
 * @param {string} filter
 * @returns {Array<object>}
 */
export default function filterConversations(conversations, filter) {
  const rows = Array.isArray(conversations) ? conversations : [];
  const resolved = parseFilter(filter);

  if (resolved === 'unread') {
    return rows.filter((row) => Number(row?.unreadCount) > 0);
  }
  if (resolved === 'direct') {
    return rows.filter((row) => row?.kind === 'direct');
  }
  if (resolved === 'live') {
    return rows.filter((row) => row?.kind === 'live');
  }
  return rows.slice();
}
