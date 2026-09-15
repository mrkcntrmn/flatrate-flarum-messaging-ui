/**
 * Shared conversation scroll helpers for Messages V2.
 * Providers should reuse these concepts for initial/latest, incoming, and pagination.
 */

/** Stable near-bottom threshold (accepted range 80–120). */
export const NEAR_BOTTOM_PX = 100;

/**
 * @param {{ scrollTop?: number, clientHeight?: number, scrollHeight?: number } | null | undefined} viewport
 * @param {number} [thresholdPx]
 * @returns {boolean}
 */
export function isNearBottom(viewport, thresholdPx = NEAR_BOTTOM_PX) {
  if (!viewport) {
    return false;
  }
  const scrollTop = Number(viewport.scrollTop) || 0;
  const clientHeight = Number(viewport.clientHeight) || 0;
  const scrollHeight = Number(viewport.scrollHeight) || 0;
  const distance = scrollHeight - (scrollTop + clientHeight);
  return distance <= thresholdPx;
}

/**
 * Preserve visual position after older messages are prepended.
 *
 * Example: oldHeight=1000, newHeight=1400, oldTop=100 → 500
 *
 * @param {number} oldHeight
 * @param {number} oldTop
 * @param {number} newHeight
 * @returns {number}
 */
export function calculatePreservedScrollTop(oldHeight, oldTop, newHeight) {
  const prevHeight = Number(oldHeight) || 0;
  const prevTop = Number(oldTop) || 0;
  const nextHeight = Number(newHeight) || 0;
  return prevTop + (nextHeight - prevHeight);
}

/**
 * Whether an incoming (or own-send) message should auto-scroll to latest.
 *
 * @param {{ nearBottom?: boolean, isOwnSend?: boolean, hasInitialPositioned?: boolean }} opts
 * @returns {boolean}
 */
export function shouldAutoScrollIncoming({ nearBottom = false, isOwnSend = false, hasInitialPositioned = true } = {}) {
  if (!hasInitialPositioned) {
    return false;
  }
  if (isOwnSend) {
    return true;
  }
  return !!nearBottom;
}

/**
 * Whether the viewport still needs one-shot initial scroll to latest.
 *
 * @param {{
 *   hasInitialPositioned?: boolean,
 *   conversationKey?: string | null,
 *   currentConversationKey?: string | null,
 *   hasRenderedMessages?: boolean
 * }} opts
 * @returns {boolean}
 */
export function shouldInitialScroll({
  hasInitialPositioned = false,
  conversationKey = null,
  currentConversationKey = null,
  hasRenderedMessages = false,
} = {}) {
  if (!hasRenderedMessages) {
    return false;
  }
  if (conversationKey == null || currentConversationKey == null) {
    return false;
  }
  if (String(conversationKey) !== String(currentConversationKey)) {
    return true;
  }
  return !hasInitialPositioned;
}

/**
 * Instant jump to latest (no animated scroll).
 *
 * @param {{ scrollTop?: number, scrollHeight?: number } | null | undefined} viewport
 */
export function scrollToLatest(viewport) {
  if (!viewport) {
    return;
  }
  viewport.scrollTop = Number(viewport.scrollHeight) || 0;
}
