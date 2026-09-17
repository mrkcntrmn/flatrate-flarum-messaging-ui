import Component from 'flarum/common/Component';
import avatar from 'flarum/common/helpers/avatar';
import humanTime from 'flarum/common/helpers/humanTime';

/**
 * Discovery results under Messages search (conversations + people).
 * Never renders message bodies/previews.
 */
export default class MessagesDiscoveryResults extends Component {
  view() {
    const {
      conversations = [],
      people = [],
      peopleHeading = 'People',
      conversationsHeading = 'Conversations',
      emptyLabel = 'No conversations or people found',
      loadingPeople = false,
      activeIndex = -1,
      onActivateConversation = null,
      onActivatePerson = null,
      showEmpty = false,
    } = this.attrs;

    const items = [];
    let index = 0;

    if (conversations.length > 0) {
      items.push(
        <div className="MessagesDiscovery-section" key="conversations-heading">
          <h2 className="MessagesDiscovery-heading" id="messages-discovery-conversations">
            {conversationsHeading}
          </h2>
          <ul className="MessagesDiscovery-list" role="listbox" aria-labelledby="messages-discovery-conversations">
            {conversations.map((conversation) => {
              const optionIndex = index++;
              const active = optionIndex === activeIndex;
              const live = conversation.kind === 'live';
              const count = Number(conversation.liveUserCount);
              const hasLiveCount = live && conversation.liveUserCount != null && Number.isFinite(count) && count >= 0;
              const liveText = hasLiveCount ? `${Math.floor(count)} LIVE` : 'LIVE';
              const activity = conversation.activityAt ? humanTime(new Date(conversation.activityAt)) : null;
              return (
                <li
                  key={conversation.id}
                  className={'MessagesDiscovery-option' + (active ? ' is-active' : '')}
                  role="option"
                  aria-selected={active ? 'true' : 'false'}
                  id={`messages-discovery-option-${optionIndex}`}
                  data-discovery-index={optionIndex}
                >
                  <button
                    type="button"
                    className="MessagesDiscovery-optionButton"
                    onmousedown={(e) => e.preventDefault()}
                    onclick={() => {
                      if (typeof onActivateConversation === 'function') {
                        onActivateConversation(conversation);
                      }
                    }}
                  >
                    <span className="MessagesDiscovery-optionAvatar" aria-hidden="true">
                      {conversation.avatarUrl ? (
                        <img className="Avatar" src={conversation.avatarUrl} alt="" />
                      ) : (
                        <span className="ConversationRow-icon" aria-hidden="true">
                          <i className={live ? 'fas fa-comments' : 'fas fa-user'} />
                        </span>
                      )}
                    </span>
                    <span className="MessagesDiscovery-optionText">
                      <span className="MessagesDiscovery-optionTitle">{conversation.title}</span>
                      <span className="MessagesDiscovery-optionMeta">
                        {live ? (
                          <span style={{ color: 'var(--messages-live-accent)' }}>
                            PUBLIC · <i className="fas fa-globe" aria-hidden="true" /> {liveText}
                          </span>
                        ) : (
                          <span>
                            PRIVATE · <i className="fas fa-lock" aria-hidden="true" />{activity ? ` ${activity}` : ''}
                          </span>
                        )}
                      </span>
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <span className="MessagesDiscovery-unread">{conversation.unreadCount}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    if (people.length > 0 || loadingPeople) {
      items.push(
        <div className="MessagesDiscovery-section" key="people-heading">
          <h2 className="MessagesDiscovery-heading" id="messages-discovery-people">
            {peopleHeading}
          </h2>
          {loadingPeople ? (
            <div className="MessagesDiscovery-status" aria-live="polite">
              Loading people…
            </div>
          ) : (
            <ul className="MessagesDiscovery-people" role="listbox" aria-labelledby="messages-discovery-people">
              {people.map((person) => {
                const optionIndex = index++;
                const active = optionIndex === activeIndex;
                return (
                  <li
                    key={person.id}
                    className={'MessagesDiscovery-person' + (active ? ' is-active' : '')}
                    role="option"
                    aria-selected={active ? 'true' : 'false'}
                    id={`messages-discovery-option-${optionIndex}`}
                    data-discovery-index={optionIndex}
                  >
                    <button
                      type="button"
                      className="MessagesDiscovery-optionButton"
                      onmousedown={(e) => e.preventDefault()}
                      onclick={() => {
                        if (typeof onActivatePerson === 'function') {
                          onActivatePerson(person);
                        }
                      }}
                    >
                      <span className="MessagesDiscovery-personAvatar" aria-hidden="true">
                        {person.user ? avatar(person.user, { alt: '' }) : <span className="Avatar">?</span>}
                      </span>
                      <span className="MessagesDiscovery-personText">
                        <span className="MessagesDiscovery-personName">{person.displayName}</span>
                        {person.hint ? <span className="MessagesDiscovery-personHint">{person.hint}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }

    if (showEmpty && conversations.length === 0 && people.length === 0 && !loadingPeople) {
      items.push(
        <div className="MessagesDiscovery-empty" key="empty" role="status">
          {emptyLabel}
        </div>
      );
    }

    return <div className="MessagesDiscovery">{items}</div>;
  }
}
