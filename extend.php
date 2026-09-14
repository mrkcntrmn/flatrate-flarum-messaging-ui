<?php

namespace FlatRate\MessagingUi;

use Flarum\Api\Serializer\ForumSerializer;
use Flarum\Extend;
use Flarum\Frontend\Document;
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
            // Messages surfaces stay noindex. Ordinary forum routes must not inherit that directive.
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
];
