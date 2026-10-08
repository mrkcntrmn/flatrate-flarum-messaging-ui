import { filterNotificationRows, parseNotificationFilter, sortNotificationRows } from './notificationFilters.js';
import { normalizeForumNotification } from './normalizeForumNotification.js';
import { normalizeMessageConversations } from './normalizeMessageConversation.js';
import { unifiedUnread } from './unifiedUnread.js';

/**
 * Presentation state only. Forum read state stays in Flarum. Direct and Live
 * unread stay on their providers. This object does not persist message text.
 *
 * Loader contracts:
 * - loadForumCount(): number
 * - loadForumNotifications(): presentation-safe forum inputs
 * - loadDirect(): { rows, unreadTotal }
 * - loadLive(): { rows, unreadTotal, authorizedRoomKeys? }
 */
export default class NotificationInboxState {
  constructor(loaders = {}) {
    this.loaders = loaders;
    this.filter = 'all';
    this.signedIn = false;
    this.available = false;
    this.actorId = null;
    this.forum = blankForum();
    this.direct = blankMessages();
    this.live = blankMessages();
    this._generation = 0;
  }

  setFilter(filter) {
    this.filter = parseNotificationFilter(filter);
    return this.filter;
  }

  setSignedIn(signedIn) {
    const next = !!signedIn;
    if (next !== this.signedIn) {
      this._generation += 1;
    }
    this.signedIn = next;
    if (!this.signedIn) {
      this.clearPresentation();
    }
    return this.signedIn;
  }

  setActor(actorId) {
    const next = actorId == null || actorId === '' ? null : String(actorId);
    if (next !== this.actorId) {
      this._generation += 1;
      this.clearPresentation();
    }
    this.actorId = next;
    return this.actorId;
  }

  setAvailable(available) {
    const next = available === true;
    if (next !== this.available) {
      this._generation += 1;
      if (!next) {
        this.clearPresentation();
      }
    }
    this.available = next;
    return this.available;
  }

  unread() {
    if (!this.signedIn) {
      return { status: 'known', count: null, signedOut: true, parts: null };
    }
    return unifiedUnread({
      forum: partFrom(this.forum.status, this.forum.count),
      direct: partFrom(this.direct.status, this.direct.unreadTotal),
      live: partFrom(this.live.status, this.live.unreadTotal),
    });
  }

  rows() {
    if (!this.signedIn) {
      return [];
    }
    const forum = this.forum.rowsStatus === 'known' ? this.forum.rows : [];
    const direct = this.direct.status === 'known' ? this.direct.rows : [];
    const live = this.live.status === 'known' ? this.live.rows : [];
    return sortNotificationRows(filterNotificationRows([...forum, ...direct, ...live], this.filter));
  }

  emptyState() {
    if (!this.signedIn) {
      return 'signed-out';
    }
    const waiting = [this.forum.status, this.forum.rowsStatus, this.direct.status, this.live.status];
    if (waiting.some((status) => status === 'idle' || status === 'loading')) {
      return 'loading';
    }
    const unresolved = waiting.some((status) => status !== 'known');
    if (unresolved) {
      return this.rows().length ? 'partial' : 'unavailable';
    }
    return this.rows().length ? 'rows' : 'caught-up';
  }

  async refresh() {
    if (this._refreshInFlight) {
      return this._refreshInFlight;
    }
    this._refreshInFlight = this.runRefresh().finally(() => {
      this._refreshInFlight = null;
    });
    return this._refreshInFlight;
  }

  async runRefresh() {
    if (!this.signedIn || this.available !== true) {
      return this.emptyState();
    }
    const generation = ++this._generation;
    const actorId = this.actorId;
    this.forum = { ...this.forum, status: 'loading', rowsStatus: 'loading' };
    this.direct = { ...this.direct, status: 'loading' };
    this.live = { ...this.live, status: 'loading' };

    const [forumCount, forumRows, direct, live] = await Promise.all([
      capture(() => this.loaders.loadForumCount?.()),
      capture(() => this.loaders.loadForumNotifications?.()),
      capture(() => this.loaders.loadDirect?.()),
      capture(() => this.loaders.loadLive?.()),
    ]);

    if (!this.sameView(generation, actorId)) {
      return this.emptyState();
    }

    const directIds = direct.error ? new Set() : conversationIds(direct.value?.rows);
    this.direct = messagePart(direct, {});
    this.live = messagePart(live, {
      authorizedRoomKeys: live.value?.authorizedRoomKeys || null,
    });
    this.forum = {
      status: numberStatus(forumCount),
      rowsStatus: forumRows.error ? 'unknown' : 'known',
      error: forumCount.error || forumRows.error,
      count: numberStatus(forumCount) === 'known' ? Math.floor(Number(forumCount.value)) : null,
      rows: forumRows.error
        ? []
        : (Array.isArray(forumRows.value) ? forumRows.value : [])
            .map((row) => normalizeForumNotification(row, directIds))
            .filter(Boolean),
    };
    return this.emptyState();
  }

  async refreshForumCount() {
    if (!this.signedIn || this.available !== true) return;
    const generation = this._generation;
    const actorId = this.actorId;
    const forumCount = await capture(() => this.loaders.loadForumCount?.());
    if (!this.sameView(generation, actorId)) return;
    this.forum = {
      ...this.forum,
      status: numberStatus(forumCount),
      count: numberStatus(forumCount) === 'known' ? Math.floor(Number(forumCount.value)) : null,
      error: forumCount.error || this.forum.error,
    };
  }
}

function sameView(state, generation, actorId) {
  return state._generation === generation
    && state.actorId === actorId
    && state.signedIn
    && state.available === true;
}

NotificationInboxState.prototype.sameView = function sameViewBound(generation, actorId) {
  return sameView(this, generation, actorId);
};

NotificationInboxState.prototype.clearPresentation = function clearPresentation() {
  this.forum = { ...blankForum(), status: 'known', rowsStatus: 'known' };
  this.direct = { ...blankMessages(), status: 'known' };
  this.live = { ...blankMessages(), status: 'known' };
};

function blankForum() {
  return { status: 'idle', rowsStatus: 'idle', count: null, rows: [], error: null };
}

function blankMessages() {
  return { status: 'idle', unreadTotal: null, rows: [], error: null };
}

function partFrom(status, value) {
  if (status !== 'known') {
    return { discovered: true, value: null, error: status === 'unknown' ? new Error('unavailable') : null };
  }
  return { discovered: true, value, error: null };
}

function numberStatus(result) {
  if (result.error || result.value == null || !Number.isFinite(Number(result.value)) || Number(result.value) < 0) {
    return 'unknown';
  }
  return 'known';
}

function messagePart(result, options) {
  if (result.error || !result.value || typeof result.value !== 'object') {
    return { status: 'unknown', unreadTotal: null, rows: [], error: result.error || new Error('unavailable') };
  }
  const unreadTotal = Number(result.value.unreadTotal);
  if (!Number.isFinite(unreadTotal) || unreadTotal < 0) {
    return { status: 'unknown', unreadTotal: null, rows: [], error: new Error('unread unavailable') };
  }
  return {
    status: 'known',
    unreadTotal: Math.floor(unreadTotal),
    rows: normalizeMessageConversations(result.value.rows || [], options),
    error: null,
  };
}

function conversationIds(rows) {
  const ids = new Set();
  for (const row of rows || []) {
    const id = row?.conversationId ?? row?.sourceId ?? row?.id ?? row?.key;
    if (id != null && id !== '') {
      ids.add(String(id).replace(/^direct:/, ''));
    }
  }
  return ids;
}

async function capture(run) {
  try {
    const value = await run();
    return { value: value === undefined ? null : value, error: null };
  } catch (error) {
    return { value: null, error };
  }
}
