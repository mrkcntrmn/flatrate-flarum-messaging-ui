/**
 * Keep Flarum's native notifications page as the default. The experimental
 * unified inbox may own the route only after server-backed eligibility has
 * been confirmed for the current actor.
 */
export function selectNotificationsRouteComponent({ nativeComponent = null, unifiedComponent = null, available = false } = {}) {
  if (available === true && unifiedComponent) {
    return unifiedComponent;
  }

  return nativeComponent;
}

export function createNotificationsRouteComponent({ app, nativeComponent, unifiedComponent, render } = {}) {
  return {
    oninit() {
      const inbox = app?.flatrateNotifications;
      if (inbox && typeof inbox.revalidate === 'function') {
        inbox.revalidate('notifications-route');
      }
    },

    view(vnode) {
      const component = selectNotificationsRouteComponent({
        nativeComponent,
        unifiedComponent,
        available: !!app?.session?.user && app?.flatrateNotificationState?.available === true,
      });

      return component && typeof render === 'function' ? render(component, vnode.attrs) : null;
    },
  };
}
