import fs from 'node:fs';
import path from 'node:path';

export function loadFixture() {
  const fixturePath =
    process.env.BROWSER_FIXTURE_PATH ||
    path.resolve('evidence/forum-f2-messaging-browser/fixture.json');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`BROWSER_FIXTURE_MISSING path=${fixturePath}`);
  }
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

export function receiptPath() {
  return (
    process.env.BROWSER_RECEIPT_PATH ||
    path.resolve('evidence/forum-f2-messaging-browser/receipts.json')
  );
}

export function writeReceipts(partial) {
  const target = receiptPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let current = {};
  if (fs.existsSync(target)) {
    try {
      current = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch {
      current = {};
    }
  }
  const next = { ...current, ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(target, JSON.stringify(next, null, 2) + '\n');
  return next;
}

export function mark(key, value, detail) {
  const payload = detail ? `${value} ${detail}` : value;
  writeReceipts({ [key]: payload });
  // Also emit machine-readable line for CI log scrape.
  // eslint-disable-next-line no-console
  console.log(`${key}=${payload}`);
}
