import canOfferMessageAction from '../utils/canOfferMessageAction.js';

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
  if (kind === 'newPrivateMessage') {
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
