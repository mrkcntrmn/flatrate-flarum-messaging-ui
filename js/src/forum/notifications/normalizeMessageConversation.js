import normalizeConversation from '../utils/normalizeConversation.js';
import { conversationPath } from '../utils/messagingRoutes.js';
import { assertPresentationSafe } from './forbiddenPresentationFields.js';

/**
 * Messages rows are unread Direct conversations and authorized Live rooms.
 * Hidden or unauthorized Live rooms are dropped. Message bodies are not copied.
 */
export function normalizeMessageConversation(raw, { authorizedRoomKeys = null, allowHiddenPreview = false } = {}) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const kind = raw.kind === 'live' || raw.kind === 'direct' ? raw.kind : raw.roomKey || raw.room_key ? 'live' : 'direct';
  if (kind === 'live' && !liveRoomAllowed(raw, authorizedRoomKeys, allowHiddenPreview)) {
    return null;
  }

  const conversation = normalizeConversation(raw, kind);
  if (!conversation) {
    return null;
  }

  const unreadCount = Number(conversation.unreadCount) || 0;
  if (unreadCount <= 0) {
    return null;
  }

  const row = {
    id: conversation.id,
    source: kind,
    kind,
    title: conversation.title,
    actor: null,
    unreadCount,
    activityAt: conversation.activityAt,
    href: conversationPath(kind, conversation.sourceId),
    canMessageActor: false,
    aggregate: false,
  };

  return assertPresentationSafe(row);
}

export function normalizeMessageConversations(rows, options) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeMessageConversation(row, options))
    .filter(Boolean);
}

function liveRoomAllowed(raw, authorizedRoomKeys, allowHiddenPreview) {
  const hidden = raw.hidden === true || raw.visibility === 'hidden' || raw.privacy === 'hidden';
  if (hidden && !allowHiddenPreview) {
    return false;
  }
  const roomKey = raw.roomKey || raw.room_key || raw.key || raw.sourceId || null;
  if (authorizedRoomKeys instanceof Set && roomKey != null && !authorizedRoomKeys.has(String(roomKey))) {
    return false;
  }
  return true;
}
