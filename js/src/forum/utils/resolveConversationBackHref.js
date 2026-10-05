const PRIMARY_LIVE_ROOM_KEY = 'community-general-live';
const LIVE_ROOM_SUFFIX = '-live';

/**
 * Conversation back destination for the shared Messages header.
 *
 * Live room identity is durable:
 * - General Live is pinned on MAIN, so Back returns to '/'.
 * - Canonical Brand rooms use {boardKey}-live, so Back returns to /t/{boardKey}.
 * - Direct or unknown conversations retain the Messages directory fallback.
 */
export default function resolveConversationBackHref(kind, conversation) {
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

  return `/t/${boardKey}`;
}

function readText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
