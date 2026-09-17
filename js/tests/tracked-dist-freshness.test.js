import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Flarum serves tracked js/dist/forum.js (see extend.php), not js/src.
 * These marker checks catch the FORUM-MESSAGING-010UI production failure class:
 * source updated, committed dist left stale.
 *
 * CI also runs `npm run build` then `git diff --exit-code -- js/dist`.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = join(ROOT, 'js/dist/forum.js');

test('tracked forum dist exists and is registered for Flarum forum frontend', () => {
  assert.equal(existsSync(DIST), true);
  const extend = readFileSync(join(ROOT, 'extend.php'), 'utf8');
  assert.match(extend, /Extend\\Frontend\('forum'\)/);
  assert.match(extend, /js\/dist\/forum\.js/);
});

test('tracked forum dist embeds 010UI directory Live presence contract', () => {
  const dist = readFileSync(DIST, 'utf8');
  assert.match(dist, /ConversationRow-livePresence/);
  assert.match(dist, /liveUserCount/);
  assert.match(dist, /messages-live-accent/);
  assert.match(dist, /users live/);
  // Legacy privacy-text span must not survive in the production bundle.
  assert.doesNotMatch(dist, /ConversationRow-privacy-text/);
});
