import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import { readDisplayText } from '../utils/normalizeConversation.js';

/**
 * Shell-owned conversation chrome. Direct and Live conversations share the
 * same back / title / overflow layout; providers own only the body surface.
 */
export default class MessagesConversationHeader extends Component {
  view() {
    const { kind, conversation, onBack } = this.attrs;
    const title = resolveHeaderTitle(kind, conversation);
    const sources = app.flatrateMessaging ? app.flatrateMessaging.sources() : { direct: null };
    const canCompose = !!sources.direct;

    return (
      <header className={'MessagesConversationHeader' + (kind ? ` MessagesConversationHeader--${kind}` : '')}>
        <Button
          className="Button Button--icon Button--flat MessagesConversationHeader-back"
          icon="fas fa-arrow-left"
          aria-label={app.translator.trans('flatrate-messaging-ui.forum.page.back')}
          onclick={() => {
            if (typeof onBack === 'function') onBack();
          }}
        />
        <div className="MessagesConversationHeader-main">
          {conversation?.avatarUrl ? (
            <img className="MessagesConversationHeader-avatar" src={conversation.avatarUrl} alt="" />
          ) : (
            <span className="MessagesConversationHeader-icon" aria-hidden="true">
              <i className={conversation?.icon || (kind === 'live' ? 'fas fa-comments' : 'fas fa-user')} />
            </span>
          )}
          <h2 className="MessagesConversationHeader-title">{title}</h2>
        </div>
        <Dropdown
          className="MessagesConversationHeader-menu"
          buttonClassName="Button Button--icon Button--flat MessagesConversationHeader-menuButton"
          menuClassName="Dropdown-menu--right"
          icon="fas fa-ellipsis-v"
          caretIcon=""
          label={app.translator.trans('flatrate-messaging-ui.forum.page.conversation_options')}
          accessibleToggleLabel={app.translator.trans('flatrate-messaging-ui.forum.page.conversation_options')}
        >
          {canCompose ? (
            <Button
              icon="fas fa-pen"
              onclick={() => {
                if (app.flatrateMessaging && typeof app.flatrateMessaging.composeDirect === 'function') {
                  app.flatrateMessaging.composeDirect();
                }
              }}
            >
              {app.translator.trans('flatrate-messaging-ui.forum.page.compose')}
            </Button>
          ) : null}
          <Button
            icon="fas fa-inbox"
            onclick={() => {
              if (typeof onBack === 'function') onBack();
            }}
          >
            {app.translator.trans('flatrate-messaging-ui.forum.page.back_to_messages')}
          </Button>
        </Dropdown>
      </header>
    );
  }
}

function resolveHeaderTitle(kind, conversation) {
  if (!conversation) {
    return kind === 'live' ? 'Live' : 'Conversation';
  }
  const title = readDisplayText(conversation.title);
  if (title) {
    return stripChatWithPrefix(title);
  }
  if (kind === 'live' && conversation.sourceId === 'community-general-live') {
    return 'FlatRate.wiki Live';
  }
  return readDisplayText(conversation.sourceId) || 'Conversation';
}

function stripChatWithPrefix(title) {
  const match = String(title).match(/^Chat with\s+(.+)$/i);
  return match ? match[1].trim() : title;
}
