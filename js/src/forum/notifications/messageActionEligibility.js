import canOfferMessageAction from '../utils/canOfferMessageAction.js';

/**
 * Forum kinds whose Flarum component has one fromUser and a subject href.
 * Unknown kinds, including moderation, security, and system alerts, do not
 * grow a Message action.
 *
 * discussionRenamed — flarum/core DiscussionRenamedNotification
 * newPost — flarum/subscriptions NewPostNotification
 * postLiked — flarum/likes PostLikedNotification
 * userMentioned, postMentioned, groupMentioned — flarum/mentions
 */
export const MESSAGEABLE_FORUM_KINDS = new Set([
  'discussionRenamed',
  'newPost',
  'postLiked',
  'userMentioned',
  'postMentioned',
  'groupMentioned',
]);

/**
 * Notification Message action. Reuses the profile/post eligibility rule and
 * adds the single-actor constraint. Direct rows open the conversation.
 * Live rows are room-centric.
 */
export function canMessageNotificationActor({
  signedIn = false,
  actor = null,
  target = null,
  canMessage = false,
  aggregate = false,
  source = 'forum',
  kind = '',
} = {}) {
  if (!signedIn || aggregate) {
    return false;
  }
  if (source === 'direct' || source === 'live') {
    return false;
  }
  if (!MESSAGEABLE_FORUM_KINDS.has(kind)) {
    return false;
  }
  if (!target || target.deleted || target.unavailable) {
    return false;
  }
  return canOfferMessageAction({
    actor,
    targetUser: target,
    canMessage: !!canMessage,
  });
}

export function isAggregateActor(raw) {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  if (raw.aggregate === true) {
    return true;
  }
  const extra = raw.additionalFromUsers || raw.fromUsers;
  if (Array.isArray(extra) && extra.length > 0) {
    return true;
  }
  const count = Number(raw.actorCount);
  if (Number.isFinite(count) && count > 1) {
    return true;
  }
  const text = `${raw.title || ''} ${raw.summary || ''}`;
  return /\band\b.+\bothers\b/i.test(text);
}

export function messageActionLabel(username) {
  const name = String(username || '').trim();
  return name ? `Message ${name}` : '';
}
