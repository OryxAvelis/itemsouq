<?php
declare(strict_types=1);

require_once __DIR__ . '/../_private/catalogue_service.php';

/** @return array{requestId:string,catalogueVersion:?string,buyer:array{firstName:string,robloxUsername:string,paymentMethod:string,city:?string},items:list<array{fruitSlug:string,mode:string,quantity:int}>} */
function isq_order_validate_input(array $input): array
{
    $requestId = isq_validate_request_id($input['requestId'] ?? null);
    $catalogueVersion = $input['catalogueVersion'] ?? null;
    if ($catalogueVersion !== null && (!is_string($catalogueVersion) || !preg_match('/^[a-f0-9]{16}$/', $catalogueVersion))) {
        isq_fail('VALIDATION_FAILED', 'The catalogue version is invalid.', 422, ['field' => 'catalogueVersion']);
    }

    $buyer = $input['buyer'] ?? null;
    if (!is_array($buyer) || array_is_list($buyer)) {
        isq_fail('VALIDATION_FAILED', 'Buyer details are required.', 422, ['field' => 'buyer']);
    }
    $firstName = is_string($buyer['firstName'] ?? null) ? trim((string) $buyer['firstName']) : '';
    $nameLength = function_exists('mb_strlen') ? mb_strlen($firstName, 'UTF-8') : strlen($firstName);
    if ($nameLength < 1 || $nameLength > 40 || preg_match('/[\x00-\x1F\x7F]/u', $firstName)) {
        isq_fail('VALIDATION_FAILED', 'The first name is invalid.', 422, ['field' => 'buyer.firstName']);
    }
    $robloxUsername = is_string($buyer['robloxUsername'] ?? null) ? trim((string) $buyer['robloxUsername']) : '';
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $robloxUsername)) {
        isq_fail('VALIDATION_FAILED', 'The Roblox username must contain 3–20 letters, numbers, or underscores.', 422, ['field' => 'buyer.robloxUsername']);
    }
    $paymentMethod = is_string($buyer['paymentMethod'] ?? null) ? $buyer['paymentMethod'] : '';
    if (!in_array($paymentMethod, ['cash_plus', 'wafacash'], true)) {
        isq_fail('VALIDATION_FAILED', 'The payment method is invalid.', 422, ['field' => 'buyer.paymentMethod']);
    }
    $city = $buyer['city'] ?? null;
    if ($city !== null) {
        $city = is_string($city) ? trim($city) : '';
        $cityLength = function_exists('mb_strlen') ? mb_strlen($city, 'UTF-8') : strlen($city);
        if ($city === '' || $cityLength > 80 || preg_match('/[\x00-\x1F\x7F]/u', $city)) {
            isq_fail('VALIDATION_FAILED', 'The city is invalid.', 422, ['field' => 'buyer.city']);
        }
    }

    $rawItems = $input['items'] ?? null;
    if (!is_array($rawItems) || !array_is_list($rawItems) || count($rawItems) < 1 || count($rawItems) > 20) {
        isq_fail('VALIDATION_FAILED', 'An order must contain 1–20 distinct items.', 422, ['field' => 'items']);
    }
    $items = [];
    $seen = [];
    $totalQuantity = 0;
    foreach ($rawItems as $line) {
        if (!is_array($line) || array_is_list($line)) {
            isq_fail('VALIDATION_FAILED', 'Each order item must be an object.', 422, ['field' => 'items']);
        }
        $fruitSlug = is_string($line['fruitSlug'] ?? null) ? strtolower(trim((string) $line['fruitSlug'])) : '';
        $mode = is_string($line['mode'] ?? null) ? $line['mode'] : '';
        $quantity = filter_var($line['quantity'] ?? null, FILTER_VALIDATE_INT);
        $key = $fruitSlug . ':' . $mode;
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $fruitSlug)
            || !in_array($mode, ['physical', 'permanent'], true)
            || $quantity === false || $quantity < 1 || $quantity > 99
            || isset($seen[$key])) {
            isq_fail('VALIDATION_FAILED', 'An order item is invalid or duplicated.', 422, ['field' => 'items']);
        }
        $seen[$key] = true;
        $totalQuantity += (int) $quantity;
        $items[] = ['fruitSlug' => $fruitSlug, 'mode' => $mode, 'quantity' => (int) $quantity];
    }
    if ($totalQuantity > 99) {
        isq_fail('VALIDATION_FAILED', 'The total quantity is too large.', 422, ['field' => 'items']);
    }
    usort($items, static fn(array $left, array $right): int => strcmp($left['fruitSlug'] . ':' . $left['mode'], $right['fruitSlug'] . ':' . $right['mode']));

    return [
        'requestId' => $requestId,
        'catalogueVersion' => $catalogueVersion,
        'buyer' => [
            'firstName' => $firstName,
            'robloxUsername' => $robloxUsername,
            'paymentMethod' => $paymentMethod,
            'city' => $city,
        ],
        'items' => $items,
    ];
}

function isq_order_money_cents(string $value): int
{
    if (!preg_match('/^(\d{1,8})(?:\.(\d{1,2}))?$/', $value, $matches)) {
        throw new RuntimeException('Invalid database money value.');
    }
    return ((int) $matches[1] * 100) + (int) str_pad($matches[2] ?? '', 2, '0');
}

function isq_order_money_string(int $cents): string
{
    if ($cents < 0) {
        throw new RuntimeException('Money cannot be negative.');
    }
    return sprintf('%d.%02d', intdiv($cents, 100), $cents % 100);
}

/** @param array<string,mixed> $validated */
function isq_order_payload_hash(array $validated): string
{
    return hash('sha256', json_encode([
        'catalogueVersion' => $validated['catalogueVersion'],
        'buyer' => $validated['buyer'],
        'items' => $validated['items'],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), true);
}

function isq_order_request_hash(string $requestId): string
{
    return hash_hmac('sha256', $requestId, (string) isq_config()['app_secret'], true);
}

/** @return array<string,mixed>|null */
function isq_order_find_by_request(PDO $pdo, string $requestHash): ?array
{
    $lookup = $pdo->prepare('SELECT * FROM isq_orders WHERE request_key_hash = ? LIMIT 1 FOR UPDATE');
    $lookup->bindValue(1, $requestHash, PDO::PARAM_LOB);
    $lookup->execute();
    $row = $lookup->fetch();
    return $row ?: null;
}

/** @return list<array{fruitSlug:string,mode:string,quantity:int,unitPriceMad:string,lineTotalMad:string}> */
function isq_order_items(PDO $pdo, int $orderId): array
{
    $statement = $pdo->prepare(
        'SELECT f.slug, oi.sale_mode, oi.quantity, oi.unit_price_mad '
        . 'FROM isq_order_items oi JOIN isq_fruits f ON f.id = oi.fruit_id '
        . 'WHERE oi.order_id = ? ORDER BY oi.order_id, f.sort_order, FIELD(oi.sale_mode, \'physical\', \'permanent\')'
    );
    $statement->execute([$orderId]);
    $items = [];
    foreach ($statement as $row) {
        $unit = number_format((float) $row['unit_price_mad'], 2, '.', '');
        $quantity = (int) $row['quantity'];
        $items[] = [
            'fruitSlug' => (string) $row['slug'],
            'mode' => (string) $row['sale_mode'],
            'quantity' => $quantity,
            'unitPriceMad' => $unit,
            'lineTotalMad' => isq_order_money_string(isq_order_money_cents($unit) * $quantity),
        ];
    }
    return $items;
}

/** @param array<string,mixed> $row @return array<string,mixed> */
function isq_order_response(PDO $pdo, array $row, string $statusToken): array
{
    return [
        'reference' => (string) $row['reference'],
        'status' => (string) $row['status'],
        'statusToken' => $statusToken,
        'version' => (int) $row['version'],
        'currency' => 'MAD',
        'totalMad' => number_format((float) $row['quoted_total_mad'], 2, '.', ''),
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
        'items' => isq_order_items($pdo, (int) $row['id']),
    ];
}

/** @param array<string,mixed> $row @return array{order:array<string,mixed>,statusCode:int,idempotent:bool} */
function isq_order_replay(PDO $pdo, array $row, string $payloadHash): array
{
    if (!hash_equals((string) $row['request_payload_hash'], $payloadHash)) {
        isq_fail('IDEMPOTENCY_CONFLICT', 'This requestId was already used for different order details.', 409);
    }
    $statusToken = isq_random_token();
    $rotate = $pdo->prepare('UPDATE isq_orders SET status_token_hash = ? WHERE id = ?');
    $rotate->bindValue(1, isq_token_hash($statusToken), PDO::PARAM_LOB);
    $rotate->bindValue(2, (int) $row['id'], PDO::PARAM_INT);
    $rotate->execute();
    $reloaded = $pdo->prepare('SELECT * FROM isq_orders WHERE id = ? LIMIT 1');
    $reloaded->execute([(int) $row['id']]);
    $row = $reloaded->fetch();
    if (!$row) {
        throw new RuntimeException('The existing order could not be reloaded.');
    }
    return ['order' => isq_order_response($pdo, $row, $statusToken), 'statusCode' => 200, 'idempotent' => true];
}

/** @param array<string,mixed> $validated @return array{order:array<string,mixed>,statusCode:int,idempotent:bool} */
function isq_order_create(PDO $pdo, array $validated): array
{
    $requestHash = isq_order_request_hash((string) $validated['requestId']);
    $payloadHash = isq_order_payload_hash($validated);
    $existing = isq_order_find_by_request($pdo, $requestHash);
    if ($existing) {
        return isq_order_replay($pdo, $existing, $payloadHash);
    }

    if ($validated['catalogueVersion'] !== null) {
        $catalogue = isq_catalogue_data(false);
        $currentVersion = substr(hash('sha256', json_encode($catalogue, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)), 0, 16);
        if (!hash_equals((string) $validated['catalogueVersion'], $currentVersion)) {
            isq_fail('CATALOGUE_CHANGED', 'Prices or availability changed. Refresh the catalogue and review the order.', 409);
        }
    }

    $slugs = array_values(array_unique(array_column($validated['items'], 'fruitSlug')));
    $placeholders = implode(',', array_fill(0, count($slugs), '?'));
    $statement = $pdo->prepare(
        'SELECT f.id, f.slug, f.is_active, o.sale_mode, o.price_mad, o.availability, '
        . 'o.quantity_available, o.needs_owner_review FROM isq_fruits f '
        . 'LEFT JOIN isq_fruit_offerings o ON o.fruit_id = f.id '
        . "WHERE f.slug IN ($placeholders) FOR UPDATE"
    );
    $statement->execute($slugs);
    $offerings = [];
    foreach ($statement as $row) {
        if ($row['sale_mode'] !== null) {
            $offerings[(string) $row['slug'] . ':' . (string) $row['sale_mode']] = $row;
        }
    }

    $resolved = [];
    $totalCents = 0;
    foreach ($validated['items'] as $line) {
        $key = $line['fruitSlug'] . ':' . $line['mode'];
        $offering = $offerings[$key] ?? null;
        if (!$offering || !(bool) $offering['is_active'] || $offering['availability'] !== 'available' || $offering['price_mad'] === null) {
            isq_fail('ITEM_UNAVAILABLE', 'An item is not available for ordering.', 409, ['fruitSlug' => $line['fruitSlug'], 'mode' => $line['mode']]);
        }
        if ((bool) $offering['needs_owner_review']) {
            isq_fail('OWNER_REVIEW_REQUIRED', 'An item still needs owner review.', 409, ['fruitSlug' => $line['fruitSlug'], 'mode' => $line['mode']]);
        }
        $available = $offering['quantity_available'] === null ? null : (int) $offering['quantity_available'];
        if ($available !== null && $line['quantity'] > $available) {
            isq_fail('ITEM_UNAVAILABLE', 'The requested quantity is not available.', 409, [
                'fruitSlug' => $line['fruitSlug'],
                'mode' => $line['mode'],
                'quantityAvailable' => $available,
            ]);
        }
        $unitCents = isq_order_money_cents((string) $offering['price_mad']);
        $totalCents += $unitCents * $line['quantity'];
        if ($totalCents > 9999999999) {
            isq_fail('VALIDATION_FAILED', 'The order total is too large.', 422);
        }
        $resolved[] = [
            'fruitId' => (int) $offering['id'],
            'fruitSlug' => $line['fruitSlug'],
            'mode' => $line['mode'],
            'quantity' => $line['quantity'],
            'unitPriceMad' => isq_order_money_string($unitCents),
        ];
    }

    $statusToken = isq_random_token();
    $reference = '';
    $insert = $pdo->prepare(
        'INSERT INTO isq_orders '
        . '(reference, status_token_hash, request_key_hash, request_payload_hash, buyer_first_name, roblox_username, payment_method, city, quoted_total_mad) '
        . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for ($attempt = 0; $attempt < 8; $attempt++) {
        $reference = isq_order_reference();
        try {
            $insert->bindValue(1, $reference);
            $insert->bindValue(2, isq_token_hash($statusToken), PDO::PARAM_LOB);
            $insert->bindValue(3, $requestHash, PDO::PARAM_LOB);
            $insert->bindValue(4, $payloadHash, PDO::PARAM_LOB);
            $insert->bindValue(5, $validated['buyer']['firstName']);
            $insert->bindValue(6, $validated['buyer']['robloxUsername']);
            $insert->bindValue(7, $validated['buyer']['paymentMethod']);
            $insert->bindValue(8, $validated['buyer']['city']);
            $insert->bindValue(9, isq_order_money_string($totalCents));
            $insert->execute();
            break;
        } catch (PDOException $error) {
            $constraint = $error->getMessage();
            if ($error->getCode() === '23000' && str_contains($constraint, 'uq_isq_order_request')) {
                $concurrent = isq_order_find_by_request($pdo, $requestHash);
                if (!$concurrent) {
                    throw $error;
                }
                return isq_order_replay($pdo, $concurrent, $payloadHash);
            }
            if ($error->getCode() === '23000' && str_contains($constraint, 'uq_isq_order_reference') && $attempt < 7) {
                continue;
            }
            throw $error;
        }
    }
    $orderId = (int) $pdo->lastInsertId();
    if ($orderId < 1 || $reference === '') {
        throw new RuntimeException('The order reference could not be created.');
    }

    $itemInsert = $pdo->prepare(
        'INSERT INTO isq_order_items (order_id, fruit_id, sale_mode, quantity, unit_price_mad) VALUES (?, ?, ?, ?, ?)'
    );
    foreach ($resolved as $line) {
        $itemInsert->execute([$orderId, $line['fruitId'], $line['mode'], $line['quantity'], $line['unitPriceMad']]);
    }
    $history = $pdo->prepare(
        "INSERT INTO isq_order_status_history (order_id, from_status, to_status, public_note, order_version, changed_by) VALUES (?, NULL, 'new', NULL, 1, NULL)"
    );
    $history->execute([$orderId]);
    $created = $pdo->prepare('SELECT * FROM isq_orders WHERE id = ? LIMIT 1');
    $created->execute([$orderId]);
    $row = $created->fetch();
    if (!$row) {
        throw new RuntimeException('The created order could not be loaded.');
    }
    return ['order' => isq_order_response($pdo, $row, $statusToken), 'statusCode' => 201, 'idempotent' => false];
}

function isq_orders_main(): never
{
    isq_method('POST');
    isq_require_same_origin();
    header('Cache-Control: no-store');
    $input = isq_input();
    $validated = isq_order_validate_input($input);
    isq_rate_limit('orders.create', 12, 600);
    $pdo = isq_db();
    try {
        $pdo->beginTransaction();
        $result = isq_order_create($pdo, $validated);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    isq_ok(['order' => $result['order']], $result['statusCode'], ['idempotent' => $result['idempotent']]);
}

if (!defined('ISQ_ORDERS_LIBRARY_ONLY')) {
    isq_orders_main();
}
