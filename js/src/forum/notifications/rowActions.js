import { canMessageNotificationActor, messageActionLabel } from './messageActionEligibility.js';

export function applyMessageEligibility(row, { signedIn, actor, canMessage }) {
  if (!row) return row;
  const target = row.actor
    ? {
        id: () => row.actor.id,
        deleted: row.actor.deleted,
        unavailable: row.actor.unavailable,
      }
    : null;
  const allowed = canMessageNotificationActor({
    signedIn,
    actor,
    target,
    canMessage,
    aggregate: row.aggregate === true || !row.actor,
    source: row.source,
    kind: row.kind,
  });
  return {
    ...row,
    canMessageActor: allowed,
    messageLabel: allowed ? messageActionLabel(row.actor.displayName || row.actor.username) : '',
  };
}

/**
 * Direct notification rows open the existing conversation. They do not grow a
 * second Message button, and they do not create a conversation.
 */
export function rowActions(row) {
  if (!row) {
    return { primary: null, message: null };
  }
  if (row.source === 'direct' || row.source === 'live' || row.kind === 'newPrivateMessage') {
    return { primary: { type: 'href', href: row.href }, message: null };
  }
  return {
    primary: { type: 'href', href: row.href },
    message: row.canMessageActor && row.actor
      ? { type: 'openDirectToUser', userId: row.actor.id, label: row.messageLabel }
      : null,
  };
}
