/**
 * Client-side identity search of already-authorized rows (title / identities only).
 * Does not search message bodies or preview fields.
 *
 * @param {Array<object>} conversations
 * @param {string} query
 * @returns {Array<object>}
 */
export default function searchConversations(conversations, query) {
  const rows = Array.isArray(conversations) ? conversations : [];
  const needle = String(query || '')
    .trim()
    .toLowerCase();
  if (!needle) {
    return rows.slice();
  }

  return rows.filter((row) => {
    if (matches(row?.title, needle)) {
      return true;
    }
    const identities = Array.isArray(row?.identities) ? row.identities : [];
    return identities.some((identity) => matches(identity, needle));
  });
}

function matches(value, needle) {
  return String(value || '')
    .toLowerCase()
    .includes(needle);
}
