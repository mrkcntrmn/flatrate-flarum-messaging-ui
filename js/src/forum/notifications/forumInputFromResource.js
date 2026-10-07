import { conversationIdFromNotificationContent } from './normalizeForumNotification.js';

/**
 * Turn a Flarum notification API resource into a presentation input.
 * Message content is reduced to a conversation id for Direct de-duplication.
 */
export function forumInputFromResource(resource, includedUsers = []) {
  const attrs = resource?.attributes || {};
  const fromUserId = relationshipId(resource, 'fromUser');
  const fromUser = includedUsers.find((user) => String(user.id) === String(fromUserId)) || null;
  const userAttrs = fromUser?.attributes || {};
  return {
    id: resource?.id,
    contentType: attrs.contentType,
    isRead: attrs.isRead,
    createdAt: attrs.createdAt,
    href: typeof attrs.href === 'string' ? attrs.href : '',
    conversationId: conversationIdFromNotificationContent(attrs.content),
    fromUser: fromUser
      ? {
          id: fromUser.id,
          username: userAttrs.username,
          displayName: userAttrs.displayName,
        }
      : null,
  };
}

function relationshipId(resource, name) {
  const data = resource?.relationships?.[name]?.data;
  if (!data || Array.isArray(data)) return null;
  return data.id;
}
