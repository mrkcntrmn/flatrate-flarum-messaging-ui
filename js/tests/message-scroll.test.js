import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEAR_BOTTOM_PX,
  isNearBottom,
  calculatePreservedScrollTop,
  shouldAutoScrollIncoming,
  shouldInitialScroll,
  scrollToLatest,
} from '../src/forum/utils/messageScroll.js';

test('NEAR_BOTTOM_PX is in the accepted 80–120 range', () => {
  assert.equal(NEAR_BOTTOM_PX, 100);
  assert.ok(NEAR_BOTTOM_PX >= 80 && NEAR_BOTTOM_PX <= 120);
});

test('isNearBottom detects distance within threshold', () => {
  assert.equal(isNearBottom({ scrollTop: 900, clientHeight: 100, scrollHeight: 1000 }), true);
  assert.equal(isNearBottom({ scrollTop: 800, clientHeight: 100, scrollHeight: 1000 }), true);
  assert.equal(isNearBottom({ scrollTop: 799, clientHeight: 100, scrollHeight: 1000 }), false);
  assert.equal(isNearBottom({ scrollTop: 0, clientHeight: 100, scrollHeight: 1000 }, 50), false);
  assert.equal(isNearBottom(null), false);
});

test('isNearBottom edge cases: empty, short content, exact and just-outside threshold', () => {
  assert.equal(isNearBottom({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 }), true);
  assert.equal(isNearBottom({ scrollTop: 0, clientHeight: 400, scrollHeight: 200 }), true);
  assert.equal(isNearBottom({ scrollTop: 900, clientHeight: 100, scrollHeight: 1100 }), true); // distance=100 exact
  assert.equal(isNearBottom({ scrollTop: 899, clientHeight: 100, scrollHeight: 1100 }), false); // distance=101
});

test('calculatePreservedScrollTop anchors after prepend', () => {
  assert.equal(calculatePreservedScrollTop(1000, 100, 1400), 500);
  assert.equal(calculatePreservedScrollTop(500, 0, 500), 0);
  assert.equal(calculatePreservedScrollTop(800, 200, 1200), 600);
});

test('calculatePreservedScrollTop edge cases: large and zero prepend deltas', () => {
  assert.equal(calculatePreservedScrollTop(1000, 50, 5000), 4050);
  assert.equal(calculatePreservedScrollTop(1000, 250, 1000), 250);
});

test('shouldAutoScrollIncoming: own send always; otherwise near-bottom only', () => {
  assert.equal(shouldAutoScrollIncoming({ nearBottom: false, isOwnSend: true, hasInitialPositioned: true }), true);
  assert.equal(shouldAutoScrollIncoming({ nearBottom: true, isOwnSend: false, hasInitialPositioned: true }), true);
  assert.equal(shouldAutoScrollIncoming({ nearBottom: false, isOwnSend: false, hasInitialPositioned: true }), false);
  assert.equal(shouldAutoScrollIncoming({ nearBottom: true, isOwnSend: false, hasInitialPositioned: false }), false);
});

test('shouldInitialScroll requires rendered messages and conversation identity', () => {
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: false,
      conversationKey: 'a',
      currentConversationKey: 'a',
      hasRenderedMessages: true,
    }),
    true
  );
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: true,
      conversationKey: 'a',
      currentConversationKey: 'a',
      hasRenderedMessages: true,
    }),
    false
  );
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: true,
      conversationKey: 'a',
      currentConversationKey: 'b',
      hasRenderedMessages: true,
    }),
    true
  );
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: false,
      conversationKey: 'a',
      currentConversationKey: 'a',
      hasRenderedMessages: false,
    }),
    false
  );
});

test('shouldInitialScroll: identity change and already-consumed initial position', () => {
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: true,
      conversationKey: 'direct:1',
      currentConversationKey: 'direct:2',
      hasRenderedMessages: true,
    }),
    true
  );
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: true,
      conversationKey: 'direct:1',
      currentConversationKey: 'direct:1',
      hasRenderedMessages: true,
    }),
    false
  );
  assert.equal(
    shouldInitialScroll({
      hasInitialPositioned: false,
      conversationKey: null,
      currentConversationKey: 'direct:1',
      hasRenderedMessages: true,
    }),
    false
  );
});

test('scrollToLatest sets scrollTop to scrollHeight', () => {
  const viewport = { scrollTop: 0, scrollHeight: 2400 };
  scrollToLatest(viewport);
  assert.equal(viewport.scrollTop, 2400);
  scrollToLatest(null);
});
