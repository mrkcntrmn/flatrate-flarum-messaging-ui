import Component from 'flarum/common/Component';
import ConversationRow from './ConversationRow';

export default class ConversationDirectory extends Component {
  view() {
    const conversations = this.attrs.conversations || [];
    const selected = this.attrs.selected;

    return (
      <div className="ConversationDirectory" role="list">
        {conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            active={!!(selected && selected.kind === conversation.kind && selected.key === conversation.sourceId)}
          />
        ))}
      </div>
    );
  }
}
