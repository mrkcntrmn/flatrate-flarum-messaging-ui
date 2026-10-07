<?php

namespace FlatRate\MessagingUi\Notifications;

/**
 * Administrator id for one API request.
 *
 * beginRequest() always clears the previous actor and any remembered gate
 * change. The API middleware calls it at the start of every request, so a
 * later request cannot inherit an earlier administrator.
 */
final class NotificationsRolloutAuditContext
{
    private ?string $actorId = null;

    /**
     * @var list<array{0: string, 1: string, 2: bool, 3: bool}>
     */
    private array $pending = [];

    public function beginRequest(?string $actorId): void
    {
        $this->actorId = null;
        $this->pending = [];
        if (is_string($actorId) && preg_match('/^[A-Za-z0-9_.:-]{1,128}$/', $actorId)) {
            $this->actorId = $actorId;
        }
    }

    public function actorId(): ?string
    {
        return $this->actorId;
    }

    /**
     * @param list<array{0: string, 1: string, 2: bool, 3: bool}> $changes
     */
    public function remember(array $changes): void
    {
        $this->pending = $changes;
    }

    /**
     * @return list<array{0: string, 1: string, 2: bool, 3: bool}>
     */
    public function pullPending(): array
    {
        $pending = $this->pending;
        $this->pending = [];

        return $pending;
    }
}
