import NotificationInboxState from './NotificationInboxState.js';
import { forumInputFromResource } from './forumInputFromResource.js';
import { resolveForumNotificationTarget } from './forumNotificationTarget.js';
import { NOTIFICATIONS_AVAILABLE_ATTRIBUTE, notificationsAvailable } from './notificationsAvailability.js';
import { unifiedUnread } from './unifiedUnread.js';

export function syncNotificationAccess(app, state) {
  const user = app.session?.user || null;
  const id = user && typeof user.id === 'function' ? user.id() : null;
  state.setActor(id);
  state.setSignedIn(!!user);
  // The forum attribute is the decision at document generation. Later gate
  // changes arrive through the unread-count probe, which must not be overwritten
  // by this stale boolean on every badge redraw.
  const rawAvailable = app.forum && typeof app.forum.attribute === 'function'
    ? app.forum.attribute(NOTIFICATIONS_AVAILABLE_ATTRIBUTE)
    : undefined;
  if (!state.payloadSeeded && user && (rawAvailable === true || rawAvailable === false)) {
    state.payloadSeeded = true;
    state.revalidationActive = rawAvailable === true;
    state.setAvailable(rawAvailable === true);
  }
}

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
    channel.bind('notification', () => {
      if (!notificationsAvailable(app) || inbox.state.available !== true) {
        return;
      }
      inbox.state.refreshForumCount();
    });
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
      syncNotificationAccess(app, state);
      if (!app.session?.user || state.available !== true) {
        return Promise.resolve(state.emptyState());
      }
      return state.refresh();
    },
    badge() {
      syncNotificationAccess(app, state);
      if (!app.session?.user || state.available !== true) {
        return { status: 'known', count: null, signedOut: !app.session?.user };
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
  const models = app.store && typeof app.store.pushPayload === 'function'
    ? app.store.pushPayload(payload)
    : [];
  const byId = new Map();
  for (const model of Array.isArray(models) ? models : []) {
    const id = model && typeof model.id === 'function' ? model.id() : model?.id;
    if (id != null) byId.set(String(id), model);
  }
  return (payload?.data || []).map((resource) => {
    const model = byId.get(String(resource?.id));
    return forumInputFromResource(resource, included, resolveForumNotificationTarget(app, model));
  });
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
