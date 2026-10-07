<?php

namespace FlatRate\MessagingUi;

use Flarum\Api\Serializer\ForumSerializer;
use Flarum\Extend;
use Flarum\Frontend\Document;
use FlatRate\MessagingUi\Api\ShowForumNotificationUnreadController;
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
            // Flarum 1.8 Frontend::populate() invokes content($document, $request).
            if (!MessagingIndexingPolicy::shouldNoIndexPath($request->getUri()->getPath())) {
                return;
            }
            $document->head[] = '<meta name="robots" content="noindex, nofollow">';
        }),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\ApiSerializer(ForumSerializer::class))
        ->attribute('flatrateMessagingUiEnabled', function (ForumSerializer $serializer) {
            return true;
        }),

    (new Extend\Routes('api'))
        ->get(
            '/flatrate-messaging/forum-notification-unread',
            'flatrate-messaging.forum-notification-unread',
            ShowForumNotificationUnreadController::class
        ),
];
