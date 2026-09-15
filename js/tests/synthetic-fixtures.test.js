import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSyntheticDirectory, buildSyntheticMessages, SYNTHETIC_MESSAGE_COUNTS } from '../src/forum/fixtures/syntheticMessagingFixtures.js';

test('synthetic message counts include large-history fixtures', () => {
  assert.deepEqual(SYNTHETIC_MESSAGE_COUNTS, [1, 20, 100, 200, 500]);
});

test('buildSyntheticMessages produces stable ids without body-search fields', () => {
  const messages = buildSyntheticMessages(5, { kind: 'direct', seed: 't' });
  assert.equal(messages.length, 5);
  assert.equal(messages[0].id, 't-1');
  assert.equal(messages[4].body.includes('Synthetic direct'), true);
  assert.equal('preview' in messages[0], false);
});

test('buildSyntheticDirectory has Direct + Live rows and no message bodies', () => {
  const rows = buildSyntheticDirectory();
  assert.ok(rows.some((row) => row.kind === 'direct'));
  assert.ok(rows.some((row) => row.kind === 'live' && row.title === 'FlatRate.wiki Live'));
  for (const row of rows) {
    assert.equal('body' in row, false);
    assert.equal('preview' in row, false);
  }
});
