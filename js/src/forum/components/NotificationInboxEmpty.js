export default class NotificationInboxEmpty {
  view(vnode) {
    const mode = vnode.attrs.mode;
    if (mode === 'loading') {
      return <p className="NotificationInboxEmpty">Loading notifications.</p>;
    }
    if (mode === 'unavailable' || mode === 'partial') {
      return <p className="NotificationInboxEmpty">Some notifications could not be loaded.</p>;
    }
    if (mode === 'caught-up') {
      return <p className="NotificationInboxEmpty">You're all caught up.</p>;
    }
    if (mode === 'signed-out') {
      return <p className="NotificationInboxEmpty">Sign in to view notifications.</p>;
    }
    return null;
  }
}
