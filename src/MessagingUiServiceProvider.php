<?php

namespace FlatRate\MessagingUi;

use Flarum\Foundation\AbstractServiceProvider;
use FlatRate\MessagingUi\Notifications\NotificationsRolloutAuditContext;

class MessagingUiServiceProvider extends AbstractServiceProvider
{
    public function register()
    {
        $this->container->singleton(NotificationsRolloutAuditContext::class);
    }
}
