import test from 'node:test';
import assert from 'node:assert/strict';
import canOfferMessageAction from '../src/forum/utils/canOfferMessageAction.js';

function user(id) {
  return { id: () => String(id) };
}

test('profile action self gate', () => {
  assert.equal(canOfferMessageAction({ actor: user(1), targetUser: user(2), canMessage: true }), true);
  assert.equal(canOfferMessageAction({ actor: user(1), targetUser: user(1), canMessage: true }), false);
});

test('post action self/missing user/guest gates', () => {
  assert.equal(canOfferMessageAction({ actor: null, targetUser: user(2), canMessage: true }), false);
  assert.equal(canOfferMessageAction({ actor: user(1), targetUser: null, canMessage: true }), false);
  assert.equal(canOfferMessageAction({ actor: user(1), targetUser: user(2), canMessage: false }), false);
  assert.equal(canOfferMessageAction({ actor: user(1), targetUser: { username: 'gone' }, canMessage: true }), false);
});
