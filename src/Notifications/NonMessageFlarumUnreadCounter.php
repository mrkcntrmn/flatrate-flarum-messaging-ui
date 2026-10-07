<?php

namespace FlatRate\MessagingUi\Notifications;

use Flarum\User\User;

/**
 * Same row scope as Flarum 1.8.19 User::unreadNotifications(), minus
 * newPrivateMessage. unreadNotifications() is protected, so the clauses are
 * repeated here against the public notifications() relation.
 *
 * Clauses that must stay aligned with User::unreadNotifications():
 * - whereIn type = alertable types
 * - whereNull read_at
 * - where is_deleted = false
 * - whereSubjectVisibleTo(actor)
 */
final class NonMessageFlarumUnreadCounter
{
    public function count(User $actor): int
    {
        $types = NonMessageFlarumUnread::alertableTypesExcludingDirect(
            $actor->getAlertableNotificationTypes()
        );

        if ($types === []) {
            return 0;
        }

        return (int) $actor->notifications()
            ->whereIn('type', $types)
            ->whereNull('read_at')
            ->where('is_deleted', false)
            ->whereSubjectVisibleTo($actor)
            ->count();
    }
}
