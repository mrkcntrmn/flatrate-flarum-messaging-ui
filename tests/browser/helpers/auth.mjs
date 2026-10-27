/**
 * Real Flarum session login via the forum LogInModal (cookie + CSRF).
 * Does not use API tokens as browser auth.
 */

export async function waitForApp(page) {
  await page.waitForFunction(() => !!(window.app && window.app.forum), null, {
    timeout: 60_000,
  });
}

export async function gotoStable(page, path = '/') {
  const attempts = [];
  for (let i = 0; i < 6; i++) {
    try {
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const status = resp ? resp.status() : null;
      if (status !== null && status >= 500) {
        const body = await page.content().catch(() => '');
        attempts.push({ i, status, reason: 'http_5xx', bodyHead: body.slice(0, 240) });
        await page.waitForTimeout(800);
        continue;
      }
      try {
        await waitForApp(page);
        return;
      } catch (appErr) {
        const title = await page.title().catch(() => '');
        const href = page.url();
        const consoleHint = await page
          .evaluate(() => (window.__flarumFailedBoot && String(window.__flarumFailedBoot)) || '')
          .catch(() => '');
        attempts.push({
          i,
          status,
          reason: 'app_not_ready',
          title,
          href,
          consoleHint: consoleHint.slice(0, 200),
          error: String(appErr && appErr.message ? appErr.message : appErr).slice(0, 200),
        });
        await page.waitForTimeout(800);
      }
    } catch (navErr) {
      attempts.push({
        i,
        reason: 'navigation',
        error: String(navErr && navErr.message ? navErr.message : navErr).slice(0, 240),
      });
      await page.waitForTimeout(800);
    }
  }
  throw new Error(`gotoStable failed path=${path} attempts=${JSON.stringify(attempts)}`);
}

export async function loginAs(page, username, password) {
  await gotoStable(page, '/');

  const already = await page.evaluate((u) => {
    const user = window.app?.session?.user;
    return !!(user && typeof user.username === 'function' && user.username() === u);
  }, username);
  if (already) return;

  // Prefer the real login modal UI when present.
  const logInButton = page.locator('.item-logIn button, button[itemclass*="LogIn"], .Header-controls .item-logIn button');
  if (await logInButton.first().isVisible().catch(() => false)) {
    await logInButton.first().click();
    const modal = page.locator('.LogInModal, .Modal.LogInModal');
    await modal.waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.LogInModal input[name="identification"], input[name="identification"]').fill(username);
    await page.locator('.LogInModal input[name="password"], input[name="password"]').fill(password);
    await page.locator('.LogInModal .Button--primary, .Modal-footer .Button--primary').first().click();
    await page.waitForFunction(
      (u) => {
        const user = window.app?.session?.user;
        return !!(user && typeof user.username === 'function' && user.username() === u);
      },
      username,
      { timeout: 30_000 }
    );
    return;
  }

  // Fallback: session login endpoint with CSRF from boot payload (still cookie session).
  const result = await page.evaluate(
    async ({ username: u, password: p }) => {
      const csrf =
        (window.app?.session && window.app.session.csrfToken) ||
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
        '';
      const base = window.app.forum.attribute('baseUrl') || '';
      const res = await fetch(`${base}/login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-Token': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ identification: u, password: p }),
      });
      const text = await res.text();
      return { status: res.status, text };
    },
    { username, password }
  );
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`LOGIN_FAIL user=${username} status=${result.status} body=${result.text.slice(0, 200)}`);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.waitForFunction(
    (u) => {
      const user = window.app?.session?.user;
      return !!(user && typeof user.username === 'function' && user.username() === u);
    },
    username,
    { timeout: 30_000 }
  );
}

export async function logout(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  const loggedIn = await page.evaluate(() => !!(window.app?.session?.user));
  if (!loggedIn) return;

  const toggle = page.locator('.SessionDropdown .Dropdown-toggle, .item-session .Dropdown-toggle');
  if (await toggle.first().isVisible().catch(() => false)) {
    await toggle.first().click();
    const logOut = page.locator('.item-logOut button, button[title*="Log Out"], .SessionDropdown .item-logOut button');
    if (await logOut.first().isVisible().catch(() => false)) {
      await logOut.first().click();
    } else {
      await page.evaluate(async () => {
        const csrf = window.app?.session?.csrfToken || '';
        const base = window.app.forum.attribute('baseUrl') || '';
        await fetch(`${base}/logout`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'X-CSRF-Token': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  } else {
    await page.evaluate(async () => {
      const csrf = window.app?.session?.csrfToken || '';
      const base = window.app.forum.attribute('baseUrl') || '';
      await fetch(`${base}/logout`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-Token': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForFunction(() => !window.app?.session?.user, null, { timeout: 30_000 }).catch(async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.waitForFunction(() => !window.app?.session?.user, null, { timeout: 15_000 });
  });
}

export async function providerInventory(page) {
  return page.evaluate(() => {
    const sources = window.app?.flatRateMessagingSources || {};
    const describe = (p) => {
      if (!p || typeof p !== 'object') return null;
      return {
        kind: p.kind || null,
        schemaVersion: p.schemaVersion || null,
        methods: Object.keys(p).filter((k) => typeof p[k] === 'function').sort(),
      };
    };
    return {
      hasDirect: !!sources.direct,
      hasLive: !!sources.live,
      direct: describe(sources.direct),
      live: describe(sources.live),
      user: window.app?.session?.user
        ? {
            id: window.app.session.user.id?.(),
            username: window.app.session.user.username?.(),
          }
        : null,
    };
  });
}
