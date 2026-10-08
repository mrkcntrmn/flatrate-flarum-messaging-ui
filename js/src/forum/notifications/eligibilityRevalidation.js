/**
 * Bounded eligibility revalidation. This is not a push channel and it is not
 * instant revocation across already-open sessions. The unread-count endpoint
 * remains the server authorization check.
 *
 * 200 authorized, 403 denied, 401 signed out.
 * Anything else, including a timeout or a dropped connection, is unconfirmed.
 * Unconfirmed is not a server denial, but private presentation still fails closed.
 */
export const REVALIDATION_INTERVAL_MS = 30000;

export function classifyEligibilityHttpStatus(status) {
  const code = Number(status);
  if (code === 200) return 'authorized';
  if (code === 403) return 'denied';
  if (code === 401) return 'signed-out';
  return 'unconfirmed';
}

export function classifyEligibilityFailure(error) {
  if (!error) return null;
  const status = error.status ?? error.xhr?.status ?? error.response?.status;
  if (status == null && !error.xhr && error.name !== 'TypeError') {
    return null;
  }
  return classifyEligibilityHttpStatus(status);
}

export function eligibilityTickAllowed({ signedIn = false, visible = true, active = false } = {}) {
  return signedIn === true && visible !== false && active === true;
}

export function bindEligibilityRevalidation(app, inbox, env = defaultEnv()) {
  const state = inbox.state;
  let pending = null;
  let timer = null;

  function actorId() {
    const user = app.session?.user;
    if (!user || typeof user.id !== 'function') return null;
    const id = user.id();
    return id == null || id === '' ? null : String(id);
  }

  function featureActive() {
    if (!actorId() || !state.signedIn) return false;
    return state.available === true || state.revalidationActive === true;
  }

  function apiUrl() {
    const forum = app.forum;
    if (!forum || typeof forum.attribute !== 'function') return '';
    return String(forum.attribute('apiUrl') || '');
  }

  async function probe() {
    try {
      await app.request({
        method: 'GET',
        url: `${apiUrl()}/flatrate-messaging/forum-notification-unread`,
      });
      return 'authorized';
    } catch (error) {
      return classifyEligibilityFailure(error) || 'unconfirmed';
    }
  }

  function revalidate(reason) {
    const signedIn = !!actorId() && state.signedIn;
    if (!signedIn || !apiUrl()) return null;
    if (reason === 'interval' && !eligibilityTickAllowed({
      signedIn,
      visible: env.visible(),
      active: featureActive(),
    })) {
      return null;
    }
    const currentActor = state.actorId;
    if (pending && pending.actorId === currentActor) {
      return pending.promise;
    }
    const seq = state.beginEligibilityProbe();
    const wasHidden = state.available !== true;
    const promise = probe().then((result) => {
      const applied = state.applyEligibility(seq, currentActor, result);
      if (applied && result === 'authorized' && wasHidden && typeof inbox.refresh === 'function') {
        return inbox.refresh().then(() => {
          if (env.redraw) env.redraw();
          return { applied, result };
        });
      }
      if (applied && env.redraw) env.redraw();
      return { applied, result };
    }).finally(() => {
      if (pending && pending.seq === seq) pending = null;
    });
    pending = { actorId: currentActor, seq, promise };
    return promise;
  }

  function onFocus() {
    revalidate('focus');
  }

  function onVisibility() {
    if (env.visible()) revalidate('visibility');
  }

  env.listen(env.focusTarget, 'focus', onFocus);
  env.listen(env.documentTarget, 'visibilitychange', onVisibility);
  timer = env.every(REVALIDATION_INTERVAL_MS, () => revalidate('interval'));

  inbox.revalidate = revalidate;
  inbox.stopEligibilityRevalidation = () => {
    env.unlisten(env.focusTarget, 'focus', onFocus);
    env.unlisten(env.documentTarget, 'visibilitychange', onVisibility);
    if (timer != null) env.cancel(timer);
    timer = null;
    inbox.revalidate = null;
  };
  return inbox;
}

function defaultEnv() {
  return {
    focusTarget: typeof window !== 'undefined' ? window : null,
    documentTarget: typeof document !== 'undefined' ? document : null,
    visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    listen(target, type, handler) {
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener(type, handler);
      }
    },
    unlisten(target, type, handler) {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(type, handler);
      }
    },
    every(ms, handler) {
      return setInterval(handler, ms);
    },
    cancel(timer) {
      clearInterval(timer);
    },
    redraw() {
      if (typeof m !== 'undefined' && m.redraw) m.redraw();
    },
  };
}
