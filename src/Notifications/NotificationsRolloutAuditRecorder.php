<?php

namespace FlatRate\MessagingUi\Notifications;

use Psr\Log\LoggerInterface;

/**
 * Separates a refused attempt from an applied gate change.
 *
 * Flarum 1.8.19 SetSettingsController dispatches Saving, then calls
 * settings->set() for each key, then dispatches Saved. Saved is not reached
 * when set() throws. This recorder still reads the stored value back and
 * emits the shared audit record only when that value matches the requested
 * new value. It does not claim a database transaction: Flarum saves each
 * key independently, and a later key can fail after an earlier key was written
 * without Saved running.
 */
final class NotificationsRolloutAuditRecorder
{
    public function __construct(
        private NotificationsRolloutAuditContext $context,
        private LoggerInterface $logger
    ) {
    }

    /**
     * @param array<string, mixed> $stored
     * @param array<string, mixed> $incoming
     */
    public function refuseUnattributed(array $stored, array $incoming): void
    {
        $changes = self::changes($stored, $incoming);
        if ($changes === []) {
            $this->context->remember([]);

            return;
        }
        if ($this->context->actorId() === null) {
            $this->context->remember([]);
            throw new \RuntimeException('notifications_rollout_audit_unattributed');
        }
        $this->context->remember($changes);
    }

    /**
     * @param array<string, mixed> $storedAfter
     * @return list<array<string, mixed>>
     */
    public function recordApplied(array $storedAfter, string $changedAt): array
    {
        $adminId = $this->context->actorId();
        $records = [];
        foreach ($this->context->pullPending() as [$settingKey, $gateKey, $oldValue, $newValue]) {
            $applied = NotificationsRolloutPolicy::isOptInEnabled($storedAfter[$settingKey] ?? null);
            if ($adminId === null || $applied !== $newValue) {
                continue;
            }
            $record = NotificationsRolloutPolicy::auditEvent([
                'feature_key' => NotificationsRolloutPolicy::FEATURE_KEY,
                'gate_key' => $gateKey,
                'old_value' => $oldValue,
                'new_value' => $newValue,
                'changed_by_admin_id' => $adminId,
                'changed_at' => $changedAt,
                'reason' => 'admin settings save applied',
            ]);
            $this->logger->info('forum-notifications rollout gate applied', $record);
            $records[] = $record;
        }

        return $records;
    }

    /**
     * @param array<string, mixed> $stored
     * @param array<string, mixed> $incoming
     * @return list<array{0: string, 1: string, 2: bool, 3: bool}>
     */
    public static function changes(array $stored, array $incoming): array
    {
        $changes = [];
        foreach (NotificationsRolloutPolicy::SETTING_GATE_KEYS as $settingKey => $gateKey) {
            if (!array_key_exists($settingKey, $incoming)) {
                continue;
            }
            $oldValue = NotificationsRolloutPolicy::isOptInEnabled($stored[$settingKey] ?? null);
            $newValue = NotificationsRolloutPolicy::isOptInEnabled($incoming[$settingKey]);
            if ($oldValue === $newValue) {
                continue;
            }
            $changes[] = [$settingKey, $gateKey, $oldValue, $newValue];
        }

        return $changes;
    }
}
