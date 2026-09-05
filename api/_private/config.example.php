<?php
declare(strict_types=1);

/*
 * Copy this file to config.local.php and replace every placeholder.
 * config.local.php is ignored by Git and denied by api/_private/.htaccess.
 * On InfinityFree, DB_HOST must be the SQL hostname from the control panel,
 * not "localhost".
 */
return [
    'db' => [
        'host' => 'sql000.infinityfree.com',
        'port' => 3306,
        'name' => 'if0_00000000_itemsouq',
        'user' => 'if0_00000000',
        'password' => 'replace-with-hosting-account-password',
    ],
    // Generate with: php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'app_secret' => 'replace-with-at-least-32-random-characters',
    'setup_token' => 'replace-with-a-different-long-random-token',
    'origin' => 'https://example.com',
    'session_name' => 'itemsouq_owner',
];

