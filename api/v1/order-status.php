<?php
declare(strict_types=1);

require_once __DIR__ . '/../_private/bootstrap.php';

/** @return array<string,mixed>|null */
function isq_order_status_lookup(PDO $pdo, string $reference, string $token): ?array
{
    $statement = $pdo->prepare(
        'SELECT reference, status, public_note, version, created_at, updated_at '
        . 'FROM isq_orders WHERE reference = ? AND status_token_hash = ? LIMIT 1'
    );
    $statement->bindValue(1, $reference);
    $statement->bindValue(2, isq_token_hash($token), PDO::PARAM_LOB);
    $statement->execute();
    $row = $statement->fetch();
    if (!$row) {
        return null;
    }
    return [
        'reference' => (string) $row['reference'],
        'status' => (string) $row['status'],
        'publicNote' => $row['public_note'] === null ? null : (string) $row['public_note'],
        'version' => (int) $row['version'],
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
    ];
}

function isq_order_status_main(): never
{
    isq_method('GET');
    header('Cache-Control: no-store');
    $reference = is_string($_GET['reference'] ?? null) ? strtoupper(trim((string) $_GET['reference'])) : '';
    $token = isq_bearer_token();
    if (!preg_match('/^ISQ-\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/', $reference) || $token === null) {
        isq_fail('ORDER_NOT_FOUND', 'The order could not be found.', 404);
    }
    isq_rate_limit('orders.status', 60, 600);
    $order = isq_order_status_lookup(isq_db(), $reference, $token);
    if ($order === null) {
        isq_fail('ORDER_NOT_FOUND', 'The order could not be found.', 404);
    }
    isq_ok(['order' => $order]);
}

if (!defined('ISQ_ORDER_STATUS_LIBRARY_ONLY')) {
    isq_order_status_main();
}
