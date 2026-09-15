# Messages (flatrate/flarum-messaging-ui)

Local Flarum 1.8 **Messages** shell. It composes authorized Live Chat and Direct Message conversations into one `/messages` surface. It does **not** store messages, run migrations, or talk to Supabase.

This tree is a **local package only**. Creating a GitHub remote or publishing to Packagist is a later consequential action — do not treat this worktree as a canonical public checkout.

## Identity

| | |
|---|---|
| Composer | `flatrate/flarum-messaging-ui` |
| Extension ID | `flatrate-messaging-ui` |
| Flarum | 1.8.19 compatible (`flarum/core` `^1.8.5`, PHP `^8.1`) |

This package does **not** Composer-require Live Chat or the Direct Messages bridge. Providers are discovered at runtime:

- live provider present → Live rows and Live filter
- direct provider present → Direct rows, Direct filter, Start-DM
- both → unified Messages product
- neither → explicit unavailable state

## Local path-repository install

From the Flarum root (example):

```bash
# composer.json (Flarum root)
{
  "repositories": [
    {
      "type": "path",
      "url": "/home/ilove/dev/_worktrees/flatrate-flarum-messaging-ui/forum-messaging-001"
    }
  ]
}
```

```bash
composer require flatrate/flarum-messaging-ui:*@dev
php flarum cache:clear
```

Enable **Messages** in the admin extension list.

Runtime providers (implemented by the Live Chat / DM packages, not this shell) should assign:

```js
app.flatRateMessagingSources ??= {};
app.flatRateMessagingSources.live = { /* listConversations, getUnreadTotal, renderConversation */ };
app.flatRateMessagingSources.direct = { /* listConversations, getUnreadTotal, renderConversation, findConversationWithUser, startConversationWithUser */ };
```

### V2 presentation context (additive)

When the shell is V2-capable it passes:

```js
provider.renderConversation({
  key,
  context: {
    presentationVersion: 2,
    initialDraft,
    conversation,
  },
});
```

Providers must keep rendering the accepted V1 surface when `presentationVersion` is absent. Viewport ownership (constrained shell height, message-viewport scroll, composer always visible) is a hard product invariant for V2.

Synthetic messaging fixtures remain available for automated tests only. Production Messages routes always render the authorized provider surface; there is no user-triggerable synthetic conversation URL.

## Scripts

```bash
# PHP noindex policy (PHPUnit 9.6; needs ext-dom, ext-mbstring, ext-xmlwriter)
composer test
# or: vendor/bin/phpunit

# Forum JS
cd js
npm install
npm run build
npm test
npm run format-check
```

## Routes

| Path | Name |
|---|---|
| `/messages` | `flatrate-messaging.index` |
| `/messages/live/{roomKey}` | `flatrate-messaging.live` |
| `/messages/direct/{conversationId}` | `flatrate-messaging.direct` |

`/messages` and `/messages/*` are `noindex, nofollow`. Public `/`, `/d/`, `/t/` are not.

## Out of scope

- Message tables, migrations, or an independent unread store
- Direct calls to neoncube / StartConversationModal / clipboard copy
- Remote repository creation
