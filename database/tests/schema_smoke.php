<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/_private/catalogue_service.php';

$pdo = isq_db();
$database = (string) isq_config()['db']['name'];
$expected = [
    'isq_schema_migrations', 'isq_owner_users', 'isq_rate_limit_buckets',
    'isq_fruits', 'isq_fruit_offerings', 'isq_fruit_offering_history',
    'isq_trades', 'isq_trade_items', 'isq_trade_responses', 'isq_trade_response_items',
    'isq_orders', 'isq_order_items', 'isq_order_status_history',
];
$tableQuery = $pdo->prepare(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name LIKE \'isq\\_%\' ORDER BY table_name'
);
$tableQuery->execute([$database]);
$actual = $tableQuery->fetchAll(PDO::FETCH_COLUMN);
$missing = array_values(array_diff($expected, $actual));
if ($missing !== []) {
    fwrite(STDERR, 'Missing tables: ' . implode(', ', $missing) . "\n");
    exit(1);
}

$counts = [
    'migrations' => (int) $pdo->query('SELECT COUNT(*) FROM isq_schema_migrations')->fetchColumn(),
    'fruits' => (int) $pdo->query('SELECT COUNT(*) FROM isq_fruits')->fetchColumn(),
    'offerings' => (int) $pdo->query('SELECT COUNT(*) FROM isq_fruit_offerings')->fetchColumn(),
    'review' => (int) $pdo->query('SELECT COUNT(*) FROM isq_fruit_offerings WHERE needs_owner_review = 1')->fetchColumn(),
];
if ($counts['migrations'] !== 5 || $counts['fruits'] !== 41 || $counts['offerings'] !== 82
    || $counts['review'] < 0 || $counts['review'] > 82) {
    fwrite(STDERR, 'Unexpected seed counts: ' . json_encode($counts) . "\n");
    exit(1);
}

$foreignKeys = $pdo->prepare(
    'SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND table_name LIKE \'isq\\_%\''
);
$foreignKeys->execute([$database]);
$foreignKeyCount = (int) $foreignKeys->fetchColumn();
if ($foreignKeyCount < 10) {
    fwrite(STDERR, "Expected at least 10 foreign keys, found $foreignKeyCount.\n");
    exit(1);
}

$publicCatalogue = isq_catalogue_data(false);
$ownerCatalogue = isq_catalogue_data(true);
if (count($publicCatalogue['fruits']) !== 41 || count($ownerCatalogue['fruits']) !== 41) {
    fwrite(STDERR, "Catalogue service did not return all 41 fruits.\n");
    exit(1);
}
$ownerBySlug = array_column($ownerCatalogue['fruits'], null, 'id');
foreach ($publicCatalogue['fruits'] as $fruit) {
    foreach (['physical', 'permanent'] as $mode) {
        $publicOffering = $fruit['offerings'][$mode] ?? null;
        $ownerOffering = $ownerBySlug[$fruit['id']]['offerings'][$mode] ?? null;
        if (!is_array($publicOffering) || !is_array($ownerOffering)) {
            fwrite(STDERR, "Catalogue offering is missing for {$fruit['id']}:$mode.\n");
            exit(1);
        }
        if ($ownerOffering['needsOwnerReview'] && $ownerOffering['availability'] !== 'hidden'
            && ($publicOffering['availability'] !== 'on_request' || $publicOffering['quantityAvailable'] !== null)) {
            fwrite(STDERR, "Unreviewed offering became publicly orderable for {$fruit['id']}:$mode.\n");
            exit(1);
        }
    }
}

echo 'Schema smoke checks passed: ' . json_encode($counts)
    . ", foreignKeys=$foreignKeyCount, catalogueSafety=ok.\n";
