<?php

namespace FlatRate\MessagingUi\Tests;

use PHPUnit\Framework\TestCase;

class F2EntryContractTest extends TestCase
{
    public function testExtendPhpSwitchesToExtendF2WhenAbstractShowControllerMissing(): void
    {
        $extend = (string) file_get_contents(dirname(__DIR__).'/extend.php');

        $this->assertStringContainsString('AbstractShowController::class', $extend);
        $this->assertStringContainsString("return require __DIR__.'/extend-f2.php';", $extend);
        $this->assertMatchesRegularExpression(
            '/if\s*\(\s*!class_exists\(\s*\\\\Flarum\\\\Api\\\\Controller\\\\AbstractShowController::class\s*\)\s*\)/',
            $extend
        );
    }

    public function testExtendF2RegistersShellRoutesAndDistAssets(): void
    {
        $f2 = (string) file_get_contents(dirname(__DIR__).'/extend-f2.php');

        $this->assertStringContainsString("->js(__DIR__.'/js/dist/forum.js')", $f2);
        $this->assertStringContainsString("->js(__DIR__.'/js/dist/admin.js')", $f2);
        $this->assertStringContainsString("->css(__DIR__.'/resources/less/forum.less')", $f2);
        $this->assertStringContainsString("->route('/messages', 'flatrate-messaging.index')", $f2);
        $this->assertStringContainsString("->route('/messages/live/{roomKey}', 'flatrate-messaging.live')", $f2);
        $this->assertStringContainsString("->route('/messages/direct/{conversationId}', 'flatrate-messaging.direct')", $f2);
        $this->assertStringContainsString('new Extend\\Locales(__DIR__.\'/locale\')', $f2);
        $this->assertStringContainsString('MessagingIndexingPolicy::shouldNoIndexPath', $f2);
        $this->assertStringContainsString('noindex, nofollow', $f2);
        $this->assertStringContainsString('flatrateMessagingUiEnabled', $f2);
        $this->assertStringContainsString('MessagingUiServiceProvider::class', $f2);
    }

    public function testExtendF2AvoidsRemovedF1SerializerApisAndSecondStorage(): void
    {
        $f2 = (string) file_get_contents(dirname(__DIR__).'/extend-f2.php');

        $this->assertStringNotContainsString('ApiSerializer', $f2);
        $this->assertStringNotContainsString('ForumSerializer', $f2);
        $this->assertStringNotContainsString('Tobscure', $f2);
        $this->assertStringNotContainsString('AbstractShowController', $f2);
        $this->assertStringNotContainsString('CaptureNotificationsRolloutActor', $f2);
        $this->assertStringNotContainsString('ShowForumNotificationUnreadController', $f2);
        $this->assertStringNotContainsString('neoncube-private-messages', $f2);
        $this->assertStringNotContainsString('/chatmessages', $f2);
        $this->assertStringNotContainsString('UNIFIED_STORAGE=true', $f2);
    }
}
