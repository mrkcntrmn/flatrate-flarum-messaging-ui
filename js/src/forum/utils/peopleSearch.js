/**
 * Community people search for Messages discovery (FORUM-MESSAGING-006UI).
 * Uses Flarum users API only — never message bodies or private profile fields.
 */

export const MIN_REMOTE_USER_QUERY_LENGTH = 2;
export const REMOTE_SEARCH_DEBOUNCE_MS = 300;
export const PEOPLE_RESULT_LIMIT = 5;

function idOf(user) {
  if (!user) return null;
  if (typeof user.id === 'function') return String(user.id());
  if (user.id != null) return String(user.id);
  return null;
}

function displayNameOf(user) {
  if (!user) return '';
  if (typeof user.displayName === 'function') return String(user.displayName() || '');
  if (typeof user.username === 'function') return String(user.username() || '');
  return String(user.displayName || user.username || '');
}

function avatarUrlOf(user) {
  if (!user) return null;
  if (typeof user.avatarUrl === 'function') return user.avatarUrl() || null;
  return user.avatarUrl || null;
}

/**
 * Public-safe people row. Never copies email/phone/private fields.
 */
export function toPeopleResult(user, { hint = null } = {}) {
  const id = idOf(user);
  if (!id) return null;
  return {
    id,
    displayName: displayNameOf(user),
    avatarUrl: avatarUrlOf(user),
    hint: hint || null,
    user,
  };
}

export function sanitizePeopleResults(users, actorId, { limit = PEOPLE_RESULT_LIMIT } = {}) {
  const actor = actorId != null ? String(actorId) : null;
  const seen = new Set();
  const out = [];

  for (const user of users || []) {
    const row = toPeopleResult(user);
    if (!row) continue;
    if (actor && row.id === actor) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * Default Flarum users lookup used by Messages discovery.
 */
export function findUsersByQuery(app, query, { limit = PEOPLE_RESULT_LIMIT } = {}) {
  if (!app?.store?.find) {
    return Promise.resolve([]);
  }
  return app.store
    .find('users', {
      filter: { q: query },
      page: { limit },
    })
    .then((models) => (Array.isArray(models) ? models : models ? [models] : []))
    .catch(() => []);
}

/**
 * Debounced remote people search with stale-response ignore.
 */
export function createPeopleSearchController({
  findUsers,
  actorId,
  debounceMs = REMOTE_SEARCH_DEBOUNCE_MS,
  minLength = MIN_REMOTE_USER_QUERY_LENGTH,
  limit = PEOPLE_RESULT_LIMIT,
} = {}) {
  let seq = 0;
  let timer = null;

  return {
    schedule(query, onResult) {
      if (typeof clearTimeout === 'function') {
        clearTimeout(timer);
      }
      const q = String(query || '').trim();
      if (q.length < minLength) {
        onResult({ query: q, users: [], status: 'idle' });
        return;
      }

      const mySeq = ++seq;
      const run = async () => {
        onResult({ query: q, users: [], status: 'loading' });
        try {
          const raw = typeof findUsers === 'function' ? await findUsers(q) : [];
          if (mySeq !== seq) return;
          onResult({
            query: q,
            users: sanitizePeopleResults(raw, actorId, { limit }),
            status: 'ready',
          });
        } catch {
          if (mySeq !== seq) return;
          onResult({ query: q, users: [], status: 'error' });
        }
      };

      if (typeof setTimeout === 'function') {
        timer = setTimeout(run, debounceMs);
      } else {
        run();
      }
    },

    cancel() {
      if (typeof clearTimeout === 'function') {
        clearTimeout(timer);
      }
      seq += 1;
    },
  };
}
