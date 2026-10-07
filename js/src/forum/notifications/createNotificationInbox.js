import NotificationInboxState from './NotificationInboxState.js';
import { forumInputFromResource } from './forumInputFromResource.js';
import { unifiedUnread } from './unifiedUnread.js';

export function bindExistingRealtime(app, inbox) {
  const pusher = app.pusher;
  if (!pusher || typeof pusher.then !== 'function') {
    return;
  }
  pusher.then((object) => {
    const channel = object?.channels?.user;
    if (!channel || typeof channel.bind !== 'function' || channel.flatrateNotificationsBound) {
      return;
    }
    channel.flatrateNotificationsBound = true;
    channel.bind('notification', () => inbox.state.refreshForumCount());
  });
}

export function createNotificationInbox(app) {
  const state = new NotificationInboxState({
    loadForumCount: () => loadForumCount(app),
    loadForumNotifications: () => loadForumNotifications(app),
    loadDirect: () => loadProvider(app, 'direct'),
    loadLive: () => loadProvider(app, 'live'),
  });

  return {
    state,
    refresh() {
      state.setSignedIn(!!app.session?.user);
      if (!app.session?.user) {
        return Promise.resolve(state.emptyState());
      }
      return state.refresh();
    },
    badge() {
      state.setSignedIn(!!app.session?.user);
      if (!app.session?.user) {
        return { status: 'known', count: null, signedOut: true };
      }
      const direct = providerUnread(app, 'direct');
      const live = providerUnread(app, 'live');
      const forum = state.forum.status === 'known'
        ? { discovered: true, value: state.forum.count, error: null }
        : { discovered: true, value: null, error: state.forum.status === 'unknown' ? new Error('unavailable') : null };
      return unifiedUnread({
        forum,
        direct,
        live,
      });
    },
  };
}

async function loadForumCount(app) {
  const payload = await app.request({
    method: 'GET',
    url: `${app.forum.attribute('apiUrl')}/flatrate-messaging/forum-notification-unread`,
  });
  const count = payload?.data?.attributes?.nonMessageFlarumUnread;
  if (!Number.isFinite(Number(count)) || Number(count) < 0 || payload?.data?.attributes?.message) {
    throw new Error('forum notification count unavailable');
  }
  return Math.floor(Number(count));
}

async function loadForumNotifications(app) {
  const payload = await app.request({
    method: 'GET',
    url: `${app.forum.attribute('apiUrl')}/notifications`,
  });
  const included = Array.isArray(payload?.included) ? payload.included.filter((item) => item.type === 'users') : [];
  return (payload?.data || []).map((resource) => forumInputFromResource(resource, included));
}

async function loadProvider(app, kind) {
  const provider = app.flatRateMessagingSources?.[kind];
  if (!provider) {
    return { rows: [], unreadTotal: 0 };
  }
  const rows = typeof provider.listConversations === 'function' ? await provider.listConversations() : [];
  const unreadTotal = typeof provider.getUnreadTotal === 'function' ? provider.getUnreadTotal() : 0;
  const authorizedRoomKeys = kind === 'live' && Array.isArray(rows)
    ? new Set(rows.map((row) => String(row.roomKey || row.key || row.sourceId || '')).filter(Boolean))
    : null;
  return { rows, unreadTotal, authorizedRoomKeys };
}

function providerUnread(app, kind) {
  const provider = app.flatRateMessagingSources?.[kind];
  if (!provider || typeof provider.getUnreadTotal !== 'function') {
    return { discovered: false, value: 0, error: null };
  }
  try {
    return { discovered: true, value: provider.getUnreadTotal(), error: null };
  } catch (error) {
    return { discovered: true, value: null, error };
  }
}
