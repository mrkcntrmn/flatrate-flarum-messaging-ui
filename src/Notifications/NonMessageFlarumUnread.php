<?php

namespace FlatRate\MessagingUi\Notifications;

/**
 * Count-only exclusion of the Direct bridge's Flarum alert type.
 *
 * Flarum 1.8.19 User::getUnreadNotificationCount() counts every alertable
 * notification row, including newPrivateMessage. Direct unread is a separate
 * users.unread_messages counter. Adding those two totals double-counts one
 * incoming Direct message. This helper is the type filter for the Flarum-owned
 * count; it does not store a second read cursor.
 */
final class NonMessageFlarumUnread
{
    public const EXCLUDED_TYPE = 'newPrivateMessage';

    /**
     * @param array<int, mixed> $alertableTypes
     * @return list<string>
     */
    public static function alertableTypesExcludingDirect(array $alertableTypes): array
    {
        $types = [];
        foreach ($alertableTypes as $type) {
            if (!is_string($type) || $type === '' || $type === self::EXCLUDED_TYPE) {
                continue;
            }
            $types[] = $type;
        }

        return array_values(array_unique($types));
    }
}
