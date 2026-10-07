<?php

namespace FlatRate\MessagingUi\Notifications;

/**
 * Pure Notifications audience gates.
 *
 * Three independent default-off controls. Admin Preview does not enable Beta
 * Testers or Users. Beta Testers does not enable Users. Public is not a gate:
 * guests are never eligible. This class does not read or write notification,
 * Direct, or Live state.
 */
final class NotificationsRolloutPolicy
{
    public const ADMIN_PREVIEW_SETTING = 'flatrate-messaging-ui.notifications_admin_preview_enabled';

    public const MEMBER_BETA_SETTING = 'flatrate-messaging-ui.notifications_member_beta_enabled';

    public const MEMBER_SETTING = 'flatrate-messaging-ui.notifications_member_enabled';

    public const FORUM_ATTRIBUTE = 'flatrate-messaging-ui.notifications_available';

    public const FEATURE_KEY = 'forum-notifications';

    public const GATE_ADMIN_PREVIEW = 'adminPreviewEnabled';

    public const GATE_MEMBER_BETA = 'memberBetaEnabled';

    public const GATE_MEMBER = 'memberEnabled';

    /**
     * @var array<string, string>
     */
    public const SETTING_GATE_KEYS = [
        self::ADMIN_PREVIEW_SETTING => self::GATE_ADMIN_PREVIEW,
        self::MEMBER_BETA_SETTING => self::GATE_MEMBER_BETA,
        self::MEMBER_SETTING => self::GATE_MEMBER,
    ];

    /**
     * @param mixed $raw
     */
    public static function isOptInEnabled($raw): bool
    {
        return $raw === 1 || $raw === '1' || $raw === true || $raw === 'true';
    }

    public static function allows(
        bool $authenticated,
        bool $isAdmin,
        bool $memberEnabled,
        bool $memberBetaEnabled,
        bool $betaActive,
        bool $adminPreviewEnabled
    ): bool {
        if (!$authenticated) {
            return false;
        }
        if ($memberEnabled) {
            return true;
        }
        if ($memberBetaEnabled && $betaActive) {
            return true;
        }
        if ($adminPreviewEnabled && $isAdmin) {
            return true;
        }

        return false;
    }

    /**
     * @param array<string, mixed> $input
     * @return array{
     *   feature_key: string,
     *   gate_key: string,
     *   old_value: bool,
     *   new_value: bool,
     *   changed_by_admin_id: string,
     *   changed_at: string,
     *   reason: string
     * }
     */
    public static function auditEvent(array $input): array
    {
        foreach (array_keys($input) as $key) {
            if (self::isSecretKey((string) $key)) {
                throw new \InvalidArgumentException('audit_secret_forbidden');
            }
        }

        $featureKey = self::requireString($input['feature_key'] ?? null, 'audit_feature_key_invalid');
        if (!preg_match('/^[a-z][a-z0-9_-]{0,63}$/', $featureKey)) {
            throw new \InvalidArgumentException('audit_feature_key_invalid');
        }

        $gateKey = self::canonicalGateKey($input['gate_key'] ?? null);
        $oldValue = $input['old_value'] ?? null;
        $newValue = $input['new_value'] ?? null;
        if (!is_bool($oldValue) || !is_bool($newValue)) {
            throw new \InvalidArgumentException('audit_value_invalid');
        }

        $adminId = self::requireString($input['changed_by_admin_id'] ?? null, 'audit_admin_id_invalid');
        if (!preg_match('/^[A-Za-z0-9_.:-]{1,128}$/', $adminId)) {
            throw new \InvalidArgumentException('audit_admin_id_invalid');
        }

        $changedAt = self::requireString($input['changed_at'] ?? null, 'audit_changed_at_invalid');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/', $changedAt)) {
            throw new \InvalidArgumentException('audit_changed_at_invalid');
        }

        $reason = self::requireString($input['reason'] ?? null, 'audit_reason_invalid');
        if (strlen($reason) > 280 || self::looksLikeSecret($reason) || self::looksLikeSecret($adminId)) {
            throw new \InvalidArgumentException('audit_reason_invalid');
        }

        return [
            'feature_key' => $featureKey,
            'gate_key' => $gateKey,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'changed_by_admin_id' => $adminId,
            'changed_at' => $changedAt,
            'reason' => $reason,
        ];
    }

    private static function canonicalGateKey($value): string
    {
        $aliases = [
            self::GATE_ADMIN_PREVIEW => self::GATE_ADMIN_PREVIEW,
            'ADMIN_PREVIEW_ENABLED' => self::GATE_ADMIN_PREVIEW,
            self::GATE_MEMBER_BETA => self::GATE_MEMBER_BETA,
            'MEMBER_BETA_ENABLED' => self::GATE_MEMBER_BETA,
            self::GATE_MEMBER => self::GATE_MEMBER,
            'MEMBER_ENABLED' => self::GATE_MEMBER,
        ];
        if (!is_string($value) || !isset($aliases[$value])) {
            throw new \InvalidArgumentException('audit_gate_key_invalid');
        }

        return $aliases[$value];
    }

    /**
     * @param mixed $value
     */
    private static function requireString($value, string $code): string
    {
        if (!is_string($value) || $value === '' || trim($value) !== $value) {
            throw new \InvalidArgumentException($code);
        }
        if (self::looksLikeSecret($value)) {
            throw new \InvalidArgumentException('audit_secret_forbidden');
        }

        return $value;
    }

    private static function isSecretKey(string $key): bool
    {
        return preg_match('/(?:^|_)(?:password|token|secret|authorization|cookie|session|service_role|api_key|apikey)(?:_|$)/i', $key) === 1;
    }

    private static function looksLikeSecret(string $value): bool
    {
        return preg_match('/(?:bearer\s+|service_role|eyJ[A-Za-z0-9_-]{8,}\.)/i', $value) === 1;
    }
}
