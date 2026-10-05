const PRIMARY_LIVE_ROOM_KEY = 'community-general-live';
const LIVE_ROOM_SUFFIX = '-live';

/**
 * Conversation back destination for the shared Messages header.
 *
 * Live room identity is durable:
 * - General Live is pinned on MAIN, so Back returns to '/'.
 * - Brand rooms ask Navigation for the canonical board URL.
 * - Direct, unknown rooms, or a missing route provider return '/messages'.
 */
export default function resolveConversationBackHref(kind, conversation, routes = null) {
  if (kind !== 'live') return '/messages';

  const sourceId = readText(conversation?.sourceId);
  if (!sourceId) return '/messages';

  if (sourceId === PRIMARY_LIVE_ROOM_KEY) {
    return '/';
  }

  if (!sourceId.endsWith(LIVE_ROOM_SUFFIX)) {
    return '/messages';
  }

  const boardKey = sourceId.slice(0, -LIVE_ROOM_SUFFIX.length);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(boardKey)) {
    return '/messages';
  }

  try {
    const href = routes && typeof routes.hrefForBoardKey === 'function' ? routes.hrefForBoardKey(boardKey) : null;
    if (typeof href === 'string' && href.startsWith('/t/')) {
      return href;
    }
  } catch (error) {
    return '/messages';
  }

  return '/messages';
}

function readText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
