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
import {
  rememberScroll,
  restoreScroll,
  selectNotificationsScroller,
  shouldPersistScroll,
} from '../notifications/notificationRoutes.js';

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
    this._scrollAdjusted = false;
    this._restoredFilter = null;
    this._pendingScrollRestore = false;
    if (app.flatrateNotifications && typeof app.flatrateNotifications.revalidate === 'function') {
      app.flatrateNotifications.revalidate('notifications');
    }
    if (app.session.user && notificationsAvailable(app) && state.available === true) {
      this._refresh = state.refresh();
      this._refresh.then(() => m.redraw());
    }
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    // A hard load can resolve the inbox before this page is mounted. Attaching
    // again after mount redraws the settled empty or row state.
    if (this._refresh && typeof this._refresh.then === 'function') {
      this._refresh.then(() => {
        m.redraw();
        this.restoreScrollPosition();
      });
    }
    this.bindScrollAdjustment();
    this.restoreScrollPosition();
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    if (!this._pendingScrollRestore) return;
    this._pendingScrollRestore = false;
    this.restoreScrollPosition();
  }

  onremove() {
    this.persistScrollPosition();
  }

  scroller() {
    const list = this.element && this.element.querySelector('.NotificationInboxList');
    const doc = typeof document !== 'undefined' ? (document.scrollingElement || document.documentElement) : null;
    return selectNotificationsScroller(list, doc);
  }

  persistScrollPosition() {
    const state = app.flatrateNotificationState;
    const scroller = this.scroller();
    if (!state || !state.actorId || !shouldPersistScroll(scroller)) return;
    rememberScroll(window.sessionStorage, state.actorId, state.filter, scroller.scrollTop);
  }

  restoreScrollPosition(attempt = 0) {
    const state = app.flatrateNotificationState;
    if (!state || !state.actorId || this._scrollAdjusted) return;
    const scroller = this.scroller();
    if (!scroller) return;
    const top = restoreScroll(window.sessionStorage, state.actorId, state.filter);
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (top > 0 && max + 1 < top && attempt < 30) {
      setTimeout(() => this.restoreScrollPosition(attempt + 1), 50);
      return;
    }
    const target = Math.min(top, max);
    this._assigningScroll = true;
    scroller.scrollTop = target;
    this._restoredFilter = state.filter;
    const release = () => {
      const drifted = top > 0 && Math.abs(scroller.scrollTop - target) > 1;
      if (drifted && attempt < 30 && !this._scrollAdjusted) {
        this.restoreScrollPosition(attempt + 1);
        return;
      }
      this._assigningScroll = false;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(release);
    else release();
  }

  bindScrollAdjustment() {
    const scroller = this.scroller();
    if (!scroller || this._scrollBound) return;
    this._scrollBound = true;
    scroller.addEventListener('scroll', () => {
      if (this._assigningScroll) return;
      this._scrollAdjusted = true;
    }, { passive: true });
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

    if (state.available !== true) {
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
            this.persistScrollPosition();
            this._scrollAdjusted = false;
            state.setFilter(filter);
            this._pendingScrollRestore = true;
          }}
        />
        {mode === 'rows' || mode === 'partial' ? <NotificationInboxList rows={rows} filter={state.filter} /> : null}
        {mode === 'rows' ? null : <NotificationInboxEmpty mode={mode} />}
      </div>
    );
  }
}
