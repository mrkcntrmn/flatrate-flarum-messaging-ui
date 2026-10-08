import test from 'node:test';
import assert from 'node:assert/strict';
import { canMessageNotificationActor, messageActionLabel } from '../src/forum/notifications/messageActionEligibility.js';
import { applyMessageEligibility, rowActions } from '../src/forum/notifications/rowActions.js';

const actor = { id: () => '1' };
const other = { id: () => '725' };

function eligible(overrides = {}) {
  return canMessageNotificationActor({
    signedIn: true,
    actor,
    target: other,
    canMessage: true,
    aggregate: false,
    source: 'forum',
    kind: 'newPost',
    ...overrides,
  });
}

test('message action requires one other messageable member', () => {
  assert.equal(eligible(), true);
  assert.equal(eligible({ signedIn: false }), false);
  assert.equal(eligible({ actor: null }), false);
  assert.equal(eligible({ target: actor }), false);
  assert.equal(eligible({ target: null }), false);
  assert.equal(eligible({ target: { deleted: true } }), false);
  assert.equal(eligible({ target: { unavailable: true, id: () => '9' } }), false);
  assert.equal(eligible({ canMessage: false }), false);
  assert.equal(eligible({ aggregate: true }), false);
  assert.equal(eligible({ source: 'direct' }), false);
  assert.equal(eligible({ source: 'live' }), false);
  assert.equal(eligible({ kind: 'newPrivateMessage' }), false);
  assert.equal(eligible({ kind: 'discussionRenamed' }), true);
  assert.equal(eligible({ kind: 'postLiked' }), true);
  assert.equal(eligible({ kind: 'userMentioned' }), true);
  assert.equal(eligible({ kind: 'postMentioned' }), true);
  assert.equal(eligible({ kind: 'groupMentioned' }), true);
  assert.equal(eligible({ kind: 'reply' }), false);
  assert.equal(eligible({ kind: 'userSuspended' }), false);
  assert.equal(eligible({ kind: 'system' }), false);
  assert.equal(eligible({ kind: 'moderation' }), false);
  assert.equal(eligible({ kind: 'security' }), false);
  assert.equal(eligible({ kind: 'unknownEvent' }), false);
  assert.equal(eligible({ kind: '' }), false);
  assert.equal(eligible({ kind: 'forum' }), false);
});

test('eligible forum row exposes Message and direct rows open the conversation', () => {
  const forum = applyMessageEligibility({
    id: 'forum:1',
    source: 'forum',
    kind: 'newPost',
    actor: { id: '725', username: 'tech_#725', displayName: 'tech_#725' },
    aggregate: false,
    href: '/d/1',
  }, { signedIn: true, actor, canMessage: true });
  assert.equal(forum.canMessageActor, true);
  assert.equal(messageActionLabel('tech_#725'), 'Message tech_#725');
  assert.deepEqual(rowActions(forum).message, {
    type: 'openDirectToUser',
    userId: '725',
    label: 'Message tech_#725',
  });

  const aggregate = applyMessageEligibility({
    ...forum,
    aggregate: true,
    title: 'tech_#725, tech_#133 and 5 others liked your post',
  }, { signedIn: true, actor, canMessage: true });
  assert.equal(aggregate.canMessageActor, false);
  assert.equal(rowActions(aggregate).message, null);

  const direct = rowActions({
    source: 'direct',
    kind: 'direct',
    href: '/messages/direct/44',
    canMessageActor: false,
  });
  assert.equal(direct.primary.href, '/messages/direct/44');
  assert.equal(direct.message, null);
});
