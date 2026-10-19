/** Retired shell overflow keys. Providers may not reintroduce these. */
export const RETIRED_OVERFLOW_KEYS = ['allMessages'];

/**
 * Shell-owned conversation overflow keys.
 * Navigation stays on the visible Back button, so All messages is not a key.
 */
export function shellHeaderOverflowPlan({ canCompose = false } = {}) {
  return canCompose ? ['newMessage'] : [];
}

export function omitRetiredOverflowKeys(list) {
  if (!list || typeof list.remove !== 'function') return list;
  RETIRED_OVERFLOW_KEYS.forEach((key) => list.remove(key));
  return list;
}

/**
 * Keys that remain after provider items are merged under the shell plan.
 * Retired keys are dropped even when a provider still emits them.
 */
export function visibleOverflowKeys({ canCompose = false, providerKeys = [] } = {}) {
  const retired = new Set(RETIRED_OVERFLOW_KEYS);
  const keys = [];
  const push = (key) => {
    if (!key || retired.has(key) || keys.includes(key)) return;
    keys.push(key);
  };

  providerKeys.forEach(push);
  shellHeaderOverflowPlan({ canCompose }).forEach(push);
  return keys;
}
