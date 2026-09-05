<?php
declare(strict_types=1);

define('ISQ_ORDERS_LIBRARY_ONLY', true);
define('ISQ_ORDER_STATUS_LIBRARY_ONLY', true);
require_once __DIR__ . '/../api/v1/orders.php';
require_once __DIR__ . '/../api/v1/order-status.php';

$failures = [];
$assert = static function (bool $condition, string $message) use (&$failures): void {
    if (!$condition) {
        $failures[] = $message;
    }
};

$assert(isq_order_money_cents('155.00') === 15500, 'Money parser must preserve whole MAD values.');
$assert(isq_order_money_cents('12.34') === 1234, 'Money parser must preserve centimes.');
$assert(isq_order_money_string(1234) === '12.34', 'Money formatter must emit a decimal database value.');
for ($index = 0; $index < 20; $index++) {
    $assert((bool) preg_match('/^ISQ-\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/', isq_order_reference()), 'Order references must match the public 19-character format.');
}

$fruitsSource = file_get_contents(__DIR__ . '/../assets/js/fruits.js');
preg_match_all("/\{ id: '([a-z0-9-]+)', name:/", (string) $fruitsSource, $fruitMatches);
$assert(count($fruitMatches[1]) === 41, 'The storefront must expose exactly 41 immutable fruit IDs.');
$assert(count(array_unique($fruitMatches[1])) === 41, 'Fruit IDs must be unique.');

$appSource = file_get_contents(__DIR__ . '/../assets/js/app.js');
$assert(!str_contains((string) $appSource, 'data-order-advance'), 'Customers must not receive an order-status advance control.');
$assert(!str_contains((string) $appSource, 'createOrderReference'), 'Order references must not be generated in the browser.');
$assert(str_contains((string) $appSource, 'Authorization: `Bearer ${tracker.token}`'), 'Status tokens must travel in the Authorization header.');
$assert(!str_contains((string) $appSource, 'statusToken}`'), 'Status tokens must not be interpolated into URLs or rendered markup.');
$assert(str_contains((string) $appSource, "maximumFractionDigits: 2"), 'The storefront must preserve owner-entered MAD centimes.');
$assert(str_contains((string) $appSource, "localStorage.removeItem(key)"), 'Obsolete browser-generated order trackers must be removed during migration.');
$ordersSource = file_get_contents(__DIR__ . '/../api/v1/orders.php');
$assert(str_contains((string) $ordersSource, "str_contains(\$constraint, 'uq_isq_order_request')"), 'Concurrent idempotent request races must recover through the request constraint.');
$assert(str_contains((string) $ordersSource, "[A-Za-z0-9_]{3,20}"), 'Order usernames must follow Roblox\'s 3–20 character limit.');

$pdo = isq_db();
$pdo->beginTransaction();
try {
    $offering = $pdo->query(
        "SELECT o.fruit_id, o.sale_mode, o.price_mad, o.availability, o.quantity_available, o.needs_owner_review "
        . "FROM isq_fruit_offerings o JOIN isq_fruits f ON f.id = o.fruit_id WHERE f.slug = 'rocket' AND o.sale_mode = 'physical' FOR UPDATE"
    )->fetch();
    if (!$offering) {
        throw new RuntimeException('Rocket physical offering is missing. Run database migrations 001–005.');
    }
    $pdo->exec(
        "UPDATE isq_fruit_offerings o JOIN isq_fruits f ON f.id = o.fruit_id "
        . "SET o.price_mad = 123.45, o.availability = 'available', o.quantity_available = 2, o.needs_owner_review = 0 "
        . "WHERE f.slug = 'rocket' AND o.sale_mode = 'physical'"
    );

    $input = [
        'requestId' => '123e4567-e89b-42d3-a456-426614174000',
        'buyer' => [
            'firstName' => 'API Test',
            'robloxUsername' => 'Itemsouq_Test',
            'paymentMethod' => 'cash_plus',
            'city' => 'Casablanca',
        ],
        'items' => [['fruitSlug' => 'rocket', 'mode' => 'physical', 'quantity' => 2]],
    ];
    $validated = isq_order_validate_input($input);
    $created = isq_order_create($pdo, $validated);
    $order = $created['order'];
    $assert($created['statusCode'] === 201 && $created['idempotent'] === false, 'A new request must create one order.');
    $assert($order['totalMad'] === '246.90', 'The total must be calculated from the database price.');
    $assert($order['items'][0]['unitPriceMad'] === '123.45', 'The order must snapshot the database unit price.');
    $assert((bool) preg_match('/^ISQ-\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/', $order['reference']), 'The stored reference must use the public format.');
    $assert((bool) preg_match('/^[A-Za-z0-9_-]{32,128}$/', $order['statusToken']), 'The status token must be opaque and high entropy.');

    $publicStatus = isq_order_status_lookup($pdo, $order['reference'], $order['statusToken']);
    $assert($publicStatus !== null && $publicStatus['status'] === 'new', 'The private token must retrieve the new status.');
    $assert(!array_intersect(['buyer_first_name', 'firstName', 'roblox_username', 'robloxUsername', 'paymentMethod'], array_keys($publicStatus ?? [])), 'Public status must not expose buyer data.');
    $assert(isq_order_status_lookup($pdo, $order['reference'], str_repeat('x', 43)) === null, 'A wrong token must reveal no order.');

    $replayed = isq_order_create($pdo, $validated);
    $assert($replayed['statusCode'] === 200 && $replayed['idempotent'] === true, 'A repeated requestId must be idempotent.');
    $assert($replayed['order']['reference'] === $order['reference'], 'An idempotent retry must retain its reference.');
    $assert($replayed['order']['statusToken'] !== $order['statusToken'], 'An idempotent retry must safely rotate the one-time status token.');
    $assert(isq_order_status_lookup($pdo, $order['reference'], $order['statusToken']) === null, 'The rotated old status token must stop working.');
    $assert(isq_order_status_lookup($pdo, $order['reference'], $replayed['order']['statusToken']) !== null, 'The rotated status token must work.');
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
}

if ($failures !== []) {
    fwrite(STDERR, "Orders API tests failed:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

fwrite(STDOUT, "Orders API tests passed.\n");
