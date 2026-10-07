<?php

namespace FlatRate\MessagingUi\Tests;

use FlatRate\MessagingUi\Notifications\NotificationsRolloutPolicy;
use PHPUnit\Framework\TestCase;

class NotificationsRolloutPolicyTest extends TestCase
{
    public function testAbsentAndMalformedValuesStayOff(): void
    {
        foreach ([null, '', '0', 0, false, 'false', 'yes', 'on', 2, '2', []] as $raw) {
            $this->assertFalse(NotificationsRolloutPolicy::isOptInEnabled($raw), var_export($raw, true));
        }
        $this->assertTrue(NotificationsRolloutPolicy::isOptInEnabled(1));
        $this->assertTrue(NotificationsRolloutPolicy::isOptInEnabled('1'));
        $this->assertTrue(NotificationsRolloutPolicy::isOptInEnabled(true));
        $this->assertTrue(NotificationsRolloutPolicy::isOptInEnabled('true'));
    }

    public function testAllOffDeniesEveryAudience(): void
    {
        foreach ([
            [true, true],
            [true, false],
            [false, true],
            [false, false],
        ] as [$authenticated, $isAdmin]) {
            $this->assertFalse($this->allows($authenticated, $isAdmin, false, false, true, false));
        }
        $this->assertFalse($this->allows(false, false, true, true, true, true));
    }

    public function testAdminPreviewDoesNotEnableBetaOrUsers(): void
    {
        $this->assertTrue($this->allows(true, true, false, false, false, true));
        $this->assertFalse($this->allows(true, false, false, false, true, true));
        $this->assertFalse($this->allows(true, false, false, false, false, true));
        $this->assertFalse($this->allows(false, true, false, false, false, true));
    }

    public function testBetaRequiresActiveApprovalAndDoesNotEnableUsers(): void
    {
        $this->assertTrue($this->allows(true, false, false, true, true, false));
        $this->assertFalse($this->allows(true, false, false, true, false, false));
        $this->assertFalse($this->allows(true, true, false, true, false, false));
        $this->assertFalse($this->allows(false, false, false, true, true, false));
    }

    public function testUsersOnShowsAuthenticatedMembersAndStillHidesGuests(): void
    {
        $this->assertTrue($this->allows(true, false, true, false, false, false));
        $this->assertTrue($this->allows(true, true, true, false, false, false));
        $this->assertFalse($this->allows(false, false, true, false, false, false));
    }

    public function testAuditRecordUsesOnlyTheSharedFields(): void
    {
        $record = NotificationsRolloutPolicy::auditEvent([
            'feature_key' => 'forum-notifications',
            'gate_key' => 'ADMIN_PREVIEW_ENABLED',
            'old_value' => false,
            'new_value' => true,
            'changed_by_admin_id' => '42',
            'changed_at' => '2026-10-07T20:00:00Z',
            'reason' => 'admin settings save',
        ]);

        $this->assertSame([
            'feature_key',
            'gate_key',
            'old_value',
            'new_value',
            'changed_by_admin_id',
            'changed_at',
            'reason',
        ], array_keys($record));
        $this->assertSame('adminPreviewEnabled', $record['gate_key']);
    }

    public function testAuditRejectsThePublicGateAndSecretFields(): void
    {
        try {
            NotificationsRolloutPolicy::auditEvent([
                'feature_key' => 'forum-notifications',
                'gate_key' => 'publicEnabled',
                'old_value' => false,
                'new_value' => true,
                'changed_by_admin_id' => '42',
                'changed_at' => '2026-10-07T20:00:00Z',
                'reason' => 'admin settings save',
            ]);
            $this->fail('public gate must not be an audit gate');
        } catch (\InvalidArgumentException $e) {
            $this->assertSame('audit_gate_key_invalid', $e->getMessage());
        }

        try {
            NotificationsRolloutPolicy::auditEvent([
                'feature_key' => 'forum-notifications',
                'gate_key' => 'memberEnabled',
                'old_value' => false,
                'new_value' => true,
                'changed_by_admin_id' => '42',
                'changed_at' => '2026-10-07T20:00:00Z',
                'reason' => 'admin settings save',
                'api_key' => 'nope',
            ]);
            $this->fail('secret fields must not be auditable');
        } catch (\InvalidArgumentException $e) {
            $this->assertSame('audit_secret_forbidden', $e->getMessage());
        }
    }

    public function testGateOffDoesNotTouchUnreadState(): void
    {
        $files = [
            dirname(__DIR__).'/src/Notifications/NotificationsRolloutPolicy.php',
            dirname(__DIR__).'/src/Notifications/NotificationsRollout.php',
            dirname(__DIR__).'/src/Notifications/RecordNotificationsRolloutChange.php',
            dirname(__DIR__).'/src/Notifications/CaptureNotificationsRolloutActor.php',
            dirname(__DIR__).'/src/Api/ShowForumNotificationUnreadController.php',
        ];
        $combined = '';
        foreach ($files as $file) {
            $combined .= file_get_contents($file);
        }

        $this->assertStringNotContainsString('unread_messages', $combined);
        $this->assertStringNotContainsString('markNotificationsAsRead', $combined);
        $this->assertStringNotContainsString('markAsRead', $combined);
        $this->assertStringNotContainsString('unreaded', $combined);
        $this->assertStringNotContainsString('flatrate_beta_tester_access', $combined);
        $this->assertStringNotContainsString('is_beta_tester', $combined);

        $controller = file_get_contents(dirname(__DIR__).'/src/Api/ShowForumNotificationUnreadController.php');
        $denied = strpos($controller, 'availableTo($actor)');
        $counted = strpos($controller, 'counter->count($actor)');
        $this->assertNotFalse($denied);
        $this->assertNotFalse($counted);
        $this->assertLessThan($counted, $denied);

        $extend = file_get_contents(dirname(__DIR__).'/extend.php');
        $this->assertSame('flatrate-messaging-ui.notifications_available', NotificationsRolloutPolicy::FORUM_ATTRIBUTE);
        $this->assertStringContainsString('->attribute(NotificationsRolloutPolicy::FORUM_ATTRIBUTE,', $extend);
        $this->assertStringNotContainsString('serializeToForum', $extend);
        $this->assertStringContainsString("->default(NotificationsRolloutPolicy::ADMIN_PREVIEW_SETTING, '0')", $extend);
        $this->assertStringContainsString("->default(NotificationsRolloutPolicy::MEMBER_BETA_SETTING, '0')", $extend);
        $this->assertStringContainsString("->default(NotificationsRolloutPolicy::MEMBER_SETTING, '0')", $extend);
        $this->assertStringContainsString('BetaTesterProjection', file_get_contents(dirname(__DIR__).'/src/Notifications/NotificationsRollout.php'));
    }

    private function allows(
        bool $authenticated,
        bool $isAdmin,
        bool $memberEnabled,
        bool $memberBetaEnabled,
        bool $betaActive,
        bool $adminPreviewEnabled
    ): bool {
        return NotificationsRolloutPolicy::allows(
            $authenticated,
            $isAdmin,
            $memberEnabled,
            $memberBetaEnabled,
            $betaActive,
            $adminPreviewEnabled
        );
    }
}
