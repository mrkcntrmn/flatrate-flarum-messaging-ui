import { chromium } from 'playwright';

const cdp = process.env.ANDROID_CDP_URL || 'http://127.0.0.1:9223';
const browser = await chromium.connectOverCDP(cdp);
const contexts = browser.contexts();
const pages = contexts.flatMap((c) => c.pages());
const target = pages.find((p) => (p.url() || '').includes('127.0.0.1:18771')) || pages[0];
console.log(JSON.stringify({
  pageCount: pages.length,
  urls: pages.map((p) => p.url()),
  target: target ? target.url() : null,
}, null, 2));
if (target) {
  await target.bringToFront().catch(() => {});
  const state = await target.evaluate(() => ({
    title: document.title,
    href: location.href,
    hasApp: !!(window.app && window.app.forum),
    user: window.app?.session?.user ? window.app.session.user.username?.() : null,
    sources: {
      direct: !!window.app?.flatRateMessagingSources?.direct,
      live: !!window.app?.flatRateMessagingSources?.live,
    },
    bodyText: (document.body?.innerText || '').slice(0, 400),
    consoleHint: window.__flarumFailedBoot || null,
  }));
  console.log(JSON.stringify(state, null, 2));
}
await browser.close();
