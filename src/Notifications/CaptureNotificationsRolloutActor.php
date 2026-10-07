<?php

namespace FlatRate\MessagingUi\Notifications;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Binds the audit actor to this request and clears any previous one first.
 */
final class CaptureNotificationsRolloutActor implements MiddlewareInterface
{
    public function __construct(private NotificationsRolloutAuditContext $context)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $this->context->beginRequest($this->adminId($request));

        return $handler->handle($request);
    }

    private function adminId(ServerRequestInterface $request): ?string
    {
        $reference = $request->getAttribute('actorReference');
        if (!is_object($reference) || !method_exists($reference, 'getActor')) {
            return null;
        }
        $actor = $reference->getActor();
        $id = is_object($actor) ? (int) ($actor->id ?? 0) : 0;
        if ($id < 1 || !is_object($actor) || !method_exists($actor, 'isAdmin') || $actor->isAdmin() !== true) {
            return null;
        }

        return (string) $id;
    }
}
