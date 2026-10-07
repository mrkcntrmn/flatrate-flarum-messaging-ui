import app from 'flarum/forum/app';
import Link from 'flarum/common/components/Link';
import avatar from 'flarum/common/helpers/avatar';
import humanTime from 'flarum/common/helpers/humanTime';
import { rowActions } from '../notifications/rowActions.js';

function storedUser(actor) {
  if (!actor || actor.id == null || !app.store || typeof app.store.getById !== 'function') {
    return null;
  }
  return app.store.getById('users', actor.id);
}

function actorModel(actor) {
  if (!actor || actor.id == null) return null;
  return storedUser(actor) || {
    id: () => actor.id,
    username: () => actor.username,
    displayName: () => actor.displayName,
  };
}

export default class NotificationInboxRow {
  view(vnode) {
    const row = vnode.attrs.row;
    const actions = rowActions(row);
    const user = actorModel(row.actor);
    const profile = user && app.route ? app.route.user(user) : null;
    const when = row.activityAt ? humanTime(new Date(row.activityAt)) : '';

    return (
      <article className={'NotificationInboxRow' + (row.unreadCount > 0 ? ' is-unread' : '')}>
        {row.actor ? (
          <Link className="NotificationInboxRow-actor" href={profile} aria-label={row.actor.displayName || row.actor.username}>
            {storedUser(row.actor) ? avatar(storedUser(row.actor)) : (
              <span className="Avatar NotificationInboxRow-fallback" aria-hidden="true">
                {(row.actor.displayName || row.actor.username || '?').slice(0, 1)}
              </span>
            )}
          </Link>
        ) : (
          <span className="NotificationInboxRow-actor" aria-hidden="true" />
        )}
        <div className="NotificationInboxRow-body">
          {actions.primary?.href ? (
            <Link className="NotificationInboxRow-target" href={actions.primary.href}>
              <span className="NotificationInboxRow-title">{row.title}</span>
              {when ? <time className="NotificationInboxRow-time">{when}</time> : null}
            </Link>
          ) : (
            <div className="NotificationInboxRow-target" data-target="unavailable">
              <span className="NotificationInboxRow-title">{row.title}</span>
              {when ? <time className="NotificationInboxRow-time">{when}</time> : null}
            </div>
          )}
          {actions.message ? (
            <button
              type="button"
              className="Button Button--flat NotificationInboxRow-message"
              aria-label={actions.message.label}
              onclick={() => {
                const target = actorModel(row.actor);
                if (app.flatrateMessaging && target) {
                  app.flatrateMessaging.openDirectToUser(target);
                }
              }}
            >
              Message
            </button>
          ) : null}
        </div>
      </article>
    );
  }
}
