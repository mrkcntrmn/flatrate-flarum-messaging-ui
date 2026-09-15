import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import { isMessagesIndexRoute } from '../utils/messagingRoutes.js';

/**
 * Top-nav compose entry. Desktop uses HeaderSecondary; phone may pin a visible twin.
 * Conversation routes own their right-side overflow menu instead.
 */
export default class MessagesComposeButton extends Component {
  view() {
    if (!this.shouldShow()) {
      return null;
    }

    const pinned = !!this.attrs.mobilePinned;
    const className =
      'Button Button--link Button--icon MessagesComposeButton' +
      (pinned ? ' MessagesComposeButton--mobilePinned' : '');

    return (
      <Button
        className={className}
        icon="fas fa-pen"
        aria-label={app.translator.trans('flatrate-messaging-ui.forum.page.compose')}
        onclick={() => {
          if (app.flatrateMessaging && typeof app.flatrateMessaging.composeDirect === 'function') {
            app.flatrateMessaging.composeDirect();
          }
        }}
      />
    );
  }

  shouldShow() {
    if (!app.session.user) {
      return false;
    }
    if (!isMessagesIndexRoute()) {
      return false;
    }
    const sources = app.flatrateMessaging ? app.flatrateMessaging.sources() : { direct: null };
    return !!sources.direct;
  }
}
