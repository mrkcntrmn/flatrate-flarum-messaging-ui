import { assertPresentationSafe } from './forbiddenPresentationFields.js';
import { isSafeForumHref } from './forumNotificationTarget.js';
import { isAggregateActor } from './messageActionEligibility.js';

export const DIRECT_FLARUM_NOTIFICATION_TYPE = 'newPrivateMessage';

const SAFE_TITLES = {
  discussionRenamed: 'renamed your discussion',
  postLiked: 'liked your post',
  newPost: 'replied to your discussion',
  reply: 'replied to your discussion',
  userMentioned: 'mentioned you',
  postMentioned: 'replied to your post',
  groupMentioned: "mentioned a group you're a member of",
};

export function conversationIdFromNotificationContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return null;
  }
  if (content.conversationId != null && content.conversationId !== '') {
    return String(content.conversationId);
  }
  const conversation = content.conversation;
  if (conversation && typeof conversation === 'object' && conversation.id != null && conversation.id !== '') {
    return String(conversation.id);
  }
  return null;
}

export function shouldSuppressForumDirectNotification(raw, directConversationIds) {
  const type = raw?.contentType || raw?.kind;
  if (type !== DIRECT_FLARUM_NOTIFICATION_TYPE) {
    return false;
  }
  const ids = directConversationIds instanceof Set ? directConversationIds : new Set(directConversationIds || []);
  const conversationId = raw?.conversationId != null ? String(raw.conversationId) : null;
  return conversationId != null && ids.has(conversationId);
}

export function forumActivityTitle({ contentType, username }) {
  const name = String(username || '').trim() || 'Someone';
  const action = SAFE_TITLES[contentType] || 'sent a forum notification';
  return `${name} ${action}`;
}

export function normalizeForumNotification(raw, directConversationIds) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  if (shouldSuppressForumDirectNotification(raw, directConversationIds)) {
    return null;
  }

  const id = raw.id != null ? String(raw.id) : '';
  if (!id) {
    return null;
  }

  const kind = String(raw.contentType || raw.kind || 'forum');
  const fromUser = raw.fromUser && typeof raw.fromUser === 'object' ? raw.fromUser : null;
  const username = readName(fromUser);
  const aggregate = isAggregateActor(raw);
  const actor = aggregate || !fromUser
    ? null
    : {
        id: idOf(fromUser),
        username,
        displayName: readDisplay(fromUser) || username,
        deleted: fromUser.deleted === true,
        unavailable: fromUser.unavailable === true,
      };

  const unreadCount = raw.isRead ? 0 : positiveInt(raw.unreadCount, 1);
  const row = {
    id: `forum:${id}`,
    source: 'forum',
    kind,
    title: forumActivityTitle({ contentType: kind, username: actor?.displayName || username }),
    actor: actor && actor.id ? actor : null,
    unreadCount,
    activityAt: raw.createdAt || raw.activityAt || null,
    href: isSafeForumHref(raw.href) ? raw.href : '',
    targetUnavailable: !isSafeForumHref(raw.href),
    canMessageActor: false,
    aggregate,
  };

  return assertPresentationSafe(row);
}

function readName(user) {
  if (!user) return '';
  return String(user.username || user.displayName || user.display_name || '');
}

function readDisplay(user) {
  if (!user) return '';
  return String(user.displayName || user.display_name || user.username || '');
}

function idOf(user) {
  if (!user || user.id == null || user.id === '') return '';
  return String(typeof user.id === 'function' ? user.id() : user.id);
}

function positiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.floor(number);
}
