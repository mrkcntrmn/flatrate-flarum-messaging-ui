import { chromium } from 'playwright';
import fs from 'node:fs';
const FIXTURE = JSON.parse(fs.readFileSync(process.env.BROWSER_FIXTURE_PATH, 'utf8'));
const browser = await chromium.connectOverCDP(process.env.ANDROID_CDP_URL);
const page = browser.contexts()[0].pages().find(p => p.url().includes('18771')) || browser.contexts()[0].pages()[0];
await page.goto(FIXTURE.baseUrl + '/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await page.waitForFunction(() => window.app?.forum);
// login via fetch
await page.evaluate(async ({u,p}) => {
  if (window.app?.session?.user?.username?.() === u) return;
  const csrf = window.app.session.csrfToken;
  const base = window.app.forum.attribute('baseUrl');
  await fetch(base + '/login', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'X-Requested-With':'XMLHttpRequest'}, body: JSON.stringify({identification:u,password:p})});
}, {u:'alice', p:FIXTURE.passwords.alice});
await page.goto(FIXTURE.baseUrl + '/messages', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.app?.forum);
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('a,button,[role="button"],li,div')].filter(n => /bob|FlatRate|PRIVATE|LIVE|Direct/i.test(n.textContent||'') && (n.textContent||'').length < 120);
  return {
    href: location.href,
    classes: [...document.querySelectorAll('[class*="Message"],[class*="Conversation"],[class*="Directory"],[class*="Live"]')].slice(0,40).map(n => n.className),
    candidates: nodes.slice(0,30).map(n => ({tag:n.tagName, cls:n.className, text:(n.textContent||'').trim().slice(0,80), href:n.getAttribute?.('href')})),
    routes: Object.keys(window.app?.routes || {}),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
