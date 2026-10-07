<?php

namespace FlatRate\MessagingUi\Notifications;

use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

/**
 * Server-side actor-effective Notifications availability.
 *
 * Beta eligibility is only BetaTesterProjection::isActive(). A missing binding,
 * a thrown isActive(), and a non-true result all fail closed. This class does
 * not read the projection table and does not write notification, Direct, or
 * Live unread state.
 */
final class NotificationsRollout
{
    public const PROJECTION_CLASS = 'FlatRate\\SupabaseOAuth\\Beta\\BetaTesterProjection';

    /**
     * @param object|null $projection explicit cohort service; null with $projectionProvided resolves softly
     * @param callable|null $resolver replaces container resolution when the projection was not provided
     */
    public function __construct(
        private ?SettingsRepositoryInterface $settings = null,
        private ?object $projection = null,
        private bool $projectionProvided = false,
        private $resolver = null
    ) {
    }

    public function adminPreviewEnabled(): bool
    {
        return NotificationsRolloutPolicy::isOptInEnabled($this->raw(NotificationsRolloutPolicy::ADMIN_PREVIEW_SETTING));
    }

    public function memberBetaEnabled(): bool
    {
        return NotificationsRolloutPolicy::isOptInEnabled($this->raw(NotificationsRolloutPolicy::MEMBER_BETA_SETTING));
    }

    public function memberEnabled(): bool
    {
        return NotificationsRolloutPolicy::isOptInEnabled($this->raw(NotificationsRolloutPolicy::MEMBER_SETTING));
    }

    public function availableTo(User $actor): bool
    {
        $authenticated = $actor->id !== null && (int) $actor->id >= 1;
        $betaActive = false;
        if ($authenticated && $this->memberBetaEnabled()) {
            $betaActive = $this->isApproved($actor);
        }

        return NotificationsRolloutPolicy::allows(
            $authenticated,
            $actor->isAdmin() === true,
            $this->memberEnabled(),
            $this->memberBetaEnabled(),
            $betaActive,
            $this->adminPreviewEnabled()
        );
    }

    public function isApproved(User $actor): bool
    {
        if ($actor->id === null || (int) $actor->id < 1) {
            return false;
        }
        $projection = $this->resolveProjection();
        if (!is_object($projection) || !method_exists($projection, 'isActive')) {
            return false;
        }
        try {
            return $projection->isActive($actor) === true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * @param mixed $default
     * @return mixed
     */
    private function raw(string $key, $default = null)
    {
        if ($this->settings !== null) {
            return $this->settings->get($key, $default);
        }
        if (function_exists('resolve')) {
            try {
                return resolve(SettingsRepositoryInterface::class)->get($key, $default);
            } catch (\Throwable $e) {
                return $default;
            }
        }

        return $default;
    }

    private function resolveProjection(): ?object
    {
        if ($this->projectionProvided) {
            return $this->projection;
        }
        try {
            if ($this->resolver !== null) {
                $resolved = ($this->resolver)();
            } else {
                $resolved = $this->resolveFromContainer();
            }
        } catch (\Throwable $e) {
            return null;
        }

        return is_object($resolved) ? $resolved : null;
    }

    /**
     * @return object|null
     */
    private function resolveFromContainer()
    {
        if (!interface_exists(self::PROJECTION_CLASS) && !class_exists(self::PROJECTION_CLASS)) {
            return null;
        }
        if (!function_exists('resolve')) {
            return null;
        }
        $resolved = resolve(self::PROJECTION_CLASS);

        return is_object($resolved) ? $resolved : null;
    }
}
