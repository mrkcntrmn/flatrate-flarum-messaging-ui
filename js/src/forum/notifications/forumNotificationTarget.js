/**
 * Forum notification links come from the registered Flarum notification
 * component's href(), the same contract as Notification.tsx. The API serializer
 * does not emit href. This helper does not build discussion or post URLs.
 *
 * A missing subject makes the core and extension components return '#' or throw.
 * Both become an unavailable target with no link.
 */
export function isSafeForumHref(href) {
  return typeof href === 'string'
    && href.startsWith('/')
    && !href.startsWith('//')
    && !href.includes('://')
    && !/[\s<>"']/.test(href);
}

export function resolveForumNotificationTarget(app, notification) {
  const unavailable = { href: '', unavailable: true };
  if (!notification || !app || !app.notificationComponents) {
    return unavailable;
  }
  const type = typeof notification.contentType === 'function' ? notification.contentType() : '';
  const Component = type ? app.notificationComponents[type] : null;
  if (typeof Component !== 'function' || !Component.prototype || typeof Component.prototype.href !== 'function') {
    return unavailable;
  }
  const instance = Object.create(Component.prototype);
  instance.attrs = { notification };
  let href;
  try {
    href = Component.prototype.href.call(instance);
  } catch (error) {
    return unavailable;
  }
  if (!isSafeForumHref(href)) {
    return unavailable;
  }
  return { href, unavailable: false };
}
