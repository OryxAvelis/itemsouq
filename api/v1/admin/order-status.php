<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/bootstrap.php';

isq_method('POST');
isq_require_same_origin();
header('Cache-Control: no-store');
$admin = isq_require_admin();
$input = isq_input();
isq_require_csrf($input);
isq_rate_limit('owner.order-status.write', 120, 600, (string) $admin['id']);

$reference = is_string($input['reference'] ?? null) ? strtoupper(trim($input['reference'])) : '';
$status = is_string($input['status'] ?? null) ? $input['status'] : '';
$note = is_string($input['publicNote'] ?? null) ? trim($input['publicNote']) : '';
$expectedVersion = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
$statuses = ['new', 'contacted', 'confirmed', 'payment_pending', 'paid', 'delivering', 'completed', 'cancelled'];
if (!preg_match('/^ISQ-\\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/', $reference)) {
    isq_fail('VALIDATION_FAILED', 'Enter a valid order reference.', 422, ['field' => 'reference']);
}
if (!in_array($status, $statuses, true)) {
    isq_fail('VALIDATION_FAILED', 'Choose a valid order status.', 422, ['field' => 'status']);
}
$noteLength = function_exists('mb_strlen') ? mb_strlen($note, 'UTF-8') : strlen($note);
if ($noteLength > 240) {
    isq_fail('VALIDATION_FAILED', 'The public note cannot exceed 240 characters.', 422, ['field' => 'publicNote']);
}
if ($expectedVersion === false || $expectedVersion < 1) {
    isq_fail('VALIDATION_FAILED', 'A valid expectedVersion is required.', 422, ['field' => 'expectedVersion']);
}
$note = $note === '' ? null : $note;

$pdo = isq_db();
$pdo->beginTransaction();
try {
    $read = $pdo->prepare('SELECT id, status, version FROM isq_orders WHERE reference = ? FOR UPDATE');
    $read->execute([$reference]);
    $order = $read->fetch();
    if (!$order) {
        $pdo->rollBack();
        isq_fail('ORDER_NOT_FOUND', 'The order was not found.', 404);
    }
    if ((int) $order['version'] !== $expectedVersion) {
        $pdo->rollBack();
        isq_fail('VERSION_CONFLICT', 'This order changed in another session. Reload and try again.', 409, [
            'currentVersion' => (int) $order['version'],
        ]);
    }

    $newVersion = $expectedVersion + 1;
    $terminal = in_array($status, ['completed', 'cancelled'], true);
    $update = $pdo->prepare(
        'UPDATE isq_orders SET status = ?, public_note = ?, version = ?, '
        . 'terminal_at = CASE WHEN ? = 1 THEN COALESCE(terminal_at, UTC_TIMESTAMP()) ELSE NULL END '
        . 'WHERE id = ? AND version = ?'
    );
    $update->execute([$status, $note, $newVersion, $terminal ? 1 : 0, $order['id'], $expectedVersion]);
    if ($update->rowCount() !== 1) {
        $pdo->rollBack();
        isq_fail('VERSION_CONFLICT', 'This order changed in another session. Reload and try again.', 409);
    }
    $history = $pdo->prepare(
        'INSERT INTO isq_order_status_history '
        . '(order_id, from_status, to_status, public_note, order_version, changed_by) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $history->execute([$order['id'], $order['status'], $status, $note, $newVersion, $admin['id']]);
    $fresh = $pdo->prepare('SELECT status, public_note, version, updated_at, terminal_at FROM isq_orders WHERE id = ?');
    $fresh->execute([$order['id']]);
    $updated = $fresh->fetch();
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $error;
}

isq_ok([
    'reference' => $reference,
    'status' => (string) $updated['status'],
    'publicNote' => $updated['public_note'] === null ? null : (string) $updated['public_note'],
    'version' => (int) $updated['version'],
    'updatedAt' => isq_iso((string) $updated['updated_at']),
    'terminalAt' => isq_iso($updated['terminal_at'] === null ? null : (string) $updated['terminal_at']),
]);
