<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/bootstrap.php';

isq_method('POST');
isq_require_same_origin();
header('Cache-Control: no-store');
$input = isq_input();
isq_require_admin();
isq_require_csrf($input);

isq_start_session();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => 'Strict',
    ]);
}
session_destroy();
isq_ok(['authenticated' => false]);

