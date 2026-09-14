import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import extractText from 'flarum/common/utils/extractText';

export default class MessagesNavButton extends Component {
  view() {
    const label = app.translator.trans('flatrate-messaging-ui.forum.nav.messages');
    const text = extractText(label);
    const unread = app.flatrateMessaging ? app.flatrateMessaging.unreadTotal() : 0;

    return (
      <Link
        className={'FlatRateMessagesNav Button Button--link' + (unread > 0 ? ' new' : '')}
        href={app.route('flatrate-messaging.index')}
        aria-label={text}
        title={text}
      >
        <i className="icon fas fa-paper-plane Button-icon" aria-hidden="true" />
        <span className="Button-label">{label}</span>
        {unread > 0 ? <span className="FlatRateMessagesNav-unread">{unread}</span> : null}
      </Link>
    );
  }
}
