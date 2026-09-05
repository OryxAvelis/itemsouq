<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/bootstrap.php';

isq_method('GET');
header('Cache-Control: no-store');

$ownerCount = (int) isq_db()->query('SELECT COUNT(*) FROM isq_owner_users')->fetchColumn();
isq_start_session();
$admin = null;
$adminId = filter_var($_SESSION['isq_admin_id'] ?? null, FILTER_VALIDATE_INT);
$created = filter_var($_SESSION['isq_admin_created'] ?? null, FILTER_VALIDATE_INT);
$seen = filter_var($_SESSION['isq_admin_seen'] ?? null, FILTER_VALIDATE_INT);
$now = time();
if ($adminId && $created && $seen && $now - $created <= 28800 && $now - $seen <= 1800) {
    $statement = isq_db()->prepare('SELECT id, username FROM isq_owner_users WHERE id = ? AND is_active = 1 LIMIT 1');
    $statement->execute([$adminId]);
    $row = $statement->fetch();
    if ($row) {
        $_SESSION['isq_admin_seen'] = $now;
        $_SESSION['isq_csrf'] ??= isq_random_token(24);
        $admin = ['id' => (int) $row['id'], 'username' => (string) $row['username']];
    }
}
if ($admin === null && $adminId) {
    $_SESSION = [];
}

isq_ok([
    'authenticated' => $admin !== null,
    'setupRequired' => $ownerCount === 0,
    'owner' => $admin,
    'csrfToken' => $admin === null ? null : $_SESSION['isq_csrf'],
]);

