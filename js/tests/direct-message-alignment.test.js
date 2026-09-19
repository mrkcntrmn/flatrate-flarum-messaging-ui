import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * FORUM-MESSAGING-DIRECT-ALIGNMENT-R1
 *
 * Direct provider emits `.message-content.my-message` / `.other-message`.
 * The unified Messages shell must style those classes — not stale `.me`.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Extract the Direct conversation pane block from forum.less. */
function directPaneLess(less) {
  const start = less.indexOf('.MessagesPage-conversationPane--direct');
  assert.ok(start >= 0, 'Direct pane scope must exist');
  // Take until the next top-level rule that is not nested under the pane
  // (a line starting with `.` at column 0 after the opening brace block).
  const from = less.slice(start);
  // Brace-match the first block after the selector.
  const brace = from.indexOf('{');
  assert.ok(brace >= 0);
  let depth = 0;
  let end = brace;
  for (; end < from.length; end += 1) {
    const ch = from[end];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return from.slice(0, end);
}

test('Direct pane styles production my-message / other-message ownership classes', () => {
  const less = read('resources/less/forum.less');
  const pane = directPaneLess(less);

  assert.match(pane, /\.message-content\.my-message\s*\{/);
  assert.match(
    pane,
    /\.message-content\.my-message\s*\{[\s\S]*?align-self:\s*flex-end/
  );
  assert.match(
    pane,
    /\.message-content\.other-message\s*\{[\s\S]*?align-self:\s*flex-start/
  );
  assert.match(
    pane,
    /\.message-content\.my-message\s+\.message-data\s*\{[\s\S]*?justify-content:\s*flex-end/
  );
  assert.match(
    pane,
    /\.message-content\.my-message\s+\.message-text[\s\S]*?background:\s*color-mix/
  );
});

test('stale .me is not the sole Direct ownership selector', () => {
  const less = read('resources/less/forum.less');
  const pane = directPaneLess(less);

  // Canonical contract must be present.
  assert.match(pane, /\.message-content\.my-message/);
  assert.match(pane, /\.message-content\.other-message/);

  // Stale `.me` must not be the only ownership alignment path.
  const ownAlignViaMe =
    /\.message-content\.me[\s\S]*?align-self:\s*flex-end/.test(pane) &&
    !/\.message-content\.my-message[\s\S]*?align-self:\s*flex-end/.test(pane);
  assert.equal(
    ownAlignViaMe,
    false,
    'own-message right alignment must not depend solely on stale .me'
  );

  // Prefer not leaving `.me` as an ownership selector inside the Direct pane.
  assert.doesNotMatch(
    pane,
    /\.message-content\.me\b/,
    'replace stale .me selectors rather than stacking compatibility rules'
  );
});

test('Direct alignment rules remain scoped under conversationPane--direct', () => {
  const less = read('resources/less/forum.less');
  const pane = directPaneLess(less);

  assert.match(pane, /^\.MessagesPage-conversationPane--direct/);
  assert.match(pane, /\.message-content\.my-message/);
  assert.match(pane, /\.message-content\.other-message/);

  // Global (unscoped) ownership rules for these classes must not exist outside the pane.
  const withoutPane = less.replace(pane, '');
  assert.doesNotMatch(
    withoutPane,
    /\.MessagesPage-conversationPane--direct[\s\S]*\.message-content\.my-message/
  );
  assert.doesNotMatch(withoutPane, /^\s*\.message-content\.my-message\s*\{/m);
});
