import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Dropdown from 'flarum/common/components/Dropdown';
import extractText from 'flarum/common/utils/extractText';
import humanTime from 'flarum/common/helpers/humanTime';
import { conversationPath } from '../utils/messagingRoutes.js';
import discoverSources from '../utils/discoverSources.js';
import buildShellDirectoryOverflowItems, {
  mergeDirectoryOverflowItems,
} from '../utils/buildShellDirectoryOverflowItems.js';

/**
 * Directory row contract: title, type/privacy state, activity, unread,
 * avatar/icon, optional Live presence count, and ⋯ menu.
 * Body / preview fields are ignored even if a provider attaches them.
 *
 * Root is NOT a Link — overflow is a sibling of ConversationRow-link so nested
 * interactive controls stay valid.
 */
export default class ConversationRow extends Component {
  view() {
    const conversation = this.attrs.conversation || {};
    const { title, kind, privacy, privacyLabel, activityAt, unreadCount, liveUserCount, avatarUrl, icon, sourceId } = conversation;
    const active = !!this.attrs.active;
    const href = conversationPath(kind, sourceId);
    const live = kind === 'live';
    const kindLabel = app.translator.trans(
      live ? 'flatrate-messaging-ui.forum.row.live' : 'flatrate-messaging-ui.forum.row.direct'
    );
    const privacyText =
      privacyLabel ||
      (privacy === 'private'
        ? app.translator.trans('flatrate-messaging-ui.forum.row.private')
        : app.translator.trans('flatrate-messaging-ui.forum.row.public_room'));
    const privacyIcon = privacy === 'private' ? 'fas fa-lock' : 'fas fa-globe';
    const activity = activityAt ? humanTime(new Date(activityAt)) : null;
    const unread = Number(unreadCount) > 0;
    const count = Number(liveUserCount);
    const hasLiveCount = live && liveUserCount != null && Number.isFinite(count) && count >= 0;
    const livePresenceText = hasLiveCount ? `${Math.floor(count)} LIVE` : 'LIVE';
    const livePresenceAria = hasLiveCount ? `${Math.floor(count)} users live` : 'Live room';
    const menuLabel = extractText(app.translator.trans('flatrate-messaging-ui.forum.page.conversation_options'));
    const overflowItems = this.overflowItems(conversation).toArray().filter(Boolean);

    return (
      <div
        className={
          'ConversationRow' +
          (live ? ' ConversationRow--live' : '') +
          (kind === 'direct' ? ' ConversationRow--direct' : '') +
          (active ? ' is-active' : '') +
          (unread ? ' is-unread' : '')
        }
        role="listitem"
      >
        <Link
          className="ConversationRow-link"
          href={href}
          title={title}
          aria-current={active ? 'page' : undefined}
        >
          {avatarUrl ? (
            <img className="ConversationRow-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="ConversationRow-icon" aria-hidden="true">
              <i className={icon || (live ? 'fas fa-comments' : 'fas fa-user')} />
            </span>
          )}
          <span className="ConversationRow-body">
            <span className="ConversationRow-title">{title}</span>
            <span className="ConversationRow-meta">
              <span className="ConversationRow-kind">{kindLabel}</span>
              <span className="ConversationRow-privacy" aria-label={privacyText} title={privacyText}>
                <i className={privacyIcon} aria-hidden="true" />
              </span>
              {live ? (
                <span
                  className="ConversationRow-livePresence"
                  aria-label={livePresenceAria}
                  style={{ color: 'var(--messages-live-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {livePresenceText}
                </span>
              ) : activity ? (
                <span className="ConversationRow-activity">{activity}</span>
              ) : null}
            </span>
          </span>
          {unreadCount > 0 ? (
            <span
              className="ConversationRow-unread"
              aria-label={app.translator.trans('flatrate-messaging-ui.forum.row.unread', { count: unreadCount })}
            >
              {unreadCount}
            </span>
          ) : null}
        </Link>
        <Dropdown
          className="ConversationRow-overflow"
          buttonClassName="Button Button--icon Button--flat ConversationRow-overflowToggle"
          menuClassName="Dropdown-menu--right"
          icon="fas fa-ellipsis-h"
          caretIcon={null}
          label={menuLabel}
          accessibleToggleLabel={menuLabel}
        >
          {overflowItems}
        </Dropdown>
      </div>
    );
  }

  overflowItems(conversation) {
    const shellItems = buildShellDirectoryOverflowItems({ conversation });
    const sources = discoverSources(app);
    const provider = conversation?.kind === 'live' ? sources.live : conversation?.kind === 'direct' ? sources.direct : null;
    const providerItems =
      provider && typeof provider.directoryOverflowItems === 'function'
        ? provider.directoryOverflowItems({
            conversation,
            key: conversation?.sourceId,
            kind: conversation?.kind,
          })
        : null;
    return mergeDirectoryOverflowItems(shellItems, providerItems);
  }
}
