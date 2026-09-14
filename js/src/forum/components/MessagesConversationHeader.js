import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import { readDisplayText } from '../utils/normalizeConversation.js';

/**
 * Shell-owned conversation chrome header (mobile back + title).
 */
export default class MessagesConversationHeader extends Component {
  view() {
    const { kind, conversation, onBack } = this.attrs;
    const title = resolveHeaderTitle(kind, conversation);

    return (
      <header className={'MessagesConversationHeader' + (kind ? ` MessagesConversationHeader--${kind}` : '')}>
        <Button
          className="Button Button--icon MessagesConversationHeader-back"
          icon="fas fa-arrow-left"
          aria-label={app.translator.trans('flatrate-messaging-ui.forum.page.back')}
          onclick={() => {
            if (typeof onBack === 'function') onBack();
          }}
        />
        <div className="MessagesConversationHeader-main">
          {conversation?.avatarUrl ? (
            <img className="MessagesConversationHeader-avatar" src={conversation.avatarUrl} alt="" />
          ) : conversation?.icon ? (
            <span className="MessagesConversationHeader-icon">
              <i className={conversation.icon} />
            </span>
          ) : null}
          <h2 className="MessagesConversationHeader-title">{title}</h2>
        </div>
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
