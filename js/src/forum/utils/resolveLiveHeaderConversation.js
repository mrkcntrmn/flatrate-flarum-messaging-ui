import normalizeConversation from './normalizeConversation.js';

/**
 * Header source order for a selected Live room:
 * 1. Authorized provider snapshot for this room and session.
 * 2. Existing directory row for the same room.
 * 3. Neutral loading or unavailable presentation.
 *
 * The route key is never used as the visible title.
 */
export default function resolveLiveHeaderConversation({ provider = null, directoryConversation = null, roomKey = '', sessionUserId = null } = {}) {
  const key = roomKey == null ? '' : String(roomKey);
  const snapshot = readProviderSnapshot(provider, key);

  if (isUnavailableSnapshot(snapshot, key, sessionUserId)) {
    return {
      status: 'unavailable',
      conversation: neutralConversation(key, { headerUnavailable: true }),
    };
  }

  if (isTrustedSnapshot(snapshot, key, sessionUserId)) {
    const normalized = normalizeConversation(
      {
        kind: 'live',
        sourceId: key,
        title: snapshot.title,
        privacy: 'public',
        isPublic: true,
        liveUserCount: null,
      },
      'live'
    );
    if (normalized && normalized.privacy === 'public' && normalized.sourceId === key && canonicalTitle(normalized.title, key)) {
      return {
        status: 'ready',
        conversation: {
          ...normalized,
          presentationTrusted: true,
          headerPending: false,
          headerUnavailable: false,
          liveUserCount: null,
        },
      };
    }
  }

  if (directoryConversation && directoryConversation.kind === 'live' && String(directoryConversation.sourceId) === key) {
    return { status: 'ready', conversation: directoryConversation };
  }

  return {
    status: 'loading',
    conversation: neutralConversation(key, { headerPending: true }),
  };
}

function readProviderSnapshot(provider, key) {
  if (!provider || typeof provider.getSelectedConversation !== 'function') return null;
  try {
    const snapshot = provider.getSelectedConversation({ key });
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  } catch (e) {
    return null;
  }
}

function isUnavailableSnapshot(snapshot, key, sessionUserId) {
  if (!snapshot || snapshot.unavailable !== true) return false;
  if (!sessionBound(snapshot, sessionUserId)) return false;
  return sourceMatches(snapshot, key);
}

function isTrustedSnapshot(snapshot, key, sessionUserId) {
  if (!snapshot || snapshot.unavailable === true || snapshot.presentationTrusted !== true) return false;
  if (snapshot.privacy !== 'public') return false;
  if (!sessionBound(snapshot, sessionUserId)) return false;
  if (!sourceMatches(snapshot, key)) return false;
  return canonicalTitle(snapshot.title, key);
}

function sessionBound(snapshot, sessionUserId) {
  if (sessionUserId == null || sessionUserId === '') return false;
  return String(snapshot.sessionUserId) === String(sessionUserId);
}

function sourceMatches(snapshot, key) {
  const sourceId = snapshot.sourceId ?? snapshot.roomKey ?? snapshot.key;
  return sourceId != null && String(sourceId) === String(key);
}

function canonicalTitle(title, key) {
  const text = String(title || '').trim();
  return Boolean(text) && text !== String(key);
}

function neutralConversation(key, flags) {
  return {
    kind: 'live',
    sourceId: key,
    id: `live:${key}`,
    title: '',
    privacy: 'private',
    liveUserCount: null,
    presentationTrusted: false,
    headerPending: Boolean(flags.headerPending),
    headerUnavailable: Boolean(flags.headerUnavailable),
  };
}
