<?php

namespace FlatRate\MessagingUi\Seo;

final class MessagingIndexingPolicy
{
    /**
     * Messages surfaces stay noindex. Ordinary forum routes must not inherit that directive.
     */
    public static function shouldNoIndexPath(string $path): bool
    {
        $normalized = self::normalizePath($path);

        return $normalized === '/messages'
            || str_starts_with($normalized, '/messages/');
    }

    public static function normalizePath(string $path): string
    {
        if ($path === '') {
            return '/';
        }

        if ($path[0] !== '/') {
            $path = '/'.$path;
        }

        if ($path !== '/' && str_ends_with($path, '/')) {
            $path = rtrim($path, '/');
        }

        return $path === '' ? '/' : $path;
    }
}
