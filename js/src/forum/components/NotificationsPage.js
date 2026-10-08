import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import LogInModal from 'flarum/forum/components/LogInModal';
import NotificationInboxHeader from './NotificationInboxHeader.js';
import NotificationInboxTabs from './NotificationInboxTabs.js';
import NotificationInboxList from './NotificationInboxList.js';
import NotificationInboxEmpty from './NotificationInboxEmpty.js';
import { applyMessageEligibility } from '../notifications/rowActions.js';
import { syncNotificationAccess } from '../notifications/createNotificationInbox.js';
import { notificationsAvailable } from '../notifications/notificationsAvailability.js';
import { rememberScroll, restoreScroll } from '../notifications/notificationRoutes.js';

export default class NotificationsPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyClass = 'App--notifications';
    const state = app.flatrateNotificationState;
    if (!state) return;
    if (app.history && typeof app.history.push === 'function') {
      app.history.push('notifications', 'Notifications');
    }
    syncNotificationAccess(app, state);
    state.setSignedIn(!!app.session.user);
    this._refresh = null;
    if (app.session.user && notificationsAvailable(app)) {
      this._refresh = state.refresh();
      this._refresh.then(() => m.redraw());
    }
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    // A hard load can resolve the inbox before this page is mounted. Attaching
    // again after mount redraws the settled empty or row state.
    if (this._refresh && typeof this._refresh.then === 'function') {
      this._refresh.then(() => m.redraw());
    }
    const state = app.flatrateNotificationState;
    const scroller = this.element && this.element.querySelector('.NotificationInboxList');
    if (scroller && state) {
      scroller.scrollTop = restoreScroll(window.sessionStorage, state.filter);
    }
  }

  onremove() {
    const state = app.flatrateNotificationState;
    const scroller = this.element && this.element.querySelector('.NotificationInboxList');
    if (scroller && state) {
      rememberScroll(window.sessionStorage, state.filter, scroller.scrollTop);
    }
  }

  view() {
    const state = app.flatrateNotificationState;
    const guest = !app.session.user || !state || !state.signedIn;
    if (guest) {
      return (
        <div className="NotificationsPage">
          <NotificationInboxHeader />
          <NotificationInboxEmpty mode="signed-out" />
          <Button className="Button Button--primary" onclick={() => app.modal.show(LogInModal)}>
            Log In
          </Button>
        </div>
      );
    }

    if (!notificationsAvailable(app)) {
      return (
        <div className="NotificationsPage">
          <Button className="Button" onclick={() => m.route.set('/')}>
            MAIN
          </Button>
        </div>
      );
    }

    const canMessage = !!(app.forum && app.forum.attribute && app.forum.attribute('canMessage'));
    const rows = state.rows().map((row) =>
      applyMessageEligibility(row, {
        signedIn: true,
        actor: app.session.user,
        canMessage,
      })
    );
    const mode = state.emptyState();

    return (
      <div className="NotificationsPage">
        <NotificationInboxHeader />
        <NotificationInboxTabs
          filter={state.filter}
          onchange={(filter) => {
            state.setFilter(filter);
          }}
        />
        {mode === 'rows' || mode === 'partial' ? <NotificationInboxList rows={rows} filter={state.filter} /> : null}
        {mode === 'rows' ? null : <NotificationInboxEmpty mode={mode} />}
      </div>
    );
  }
}
