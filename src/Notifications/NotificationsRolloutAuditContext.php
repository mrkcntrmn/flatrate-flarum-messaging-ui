<?php

namespace FlatRate\MessagingUi\Notifications;

/**
 * Request-scoped administrator id for a Notifications gate change.
 * Registered as a container singleton so the API middleware and the settings
 * listener share one actor.
 */
final class NotificationsRolloutAuditContext
{
    private ?string $actorId = null;

    public function setActorId(string $actorId): void
    {
        $this->actorId = $actorId;
    }

    public function actorId(): ?string
    {
        return $this->actorId;
    }
}
