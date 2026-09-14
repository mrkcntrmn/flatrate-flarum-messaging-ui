/**
 * Normalize a live or direct conversation into the Messages row contract.
 * Body / preview / last-message fields are stripped and must not be read by rows.
 *
 * @param {object} raw
 * @param {'live'|'direct'} [kindHint]
 * @returns {object|null}
 */
const PRIMARY_LIVE_ROOM_KEY = 'community-general-live';
const PRIMARY_LIVE_TITLE = 'FlatRate.wiki Live';

export default function normalizeConversation(raw, kindHint) {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }

  const kind = resolveKind(raw, kindHint);
  if (kind !== 'live' && kind !== 'direct') {
    return null;
  }

  const sourceId = resolveSourceId(raw, kind);
  if (sourceId == null || sourceId === '') {
    return null;
  }

  const title = resolveTitle(raw, kind, sourceId);
  const privacy = resolvePrivacy(raw, kind);
  const identities = resolveIdentities(raw, title, sourceId);

  return {
    id: `${kind}:${sourceId}`,
    sourceId: String(sourceId),
    kind,
    title,
    identities,
    privacy,
    privacyLabel: privacy === 'private' ? 'Private' : 'Public room',
    activityAt: resolveActivityAt(raw),
    unreadCount: resolveUnreadCount(raw),
    avatarUrl: resolveAvatarUrl(raw),
    icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : null,
  };
}

function resolveKind(raw, kindHint) {
  if (kindHint === 'live' || kindHint === 'direct') {
    return kindHint;
  }
  if (raw.kind === 'live' || raw.kind === 'direct') {
    return raw.kind;
  }
  if (raw.type === 'live' || raw.source === 'live') {
    return 'live';
  }
  if (raw.type === 'direct' || raw.source === 'direct') {
    return 'direct';
  }
  if (raw.roomKey != null || raw.room_key != null) {
    return 'live';
  }
  if (Array.isArray(raw.recipients) || raw.recipient != null) {
    return 'direct';
  }
  return null;
}

function resolveSourceId(raw, kind) {
  if (raw.sourceId != null && raw.sourceId !== '') {
    return String(raw.sourceId);
  }
  if (raw.key != null && raw.key !== '') {
    return String(raw.key);
  }
  if (kind === 'live' && (raw.roomKey != null || raw.room_key != null)) {
    return String(raw.roomKey ?? raw.room_key);
  }
  if (kind === 'direct' && (raw.conversationId != null || raw.conversation_id != null)) {
    return String(raw.conversationId ?? raw.conversation_id);
  }
  if (raw.id != null) {
    const id = String(typeof raw.id === 'function' ? raw.id() : raw.id);
    if (id.startsWith('live:') || id.startsWith('direct:')) {
      return id.slice(id.indexOf(':') + 1);
    }
    return id;
  }
  return null;
}

function resolveTitle(raw, kind, sourceId) {
  const candidates = [
    readDisplayText(raw.title),
    readDisplayText(raw.name),
    readDisplayText(raw.displayName),
    readDisplayText(raw.username),
    recipientTitle(raw),
  ];
  let title = candidates.find((value) => value) || null;

  if (kind === 'live' && String(sourceId) === PRIMARY_LIVE_ROOM_KEY) {
    if (!title || title === PRIMARY_LIVE_ROOM_KEY) {
      return PRIMARY_LIVE_TITLE;
    }
  }

  if (!title && kind === 'live') {
    title = readDisplayText(raw.roomKey || raw.room_key);
  }

  return title || 'Conversation';
}

function recipientTitle(raw) {
  const recipients = Array.isArray(raw.recipients) ? raw.recipients : [];
  const names = recipients
    .map((recipient) => {
      const user = recipient && typeof recipient.user === 'function' ? recipient.user() : recipient?.user || recipient;
      return readDisplayText(user?.displayName) || readDisplayText(user?.username) || readDisplayText(user?.display_name);
    })
    .filter(Boolean);
  return names.length ? names.join(', ') : null;
}

function resolveIdentities(raw, title, sourceId) {
  const identities = new Set();
  if (title) identities.add(title.toLowerCase());
  if (sourceId) identities.add(String(sourceId).toLowerCase());

  for (const key of ['username', 'displayName', 'display_name', 'name', 'roomKey', 'room_key', 'key']) {
    const value = readDisplayText(raw[key]);
    if (value) identities.add(value.toLowerCase());
  }

  const recipients = Array.isArray(raw.recipients) ? raw.recipients : [];
  for (const recipient of recipients) {
    const user = recipient && typeof recipient.user === 'function' ? recipient.user() : recipient?.user || recipient;
    for (const key of ['username', 'displayName', 'display_name', 'name']) {
      const value = readDisplayText(user?.[key]);
      if (value) identities.add(value.toLowerCase());
    }
  }

  return Array.from(identities);
}

function resolvePrivacy(raw, kind) {
  const explicit = raw.privacy || raw.visibility;
  if (explicit === 'private' || explicit === 'public') {
    return explicit;
  }
  if (raw.isPublic === true || raw.public === true) {
    return 'public';
  }
  if (raw.isPublic === false || raw.private === true) {
    return 'private';
  }
  if (raw.type === 'chat' || raw.type === 'pm') {
    return 'private';
  }
  if (raw.type === 'channel') {
    return 'public';
  }
  return kind === 'direct' ? 'private' : 'public';
}

function resolveActivityAt(raw) {
  const value = raw.activityAt ?? raw.activity_at ?? raw.updatedAt ?? raw.updated_at ?? raw.lastActivity ?? raw.last_activity_at ?? null;
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'function') {
    return resolveActivityAt({ activityAt: value() });
  }
  return null;
}

function resolveUnreadCount(raw) {
  const value = raw.unreadCount ?? raw.unReadCount ?? raw.unread_count ?? raw.unread ?? 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolveAvatarUrl(raw) {
  if (typeof raw.avatarUrl === 'string' && raw.avatarUrl) {
    return raw.avatarUrl;
  }
  if (typeof raw.avatar_url === 'string' && raw.avatar_url) {
    return raw.avatar_url;
  }
  const recipients = Array.isArray(raw.recipients) ? raw.recipients : [];
  for (const recipient of recipients) {
    const user = recipient && typeof recipient.user === 'function' ? recipient.user() : recipient?.user || recipient;
    const url = readDisplayText(user?.avatarUrl) || readDisplayText(user?.avatar_url);
    if (url) return url;
  }
  return null;
}

/**
 * Presentation-only text reader for titles/labels.
 * Accepts strings, functions returning those, and simple text-fragment arrays.
 * Never stringifies arbitrary objects.
 *
 * @param {*} value
 * @returns {string|null}
 */
export function readDisplayText(value) {
  if (typeof value === 'function') {
    try {
      value = value();
    } catch {
      return null;
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts = [];
    for (const part of value) {
      const text = readDisplayText(part);
      if (text) parts.push(text);
    }
    const joined = parts.join('').trim();
    return joined ? joined : null;
  }

  return null;
}
