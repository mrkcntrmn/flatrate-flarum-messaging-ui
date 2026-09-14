/**
 * Map Direct route selection onto the conversation pane state machine.
 *
 * A mismatched or missing selection is treated as loading so the shell never
 * flashes a false empty/"no messages" pane while a resolve is starting.
 *
 * @param {{ status?: string, kind?: string, key?: string } | null | undefined} selection
 * @param {string | null | undefined} selectedKey
 * @returns {'idle'|'loading'|'ready'|'not-found'|'error'}
 */
export default function directConversationPaneStatus(selection, selectedKey) {
  if (selectedKey == null || selectedKey === '') {
    return 'idle';
  }

  const key = String(selectedKey);
  if (!selection || selection.kind !== 'direct' || String(selection.key) !== key) {
    return 'loading';
  }

  const status = selection.status;
  if (status === 'ready' || status === 'not-found' || status === 'error' || status === 'loading') {
    return status;
  }

  return 'loading';
}
