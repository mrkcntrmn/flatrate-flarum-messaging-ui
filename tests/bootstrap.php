<?php

$autoload = dirname(__DIR__).'/vendor/autoload.php';
if (file_exists($autoload)) {
    require $autoload;
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'FlatRate\\MessagingUi\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = dirname(__DIR__).'/src/'.$relative.'.php';
    if (is_file($file)) {
        require_once $file;
    }
});
