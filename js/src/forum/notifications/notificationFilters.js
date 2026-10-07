export const NOTIFICATION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'forum', label: 'Forum' },
  { id: 'messages', label: 'Messages' },
];

const FILTER_IDS = new Set(NOTIFICATION_FILTERS.map((filter) => filter.id));

export function parseNotificationFilter(value) {
  const filter = String(value || 'all');
  if (!FILTER_IDS.has(filter)) {
    throw new Error(`unsupported notifications filter: ${filter}`);
  }
  return filter;
}

export function filterNotificationRows(rows, filter) {
  const selected = parseNotificationFilter(filter);
  const list = Array.isArray(rows) ? rows : [];
  if (selected === 'forum') {
    return list.filter((row) => row && row.source === 'forum');
  }
  if (selected === 'messages') {
    return list.filter((row) => row && (row.source === 'direct' || row.source === 'live'));
  }
  return list.slice();
}

export function sortNotificationRows(rows) {
  return (Array.isArray(rows) ? rows.slice() : []).sort((a, b) => {
    const left = activityValue(a?.activityAt);
    const right = activityValue(b?.activityAt);
    if (right !== left) {
      return right - left;
    }
    const source = String(a?.source || '').localeCompare(String(b?.source || ''));
    if (source !== 0) {
      return source;
    }
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

function activityValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}
