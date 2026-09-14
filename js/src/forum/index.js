import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import UserControls from 'flarum/forum/utils/UserControls';
import PostControls from 'flarum/forum/utils/PostControls';
import Button from 'flarum/common/components/Button';
import MessagesPage from './components/MessagesPage.js';
import MessagesNavButton from './components/MessagesNavButton.js';
import MessagingState from './state/MessagingState.js';
import createMessagingService from './createMessagingService.js';
import canOfferMessageAction from './utils/canOfferMessageAction.js';

app.initializers.add('flatrate-messaging-ui', () => {
  app.routes['flatrate-messaging.index'] = { path: '/messages', component: MessagesPage };
  app.routes['flatrate-messaging.live'] = { path: '/messages/live/:roomKey', component: MessagesPage };
  app.routes['flatrate-messaging.direct'] = { path: '/messages/direct/:conversationId', component: MessagesPage };

  app.flatrateMessagingState = new MessagingState({
    sources: () => (app.flatrateMessaging ? app.flatrateMessaging.sources() : { live: null, direct: null }),
  });

  app.flatrateMessaging = createMessagingService({
    app,
    state: app.flatrateMessagingState,
  });

  extend(HeaderSecondary.prototype, 'items', function (items) {
    if (!app.session.user) {
      return;
    }
    items.add('FlatRateMessages', <MessagesNavButton />, 5);
  });

  extend(UserControls, 'userControls', function (items, user) {
    if (
      !canOfferMessageAction({
        actor: app.session.user,
        targetUser: user,
        canMessage: !!app.forum.attribute('canMessage'),
      })
    ) {
      return;
    }

    items.add(
      'flatrateMessage',
      <Button icon="fas fa-paper-plane" onclick={() => app.flatrateMessaging.openDirectToUser(user)}>
        {app.translator.trans('flatrate-messaging-ui.forum.profile.message')}
      </Button>,
      90
    );
  });

  extend(PostControls, 'userControls', function (items, post) {
    const target = post && typeof post.user === 'function' ? post.user() : null;
    if (
      !canOfferMessageAction({
        actor: app.session.user,
        targetUser: target,
        canMessage: !!app.forum.attribute('canMessage'),
      })
    ) {
      return;
    }

    items.add(
      'flatrateMessage',
      <Button icon="fas fa-paper-plane" onclick={() => app.flatrateMessaging.openDirectToUser(target)}>
        {app.translator.trans('flatrate-messaging-ui.forum.actions.message')}
      </Button>
    );
  });
});
