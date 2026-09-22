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
$assert(count($migrationFiles) === 7, 'Expected exactly seven numbered migrations.');
$expectedNames = [
    '001_core.sql', '002_catalogue.sql', '003_trading.sql', '004_orders.sql',
    '005_seed_fruits.sql', '006_game_passes_services.sql', '007_add_magnet_fruit.sql',
];
$assert(array_map('basename', $migrationFiles) === $expectedNames, 'Migration names or ordering changed.');

$allSql = '';
foreach ($migrationFiles as $file) {
    $sql = (string) file_get_contents($file);
    $allSql .= "\n" . $sql;
    $assert(!preg_match('/\\b(?:DROP|TRUNCATE)\\b/i', $sql), basename($file) . ' contains a destructive DDL statement.');
}
preg_match_all('/CREATE TABLE IF NOT EXISTS\\s+([a-z0-9_]+)/i', $allSql, $tableMatches);
$createdTables = array_values(array_unique($tableMatches[1] ?? []));
$assert(count($createdTables) === 18, 'Expected 18 normalized Itemsouq tables.');
foreach ($createdTables as $table) {
    $assert(str_starts_with($table, 'isq_'), "Unprefixed table found: $table");
}

$seed = (string) file_get_contents($migrationDirectory . '/005_seed_fruits.sql');
preg_match_all("/^\\s{4}\\(\\d+, '[a-z0-9-]+', '[^']+', '(?:Common|Uncommon|Rare|Legendary|Mythical)'/m", $seed, $fruitRows);
preg_match_all("/^\\s{4}\\(\\d+, '(?:physical|permanent)', \\d+\\.\\d{2}, '(?:available|out_of_stock|on_request|hidden)'/m", $seed, $offeringRows);
$assert(count($fruitRows[0]) === 41, 'Seed must contain 41 canonical fruit rows.');
$assert(count($offeringRows[0]) === 82, 'Seed must contain 82 offering rows.');
$assert(substr_count($seed, 'needs_owner_review') >= 3, 'Prototype seed review marker is missing.');

$marketplaceSeed = (string) file_get_contents($migrationDirectory . '/006_game_passes_services.sql');
preg_match_all("/^\\s{4}\\(\\d+, '[a-z0-9-]+', '[^']+', '[^']+', \\d+, 'assets\\/images\\/gamepasses\\/[a-z0-9-]+\\.png'/m", $marketplaceSeed, $gamePassRows);
preg_match_all("/^\\s{4}\\(\\d+, NULL, 'on_request', NULL, 1, 1\\)/m", $marketplaceSeed, $gamePassOfferingRows);
$assert(count($gamePassRows[0]) === 6, 'Seed must contain six canonical Game Pass rows.');
$assert(count($gamePassOfferingRows[0]) === 6, 'Seed must contain six owner-review Game Pass offerings.');
$assert(!preg_match('/INSERT\\s+INTO\\s+isq_services\\b/i', $marketplaceSeed), 'Services catalogue must start without seeded listings.');
$assert(str_contains($marketplaceSeed, 'Services intentionally contain no'), 'Services credential-safety schema note is missing.');

$magnetSeed = (string) file_get_contents($migrationDirectory . '/007_add_magnet_fruit.sql');
$assert(
    str_contains($magnetSeed, "(42, 'magnet', 'Magnet', 'Mythical', 'Natural', 6000000, 3500, 'assets/images/fruits/magnet.webp', 42)"),
    'Magnet reference metadata is missing or incorrect.'
);
preg_match_all("/^\\s{4}\\(42, '(?:physical|permanent)', NULL, 'on_request', NULL, 1, 1\\)/m", $magnetSeed, $magnetOfferingRows);
$assert(count($magnetOfferingRows[0]) === 2, 'Magnet migration must contain two owner-review offerings.');

$combinedInstaller = str_replace("\r\n", "\n", (string) file_get_contents(dirname(__DIR__) . '/itemsouq-infinityfree.sql'));
$marketplaceMarker = '-- Source: database\\migrations\\006_game_passes_services.sql';
$magnetMarker = '-- Source: database\\migrations\\007_add_magnet_fruit.sql';
$marketplacePosition = strpos($combinedInstaller, $marketplaceMarker);
$magnetPosition = strpos($combinedInstaller, $magnetMarker);
$combinedMarketplace = $marketplacePosition === false || $magnetPosition === false
    ? ''
    : trim(substr(
        $combinedInstaller,
        $marketplacePosition + strlen($marketplaceMarker),
        $magnetPosition - ($marketplacePosition + strlen($marketplaceMarker))
    ));
$combinedMagnet = $magnetPosition === false
    ? ''
    : trim(substr($combinedInstaller, $magnetPosition + strlen($magnetMarker)));
$assert($marketplacePosition !== false, 'Combined InfinityFree installer is missing migration 006.');
$assert($combinedMarketplace === trim(str_replace("\r\n", "\n", $marketplaceSeed)), 'Combined InfinityFree migration 006 differs from its source file.');
$assert($magnetPosition !== false, 'Combined InfinityFree installer is missing migration 007.');
$assert($combinedMagnet === trim(str_replace("\r\n", "\n", $magnetSeed)), 'Combined InfinityFree migration 007 differs from its source file.');

$fruitSource = (string) file_get_contents($root . '/assets/js/fruits.js');
preg_match_all("/\\{ id: '([a-z0-9-]+)', name:/", $fruitSource, $sourceSlugs);
preg_match_all("/^\\s{4}\\(\\d+, '([a-z0-9-]+)', '[^']+', '(?:Common|Uncommon|Rare|Legendary|Mythical)'/m", $seed, $seedSlugs);
preg_match("/\\(42, '([a-z0-9-]+)', 'Magnet'/", $magnetSeed, $magnetSlug);
$databaseSlugs = array_merge($seedSlugs[1], isset($magnetSlug[1]) ? [$magnetSlug[1]] : []);
$assert(count($sourceSlugs[1]) === 42, 'Browser reference catalogue must contain 42 fruit IDs.');
$assert($sourceSlugs[1] === $databaseSlugs, 'Database and browser fruit slug ordering differs.');

require_once $root . '/api/_private/bootstrap.php';
require_once $root . '/api/_private/game_pass_service.php';
require_once $root . '/api/_private/services_service.php';
$requiredFunctions = [
    'isq_db', 'isq_method', 'isq_input', 'isq_ok', 'isq_fail', 'isq_bearer_token', 'isq_token_hash',
    'isq_random_token', 'isq_public_id', 'isq_order_reference', 'isq_rate_limit', 'isq_require_admin',
    'isq_require_csrf', 'isq_iso', 'isq_validate_request_id', 'isq_validate_username', 'isq_validate_trade_lines',
    'isq_game_pass_catalogue_data', 'isq_services_data', 'isq_service_data', 'isq_service_copy_is_safe',
];
foreach ($requiredFunctions as $function) {
    $assert(function_exists($function), "Missing shared helper: $function");
}
$assert((bool) preg_match('/^TRD-[0-9A-HJKMNP-TV-Z]{16}$/', isq_public_id('TRD')), 'Trade public ID format failed.');
$assert((bool) preg_match('/^ISQ-\\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/', isq_order_reference()), 'Order reference format failed.');
$assert((bool) preg_match('/^SVC-[0-9A-HJKMNP-TV-Z]{16}$/', isq_public_id('SVC')), 'Service public ID format failed.');
$assert(strlen(isq_token_hash(isq_random_token())) === 32, 'Capability token hash must be 32 binary bytes.');
$assert(isq_validate_username('Youssef_RBX') === 'Youssef_RBX', 'Username validation changed unexpectedly.');
$assert(count(isq_validate_trade_lines([['fruitSlug' => 'dragon', 'quantity' => 1]], 'physical')) === 1, 'Trade line validation failed.');
$assert(isq_validate_service_text("  Aide   raid  ", 'titleFr', 3, 100) === 'Aide raid', 'Service text normalization failed.');
$assert(isq_validate_service_price('125.5') === '125.50', 'Service MAD price normalization failed.');
$assert(isq_validate_service_availability('on_request') === 'on_request', 'Service availability validation failed.');
$assert(isq_validate_service_sort_order('20') === 20, 'Service sort-order validation failed.');
$assert(isq_validate_service_featured(true) === true, 'Service featured validation failed.');
$assert(isq_service_copy_is_safe('Aide raid', 'Kan3awnok f raid') === true, 'Safe service copy was rejected.');
$assert(isq_service_copy_is_safe('Selling Roblox account', '') === false, 'English account-sale copy was not detected.');
$assert(isq_service_copy_is_safe('Je vends un compte Roblox niveau max', '') === false, 'Conjugated French account-sale copy was not detected.');
$assert(isq_service_copy_is_safe('Compte Roblox niveau max — 300 MAD', '') === false, 'Implicit account-sale copy was not detected.');
$assert(isq_service_copy_is_safe("Vente de com\u{200B}pte Roblox", '') === false, 'Zero-width account-sale bypass was not detected.');
$assert(isq_service_copy_is_safe('Vente de compte Roblox', '') === false, 'French account-sale copy was not detected.');
$assert(isq_service_copy_is_safe('حساب للبيع', '') === false, 'Arabic account-sale copy was not detected.');
$assert(isq_service_copy_is_safe('شراء حساب روبلوكس', '') === false, 'Arabic account-purchase copy was not detected.');
$assert(isq_service_copy_is_safe('Support', 'Never send your password') === false, 'Credential-oriented copy was not detected.');
$assert(isq_service_copy_is_safe('مساعدة', 'لا ترسل باسورد أو كوكيز') === false, 'Arabic credential-oriented copy was not detected.');
$assert(isq_service_copy_is_safe('كود خصم', 'نساعدك تختار الخدمة المناسبة') === true, 'Ordinary Arabic service copy was over-blocked.');

$serviceShape = isq_service_data([
    'public_id' => 'SVC-0123456789ABCDEF',
    'title_fr' => 'Aide raid',
    'title_ary' => 'Mosa3ada f raid',
    'description_fr' => 'Accompagnement en jeu.',
    'description_ary' => 'Mosa3ada dakhel l3ba.',
    'price_mad' => '25.00',
    'availability' => 'on_request',
    'sort_order' => '10',
    'is_featured' => '0',
    'is_archived' => '0',
    'version' => '1',
    'created_at' => '2026-09-07 00:00:00',
    'updated_at' => '2026-09-07 00:00:00',
]);
$assert(($serviceShape['titleFr'] ?? null) === 'Aide raid' && ($serviceShape['titleAry'] ?? null) === 'Mosa3ada f raid', 'Bilingual service response shape failed.');
$assert(($serviceShape['priceMad'] ?? null) === '25.00' && ($serviceShape['version'] ?? null) === 1, 'Service response normalization failed.');

$serviceAdminSource = (string) file_get_contents($root . '/api/v1/admin/services.php');
$assert(str_contains($serviceAdminSource, "['create', 'update', 'archive', 'restore']"), 'Service action allowlist is missing.');
$assert(!preg_match('/\\bDELETE\\s+FROM\\s+isq_services\\b/i', $serviceAdminSource), 'Service API must use recoverable archiving, not deletion.');
$assert(substr_count($serviceAdminSource, 'expectedVersion') >= 3, 'Service optimistic-lock checks are missing.');
$assert(str_contains($serviceAdminSource, 'titleFr') && str_contains($serviceAdminSource, 'titleAry'), 'Bilingual service fields are missing.');
$assert(substr_count($serviceAdminSource, 'isq_require_safe_service_copy') >= 3, 'Service safety checks must cover create, update, and restore.');

$gamePassAdminSource = (string) file_get_contents($root . '/api/v1/admin/game-passes.php');
$assert(str_contains($gamePassAdminSource, 'version = version + 1'), 'Game Pass optimistic-lock update is missing.');
$assert(str_contains($gamePassAdminSource, 'isq_game_pass_offering_history'), 'Game Pass audit history write is missing.');

if ($failures !== []) {
    fwrite(STDERR, "Offline checks failed:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}
echo "Offline checks passed ($checks assertions).\n";
