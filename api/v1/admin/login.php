<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/bootstrap.php';

isq_method('POST');
isq_require_same_origin();
header('Cache-Control: no-store');
$input = isq_input();
$username = is_string($input['username'] ?? null) ? trim($input['username']) : '';
$password = is_string($input['password'] ?? null) ? $input['password'] : '';

isq_rate_limit('owner.login.ip', 5, 900);
isq_rate_limit('owner.login.username', 8, 3600, strtolower($username));

$statement = isq_db()->prepare(
    'SELECT id, username, password_hash FROM isq_owner_users WHERE username = ? AND is_active = 1 LIMIT 1'
);
$statement->execute([$username]);
$owner = $statement->fetch();
if (!$owner || !password_verify($password, (string) $owner['password_hash'])) {
    usleep(random_int(150000, 350000));
    isq_fail('LOGIN_FAILED', 'The username or password is incorrect.', 401);
}

if (password_needs_rehash((string) $owner['password_hash'], PASSWORD_DEFAULT)) {
    $rehash = isq_db()->prepare('UPDATE isq_owner_users SET password_hash = ? WHERE id = ?');
    $rehash->execute([password_hash($password, PASSWORD_DEFAULT), $owner['id']]);
}
$touch = isq_db()->prepare('UPDATE isq_owner_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?');
$touch->execute([$owner['id']]);

isq_start_session();
session_regenerate_id(true);
$_SESSION['isq_admin_id'] = (int) $owner['id'];
$_SESSION['isq_admin_created'] = time();
$_SESSION['isq_admin_seen'] = time();
$_SESSION['isq_csrf'] = isq_random_token(24);

isq_ok([
    'authenticated' => true,
    'owner' => ['id' => (int) $owner['id'], 'username' => (string) $owner['username']],
    'csrfToken' => $_SESSION['isq_csrf'],
]);

