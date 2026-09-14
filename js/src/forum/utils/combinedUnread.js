/**
 * Combined unread total from live + direct providers.
 * A missing or throwing source counts as 0. There is no independent unread DB.
 *
 * @param {{ getUnreadTotal?: () => number }|null|undefined} live
 * @param {{ getUnreadTotal?: () => number }|null|undefined} direct
 * @returns {number}
 */
export default function combinedUnread(live, direct) {
  return unreadFrom(live) + unreadFrom(direct);
}

function unreadFrom(source) {
  if (!source || typeof source.getUnreadTotal !== 'function') {
    return 0;
  }
  try {
    const value = Number(source.getUnreadTotal());
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
