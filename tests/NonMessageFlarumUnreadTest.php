<?php

namespace FlatRate\MessagingUi\Tests;

use FlatRate\MessagingUi\Notifications\NonMessageFlarumUnread;
use PHPUnit\Framework\TestCase;

class NonMessageFlarumUnreadTest extends TestCase
{
    public function testExcludesDirectAlertTypeOnly(): void
    {
        $types = NonMessageFlarumUnread::alertableTypesExcludingDirect([
            'postLiked',
            'newPrivateMessage',
            'discussionRenamed',
            'newPrivateMessage',
            '',
            null,
            12,
        ]);

        $this->assertSame(['postLiked', 'discussionRenamed'], $types);
    }

    public function testEmptyAlertableTypesStayEmpty(): void
    {
        $this->assertSame([], NonMessageFlarumUnread::alertableTypesExcludingDirect(['newPrivateMessage']));
    }

    public function testCounterUsesFlarumUnreadScopeWithoutMessagePayload(): void
    {
        $counter = file_get_contents(dirname(__DIR__).'/src/Notifications/NonMessageFlarumUnreadCounter.php');
        $controller = file_get_contents(dirname(__DIR__).'/src/Api/ShowForumNotificationUnreadController.php');

        $this->assertStringContainsString('getAlertableNotificationTypes()', $counter);
        $this->assertStringContainsString("whereNull('read_at')", $counter);
        $this->assertStringContainsString("where('is_deleted', false)", $counter);
        $this->assertStringContainsString('whereSubjectVisibleTo($actor)', $counter);
        $this->assertStringContainsString('alertableTypesExcludingDirect', $counter);
        $this->assertStringNotContainsString('preview', $counter);
        $this->assertStringNotContainsString('transcript', $counter);

        $this->assertStringContainsString('assertRegistered()', $controller);
        $this->assertStringContainsString('nonMessageFlarumUnread', $controller);
        $this->assertStringNotContainsString("'body'", $controller);
        $this->assertStringNotContainsString("'preview'", $controller);
        $this->assertStringNotContainsString('lastMessage', $controller);
    }
}
