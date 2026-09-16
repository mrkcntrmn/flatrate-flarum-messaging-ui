import { toPeopleResult, PEOPLE_RESULT_LIMIT } from './peopleSearch.js';

/**
 * Bounded suggested-people list from already-authorized Community signals.
 * V1 signals: recent Direct counterparts, then any provided followed users.
 * Never invents relationship context or private profile fields.
 */
export function suggestPeople({
  conversations = [],
  followedUsers = [],
  actorId = null,
  limit = PEOPLE_RESULT_LIMIT + 3,
} = {}) {
  const actor = actorId != null ? String(actorId) : null;
  const seen = new Set(actor ? [actor] : []);
  const out = [];

  const push = (user, hint) => {
    const row = toPeopleResult(user, { hint });
    if (!row || seen.has(row.id)) return;
    // Strip accidental private fields if a full model was passed through attrs.
    const safe = {
      id: row.id,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      hint: hint || null,
      user: row.user,
    };
    seen.add(row.id);
    out.push(safe);
  };

  const directRows = (conversations || [])
    .filter((row) => row && row.kind === 'direct' && row.userId)
    .slice()
    .sort((a, b) => {
      const ta = a.activityAt ? Date.parse(a.activityAt) : 0;
      const tb = b.activityAt ? Date.parse(b.activityAt) : 0;
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });

  for (const row of directRows) {
    if (out.length >= limit) break;
    push(
      {
        id: () => String(row.userId),
        displayName: () => row.title || String(row.userId),
        avatarUrl: () => row.avatarUrl || null,
      },
      'Recent'
    );
  }

  for (const user of followedUsers || []) {
    if (out.length >= limit) break;
    push(user, 'Following');
  }

  return out;
}

/**
 * Best-effort followed users from the Flarum store when available.
 * Fail soft — suggestions still work from Direct counterparts alone.
 */
export function collectFollowedUsers(app, { limit = 8 } = {}) {
  const actor = app?.session?.user;
  if (!actor) return [];

  try {
    if (typeof actor.followedUsers === 'function') {
      const list = actor.followedUsers() || [];
      return Array.isArray(list) ? list.filter(Boolean).slice(0, limit) : [];
    }
  } catch {
    // ignore
  }

  try {
    if (app?.store?.all) {
      const all = app.store.all('users') || [];
      return all
        .filter((user) => {
          if (!user || user === actor) return false;
          if (typeof user.followed === 'function') return !!user.followed();
          return false;
        })
        .slice(0, limit);
    }
  } catch {
    // ignore
  }

  return [];
}
