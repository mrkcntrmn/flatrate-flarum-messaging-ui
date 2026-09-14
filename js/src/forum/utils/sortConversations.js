/**
 * Sort conversations by activityAt descending, nulls last, then kind / title / id.
 *
 * @param {Array<object>} conversations
 * @returns {Array<object>}
 */
export default function sortConversations(conversations) {
  const rows = Array.isArray(conversations) ? conversations.slice() : [];

  rows.sort((a, b) => {
    const aTime = a?.activityAt;
    const bTime = b?.activityAt;
    const aHas = aTime != null && Number.isFinite(Number(aTime));
    const bHas = bTime != null && Number.isFinite(Number(bTime));

    if (aHas && bHas && Number(aTime) !== Number(bTime)) {
      return Number(bTime) - Number(aTime);
    }
    if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }

    const kindCmp = String(a?.kind || '').localeCompare(String(b?.kind || ''));
    if (kindCmp !== 0) {
      return kindCmp;
    }

    const titleCmp = String(a?.title || '').localeCompare(String(b?.title || ''));
    if (titleCmp !== 0) {
      return titleCmp;
    }

    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });

  return rows;
}
