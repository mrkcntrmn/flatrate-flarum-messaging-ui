import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import { notificationsBackPlan } from '../notifications/notificationRoutes.js';

export default class NotificationInboxHeader {
  view() {
    const back = () => {
      const history = app.history;
      const plan = notificationsBackPlan({
        canGoBack: !!(history && typeof history.canGoBack === 'function' && history.canGoBack()),
      });
      if (plan.type === 'history' && history && typeof history.back === 'function') {
        history.back();
        return;
      }
      if (typeof m !== 'undefined' && m.route) {
        m.route.set(plan.href || '/');
      }
    };

    return (
      <header className="NotificationInboxHeader">
        <Button
          className="Button Button--icon Button--flat App-backControl NotificationInboxHeader-back"
          icon="fas fa-arrow-left"
          aria-label="Back"
          onclick={back}
        />
        <h1 className="NotificationInboxHeader-title App-titleControl App-titleControl--text">Notifications</h1>
        <span className="App-primaryControl NotificationInboxHeader-bell" aria-hidden="true">
          <i className="fas fa-bell" title="Notifications" />
        </span>
      </header>
    );
  }
}
