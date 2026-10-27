import { waitForApp, gotoStable, attachPageDiagnostics } from './auth.mjs';

export async function openMessages(page, path = '/messages') {
  const browserDiag = attachPageDiagnostics(page);
  await gotoStable(page, path);
  try {
    await page.waitForSelector('.MessagesPage, .MessagesShell', { timeout: 60_000 });
  } catch (err) {
    const diag = await page
      .evaluate(() => {
        const routes = window.app?.routes ? Object.keys(window.app.routes).sort() : [];
        const boot = window.app?.data || window.flarum?.data || null;
        return {
          href: location.href,
          title: document.title,
          hasApp: !!(window.app && window.app.forum),
          user: window.app?.session?.user ? window.app.session.user.username?.() : null,
          routeKeys: routes,
          hasMessagesRoute: routes.includes('flatrate-messaging.index'),
          bodyHead: (document.body?.innerText || '').slice(0, 400),
          shellCount: document.querySelectorAll('.MessagesPage, .MessagesShell').length,
          providers: {
            live: !!window.app?.flatRateMessagingSources?.live,
            direct: !!window.app?.flatRateMessagingSources?.direct,
          },
          extensionIds: Array.isArray(boot?.extensions)
            ? boot.extensions
            : boot?.extensions
              ? Object.keys(boot.extensions)
              : null,
          forumJsSrc: document.querySelector('script[src*="forum.js"]')?.src || null,
        };
      })
      .catch((e) => ({ evaluateError: String(e) }));
    diag.pageErrors = (browserDiag.pageErrors || []).slice(-8);
    diag.console = (browserDiag.console || []).slice(-12);
    diag.requestsFailed = (browserDiag.requestsFailed || []).slice(-12);
    throw new Error(`openMessages failed path=${path} diag=${JSON.stringify(diag)} cause=${err && err.message ? err.message : err}`);
  }
}

export async function bubbleBodies(page) {
  return page
    .locator(
      '.MessagesBubble-body, .MessageText, .chat-message .message-text, .ChatMessage-body, .ChatMessage .message, .MessagesLiveSurface .message'
    )
    .allTextContents();
}

export async function waitForBubbleText(page, text, timeout = 45_000) {
  await page.waitForFunction(
    (needle) => {
      const nodes = Array.from(
        document.querySelectorAll(
          '.MessagesBubble-body, .MessageText, .chat-message .message-text, .ChatMessage-body, .ChatMessage .message, .MessagesLiveSurface .message, .ChatViewport .message'
        )
      );
      return nodes.some((n) => (n.textContent || '').includes(needle));
    },
    text,
    { timeout }
  );
}

export async function sendDirectComposer(page, text) {
  const input = page.locator(
    '.MessagesComposer-input, .DirectComposer textarea, textarea.MessagesComposer-input, .MessagesDirectSurface textarea'
  );
  await input.first().waitFor({ state: 'visible', timeout: 45_000 });
  // Mithril Stream-controlled textarea: fill()/pressSequentially fight the
  // binding and can hang. Set value + input event, wait until canSend enables
  // the button, then requestSubmit (disabled buttons ignore clicks).
  await input.first().click({ force: true });
  await page.evaluate((body) => {
    const ta = document.querySelector(
      '.MessagesDirectSurface textarea.MessagesComposer-input, form.MessagesComposer textarea.MessagesComposer-input, .DirectComposer textarea'
    );
    if (!ta) throw new Error('no_direct_composer');
    const proto = window.HTMLTextAreaElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && typeof desc.set === 'function') desc.set.call(ta, body);
    else ta.value = body;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (window.m && typeof window.m.redraw === 'function') window.m.redraw();
  }, text);
  await page.waitForFunction(
    (body) => {
      const ta = document.querySelector(
        '.MessagesDirectSurface textarea.MessagesComposer-input, form.MessagesComposer textarea.MessagesComposer-input, .DirectComposer textarea'
      );
      const btn = document.querySelector(
        '.MessagesDirectSurface .MessagesComposer-send, form.MessagesComposer .MessagesComposer-send'
      );
      return !!(ta && ta.value === body && btn && !btn.disabled && !btn.classList.contains('disabled'));
    },
    text,
    { timeout: 15_000 }
  );
  await page.evaluate(() => {
    const form = document.querySelector(
      '.MessagesDirectSurface form.MessagesComposer, form.MessagesComposer.DirectComposer, form.MessagesComposer'
    );
    if (!form) throw new Error('no_direct_composer_form');
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await waitForBubbleText(page, text, 45_000);
}

export async function sendLiveComposer(page, text) {
  const input = page.locator('#chat-input, .ChatInput textarea, .MessagesLiveSurface textarea');
  await input.first().waitFor({ state: 'visible', timeout: 45_000 });
  // `#notices` can sit above the Live composer and intercept clicks.
  await input.first().click({ force: true });
  await input.first().fill('');
  await input.first().type(text, { delay: 8 });
  // Live messageSend() no-ops unless writingPreview is armed via inputProcess.
  const armed = await page.evaluate((body) => {
    const chat = window.app?.chat;
    if (!chat || typeof chat.getCurrentChat !== 'function' || typeof chat.getViewportState !== 'function') {
      return { ok: false, reason: 'no_chat' };
    }
    const model = chat.getCurrentChat();
    if (!model) return { ok: false, reason: 'no_current_chat' };
    const vs = chat.getViewportState(model);
    const ta = document.querySelector('#chat-input');
    if (ta) {
      ta.value = body;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    vs.input.content(body);
    vs.input.messageLength = body.trim().length;
    if (!vs.input.writingPreview) {
      vs.input.writingPreview = true;
      const preview = app.store.createRecord('chatmessages');
      preview.pushData({
        id: 0,
        attributes: { message: body, created_at: 0 },
        relationships: { user: app.session.user, chat: model },
      });
      Object.assign(preview, { isEditing: true, isNeedToFlash: true, content: body });
      vs.input.previewModel = preview;
    } else if (vs.input.previewModel) {
      vs.input.previewModel.content = body;
    }
    vs.messageSend();
    return { ok: true };
  }, text);
  if (!armed.ok) {
    const send = page.locator('.ChatInput-send, .ChatInput .Button--primary');
    if (await send.first().isVisible().catch(() => false)) {
      await send.first().click({ force: true });
    } else {
      await input.first().press('Enter');
    }
  }
  await waitForBubbleText(page, text, 60_000);
}

export async function guestHtmlLeaks(page, sentinels) {
  const html = await page.content();
  const leaked = sentinels.filter((s) => html.includes(s));
  const stateLeak = await page.evaluate((needles) => {
    const safe = (value) => {
      const seen = new WeakSet();
      try {
        return JSON.stringify(value, (_k, v) => {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return undefined;
            seen.add(v);
          }
          if (typeof v === 'function') return undefined;
          return v;
        });
      } catch (_e) {
        return '';
      }
    };
    const dump = [
      safe(window.app?.data),
      safe(window.app?.cache),
      document.body?.innerText || '',
    ].join('\n');
    return needles.filter((n) => dump.includes(n));
  }, sentinels);
  return { htmlLeaks: leaked, stateLeaks: stateLeak };
}

export async function directoryTitles(page) {
  // Wait for either Direct or Live rows; do not click ambiguous "Live" buttons
  // (that can match header chrome and navigate away from /messages).
  await page
    .waitForSelector('.ConversationRow-title, .MessagesDirectory-title, .ChatList-item-title', {
      timeout: 30_000,
    })
    .catch(() => {});
  const filterLive = page.locator(
    '.MessagesFilter [data-filter="live"], .MessagesDirectory-filter [data-filter="live"], button.MessagesFilter-live'
  );
  if (await filterLive.first().isVisible().catch(() => false)) {
    await filterLive.first().click();
    await page.waitForTimeout(400);
  }
  return page.locator('.ConversationRow-title, .MessagesDirectory-title, .ChatList-item-title').allTextContents();
}

export async function mobileShellMetrics(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.MessagesPage, .MessagesShell');
    if (!shell) return { ok: false, reason: 'missing_shell' };
    const style = getComputedStyle(document.documentElement);
    const bodyOverflowY = getComputedStyle(document.body).overflowY;
    const docScroll = document.documentElement.scrollHeight > window.innerHeight + 2;
    const viewport = shell.querySelector('.MessagesMessageViewport, .DirectMessageViewport, .ChatViewport, .MessagesPage-conversationBody');
    const composer = shell.querySelector('.MessagesComposer, .ChatInput, .DirectComposer');
    return {
      ok: true,
      bodyOverflowY,
      docScroll,
      hasViewport: !!viewport,
      hasComposer: !!composer,
      shellHeight: shell.getBoundingClientRect().height,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      cssVarsHint: style.getPropertyValue('--header-height') || null,
    };
  });
}
