/**
 * Live public-room status shown opposite the conversation title.
 * Never invents a count. A resolved 0 is omitted, same as an unknown count.
 *
 * Returns structured parts so the shell can render a colorable globe icon
 * (emoji glyphs cannot take CSS color).
 */
export default function resolveLiveHeaderStatus(kind, conversation) {
  if (kind !== 'live') return null;
  if (conversation?.privacy !== 'public') return null;
  const rawCount = conversation?.liveUserCount;
  const count = Number(rawCount);
  if (rawCount != null && Number.isFinite(count) && count > 0) {
    const resolved = Math.floor(count);
    return { privacy: 'PUBLIC', live: `LIVE ${resolved}`, count: resolved };
  }
  return { privacy: 'PUBLIC', live: 'LIVE', count: null };
}
