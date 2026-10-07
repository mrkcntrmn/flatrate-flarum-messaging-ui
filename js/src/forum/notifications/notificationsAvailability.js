export const NOTIFICATIONS_AVAILABLE_ATTRIBUTE = 'flatrate-messaging-ui.notifications_available';

/**
 * Actor-effective availability from the forum payload.
 * Missing, string, or numeric values fail closed. This does not read beta
 * state or the raw rollout settings.
 */
export function notificationsAvailable(app) {
  const forum = app && app.forum;
  if (!forum || typeof forum.attribute !== 'function') {
    return false;
  }
  return forum.attribute(NOTIFICATIONS_AVAILABLE_ATTRIBUTE) === true;
}
