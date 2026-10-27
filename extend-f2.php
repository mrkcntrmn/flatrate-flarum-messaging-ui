<?php

/*
 * Flarum 2.0.2 frontend shell for FlatRate Messaging UI.
 *
 * Flarum 2 removed the F1 forum-serializer extender. This entry keeps the
 * Messages routes, forum/admin assets, locales, and noindex policy.
 * Notifications-rollout forum attributes, API middleware, and the unread count
 * route stay deferred until a F2-safe actor-aware serialization path exists.
 * No second message storage API is registered (UNIFIED_STORAGE=false).
 */

use Flarum\Extend;
use Flarum\Frontend\Document;
use FlatRate\MessagingUi\MessagingUiServiceProvider;
use FlatRate\MessagingUi\Seo\MessagingIndexingPolicy;
use Psr\Http\Message\ServerRequestInterface as Request;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/resources/less/forum.less')
        ->route('/messages', 'flatrate-messaging.index')
        ->route('/messages/live/{roomKey}', 'flatrate-messaging.live')
        ->route('/messages/direct/{conversationId}', 'flatrate-messaging.direct')
        ->content(function (Document $document, Request $request) {
            // Messages and Notifications stay noindex. Ordinary forum routes must not inherit that directive.
            if (!MessagingIndexingPolicy::shouldNoIndexPath($request->getUri()->getPath())) {
                return;
            }
            $document->head[] = '<meta name="robots" content="noindex, nofollow">';
        }),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    new Extend\Locales(__DIR__.'/locale'),

    // F2-safe constant forum attribute via Settings (F1 serializer extender is gone).
    (new Extend\Settings())
        ->default('flatrate-messaging-ui.enabled_marker', '1')
        ->serializeToForum('flatrateMessagingUiEnabled', 'flatrate-messaging-ui.enabled_marker', function ($value) {
            return true;
        }),

    (new Extend\ServiceProvider())
        ->register(MessagingUiServiceProvider::class),
];
