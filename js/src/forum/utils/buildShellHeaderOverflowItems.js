import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import ItemList from 'flarum/common/utils/ItemList';

/** Shell-owned overflow keys — providers may not replace these. */
export const SHELL_OVERFLOW_KEYS = new Set(['allMessages', 'newMessage']);

/**
 * Baseline conversation overflow actions owned by the Messages shell.
 * Always present when a conversation is selected; providers only append.
 */
export default function buildShellHeaderOverflowItems({ onBack } = {}) {
  const items = new ItemList();
  const sources = app.flatrateMessaging ? app.flatrateMessaging.sources() : { direct: null };
  const canCompose = !!sources?.direct;

  if (canCompose) {
    items.add(
      'newMessage',
      <Button
        icon="fas fa-pen"
        onclick={() => {
          if (app.flatrateMessaging && typeof app.flatrateMessaging.composeDirect === 'function') {
            app.flatrateMessaging.composeDirect();
          }
        }}
      >
        {app.translator.trans('flatrate-messaging-ui.forum.page.compose')}
      </Button>,
      100
    );
  }

  items.add(
    'allMessages',
    <Button
      icon="fas fa-inbox"
      onclick={() => {
        if (typeof onBack === 'function') onBack();
      }}
    >
      {app.translator.trans('flatrate-messaging-ui.forum.page.back_to_messages')}
    </Button>,
    90
  );

  return items;
}

/**
 * Merge provider contributions under shell items.
 * ItemList.merge overwrites by key — shell is merged last so shell semantics win.
 */
export function mergeHeaderOverflowItems(shellItems, providerItems) {
  const merged = new ItemList();
  const provider = normalizeProviderHeaderOverflowItems(providerItems);
  if (provider) {
    merged.merge(provider);
  }
  if (shellItems) {
    merged.merge(shellItems);
  }
  return merged;
}

export function normalizeProviderHeaderOverflowItems(providerItems) {
  if (!providerItems) {
    return null;
  }
  if (typeof providerItems.merge === 'function' && typeof providerItems.toArray === 'function') {
    return providerItems;
  }
  if (Array.isArray(providerItems)) {
    // Legacy array contributions: keep as anonymous low-priority entries.
    const list = new ItemList();
    providerItems.filter(Boolean).forEach((item, index) => {
      list.add(`provider:${index}`, item, 10 - index);
    });
    return list;
  }
  return null;
}
