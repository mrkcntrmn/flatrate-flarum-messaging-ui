<?php

namespace FlatRate\MessagingUi\Tests;

use FlatRate\MessagingUi\Notifications\NotificationsRolloutAuditContext;
use FlatRate\MessagingUi\Notifications\NotificationsRolloutAuditRecorder;
use FlatRate\MessagingUi\Notifications\NotificationsRolloutPolicy;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;

class NotificationsRolloutAuditTest extends TestCase
{
    public function testRequestActorDoesNotLeakAcrossRequests(): void
    {
        $context = new NotificationsRolloutAuditContext();
        $context->beginRequest('7');
        $this->assertSame('7', $context->actorId());

        $context->beginRequest(null);
        $this->assertNull($context->actorId());

        $context->beginRequest('9');
        $this->assertSame('9', $context->actorId());
        $context->remember([[
            NotificationsRolloutPolicy::ADMIN_PREVIEW_SETTING,
            NotificationsRolloutPolicy::GATE_ADMIN_PREVIEW,
            false,
            true,
        ]]);
        $context->beginRequest('9');
        $this->assertSame([], $context->pullPending());
    }

    public function testFailedSaveDoesNotRecordAnAppliedChange(): void
    {
        $key = NotificationsRolloutPolicy::MEMBER_SETTING;
        $context = new NotificationsRolloutAuditContext();
        $context->beginRequest('4');
        $logger = new RecordingLogger();
        $recorder = new NotificationsRolloutAuditRecorder($context, $logger);

        $recorder->refuseUnattributed(
            [$key => '0'],
            [$key => '1']
        );
        $records = $recorder->recordApplied([$key => '0'], '2026-10-07T23:00:00Z');

        $this->assertSame([], $records);
        $this->assertSame([], $logger->records);
        $this->assertFalse(NotificationsRolloutPolicy::isOptInEnabled('0'));
    }

    public function testAppliedSaveRecordsOnlyTheStoredValue(): void
    {
        $key = NotificationsRolloutPolicy::ADMIN_PREVIEW_SETTING;
        $context = new NotificationsRolloutAuditContext();
        $context->beginRequest('4');
        $logger = new RecordingLogger();
        $recorder = new NotificationsRolloutAuditRecorder($context, $logger);

        $recorder->refuseUnattributed([$key => '0'], [$key => '1']);
        $records = $recorder->recordApplied([$key => '1'], '2026-10-07T23:00:00Z');

        $this->assertCount(1, $records);
        $this->assertSame('adminPreviewEnabled', $records[0]['gate_key']);
        $this->assertFalse($records[0]['old_value']);
        $this->assertTrue($records[0]['new_value']);
        $this->assertSame('admin settings save applied', $records[0]['reason']);
        $this->assertSame('4', $records[0]['changed_by_admin_id']);
    }

    public function testUnattributedChangeIsRefusedAndDoesNotStayPending(): void
    {
        $key = NotificationsRolloutPolicy::MEMBER_BETA_SETTING;
        $context = new NotificationsRolloutAuditContext();
        $context->beginRequest(null);
        $recorder = new NotificationsRolloutAuditRecorder($context, new RecordingLogger());

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('notifications_rollout_audit_unattributed');
        try {
            $recorder->refuseUnattributed([$key => '0'], [$key => '1']);
        } finally {
            $this->assertSame([], $context->pullPending());
        }
    }

    public function testAppliedLogIsNotEmittedFromThePreSaveListener(): void
    {
        $listener = file_get_contents(dirname(__DIR__).'/src/Notifications/RecordNotificationsRolloutChange.php');
        $middleware = file_get_contents(dirname(__DIR__).'/src/Notifications/CaptureNotificationsRolloutActor.php');
        $extend = file_get_contents(dirname(__DIR__).'/extend.php');

        $this->assertStringNotContainsString('->info(', $listener);
        $this->assertStringContainsString('handleSaving', $listener);
        $this->assertStringContainsString('handleSaved', $listener);
        $this->assertStringContainsString('beginRequest', $middleware);
        $this->assertStringContainsString("listen(Saving::class, [RecordNotificationsRolloutChange::class, 'handleSaving'])", $extend);
        $this->assertStringContainsString("listen(Saved::class, [RecordNotificationsRolloutChange::class, 'handleSaved'])", $extend);
    }
}

class RecordingLogger extends AbstractLogger
{
    public array $records = [];

    public function log($level, $message, array $context = []): void
    {
        $this->records[] = ['level' => $level, 'message' => $message, 'context' => $context];
    }
}
