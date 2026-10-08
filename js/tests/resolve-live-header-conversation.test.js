import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import resolveLiveHeaderConversation from '../src/forum/utils/resolveLiveHeaderConversation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function trustedAudi(sessionUserId = '7') {
  return {
    kind: 'live',
    sourceId: 'audi-live',
    title: 'Audi Live',
    privacy: 'public',
    presentationTrusted: true,
    sessionUserId,
    liveUserCount: null,
  };
}

test('general directory row is used when the provider has no selected-room method', () => {
  const directory = {
    kind: 'live',
    sourceId: 'community-general-live',
    title: 'FlatRate.wiki',
    privacy: 'public',
    liveUserCount: 12,
  };
  const resolved = resolveLiveHeaderConversation({
    provider: { listConversations() {} },
    directoryConversation: directory,
    roomKey: 'community-general-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'ready');
  assert.equal(resolved.conversation, directory);
  assert.equal(resolved.conversation.title, 'FlatRate.wiki');
});

test('general stays neutral while the directory row is still loading', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: null,
    directoryConversation: null,
    roomKey: 'community-general-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.headerPending, true);
  assert.equal(resolved.conversation.title, '');
  assert.equal(resolved.conversation.privacy, 'private');
  assert.equal(resolved.conversation.liveUserCount, null);
  assert.notEqual(resolved.conversation.title, 'community-general-live');
});

test('authorized hidden Audi snapshot becomes the canonical public Live header', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: { getSelectedConversation: () => trustedAudi() },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'ready');
  assert.equal(resolved.conversation.title, 'Audi Live');
  assert.equal(resolved.conversation.privacy, 'public');
  assert.equal(resolved.conversation.kind, 'live');
  assert.equal(resolved.conversation.sourceId, 'audi-live');
  assert.equal(resolved.conversation.presentationTrusted, true);
  assert.equal(resolved.conversation.liveUserCount, null);
});

test('an untrusted room-key fallback is not promoted to the visible title', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: {
      getSelectedConversation: () => ({
        kind: 'live',
        sourceId: 'audi-live',
        title: 'audi-live',
        privacy: 'public',
        presentationTrusted: true,
        sessionUserId: '7',
      }),
    },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.title, '');
  assert.notEqual(resolved.conversation.title, 'audi-live');
});

test('privacy is not fabricated from the route key', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: {
      getSelectedConversation: () => ({
        kind: 'live',
        sourceId: 'audi-live',
        title: 'Audi Live',
        presentationTrusted: true,
        sessionUserId: '7',
      }),
    },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.privacy, 'private');
});

test('unauthorized Audi stays unavailable and does not keep a public status', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: {
      getSelectedConversation: () => ({
        unavailable: true,
        kind: 'live',
        sourceId: 'audi-live',
        sessionUserId: '7',
      }),
    },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'unavailable');
  assert.equal(resolved.conversation.headerUnavailable, true);
  assert.equal(resolved.conversation.title, '');
  assert.equal(resolved.conversation.privacy, 'private');
  assert.equal(resolved.conversation.liveUserCount, null);
});

test('a missing provider method stays on the directory or loading path', () => {
  const missing = resolveLiveHeaderConversation({
    provider: {},
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(missing.status, 'loading');
  assert.equal(missing.conversation.headerPending, true);

  const directory = { kind: 'live', sourceId: 'audi-live', title: 'Audi Live', privacy: 'public' };
  const listed = resolveLiveHeaderConversation({
    provider: {},
    directoryConversation: directory,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(listed.status, 'ready');
  assert.equal(listed.conversation, directory);
});

test('a null provider snapshot stays loading for a hidden room', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: { getSelectedConversation: () => null },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.title, '');
});

test('a snapshot for a different room is ignored', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: { getSelectedConversation: () => trustedAudi() },
    directoryConversation: null,
    roomKey: 'ford-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.title, '');
  assert.equal(resolved.conversation.sourceId, 'ford-live');
});

test('stale session metadata is ignored', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: { getSelectedConversation: () => trustedAudi('7') },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: '8',
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.title, '');
  assert.equal(resolved.conversation.privacy, 'private');
});

test('rapid route switching drops the previous room snapshot', () => {
  let current = 'audi-live';
  const provider = {
    getSelectedConversation({ key }) {
      if (key === 'audi-live' && current === 'audi-live') return trustedAudi();
      if (key === 'ford-live' && current === 'ford-live') {
        return { ...trustedAudi(), sourceId: 'ford-live', title: 'Ford Live' };
      }
      return null;
    },
  };
  const audi = resolveLiveHeaderConversation({
    provider,
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  current = 'ford-live';
  const ford = resolveLiveHeaderConversation({
    provider,
    roomKey: 'ford-live',
    sessionUserId: '7',
  });
  assert.equal(audi.conversation.title, 'Audi Live');
  assert.equal(ford.conversation.title, 'Ford Live');
  assert.notEqual(ford.conversation.title, 'Audi Live');
});

test('logout during hydration does not keep the authorized title', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: { getSelectedConversation: () => trustedAudi('7') },
    directoryConversation: null,
    roomKey: 'audi-live',
    sessionUserId: null,
  });
  assert.equal(resolved.status, 'loading');
  assert.equal(resolved.conversation.title, '');
});

test('a failed exact-room request renders unavailable instead of the room key', () => {
  const resolved = resolveLiveHeaderConversation({
    provider: {
      getSelectedConversation() {
        return { unavailable: true, sourceId: 'audi-live', sessionUserId: '7' };
      },
    },
    roomKey: 'audi-live',
    sessionUserId: '7',
  });
  assert.equal(resolved.status, 'unavailable');
  assert.equal(resolved.conversation.headerUnavailable, true);
  assert.equal(resolved.conversation.title, '');
});

test('direct message selection stays on its own fallback', () => {
  const page = read('js/src/forum/components/MessagesPage.js');
  assert.match(page, /selected\.kind === 'live'/);
  assert.match(page, /resolveLiveHeaderConversation/);
  assert.match(page, /title: selected\.key/);
  assert.doesNotMatch(page, /FlatRate\.wiki Live/);
});

test('live header suppresses pending and unavailable rooms before the public status', () => {
  const header = read('js/src/forum/components/MessagesConversationHeader.js');
  assert.match(header, /headerPending/);
  assert.match(header, /headerUnavailable/);
  assert.match(header, /conversation_unavailable/);
  assert.ok(header.includes("isGeneralLive ? 'FLATRATE.WIKI' : title"));
  assert.match(header, /fas fa-globe MessagesConversationHeader-liveGlobe/);
  assert.doesNotMatch(header, /fas fa-comments/);
  assert.doesNotMatch(header, /🌐/);
});

test('desktop live header uses symmetric 44px tracks without moving direct or mobile chrome', () => {
  const less = read('resources/less/forum.less');
  const desktop = less.slice(0, less.indexOf('@media @phone'));
  assert.match(
    desktop,
    /\.MessagesConversationHeader--live\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px;/
  );
  assert.match(desktop, /\.MessagesConversationHeader--live \.MessagesConversationHeader-back\s*\{[\s\S]*grid-column:\s*1;/);
  assert.match(desktop, /\.MessagesConversationHeader--live \.MessagesConversationHeader-main\s*\{[\s\S]*grid-column:\s*2;/);
  assert.match(desktop, /\.MessagesConversationHeader--live \.MessagesConversationHeader-overflow\s*\{[\s\S]*grid-column:\s*3;/);
  assert.match(desktop, /\.MessagesConversationHeader-title\s*\{[\s\S]*text-overflow:\s*ellipsis;/);
  assert.match(less, /\.MessagesConversationHeader-generalLiveStatus\s*\{[\s\S]*color:\s*#66ff00/);
  assert.match(
    less,
    /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader\s*\{[\s\S]*grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px/
  );
  assert.match(less, /\.MessagesPage\.viewing-conversation \.MessagesConversationHeader-back\s*\{[\s\S]*width:\s*44px/);
  const phone = less.slice(less.indexOf('@media @phone'));
  assert.match(phone, /\.MessagesConversationHeader-avatar,[\s\S]*display:\s*none/);
});
