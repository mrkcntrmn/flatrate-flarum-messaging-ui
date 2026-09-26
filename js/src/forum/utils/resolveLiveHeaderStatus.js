/**
 * Live public-room status under the primary conversation title.
 * Never invents a count of 0 when presence has not resolved.
 *
 * Returns structured parts so the shell can render a colorable globe icon
 * (emoji glyphs cannot take CSS color).
 */
export default function resolveLiveHeaderStatus(kind, conversation) {
  if (kind !== 'live') return null;
  if (conversation?.privacy !== 'public') return null;
  const rawCount = conversation?.liveUserCount;
  const count = Number(rawCount);
  if (rawCount != null && Number.isFinite(count) && count >= 0) {
    return { privacy: 'PUBLIC', live: `LIVE ${Math.floor(count)}` };
  }
  return { privacy: 'PUBLIC', live: 'LIVE' };
}
