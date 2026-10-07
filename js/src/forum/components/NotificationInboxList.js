import NotificationInboxRow from './NotificationInboxRow.js';

export default class NotificationInboxList {
  view(vnode) {
    const rows = vnode.attrs.rows || [];
    const filter = vnode.attrs.filter || 'all';
    return (
      <div
        className="NotificationInboxList"
        id={`notification-panel-${filter}`}
        role="tabpanel"
        aria-labelledby={`notification-tab-${filter}`}
      >
        {rows.map((row) => (
          <NotificationInboxRow key={row.id} row={row} />
        ))}
      </div>
    );
  }
}
