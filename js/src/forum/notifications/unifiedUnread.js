/**
 * UNIFIED_BADGE = NON_MESSAGE_FLARUM_UNREAD + DIRECT_UNREAD + LIVE_UNREAD
 *
 * Unknown is not zero. A failed or unresolved source keeps the badge unknown.
 * Missing installed providers are known zeroes only when discovery finished
 * and the provider object is absent.
 */

export function readUnreadPart({ discovered = false, value = undefined, error = null } = {}) {
  if (error) {
    return { status: 'unknown', count: null };
  }
  if (!discovered) {
    return { status: 'known', count: 0 };
  }
  if (value == null) {
    return { status: 'unknown', count: null };
  }
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) {
    return { status: 'unknown', count: null };
  }
  return { status: 'known', count: Math.floor(count) };
}

export function unifiedUnread({ forum, direct, live } = {}) {
  const parts = {
    forum: readUnreadPart(forum),
    direct: readUnreadPart(direct),
    live: readUnreadPart(live),
  };
  if (Object.values(parts).some((part) => part.status !== 'known')) {
    return { status: 'unknown', count: null, parts };
  }
  return {
    status: 'known',
    count: parts.forum.count + parts.direct.count + parts.live.count,
    parts,
  };
}

/**
 * The forbidden badge. Kept as an explicit negative oracle for tests.
 */
export function forbiddenFlarumPlusMessaging(flarumTotalUnread, directUnread, liveUnread) {
  return Number(flarumTotalUnread) + Number(directUnread) + Number(liveUnread);
}
