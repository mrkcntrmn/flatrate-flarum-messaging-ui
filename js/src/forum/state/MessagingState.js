import normalizeConversation from '../utils/normalizeConversation.js';
import sortConversations from '../utils/sortConversations.js';
import filterConversations, { parseFilter } from '../utils/filterConversations.js';
import searchConversations from '../utils/searchConversations.js';
import combinedUnread from '../utils/combinedUnread.js';
import discoverSources, { productMode } from '../utils/discoverSources.js';

/**
 * Client-side Messages directory state. Providers remain the unread/conversation source of truth.
 */
export default class MessagingState {
  constructor({ sources } = {}) {
    this._sources = sources || (() => ({ live: null, direct: null }));
    this.conversations = [];
    this.errors = { live: null, direct: null };
    this.loading = false;
    this.filter = 'all';
    this.query = '';
    this.initialDrafts = {};
  }

  sources() {
    const value = typeof this._sources === 'function' ? this._sources() : this._sources;
    return {
      live: value?.live || null,
      direct: value?.direct || null,
    };
  }

  productMode() {
    return productMode(this.sources());
  }

  unreadTotal() {
    const { live, direct } = this.sources();
    return combinedUnread(live, direct);
  }

  setFilter(filter) {
    this.filter = parseFilter(filter);
    return this.filter;
  }

  setQuery(query) {
    this.query = String(query || '');
    return this.query;
  }

  visibleConversations() {
    return searchConversations(filterConversations(this.conversations, this.filter), this.query);
  }

  stashInitialDraft(id, draft) {
    if (id == null) return;
    this.initialDrafts[String(id)] = draft;
  }

  takeInitialDraft(id) {
    const key = String(id);
    const draft = this.initialDrafts[key];
    delete this.initialDrafts[key];
    return draft;
  }

  findBySelection(kind, key) {
    const sourceId = String(key);
    return this.conversations.find((row) => row.kind === kind && row.sourceId === sourceId) || null;
  }

  async refresh() {
    const { live, direct } = this.sources();
    this.loading = true;
    this.errors = { live: null, direct: null };

    const [liveRows, directRows] = await Promise.all([this._loadKind('live', live), this._loadKind('direct', direct)]);

    this.conversations = sortConversations([...liveRows, ...directRows]);
    this.loading = false;
    return this.conversations;
  }

  async _loadKind(kind, provider) {
    if (!provider || typeof provider.listConversations !== 'function') {
      return [];
    }

    try {
      const list = await provider.listConversations();
      if (!Array.isArray(list)) {
        return [];
      }
      return list.map((row) => normalizeConversation(row, kind)).filter(Boolean);
    } catch (error) {
      this.errors[kind] = error && error.message ? error.message : String(error || 'error');
      return [];
    }
  }
}

export function sourcesFromRegistry(registry) {
  return discoverSources(registry);
}
