import { NOTIFICATION_FILTERS } from '../notifications/notificationFilters.js';

export default class NotificationInboxTabs {
  view(vnode) {
    const selected = vnode.attrs.filter || 'all';
    const onchange = vnode.attrs.onchange || (() => {});

    return (
      <div className="NotificationInboxTabs" role="tablist" aria-label="Notification filters">
        {NOTIFICATION_FILTERS.map((filter) => (
          <button
            type="button"
            className={'NotificationInboxTabs-tab' + (selected === filter.id ? ' is-selected' : '')}
            role="tab"
            id={`notification-tab-${filter.id}`}
            aria-selected={selected === filter.id ? 'true' : 'false'}
            aria-controls={`notification-panel-${filter.id}`}
            tabindex={selected === filter.id ? '0' : '-1'}
            onclick={() => onchange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    );
  }
}
