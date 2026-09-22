<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/_private/catalogue_service.php';
require_once dirname(__DIR__, 2) . '/api/_private/game_pass_service.php';
require_once dirname(__DIR__, 2) . '/api/_private/services_service.php';

$pdo = isq_db();
$database = (string) isq_config()['db']['name'];
$expected = [
    'isq_schema_migrations', 'isq_owner_users', 'isq_rate_limit_buckets',
    'isq_fruits', 'isq_fruit_offerings', 'isq_fruit_offering_history',
    'isq_trades', 'isq_trade_items', 'isq_trade_responses', 'isq_trade_response_items',
    'isq_orders', 'isq_order_items', 'isq_order_status_history',
    'isq_game_passes', 'isq_game_pass_offerings', 'isq_game_pass_offering_history',
    'isq_services', 'isq_service_history',
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
    'gamePasses' => (int) $pdo->query('SELECT COUNT(*) FROM isq_game_passes')->fetchColumn(),
    'gamePassOfferings' => (int) $pdo->query('SELECT COUNT(*) FROM isq_game_pass_offerings')->fetchColumn(),
    'gamePassReview' => (int) $pdo->query('SELECT COUNT(*) FROM isq_game_pass_offerings WHERE needs_owner_review = 1')->fetchColumn(),
    'services' => (int) $pdo->query('SELECT COUNT(*) FROM isq_services')->fetchColumn(),
];
if ($counts['migrations'] !== 7 || $counts['fruits'] !== 42 || $counts['offerings'] !== 84
    || $counts['review'] < 0 || $counts['review'] > 84
    || $counts['gamePasses'] !== 6 || $counts['gamePassOfferings'] !== 6
    || $counts['gamePassReview'] < 0 || $counts['gamePassReview'] > 6 || $counts['services'] < 0) {
    fwrite(STDERR, 'Unexpected seed counts: ' . json_encode($counts) . "\n");
    exit(1);
}

$foreignKeys = $pdo->prepare(
    'SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND table_name LIKE \'isq\\_%\''
);
$foreignKeys->execute([$database]);
$foreignKeyCount = (int) $foreignKeys->fetchColumn();
if ($foreignKeyCount < 17) {
    fwrite(STDERR, "Expected at least 17 foreign keys, found $foreignKeyCount.\n");
    exit(1);
}

$publicGamePasses = isq_game_pass_catalogue_data(false);
$ownerGamePasses = isq_game_pass_catalogue_data(true);
if (count($publicGamePasses['gamePasses']) !== 6 || count($ownerGamePasses['gamePasses']) !== 6) {
    fwrite(STDERR, "Game Pass service did not return all six canonical passes.\n");
    exit(1);
}
$ownerPassesBySlug = array_column($ownerGamePasses['gamePasses'], null, 'id');
foreach ($publicGamePasses['gamePasses'] as $gamePass) {
    $publicOffering = $gamePass['offering'] ?? null;
    $ownerOffering = $ownerPassesBySlug[$gamePass['id']]['offering'] ?? null;
    if (!is_array($publicOffering) || !is_array($ownerOffering)) {
        fwrite(STDERR, "Game Pass offering is missing for {$gamePass['id']}.\n");
        exit(1);
    }
    if ($ownerOffering['needsOwnerReview'] && $ownerOffering['availability'] !== 'hidden'
        && ($publicOffering['availability'] !== 'on_request' || $publicOffering['quantityAvailable'] !== null)) {
        fwrite(STDERR, "Unreviewed Game Pass became publicly orderable for {$gamePass['id']}.\n");
        exit(1);
    }
}

$publicServices = isq_services_data(false);
$ownerServices = isq_services_data(true);
if ($counts['services'] === 0 && ($publicServices['services'] !== [] || $ownerServices['services'] !== [])) {
    fwrite(STDERR, "Empty services catalogue did not remain empty.\n");
    exit(1);
}

$publicCatalogue = isq_catalogue_data(false);
$ownerCatalogue = isq_catalogue_data(true);
if (count($publicCatalogue['fruits']) !== 42 || count($ownerCatalogue['fruits']) !== 42) {
    fwrite(STDERR, "Catalogue service did not return all 42 fruits.\n");
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
