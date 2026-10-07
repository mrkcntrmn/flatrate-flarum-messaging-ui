<?php

namespace FlatRate\MessagingUi\Api;

use FlatRate\MessagingUi\Notifications\NonMessageFlarumUnreadCounter;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Count-only adapter. Attributes are a single integer. No notification rows,
 * message bodies, or read-state copy.
 */
final class ShowForumNotificationUnreadController implements RequestHandlerInterface
{
    public function __construct(private NonMessageFlarumUnreadCounter $counter)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        return new JsonResponse([
            'data' => [
                'type' => 'forum-notification-unread',
                'id' => 'self',
                'attributes' => [
                    'nonMessageFlarumUnread' => $this->counter->count($actor),
                ],
            ],
        ]);
    }
}
