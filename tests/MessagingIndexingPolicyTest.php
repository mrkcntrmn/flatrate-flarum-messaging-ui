<?php

namespace FlatRate\MessagingUi\Tests;

use FlatRate\MessagingUi\Seo\MessagingIndexingPolicy;
use PHPUnit\Framework\TestCase;

class MessagingIndexingPolicyTest extends TestCase
{
    /**
     * @dataProvider messagesPaths
     */
    public function testMessagesSurfacesAreNoIndexed(string $path): void
    {
        $this->assertTrue(MessagingIndexingPolicy::shouldNoIndexPath($path), $path);
    }

    /**
     * @dataProvider ordinaryForumPaths
     */
    public function testOrdinaryForumPathsAreNotNoIndexed(string $path): void
    {
        $this->assertFalse(MessagingIndexingPolicy::shouldNoIndexPath($path), $path);
    }

    public function testExtendPhpScopesNoindexToMessagesRoutesOnly(): void
    {
        $src = file_get_contents(dirname(__DIR__).'/extend.php');

        $this->assertStringContainsString("->route('/messages', 'flatrate-messaging.index')", $src);
        $this->assertStringContainsString("->route('/messages/live/{roomKey}', 'flatrate-messaging.live')", $src);
        $this->assertStringContainsString("->route('/messages/direct/{conversationId}', 'flatrate-messaging.direct')", $src);
        $this->assertStringContainsString('MessagingIndexingPolicy::shouldNoIndexPath', $src);
        $this->assertStringContainsString('$request->getUri()->getPath()', $src);
        $this->assertStringContainsString('<meta name="robots" content="noindex, nofollow">', $src);
        $this->assertStringContainsString('flatrateMessagingUiEnabled', $src);
    }

    public static function messagesPaths(): array
    {
        return [
            'messages root' => ['/messages'],
            'messages trailing slash' => ['/messages/'],
            'live room' => ['/messages/live/x'],
            'direct conversation' => ['/messages/direct/1'],
        ];
    }

    public static function ordinaryForumPaths(): array
    {
        return [
            'home' => ['/'],
            'discussion' => ['/d/5-foo'],
            'tag' => ['/t/gm'],
            'profile' => ['/u/tech_x'],
            'false prefix messaging' => ['/messaging'],
        ];
    }
}
