import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/admin/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\s*$/gm, '');

for (const property of ['registry', 'extensionData']) {
  test(`admin settings boot with only ${property} available`, () => {
    const registered = [];
    const registry = {
      for(id) { assert.equal(id, 'flatrate-messaging-ui'); return this; },
      registerSetting(setting) { registered.push(setting); return this; },
    };
    let initializer;
    const app = {
      [property]: registry,
      initializers: { add(id, callback) { initializer = callback; } },
      translator: { trans: (key) => key },
    };
    new Function('app', source)(app);
    initializer();
    assert.deepEqual(registered.map((setting) => setting.setting), [
      'flatrate-messaging-ui.notifications_admin_preview_enabled',
      'flatrate-messaging-ui.notifications_member_beta_enabled',
      'flatrate-messaging-ui.notifications_member_enabled',
    ]);
    assert.ok(registered.every((setting) => setting.type === 'boolean'));
  });
}
