import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const less = readFileSync(join(root, 'resources/less/forum.less'), 'utf8');

function wideLayoutHidesBack(width, height) {
  if (width >= 768 && height <= 500) return false;
  return width >= 768;
}

test('wide layout still hides Back at desktop heights', () => {
  assert.equal(wideLayoutHidesBack(1280, 800), true);
  assert.equal(wideLayoutHidesBack(801, 900), true);
});

test('phone landscape keeps the route-aware Back control', () => {
  assert.equal(wideLayoutHidesBack(801, 284), false);
  assert.equal(wideLayoutHidesBack(392, 721), false);
});

test('stylesheet restores Back only for a short wide viewport', () => {
  const hiddenAt = less.indexOf('.MessagesConversationHeader-back {\n    display: none !important;');
  const restoredAt = less.indexOf('@media @tablet-up and (max-height: 500px)');
  assert.ok(hiddenAt > 0);
  assert.ok(restoredAt > hiddenAt);
  const restore = less.slice(restoredAt, restoredAt + 220);
  assert.match(restore, /\.MessagesConversationHeader-back \{\s*display: inline-flex !important;/);
  assert.doesNotMatch(restore, /allMessages|fa-inbox/);
});
