import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import ItemList from 'flarum/common/utils/ItemList';
import { conversationPath } from './messagingRoutes.js';

/**
 * Shell-owned directory row overflow actions.
 * Providers may append via directoryOverflowItems; they do not replace these.
 */
export default function buildShellDirectoryOverflowItems({ conversation } = {}) {
  const items = new ItemList();
  const kind = conversation?.kind;
  const sourceId = conversation?.sourceId;
  const path = conversationPath(kind, sourceId);

  items.add(
    'open',
    <Button
      icon="fas fa-comments"
      onclick={() => {
        m.route.set(path);
      }}
    >
      {app.translator.trans('flatrate-messaging-ui.forum.row.open')}
    </Button>,
    100
  );

  items.add(
    'copyLink',
    <Button
      icon="fas fa-link"
      onclick={() => {
        copyConversationLink(path);
      }}
    >
      {app.translator.trans('flatrate-messaging-ui.forum.row.copy_link')}
    </Button>,
    90
  );

  return items;
}

/**
 * Merge optional provider directory-row contributions under shell items.
 * ItemList.merge overwrites by key — shell is merged last so shell semantics win.
 */
export function mergeDirectoryOverflowItems(shellItems, providerItems) {
  const merged = new ItemList();
  const provider = normalizeProviderDirectoryOverflowItems(providerItems);
  if (provider) {
    merged.merge(provider);
  }
  if (shellItems) {
    merged.merge(shellItems);
  }
  return merged;
}

export function normalizeProviderDirectoryOverflowItems(providerItems) {
  if (!providerItems) {
    return null;
  }
  if (typeof providerItems.merge === 'function' && typeof providerItems.toArray === 'function') {
    return providerItems;
  }
  if (Array.isArray(providerItems)) {
    const list = new ItemList();
    providerItems.filter(Boolean).forEach((item, index) => {
      list.add(`provider:${index}`, item, 10 - index);
    });
    return list;
  }
  return null;
}

function copyConversationLink(path) {
  const absolute = absoluteConversationUrl(path);
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(absolute).catch(() => {
      fallbackCopy(absolute);
    });
    return;
  }
  fallbackCopy(absolute);
}

function absoluteConversationUrl(path) {
  const base =
    (app.forum && typeof app.forum.attribute === 'function' && app.forum.attribute('baseUrl')) ||
    (typeof window !== 'undefined' && window.location && window.location.origin) ||
    '';
  try {
    return new URL(path, String(base).replace(/\/?$/, '/') || undefined).href;
  } catch (e) {
    return path;
  }
}

function fallbackCopy(text) {
  if (typeof document === 'undefined') {
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    // Clipboard unavailable — fail silently; no alerts with content.
  }
  document.body.removeChild(textarea);
}
