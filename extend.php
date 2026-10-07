<?php

namespace FlatRate\MessagingUi;

use Flarum\Api\Serializer\ForumSerializer;
use Flarum\Extend;
use Flarum\Frontend\Document;
use Flarum\Settings\Event\Saving;
use Flarum\Settings\SettingsRepositoryInterface;
use FlatRate\MessagingUi\Api\ShowForumNotificationUnreadController;
use FlatRate\MessagingUi\MessagingUiServiceProvider;
use FlatRate\MessagingUi\Notifications\CaptureNotificationsRolloutActor;
use FlatRate\MessagingUi\Notifications\NotificationsRollout;
use FlatRate\MessagingUi\Notifications\NotificationsRolloutPolicy;
use FlatRate\MessagingUi\Notifications\RecordNotificationsRolloutChange;
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

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Settings())
        ->default(NotificationsRolloutPolicy::ADMIN_PREVIEW_SETTING, '0')
        ->default(NotificationsRolloutPolicy::MEMBER_BETA_SETTING, '0')
        ->default(NotificationsRolloutPolicy::MEMBER_SETTING, '0'),

    (new Extend\ApiSerializer(ForumSerializer::class))
        ->attribute('flatrateMessagingUiEnabled', function (ForumSerializer $serializer) {
            return true;
        })
        ->attribute(NotificationsRolloutPolicy::FORUM_ATTRIBUTE, function (ForumSerializer $serializer) {
            $settings = resolve(SettingsRepositoryInterface::class);
            $rollout = new NotificationsRollout($settings);

            return $rollout->availableTo($serializer->getActor());
        }),

    (new Extend\Event())
        ->listen(Saving::class, [RecordNotificationsRolloutChange::class, 'handle']),

    (new Extend\Middleware('api'))
        ->add(CaptureNotificationsRolloutActor::class),

    (new Extend\ServiceProvider())
        ->register(MessagingUiServiceProvider::class),

    (new Extend\Routes('api'))
        ->get(
            '/flatrate-messaging/forum-notification-unread',
            'flatrate-messaging.forum-notification-unread',
            ShowForumNotificationUnreadController::class
        ),
];
