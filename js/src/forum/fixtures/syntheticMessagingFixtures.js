/**
 * Synthetic directory / conversation fixtures for FORUM-MESSAGING-002 shell qualification.
 * Bodies are synthetic only — never use private production content.
 */

export const SYNTHETIC_MESSAGE_COUNTS = [1, 20, 100, 200, 500];

/**
 * @param {number} count
 * @param {{ kind?: 'direct' | 'live', seed?: string }} [opts]
 */
export function buildSyntheticMessages(count, { kind = 'direct', seed = 'fixture' } = {}) {
  const n = Math.max(0, Number(count) || 0);
  const messages = [];
  for (let i = 1; i <= n; i += 1) {
    const outgoing = kind === 'direct' ? i % 3 === 0 : false;
    messages.push({
      id: `${seed}-${i}`,
      body: `Synthetic ${kind} message ${i} (${seed}).`,
      outgoing,
      author: outgoing ? 'you' : kind === 'live' ? `member_${(i % 7) + 1}` : 'peer',
      createdAt: new Date(Date.UTC(2026, 8, 14, 12, 0, i)).toISOString(),
    });
  }
  return messages;
}

/**
 * Directory rows covering long titles, unread, empty avatars, Live/Direct mix.
 */
export function buildSyntheticDirectory() {
  return [
    {
      id: 'direct:tech_334',
      kind: 'direct',
      sourceId: '101',
      title: 'tech_334',
      privacy: 'private',
      unreadCount: 3,
      activityAt: '2026-09-14T18:00:00.000Z',
      avatarUrl: null,
    },
    {
      id: 'direct:long-nick',
      kind: 'direct',
      sourceId: '102',
      title: 'very_long_nickname_that_should_ellipsis_in_directory_row_without_overflow',
      privacy: 'private',
      unreadCount: 99,
      activityAt: '2026-09-14T17:00:00.000Z',
      avatarUrl: null,
    },
    {
      id: 'live:community-general-live',
      kind: 'live',
      sourceId: 'community-general-live',
      title: 'FlatRate.wiki Live',
      privacy: 'public',
      unreadCount: 2,
      activityAt: '2026-09-14T16:30:00.000Z',
      icon: 'fas fa-comments',
    },
    {
      id: 'live:long-room',
      kind: 'live',
      sourceId: 'synthetic-long-room-title',
      title: 'Very Long Authorized Room Title That Must Not Blow Out Layout',
      privacy: 'public',
      unreadCount: 0,
      activityAt: '2026-09-14T15:00:00.000Z',
      icon: 'fas fa-comments',
    },
  ];
}
