import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import humanTime from 'flarum/common/helpers/humanTime';
import { conversationPath } from '../utils/messagingRoutes.js';

/**
 * Directory row contract: title, type, privacy, activity, unread, avatar/icon.
 * Body / preview fields are ignored even if a provider attaches them.
 */
export default class ConversationRow extends Component {
  view() {
    const conversation = this.attrs.conversation || {};
    const { title, kind, privacy, privacyLabel, activityAt, unreadCount, avatarUrl, icon, sourceId } = conversation;
    const active = !!this.attrs.active;
    const href = conversationPath(kind, sourceId);
    const kindLabel =
      kind === 'direct'
        ? app.translator.trans('flatrate-messaging-ui.forum.row.direct')
        : app.translator.trans('flatrate-messaging-ui.forum.row.live');
    const privacyText =
      privacyLabel ||
      (privacy === 'private'
        ? app.translator.trans('flatrate-messaging-ui.forum.row.private')
        : app.translator.trans('flatrate-messaging-ui.forum.row.public_room'));
    const privacyIcon = privacy === 'private' ? 'fas fa-lock' : 'fas fa-globe';
    const activity = activityAt ? humanTime(new Date(activityAt)) : null;

    const unread = Number(unreadCount) > 0;

    return (
      <Link
        className={'ConversationRow' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '')}
        href={href}
        title={title}
        aria-current={active ? 'page' : undefined}
      >
        {avatarUrl ? (
          <img className="ConversationRow-avatar" src={avatarUrl} alt="" />
        ) : (
          <span className="ConversationRow-icon" aria-hidden="true">
            <i className={icon || (kind === 'live' ? 'fas fa-comments' : 'fas fa-user')} />
          </span>
        )}
        <span className="ConversationRow-body">
          <span className="ConversationRow-title">{title}</span>
          <span className="ConversationRow-meta">
            <span className="ConversationRow-kind">{kindLabel}</span>
            <span aria-hidden="true"> · </span>
            <span className="ConversationRow-privacy" aria-label={privacyText}>
              <i className={privacyIcon} aria-hidden="true" />
              <span className="ConversationRow-privacy-text">{privacyText}</span>
            </span>
            {activity ? <span className="ConversationRow-activity">{activity}</span> : null}
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
    );
  }
}
