<?php

namespace FlatRate\MessagingUi\Notifications;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Records the authenticated administrator for a later settings save.
 * Ordinary members and guests are not stored. This does not read rollout
 * settings and does not touch notification state.
 */
final class CaptureNotificationsRolloutActor implements MiddlewareInterface
{
    public function __construct(private NotificationsRolloutAuditContext $context)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $reference = $request->getAttribute('actorReference');
        if (is_object($reference) && method_exists($reference, 'getActor')) {
            $actor = $reference->getActor();
            $id = is_object($actor) ? (int) ($actor->id ?? 0) : 0;
            if ($id >= 1 && is_object($actor) && method_exists($actor, 'isAdmin') && $actor->isAdmin() === true) {
                $this->context->setActorId((string) $id);
            }
        }

        return $handler->handle($request);
    }
}
