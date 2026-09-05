<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$migrationDirectory = dirname(__DIR__) . '/migrations';
$failures = [];
$checks = 0;
$assert = static function (bool $condition, string $message) use (&$failures, &$checks): void {
    $checks++;
    if (!$condition) {
        $failures[] = $message;
    }
};

$migrationFiles = glob($migrationDirectory . '/*.sql') ?: [];
sort($migrationFiles);
$assert(count($migrationFiles) === 5, 'Expected exactly five numbered migrations.');
$expectedNames = ['001_core.sql', '002_catalogue.sql', '003_trading.sql', '004_orders.sql', '005_seed_fruits.sql'];
$assert(array_map('basename', $migrationFiles) === $expectedNames, 'Migration names or ordering changed.');

$allSql = '';
foreach ($migrationFiles as $file) {
    $sql = (string) file_get_contents($file);
    $allSql .= "\n" . $sql;
    $assert(!preg_match('/\\b(?:DROP|TRUNCATE)\\b/i', $sql), basename($file) . ' contains a destructive DDL statement.');
}
preg_match_all('/CREATE TABLE IF NOT EXISTS\\s+([a-z0-9_]+)/i', $allSql, $tableMatches);
$createdTables = array_values(array_unique($tableMatches[1] ?? []));
$assert(count($createdTables) === 13, 'Expected 13 normalized Itemsouq tables.');
foreach ($createdTables as $table) {
    $assert(str_starts_with($table, 'isq_'), "Unprefixed table found: $table");
}

$seed = (string) file_get_contents($migrationDirectory . '/005_seed_fruits.sql');
preg_match_all("/^\\s{4}\\(\\d+, '[a-z0-9-]+', '[^']+', '(?:Common|Uncommon|Rare|Legendary|Mythical)'/m", $seed, $fruitRows);
preg_match_all("/^\\s{4}\\(\\d+, '(?:physical|permanent)', \\d+\\.\\d{2}, '(?:available|out_of_stock|on_request|hidden)'/m", $seed, $offeringRows);
$assert(count($fruitRows[0]) === 41, 'Seed must contain 41 canonical fruit rows.');
$assert(count($offeringRows[0]) === 82, 'Seed must contain 82 offering rows.');
$assert(substr_count($seed, 'needs_owner_review') >= 3, 'Prototype seed review marker is missing.');

$fruitSource = (string) file_get_contents($root . '/assets/js/fruits.js');
preg_match_all("/\\{ id: '([a-z0-9-]+)', name:/", $fruitSource, $sourceSlugs);
preg_match_all("/^\\s{4}\\(\\d+, '([a-z0-9-]+)', '[^']+', '(?:Common|Uncommon|Rare|Legendary|Mythical)'/m", $seed, $seedSlugs);
$assert(count($sourceSlugs[1]) === 41, 'Browser reference catalogue must contain 41 fruit IDs.');
$assert($sourceSlugs[1] === $seedSlugs[1], 'Database and browser fruit slug ordering differs.');

require_once $root . '/api/_private/bootstrap.php';
$requiredFunctions = [
    'isq_db', 'isq_method', 'isq_input', 'isq_ok', 'isq_fail', 'isq_bearer_token', 'isq_token_hash',
    'isq_random_token', 'isq_public_id', 'isq_order_reference', 'isq_rate_limit', 'isq_require_admin',
    'isq_require_csrf', 'isq_iso', 'isq_validate_request_id', 'isq_validate_username', 'isq_validate_trade_lines',
];
foreach ($requiredFunctions as $function) {
    $assert(function_exists($function), "Missing shared helper: $function");
}
$assert((bool) preg_match('/^TRD-[0-9A-HJKMNP-TV-Z]{16}$/', isq_public_id('TRD')), 'Trade public ID format failed.');
$assert((bool) preg_match('/^ISQ-\\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/', isq_order_reference()), 'Order reference format failed.');
$assert(strlen(isq_token_hash(isq_random_token())) === 32, 'Capability token hash must be 32 binary bytes.');
$assert(isq_validate_username('Youssef_RBX') === 'Youssef_RBX', 'Username validation changed unexpectedly.');
$assert(count(isq_validate_trade_lines([['fruitSlug' => 'dragon', 'quantity' => 1]], 'physical')) === 1, 'Trade line validation failed.');

if ($failures !== []) {
    fwrite(STDERR, "Offline checks failed:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}
echo "Offline checks passed ($checks assertions).\n";

