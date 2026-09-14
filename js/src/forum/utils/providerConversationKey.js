/**
 * Extract the un-namespaced conversation key from a provider row or Flarum model.
 *
 * @param {object|null|undefined} conversation
 * @returns {string}
 */
export default function providerConversationKey(conversation) {
  if (!conversation) {
    return '';
  }

  for (const field of ['key', 'sourceId', 'conversationId', 'roomKey']) {
    const value = conversation[field];
    if (value != null && value !== '') {
      return String(value);
    }
  }

  const id = typeof conversation.id === 'function' ? conversation.id() : conversation.id;
  if (id == null || id === '') {
    return '';
  }

  const value = String(id);
  if (value.startsWith('direct:') || value.startsWith('live:')) {
    return value.slice(value.indexOf(':') + 1);
  }
  return value;
}
