<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/game_pass_service.php';

$method = isq_method(['GET', 'POST']);
header('Cache-Control: no-store');
$admin = isq_require_admin();

if ($method === 'GET') {
    $catalogue = isq_game_pass_catalogue_data(true);
    $catalogueHash = hash('sha256', json_encode($catalogue, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    isq_ok(
        ['gamePasses' => $catalogue['gamePasses']],
        200,
        [
            'updatedAt' => $catalogue['updatedAt'],
            'catalogueVersion' => substr($catalogueHash, 0, 16),
            'reviewCount' => $catalogue['reviewCount'],
        ]
    );
}

isq_require_same_origin();
$input = isq_input();
isq_require_csrf($input);
isq_rate_limit('owner.game-passes.write', 120, 600, (string) $admin['id']);

$gamePassSlug = is_string($input['gamePassSlug'] ?? null) ? strtolower(trim($input['gamePassSlug'])) : '';
$availability = is_string($input['availability'] ?? null) ? $input['availability'] : '';
$expectedVersion = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $gamePassSlug)) {
    isq_fail('VALIDATION_FAILED', 'Choose a valid Game Pass.', 422, ['field' => 'gamePassSlug']);
}
if (!in_array($availability, ['available', 'out_of_stock', 'on_request', 'hidden'], true)) {
    isq_fail('VALIDATION_FAILED', 'Choose a valid availability.', 422, ['field' => 'availability']);
}
if ($expectedVersion === false || $expectedVersion < 1) {
    isq_fail('VALIDATION_FAILED', 'A valid expectedVersion is required.', 422, ['field' => 'expectedVersion']);
}

$price = null;
if (array_key_exists('priceMad', $input) && $input['priceMad'] !== null && $input['priceMad'] !== '') {
    $rawPrice = is_int($input['priceMad']) || is_float($input['priceMad']) || is_string($input['priceMad'])
        ? trim((string) $input['priceMad'])
        : '';
    if (!preg_match('/^(?:0|[1-9]\\d{0,7})(?:\\.\\d{1,2})?$/', $rawPrice)) {
        isq_fail('VALIDATION_FAILED', 'Enter a valid MAD price with at most two decimals.', 422, ['field' => 'priceMad']);
    }
    $price = number_format((float) $rawPrice, 2, '.', '');
}

$quantity = null;
if (array_key_exists('quantityAvailable', $input) && $input['quantityAvailable'] !== null && $input['quantityAvailable'] !== '') {
    $quantity = filter_var($input['quantityAvailable'], FILTER_VALIDATE_INT);
    if ($quantity === false || $quantity < 0 || $quantity > 65535) {
        isq_fail('VALIDATION_FAILED', 'Quantity must be between 0 and 65,535.', 422, ['field' => 'quantityAvailable']);
    }
}
if ($availability === 'available' && ($price === null || ($quantity !== null && $quantity < 1))) {
    isq_fail('VALIDATION_FAILED', 'Available Game Passes need a price and either a positive quantity or no disclosed quantity.', 422);
}
if ($availability === 'out_of_stock') {
    $quantity = 0;
}
if ($availability === 'on_request') {
    $quantity = null;
}

$pdo = isq_db();
$passStatement = $pdo->prepare('SELECT id FROM isq_game_passes WHERE slug = ? AND is_active = 1 LIMIT 1');
$passStatement->execute([$gamePassSlug]);
$gamePassId = $passStatement->fetchColumn();
if ($gamePassId === false) {
    isq_fail('GAME_PASS_NOT_FOUND', 'The selected Game Pass was not found.', 404);
}

$pdo->beginTransaction();
try {
    $update = $pdo->prepare(
        'UPDATE isq_game_pass_offerings SET price_mad = ?, availability = ?, quantity_available = ?, '
        . 'needs_owner_review = 0, version = version + 1, updated_by = ? '
        . 'WHERE game_pass_id = ? AND version = ?'
    );
    $update->execute([$price, $availability, $quantity, $admin['id'], $gamePassId, $expectedVersion]);
    if ($update->rowCount() !== 1) {
        $exists = $pdo->prepare('SELECT version FROM isq_game_pass_offerings WHERE game_pass_id = ?');
        $exists->execute([$gamePassId]);
        $currentVersion = $exists->fetchColumn();
        $pdo->rollBack();
        if ($currentVersion === false) {
            isq_fail('OFFERING_NOT_FOUND', 'The selected Game Pass offering was not found.', 404);
        }
        isq_fail('VERSION_CONFLICT', 'This Game Pass changed in another session. Reload and try again.', 409, [
            'currentVersion' => (int) $currentVersion,
        ]);
    }

    $read = $pdo->prepare(
        'SELECT price_mad, availability, quantity_available, needs_owner_review, version, updated_at '
        . 'FROM isq_game_pass_offerings WHERE game_pass_id = ?'
    );
    $read->execute([$gamePassId]);
    $offering = $read->fetch();
    $history = $pdo->prepare(
        'INSERT INTO isq_game_pass_offering_history '
        . '(game_pass_id, price_mad, availability, quantity_available, needs_owner_review, offering_version, changed_by) '
        . 'VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $history->execute([
        $gamePassId,
        $offering['price_mad'],
        $offering['availability'],
        $offering['quantity_available'],
        $offering['needs_owner_review'],
        $offering['version'],
        $admin['id'],
    ]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $error;
}

isq_ok([
    'gamePassSlug' => $gamePassSlug,
    'offering' => [
        'priceMad' => $offering['price_mad'] === null ? null : number_format((float) $offering['price_mad'], 2, '.', ''),
        'availability' => (string) $offering['availability'],
        'quantityAvailable' => $offering['quantity_available'] === null ? null : (int) $offering['quantity_available'],
        'needsOwnerReview' => (bool) $offering['needs_owner_review'],
        'version' => (int) $offering['version'],
        'updatedAt' => isq_iso((string) $offering['updated_at']),
    ],
]);
