import normalizeConversation from '../utils/normalizeConversation.js';
import sortConversations from '../utils/sortConversations.js';
import filterConversations, { parseFilter } from '../utils/filterConversations.js';
import searchConversations from '../utils/searchConversations.js';
import combinedUnread from '../utils/combinedUnread.js';
import discoverSources, { productMode } from '../utils/discoverSources.js';

function emptySelection() {
  return { status: 'idle', kind: null, key: null, error: null };
}

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
    this.selection = emptySelection();
    this._selectionGeneration = 0;
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

  clearDirectSelection() {
    this._selectionGeneration += 1;
    this.selection = emptySelection();
    return this.selection;
  }

  /**
   * Hydrate the canonical Direct route. Store hits skip a loading flash.
   * In-flight and ready selections for the same key are reused.
   */
  ensureDirectSelection(key) {
    const id = String(key ?? '');
    if (!id) {
      this.clearDirectSelection();
      return null;
    }

    if (this.selection.kind === 'direct' && this.selection.key === id) {
      if (
        this.selection.status === 'loading' ||
        this.selection.status === 'ready' ||
        this.selection.status === 'not-found' ||
        this.selection.status === 'error'
      ) {
        return null;
      }
    }

    const direct = this.sources().direct;
    if (direct && typeof direct.getLoadedConversation === 'function' && direct.getLoadedConversation(id)) {
      this._selectionGeneration += 1;
      this.selection = { status: 'ready', kind: 'direct', key: id, error: null };
      return null;
    }

    return this.resolveDirectSelection(id);
  }

  async resolveDirectSelection(key) {
    const id = String(key ?? '');
    const generation = ++this._selectionGeneration;
    this.selection = { status: 'loading', kind: 'direct', key: id, error: null };

    const direct = this.sources().direct;
    if (!direct || typeof direct.resolveConversation !== 'function') {
      if (generation !== this._selectionGeneration) {
        return this.selection;
      }
      this.selection = { status: 'not-found', kind: 'direct', key: id, error: null };
      return this.selection;
    }

    try {
      const conversation = await direct.resolveConversation(id);
      if (generation !== this._selectionGeneration) {
        return this.selection;
      }
      if (!conversation) {
        this.selection = { status: 'not-found', kind: 'direct', key: id, error: null };
        return this.selection;
      }
      this.selection = { status: 'ready', kind: 'direct', key: id, error: null };
      return this.selection;
    } catch (error) {
      if (generation !== this._selectionGeneration) {
        return this.selection;
      }
      this.selection = {
        status: 'error',
        kind: 'direct',
        key: id,
        error: error && error.message ? error.message : String(error || 'error'),
      };
      return this.selection;
    }
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
