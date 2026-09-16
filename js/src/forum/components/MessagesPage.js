import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import LogInModal from 'flarum/forum/components/LogInModal';
import ConversationDirectory from './ConversationDirectory';
import MessagingEmptyState from './MessagingEmptyState';
import MessagesConversationHeader from './MessagesConversationHeader.js';
import MessagesComposeButton from './MessagesComposeButton.js';
import discoverSources, { productMode } from '../utils/discoverSources.js';
import directConversationPaneStatus from '../utils/directConversationPaneStatus.js';

/** Additive V2 provider presentation contract (shell → providers). */
export const MESSAGES_PRESENTATION_VERSION = 2;

export default class MessagesPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyClass = 'App--messages';
    // Directory is always the canonical "all" view — no visible filter strip.
    this.filter = 'all';
    this.query = '';
    this.consumedDraftKey = null;

    const state = app.flatrateMessagingState;
    if (state) {
      state.setFilter('all');
      state.setQuery('');
    }

    this.normalizeDirectoryFilterParam();
    this.syncDirectSelection();

    if (app.session.user && app.flatrateMessaging) {
      Promise.resolve(app.flatrateMessaging.refresh()).then(() => {
        this.syncDirectSelection();
        m.redraw();
      });
    }
  }

  onbeforeupdate() {
    this.normalizeDirectoryFilterParam();
    this.syncDirectSelection();
  }

  /**
   * Strip stale ?filter= from /messages so an invisible filter cannot linger.
   */
  normalizeDirectoryFilterParam() {
    if (this.selectedFromRoute()) {
      return;
    }
    if (!m.route.param('filter')) {
      return;
    }
    const params = { ...m.route.param() };
    delete params.filter;
    m.route.set(app.route('flatrate-messaging.index', params), null, { replace: true });
  }

  syncDirectSelection() {
    const state = app.flatrateMessagingState;
    if (!state) {
      return;
    }

    if (!app.session.user) {
      if (state.selection.status !== 'idle') {
        state.clearDirectSelection();
      }
      return;
    }

    const selected = this.selectedFromRoute();
    if (!selected || selected.kind !== 'direct') {
      if (state.selection.kind === 'direct') {
        state.clearDirectSelection();
      }
      return;
    }

    const result = state.ensureDirectSelection(selected.key);
    if (result && typeof result.then === 'function') {
      result.then(() => m.redraw());
    }
  }

  view() {
    const selected = this.selectedFromRoute();
    const viewing = !!selected;
    const guest = !app.session.user;
    const sources = app.flatrateMessaging ? app.flatrateMessaging.sources() : { live: null, direct: null };
    const mode = productMode(sources);
    const state = app.flatrateMessagingState;
    const conversations = guest || mode === 'unavailable' ? [] : state ? state.visibleConversations() : [];

    return (
      <div className={'MessagesPage MessagesShell' + (viewing ? ' viewing-conversation' : '')}>
        <MessagesComposeButton mobilePinned={true} />
        <aside className="MessagesPage-directory MessagesDirectoryPane">
          {this.directoryView({ guest, mode, sources, state, conversations, selected })}
        </aside>
        <section className="MessagesPage-conversation MessagesConversationPane">
          {this.conversationView({ guest, mode, sources, state, selected })}
        </section>
      </div>
    );
  }

  directoryView({ guest, mode, sources, state, conversations, selected }) {
    if (guest) {
      return (
        <div className="MessagesPage-status">
          <h1 className="MessagesPage-title visually-hidden">{app.translator.trans('flatrate-messaging-ui.forum.page.title')}</h1>
          <p>{app.translator.trans('flatrate-messaging-ui.forum.page.sign_in_required')}</p>
          <Button className="Button Button--primary" onclick={() => app.modal.show(LogInModal)}>
            {app.translator.trans('flatrate-messaging-ui.forum.page.sign_in')}
          </Button>
        </div>
      );
    }

    if (mode === 'unavailable') {
      return (
        <div className="MessagesPage-status">
          <h1 className="MessagesPage-title visually-hidden">{app.translator.trans('flatrate-messaging-ui.forum.page.title')}</h1>
          <p>{app.translator.trans('flatrate-messaging-ui.forum.page.unavailable')}</p>
        </div>
      );
    }

    const hasError = !!(state && (state.errors.live || state.errors.direct));
    const oncompose = sources.direct
      ? () => {
          if (app.flatrateMessaging && typeof app.flatrateMessaging.composeDirect === 'function') {
            app.flatrateMessaging.composeDirect();
          }
        }
      : null;

    return (
      <div>
        <h1 className="MessagesPage-title visually-hidden">{app.translator.trans('flatrate-messaging-ui.forum.page.title')}</h1>
        <div className="MessagesPage-search">
          <i className="fas fa-search MessagesPage-searchIcon" aria-hidden="true" />
          <input
            className="FormControl MessagesPage-searchInput"
            type="search"
            placeholder={app.translator.trans('flatrate-messaging-ui.forum.page.search_placeholder')}
            value={this.query}
            oninput={(e) => {
              this.query = e.target.value;
              if (state) state.setQuery(this.query);
            }}
          />
        </div>
        {hasError ? <div className="MessagesPage-error">{app.translator.trans('flatrate-messaging-ui.forum.page.load_error')}</div> : null}
        {state && state.loading ? <LoadingIndicator /> : null}
        {!state?.loading && conversations.length === 0 ? (
          <MessagingEmptyState oncompose={oncompose} />
        ) : (
          <ConversationDirectory conversations={conversations} selected={selected} />
        )}
      </div>
    );
  }

  conversationView({ guest, mode, sources, state, selected }) {
    if (guest || mode === 'unavailable' || !selected) {
      return <div className="MessagesPage-conversationPane">{app.translator.trans('flatrate-messaging-ui.forum.page.select_prompt')}</div>;
    }

    const conversation =
      (state && state.findBySelection(selected.kind, selected.key)) || {
        kind: selected.kind,
        sourceId: selected.key,
        id: `${selected.kind}:${selected.key}`,
        title: selected.kind === 'live' && selected.key === 'community-general-live' ? 'FlatRate.wiki Live' : selected.key,
      };

    if (selected.kind === 'direct') {
      const paneStatus = directConversationPaneStatus(state?.selection, selected.key);
      if (paneStatus === 'loading' || paneStatus === 'idle') {
        return this.conversationChrome(<LoadingIndicator />, { kind: 'direct', conversation });
      }
      if (paneStatus === 'not-found') {
        return this.conversationChrome(
          <div className="MessagesPage-status">{app.translator.trans('flatrate-messaging-ui.forum.page.conversation_unavailable')}</div>,
          { kind: 'direct', conversation }
        );
      }
      if (paneStatus === 'error') {
        return this.conversationChrome(
          <div className="MessagesPage-status">
            <p>{app.translator.trans('flatrate-messaging-ui.forum.page.conversation_error')}</p>
            <Button
              className="Button"
              onclick={() => {
                if (!state) return;
                Promise.resolve(state.resolveDirectSelection(selected.key)).then(() => m.redraw());
              }}
            >
              {app.translator.trans('flatrate-messaging-ui.forum.page.conversation_retry')}
            </Button>
          </div>,
          { kind: 'direct', conversation }
        );
      }
    }

    const provider = selected.kind === 'live' ? sources.live : sources.direct;
    const draftKey = `${selected.kind}:${selected.key}`;
    let initialDraft;
    if (state && this.consumedDraftKey !== draftKey) {
      initialDraft = state.takeInitialDraft(selected.key);
      this.consumedDraftKey = draftKey;
    }

    const context = {
      presentationVersion: MESSAGES_PRESENTATION_VERSION,
      initialDraft,
      conversation,
    };

    let pane = null;
    if (provider && typeof provider.renderConversation === 'function') {
      pane = provider.renderConversation({
        key: selected.key,
        context,
      });
    }

    return this.conversationChrome(pane, { kind: selected.kind, conversation });
  }

  conversationChrome(body, { kind = null, conversation = null } = {}) {
    const paneClass =
      'MessagesPage-conversationPane' + (kind ? ` MessagesPage-conversationPane--${kind}` : '');
    // Registry must be the Flarum app — calling discoverSources without app
    // yields null providers and drops Live overflow contributions.
    const sources = discoverSources(app);
    const provider = kind === 'live' ? sources.live : kind === 'direct' ? sources.direct : null;
    const selected = this.selectedFromRoute();
    const providerOverflowItems =
      provider && typeof provider.headerOverflowItems === 'function'
        ? provider.headerOverflowItems({ key: selected?.key, conversation, kind })
        : null;

    return (
      <div className={paneClass}>
        {kind ? (
          <MessagesConversationHeader
            kind={kind}
            conversation={conversation}
            providerOverflowItems={providerOverflowItems}
            onBack={() => this.backToList()}
          />
        ) : null}
        <div className="MessagesPage-conversationBody">
          <div className="MessagesProviderSurface">{body}</div>
        </div>
      </div>
    );
  }

  selectedFromRoute() {
    const roomKey = m.route.param('roomKey');
    const conversationId = m.route.param('conversationId');
    if (roomKey) {
      return { kind: 'live', key: String(roomKey) };
    }
    if (conversationId) {
      return { kind: 'direct', key: String(conversationId) };
    }
    return null;
  }

  backToList() {
    const params = { ...m.route.param() };
    delete params.roomKey;
    delete params.conversationId;
    // Returning to directory always clears filter so nothing remains silently applied.
    delete params.filter;
    this.filter = 'all';
    if (app.flatrateMessagingState) {
      app.flatrateMessagingState.setFilter('all');
    }
    m.route.set(app.route('flatrate-messaging.index', params));
  }
}
