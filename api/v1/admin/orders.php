<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/bootstrap.php';

isq_method('GET');
header('Cache-Control: no-store');
isq_require_admin();

$statuses = ['new', 'contacted', 'confirmed', 'payment_pending', 'paid', 'delivering', 'completed', 'cancelled'];
$status = is_string($_GET['status'] ?? null) ? trim((string) $_GET['status']) : '';
if ($status !== '' && !in_array($status, $statuses, true)) {
    isq_fail('VALIDATION_FAILED', 'Unknown order status.', 422, ['field' => 'status']);
}
$limit = filter_var($_GET['limit'] ?? 50, FILTER_VALIDATE_INT);
$limit = $limit === false ? 50 : max(1, min(100, $limit));
$cursor = filter_var($_GET['cursor'] ?? null, FILTER_VALIDATE_INT);
$cursor = $cursor === false ? null : $cursor;

$where = [];
$params = [];
if ($status !== '') {
    $where[] = 'o.status = ?';
    $params[] = $status;
}
if ($cursor !== null) {
    $where[] = 'o.id < ?';
    $params[] = $cursor;
}
$sql = 'SELECT o.* FROM isq_orders o'
    . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
    . ' ORDER BY o.id DESC LIMIT ' . ($limit + 1);
$pdo = isq_db();
$statement = $pdo->prepare($sql);
$statement->execute($params);
$rows = $statement->fetchAll();
$hasMore = count($rows) > $limit;
if ($hasMore) {
    array_pop($rows);
}

$itemsByOrder = [];
if ($rows !== []) {
    $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $items = $pdo->prepare(
        'SELECT oi.order_id, f.slug, f.display_name, oi.sale_mode, oi.quantity, oi.unit_price_mad '
        . 'FROM isq_order_items oi JOIN isq_fruits f ON f.id = oi.fruit_id '
        . "WHERE oi.order_id IN ($placeholders) ORDER BY oi.order_id DESC, f.sort_order"
    );
    $items->execute($ids);
    foreach ($items as $item) {
        $itemsByOrder[(int) $item['order_id']][] = [
            'fruitSlug' => (string) $item['slug'],
            'fruitName' => (string) $item['display_name'],
            'mode' => (string) $item['sale_mode'],
            'quantity' => (int) $item['quantity'],
            'unitPriceMad' => number_format((float) $item['unit_price_mad'], 2, '.', ''),
        ];
    }
}

$orders = array_map(static function (array $row) use ($itemsByOrder): array {
    $anonymized = $row['anonymized_at'] !== null;
    return [
        'reference' => (string) $row['reference'],
        'buyer' => [
            'firstName' => $anonymized ? null : (string) $row['buyer_first_name'],
            'robloxUsername' => $anonymized ? null : (string) $row['roblox_username'],
            'paymentMethod' => $anonymized ? null : (string) $row['payment_method'],
            'city' => $anonymized || $row['city'] === null ? null : (string) $row['city'],
        ],
        'items' => $itemsByOrder[(int) $row['id']] ?? [],
        'quotedTotalMad' => number_format((float) $row['quoted_total_mad'], 2, '.', ''),
        'status' => (string) $row['status'],
        'publicNote' => $row['public_note'] === null ? null : (string) $row['public_note'],
        'version' => (int) $row['version'],
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
        'terminalAt' => isq_iso($row['terminal_at'] === null ? null : (string) $row['terminal_at']),
        'anonymizedAt' => isq_iso($row['anonymized_at'] === null ? null : (string) $row['anonymized_at']),
    ];
}, $rows);

$lastRow = $rows === [] ? null : $rows[array_key_last($rows)];
$nextCursor = $hasMore && $lastRow !== null ? (int) $lastRow['id'] : null;
$openCount = (int) $pdo->query(
    "SELECT COUNT(*) FROM isq_orders WHERE status NOT IN ('completed', 'cancelled')"
)->fetchColumn();
isq_ok(['orders' => $orders], 200, [
    'hasMore' => $hasMore,
    'nextCursor' => $nextCursor,
    'openCount' => $openCount,
]);
