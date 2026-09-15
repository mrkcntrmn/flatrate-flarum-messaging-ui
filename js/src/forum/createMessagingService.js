import combinedUnread from './utils/combinedUnread.js';
import discoverSources from './utils/discoverSources.js';
import { conversationPath } from './utils/messagingRoutes.js';
import providerConversationKey from './utils/providerConversationKey.js';

/**
 * Build the public app.flatrateMessaging service.
 * Providers are read at call time. Conversation start is delegated to the direct provider.
 *
 * @param {{ app: object, route?: Function, state: import('./state/MessagingState').default }} deps
 */
export default function createMessagingService({ app, route, state }) {
  const navigate = (path, replace = false) => {
    if (typeof route === 'function') {
      route(path, replace);
      return;
    }
    if (typeof m !== 'undefined' && m.route && typeof m.route.set === 'function') {
      m.route.set(path, null, { replace });
    }
  };

  return {
    sources() {
      return discoverSources(app);
    },

    unreadTotal() {
      const { live, direct } = this.sources();
      return combinedUnread(live, direct);
    },

    refresh() {
      return state.refresh();
    },

    openConversation(kind, key) {
      if (kind !== 'live' && kind !== 'direct') {
        return;
      }
      if (key == null || key === '') {
        return;
      }
      navigate(conversationPath(kind, key), false);
    },

    async openDirectToUser(user) {
      const actor = app?.session?.user;
      if (!user || !actor) {
        return;
      }

      const direct = this.sources().direct;
      if (!direct) {
        return;
      }

      let existing = null;
      if (typeof direct.findConversationWithUser === 'function') {
        try {
          existing = await direct.findConversationWithUser(user);
        } catch {
          existing = null;
        }
      }

      if (existing) {
        navigate('/messages/direct/' + providerConversationKey(existing), false);
        return;
      }

      if (typeof direct.startConversationWithUser !== 'function') {
        return;
      }

      direct.startConversationWithUser(user, {
        onConversationResolved(conversation, meta = {}) {
          const id = providerConversationKey(conversation);
          if (meta.draft) {
            state.stashInitialDraft(id, meta.draft);
          }
          navigate('/messages/direct/' + id, false);
        },
      });
    },

    /**
     * Blank Direct compose (recipient picker). Single owner for top-nav + empty-state.
     */
    composeDirect() {
      const direct = this.sources().direct;
      if (!direct || typeof direct.startConversationWithUser !== 'function') {
        return;
      }

      direct.startConversationWithUser(null, {
        onConversationResolved(conversation, meta = {}) {
          const id = providerConversationKey(conversation);
          if (!id) {
            return;
          }
          if (meta.draft) {
            state.stashInitialDraft(id, meta.draft);
          }
          navigate('/messages/direct/' + id, false);
        },
      });
    },
  };
}

