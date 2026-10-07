<?php

namespace FlatRate\MessagingUi\Notifications;

use Flarum\Settings\Event\Saving;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Log\LoggerInterface;

/**
 * Audits an independent Notifications gate change before Flarum persists it.
 * The log record is the shared rollout audit shape. No notification, Direct,
 * or Live row is written.
 */
final class RecordNotificationsRolloutChange
{
    public function __construct(
        private SettingsRepositoryInterface $settings,
        private NotificationsRolloutAuditContext $context,
        private LoggerInterface $logger
    ) {
    }

    public function handle(Saving $event): void
    {
        $changes = [];
        foreach (NotificationsRolloutPolicy::SETTING_GATE_KEYS as $settingKey => $gateKey) {
            if (!array_key_exists($settingKey, $event->settings)) {
                continue;
            }
            $oldValue = NotificationsRolloutPolicy::isOptInEnabled($this->settings->get($settingKey));
            $newValue = NotificationsRolloutPolicy::isOptInEnabled($event->settings[$settingKey]);
            if ($oldValue === $newValue) {
                continue;
            }
            $changes[] = [$gateKey, $oldValue, $newValue];
        }

        if ($changes === []) {
            return;
        }

        $adminId = $this->context->actorId();
        if ($adminId === null) {
            throw new \RuntimeException('notifications_rollout_audit_unattributed');
        }

        $changedAt = gmdate('Y-m-d\TH:i:s\Z');
        foreach ($changes as [$gateKey, $oldValue, $newValue]) {
            $record = NotificationsRolloutPolicy::auditEvent([
                'feature_key' => NotificationsRolloutPolicy::FEATURE_KEY,
                'gate_key' => $gateKey,
                'old_value' => $oldValue,
                'new_value' => $newValue,
                'changed_by_admin_id' => $adminId,
                'changed_at' => $changedAt,
                'reason' => 'admin settings save',
            ]);
            $this->logger->info('forum-notifications rollout gate changed', $record);
        }
    }
}
