/**
 * Ask Flarum to mark one forum notification read. Direct and Live unread
 * stay on their providers. A missing model is a no-op.
 */
export function markForumNotificationRead(store, row) {
  if (!row || row.source !== 'forum' || typeof row.id !== 'string' || !row.id.startsWith('forum:')) {
    return false;
  }
  const id = row.id.slice('forum:'.length);
  if (!id || !store || typeof store.getById !== 'function') {
    return false;
  }
  const model = store.getById('notifications', id);
  if (!model || typeof model.save !== 'function') {
    return false;
  }
  if (typeof model.isRead === 'function' && model.isRead()) {
    return false;
  }
  model.save({ isRead: true });
  return true;
}
