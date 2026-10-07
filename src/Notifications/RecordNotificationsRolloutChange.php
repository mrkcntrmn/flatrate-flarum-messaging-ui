<?php

namespace FlatRate\MessagingUi\Notifications;

use Flarum\Settings\Event\Saved;
use Flarum\Settings\Event\Saving;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Saving refuses an unattributed gate change before Flarum writes settings.
 * Saved records the change only after a read-back shows the new value stored.
 */
final class RecordNotificationsRolloutChange
{
    public function __construct(
        private SettingsRepositoryInterface $settings,
        private NotificationsRolloutAuditRecorder $recorder
    ) {
    }

    public function handleSaving(Saving $event): void
    {
        $this->recorder->refuseUnattributed(
            $this->snapshot(array_keys($event->settings)),
            $event->settings
        );
    }

    public function handleSaved(Saved $event): void
    {
        $this->recorder->recordApplied(
            $this->snapshot(array_keys($event->settings)),
            gmdate('Y-m-d\TH:i:s\Z')
        );
    }

    /**
     * @param list<mixed> $keys
     * @return array<string, mixed>
     */
    private function snapshot(array $keys): array
    {
        $stored = [];
        foreach ($keys as $key) {
            if (!is_string($key) || !isset(NotificationsRolloutPolicy::SETTING_GATE_KEYS[$key])) {
                continue;
            }
            $stored[$key] = $this->settings->get($key);
        }

        return $stored;
    }
}
