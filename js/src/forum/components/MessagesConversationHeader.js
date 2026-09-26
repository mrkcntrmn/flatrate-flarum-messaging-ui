import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import extractText from 'flarum/common/utils/extractText';
import { readDisplayText } from '../utils/normalizeConversation.js';
import resolveLiveHeaderStatus from '../utils/resolveLiveHeaderStatus.js';
import buildShellHeaderOverflowItems, {
  mergeHeaderOverflowItems,
} from '../utils/buildShellHeaderOverflowItems.js';

/**
 * Shell-owned conversation chrome. Direct and Live share back | title | ⋮.
 * Providers may append overflow items; they do not decide whether ⋮ exists.
 */
export default class MessagesConversationHeader extends Component {
  view() {
    const { kind, conversation, onBack, providerOverflowItems = null } = this.attrs;
    const title = resolveHeaderTitle(kind, conversation);
    const liveStatus = resolveLiveHeaderStatus(kind, conversation);
    const menuLabel = extractText(app.translator.trans('flatrate-messaging-ui.forum.page.conversation_menu'));
    const shellItems = buildShellHeaderOverflowItems({ onBack });
    const items = mergeHeaderOverflowItems(shellItems, providerOverflowItems).toArray().filter(Boolean);

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
          <div className="MessagesConversationHeader-copy">
            <h2 className="MessagesConversationHeader-title">{title}</h2>
            {liveStatus ? (
              <div className="MessagesConversationHeader-liveStatus">
                <span>{liveStatus.privacy}</span>
                <i className="fas fa-globe MessagesConversationHeader-liveGlobe" aria-hidden="true" />
                <span>{liveStatus.live}</span>
              </div>
            ) : null}
          </div>
        </div>
        <Dropdown
          className="MessagesConversationHeader-overflow"
          buttonClassName="Button Button--icon Button--flat MessagesConversationHeader-overflowToggle"
          menuClassName="Dropdown-menu--right"
          icon="fas fa-ellipsis-v"
          caretIcon={null}
          label={menuLabel}
          accessibleToggleLabel={menuLabel}
        >
          {items}
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
    return 'FlatRate.wiki';
  }
  return readDisplayText(conversation.sourceId) || 'Conversation';
}

function stripChatWithPrefix(title) {
  const match = String(title).match(/^Chat with\s+(.+)$/i);
  return match ? match[1].trim() : title;
}
