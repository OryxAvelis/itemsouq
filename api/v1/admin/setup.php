<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/bootstrap.php';

isq_method('POST');
isq_require_same_origin();
header('Cache-Control: no-store');
isq_rate_limit('owner.setup', 5, 3600);
$input = isq_input();

if ((int) isq_db()->query('SELECT COUNT(*) FROM isq_owner_users')->fetchColumn() !== 0) {
    isq_fail('SETUP_COMPLETE', 'The owner account is already configured.', 409);
}
$configuredToken = (string) isq_config()['setup_token'];
$providedToken = is_string($input['setupToken'] ?? null) ? $input['setupToken'] : '';
if ($configuredToken === '' || !hash_equals($configuredToken, $providedToken)) {
    isq_fail('SETUP_TOKEN_INVALID', 'The setup token is invalid.', 403);
}
$username = is_string($input['username'] ?? null) ? trim($input['username']) : '';
$password = is_string($input['password'] ?? null) ? $input['password'] : '';
if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $username)) {
    isq_fail('VALIDATION_FAILED', 'Owner username must contain 3–32 letters, numbers, or underscores.', 422, ['field' => 'username']);
}
if (strlen($password) < 12 || strlen($password) > 200) {
    isq_fail('VALIDATION_FAILED', 'Use an owner password of at least 12 characters.', 422, ['field' => 'password']);
}

$statement = isq_db()->prepare(
    'INSERT INTO isq_owner_users (singleton_key, username, password_hash) VALUES (1, ?, ?)'
);
try {
    $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
} catch (PDOException $error) {
    if ((string) $error->getCode() === '23000') {
        isq_fail('SETUP_COMPLETE', 'The owner account is already configured.', 409);
    }
    throw $error;
}

isq_start_session();
session_regenerate_id(true);
$_SESSION['isq_admin_id'] = (int) isq_db()->lastInsertId();
$_SESSION['isq_admin_created'] = time();
$_SESSION['isq_admin_seen'] = time();
$_SESSION['isq_csrf'] = isq_random_token(24);

isq_ok([
    'authenticated' => true,
    'owner' => ['id' => $_SESSION['isq_admin_id'], 'username' => $username],
    'csrfToken' => $_SESSION['isq_csrf'],
], 201);

