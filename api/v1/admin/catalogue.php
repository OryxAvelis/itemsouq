<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/catalogue_service.php';

$method = isq_method(['GET', 'POST']);
header('Cache-Control: no-store');
$admin = isq_require_admin();

if ($method === 'GET') {
    $catalogue = isq_catalogue_data(true);
    $catalogueHash = hash('sha256', json_encode($catalogue, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    isq_ok(
        ['fruits' => $catalogue['fruits']],
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
isq_rate_limit('owner.catalogue.write', 120, 600, (string) $admin['id']);

$fruitSlug = is_string($input['fruitSlug'] ?? null) ? strtolower(trim($input['fruitSlug'])) : '';
$mode = is_string($input['mode'] ?? null) ? $input['mode'] : '';
$availability = is_string($input['availability'] ?? null) ? $input['availability'] : '';
$expectedVersion = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $fruitSlug)) {
    isq_fail('VALIDATION_FAILED', 'Choose a valid fruit.', 422, ['field' => 'fruitSlug']);
}
if (!in_array($mode, ['physical', 'permanent'], true)) {
    isq_fail('VALIDATION_FAILED', 'Choose physical or permanent.', 422, ['field' => 'mode']);
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
    isq_fail('VALIDATION_FAILED', 'Available offerings need a price and either a positive quantity or no disclosed quantity.', 422);
}
if ($availability === 'out_of_stock') {
    $quantity = 0;
}
if ($availability === 'on_request') {
    $quantity = null;
}

$pdo = isq_db();
$fruitStatement = $pdo->prepare('SELECT id FROM isq_fruits WHERE slug = ? AND is_active = 1 LIMIT 1');
$fruitStatement->execute([$fruitSlug]);
$fruitId = $fruitStatement->fetchColumn();
if ($fruitId === false) {
    isq_fail('FRUIT_NOT_FOUND', 'The selected fruit was not found.', 404);
}

$pdo->beginTransaction();
try {
    $update = $pdo->prepare(
        'UPDATE isq_fruit_offerings SET price_mad = ?, availability = ?, quantity_available = ?, '
        . 'needs_owner_review = 0, version = version + 1, updated_by = ? '
        . 'WHERE fruit_id = ? AND sale_mode = ? AND version = ?'
    );
    $update->execute([$price, $availability, $quantity, $admin['id'], $fruitId, $mode, $expectedVersion]);
    if ($update->rowCount() !== 1) {
        $exists = $pdo->prepare('SELECT version FROM isq_fruit_offerings WHERE fruit_id = ? AND sale_mode = ?');
        $exists->execute([$fruitId, $mode]);
        $currentVersion = $exists->fetchColumn();
        $pdo->rollBack();
        if ($currentVersion === false) {
            isq_fail('OFFERING_NOT_FOUND', 'The selected offering was not found.', 404);
        }
        isq_fail('VERSION_CONFLICT', 'This offering changed in another session. Reload and try again.', 409, [
            'currentVersion' => (int) $currentVersion,
        ]);
    }

    $read = $pdo->prepare(
        'SELECT price_mad, availability, quantity_available, needs_owner_review, version, updated_at '
        . 'FROM isq_fruit_offerings WHERE fruit_id = ? AND sale_mode = ?'
    );
    $read->execute([$fruitId, $mode]);
    $offering = $read->fetch();
    $history = $pdo->prepare(
        'INSERT INTO isq_fruit_offering_history '
        . '(fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, offering_version, changed_by) '
        . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $history->execute([
        $fruitId,
        $mode,
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
    'fruitSlug' => $fruitSlug,
    'mode' => $mode,
    'offering' => [
        'priceMad' => $offering['price_mad'] === null ? null : number_format((float) $offering['price_mad'], 2, '.', ''),
        'availability' => (string) $offering['availability'],
        'quantityAvailable' => $offering['quantity_available'] === null ? null : (int) $offering['quantity_available'],
        'needsOwnerReview' => (bool) $offering['needs_owner_review'],
        'version' => (int) $offering['version'],
        'updatedAt' => isq_iso((string) $offering['updated_at']),
    ],
]);

