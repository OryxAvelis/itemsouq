<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/_private/bootstrap.php';

$base = rtrim((string) (getenv('ISQ_TEST_BASE_URL') ?: 'http://127.0.0.1:8012'), '/');
if (!str_ends_with($base, '/api/v1')) {
    $base .= '/api/v1';
}
$requestOrigin = preg_replace('~/api/v1$~', '', $base) ?: 'http://127.0.0.1:8012';
$configuredOrigin = (string) (isq_config()['origin'] ?? '');
$origin = $configuredOrigin !== '' ? $configuredOrigin : $requestOrigin;
$testHost = strtolower((string) parse_url($base, PHP_URL_HOST));
if (!in_array($testHost, ['127.0.0.1', 'localhost', '::1'], true)) {
    fwrite(STDERR, "Admin API integration test refused to mutate a non-local host.\n");
    exit(1);
}

$pdo = isq_db();
$cookieJar = tempnam(sys_get_temp_dir(), 'isq-admin-api-');
if ($cookieJar === false) {
    throw new RuntimeException('Could not create the temporary cookie jar.');
}

$sessionIds = [];
$ownerId = null;
$ownerUsername = null;
$offeringBefore = null;
$historyBefore = null;
$offeringTestState = null;
$orderId = null;
$orderReference = null;
$orderBuyerMarker = null;
$rateSnapshots = [];
$skipped = false;
$failure = null;
$cleanupFailures = [];

function admin_test_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/** @return array{status:int,json:array<string,mixed>,raw:string} */
function admin_test_request(
    string $method,
    string $url,
    ?array $body = null,
    ?string $csrfToken = null
): array {
    global $cookieJar, $origin, $sessionIds;

    $curl = curl_init($url);
    if ($curl === false) {
        throw new RuntimeException('Could not initialize cURL.');
    }
    $headers = [
        'Accept: application/json',
        'Origin: ' . $origin,
        'Sec-Fetch-Site: same-origin',
    ];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($csrfToken !== null) {
        $headers[] = 'X-CSRF-Token: ' . $csrfToken;
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR),
        CURLOPT_COOKIEFILE => $cookieJar,
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$sessionIds): int {
            $sessionName = preg_quote((string) isq_config()['session_name'], '/');
            if (preg_match('/^Set-Cookie:\s*' . $sessionName . '=([^;\s]*)/i', trim($line), $matches) === 1
                && preg_match('/^[A-Za-z0-9,-]{16,128}$/', $matches[1]) === 1) {
                $sessionIds[$matches[1]] = true;
            }
            return strlen($line);
        },
    ]);

    $raw = curl_exec($curl);
    if (!is_string($raw)) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException('HTTP request failed: ' . $message);
    }
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    try {
        $json = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('API response was not valid JSON (HTTP ' . $status . ').', 0, $error);
    }
    if (!is_array($json) || array_is_list($json)) {
        throw new RuntimeException('API response was not a JSON object.');
    }
    return ['status' => $status, 'json' => $json, 'raw' => $raw];
}

/** @return list<array{window_started_at:string,hit_count:string,expires_at:string}> */
function admin_test_rate_snapshot(PDO $pdo, string $scope, string $actorHash): array
{
    $statement = $pdo->prepare(
        'SELECT window_started_at, hit_count, expires_at FROM isq_rate_limit_buckets '
        . 'WHERE scope = ? AND actor_hash = ? ORDER BY window_started_at'
    );
    $statement->bindValue(1, $scope);
    $statement->bindValue(2, $actorHash, PDO::PARAM_LOB);
    $statement->execute();
    return $statement->fetchAll();
}

/** @param list<array{window_started_at:string,hit_count:string,expires_at:string}> $before */
function admin_test_restore_rate_snapshot(
    PDO $pdo,
    string $scope,
    string $actorHash,
    array $before
): void {
    $beforeByWindow = [];
    foreach ($before as $row) {
        $beforeByWindow[(string) $row['window_started_at']] = $row;
    }

    $current = admin_test_rate_snapshot($pdo, $scope, $actorHash);
    $delete = $pdo->prepare(
        'DELETE FROM isq_rate_limit_buckets WHERE scope = ? AND actor_hash = ? AND window_started_at = ?'
    );
    foreach ($current as $row) {
        $window = (string) $row['window_started_at'];
        if (isset($beforeByWindow[$window])) {
            continue;
        }
        $delete->bindValue(1, $scope);
        $delete->bindValue(2, $actorHash, PDO::PARAM_LOB);
        $delete->bindValue(3, $window);
        $delete->execute();
    }

    $restore = $pdo->prepare(
        'INSERT INTO isq_rate_limit_buckets (scope, actor_hash, window_started_at, hit_count, expires_at) '
        . 'VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE hit_count = VALUES(hit_count), expires_at = VALUES(expires_at)'
    );
    foreach ($before as $row) {
        $restore->bindValue(1, $scope);
        $restore->bindValue(2, $actorHash, PDO::PARAM_LOB);
        $restore->bindValue(3, $row['window_started_at']);
        $restore->bindValue(4, (int) $row['hit_count'], PDO::PARAM_INT);
        $restore->bindValue(5, $row['expires_at']);
        $restore->execute();
    }
}

/** @return list<array<string,mixed>> */
function admin_test_offering_history(PDO $pdo, int $fruitId, string $mode): array
{
    $statement = $pdo->prepare(
        'SELECT id, fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, '
        . 'offering_version, changed_by, changed_at FROM isq_fruit_offering_history '
        . 'WHERE fruit_id = ? AND sale_mode = ? ORDER BY id'
    );
    $statement->execute([$fruitId, $mode]);
    return $statement->fetchAll();
}

/** @param array<string,mixed> $left @param array<string,mixed> $right */
function admin_test_rows_equal(array $left, array $right, array $keys): bool
{
    foreach ($keys as $key) {
        if (($left[$key] ?? null) !== ($right[$key] ?? null)) {
            return false;
        }
    }
    return true;
}

function admin_test_reference(PDO $pdo): string
{
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $suffix = '';
        foreach (str_split(random_bytes(8)) as $byte) {
            $suffix .= $alphabet[ord($byte) & 31];
        }
        $reference = 'ISQ-' . gmdate('ymd') . '-' . $suffix;
        $check = $pdo->prepare('SELECT 1 FROM isq_orders WHERE reference = ?');
        $check->execute([$reference]);
        if ($check->fetchColumn() === false) {
            return $reference;
        }
    }
    throw new RuntimeException('Could not allocate a unique test order reference.');
}

try {
    $ownerCount = (int) $pdo->query('SELECT COUNT(*) FROM isq_owner_users')->fetchColumn();
    if ($ownerCount !== 0) {
        $session = admin_test_request('GET', $base . '/admin/session.php');
        admin_test_assert($session['status'] === 200, 'Anonymous session discovery failed.');
        admin_test_assert(($session['json']['data']['authenticated'] ?? null) === false, 'A fresh cookie jar was unexpectedly authenticated.');
        admin_test_assert(($session['json']['data']['setupRequired'] ?? null) === false, 'Existing-owner setup state was reported incorrectly.');
        $unauthorized = admin_test_request('GET', $base . '/admin/catalogue.php');
        admin_test_assert($unauthorized['status'] === 401, 'An anonymous owner request was not rejected.');
        admin_test_assert(($unauthorized['json']['error']['code'] ?? null) === 'AUTH_REQUIRED', 'Anonymous rejection used the wrong error code.');
        $skipped = true;
    } else {
        $setupToken = (string) (isq_config()['setup_token'] ?? '');
        admin_test_assert($setupToken !== '', 'The configured local setup token is empty.');

        $remoteAddress = (string) parse_url($base, PHP_URL_HOST);
        $setupActorHash = hash_hmac('sha256', $remoteAddress, (string) isq_config()['app_secret'], true);
        $rateSnapshots[] = [
            'scope' => 'owner.setup',
            'actorHash' => $setupActorHash,
            'rows' => admin_test_rate_snapshot($pdo, 'owner.setup', $setupActorHash),
        ];

        $anonymousSession = admin_test_request('GET', $base . '/admin/session.php');
        admin_test_assert($anonymousSession['status'] === 200, 'Initial session discovery failed.');
        admin_test_assert(($anonymousSession['json']['data']['authenticated'] ?? null) === false, 'Initial session must be anonymous.');
        admin_test_assert(($anonymousSession['json']['data']['setupRequired'] ?? null) === true, 'Initial session must require owner setup.');

        $unauthorized = admin_test_request('GET', $base . '/admin/catalogue.php');
        admin_test_assert($unauthorized['status'] === 401, 'The owner catalogue accepted an anonymous session.');
        admin_test_assert(($unauthorized['json']['error']['code'] ?? null) === 'AUTH_REQUIRED', 'Anonymous rejection used the wrong error code.');

        $ownerUsername = 'isq_admin_api_' . bin2hex(random_bytes(4));
        $ownerPassword = 'A9!' . bin2hex(random_bytes(16));
        $setup = admin_test_request('POST', $base . '/admin/setup.php', [
            'setupToken' => $setupToken,
            'username' => $ownerUsername,
            'password' => $ownerPassword,
        ]);
        admin_test_assert($setup['status'] === 201 && ($setup['json']['ok'] ?? false) === true, 'One-time owner setup failed.');
        $ownerId = filter_var($setup['json']['data']['owner']['id'] ?? null, FILTER_VALIDATE_INT);
        $csrfToken = $setup['json']['data']['csrfToken'] ?? null;
        admin_test_assert(is_int($ownerId) && $ownerId > 0, 'Owner setup did not return an owner ID.');
        admin_test_assert(is_string($csrfToken) && strlen($csrfToken) >= 32, 'Owner setup did not return a strong CSRF token.');
        admin_test_assert(($setup['json']['data']['owner']['username'] ?? null) === $ownerUsername, 'Owner setup returned the wrong username.');

        $ownerRow = $pdo->prepare('SELECT id, username FROM isq_owner_users WHERE id = ?');
        $ownerRow->execute([$ownerId]);
        $storedOwner = $ownerRow->fetch();
        admin_test_assert(
            is_array($storedOwner) && (string) $storedOwner['username'] === $ownerUsername,
            'The exact test owner was not stored.'
        );
        admin_test_assert((int) $pdo->query('SELECT COUNT(*) FROM isq_owner_users')->fetchColumn() === 1, 'Owner setup did not preserve singleton ownership.');

        $setupAgain = admin_test_request('POST', $base . '/admin/setup.php', [
            'setupToken' => $setupToken,
            'username' => $ownerUsername,
            'password' => $ownerPassword,
        ]);
        admin_test_assert($setupAgain['status'] === 409, 'Owner setup was not one-time.');
        admin_test_assert(($setupAgain['json']['error']['code'] ?? null) === 'SETUP_COMPLETE', 'Repeated setup used the wrong error code.');

        $session = admin_test_request('GET', $base . '/admin/session.php');
        admin_test_assert($session['status'] === 200, 'Authenticated session discovery failed.');
        admin_test_assert(($session['json']['data']['authenticated'] ?? null) === true, 'Setup session was not authenticated.');
        admin_test_assert(($session['json']['data']['owner']['id'] ?? null) === $ownerId, 'Session owner did not match the setup owner.');
        admin_test_assert(($session['json']['data']['csrfToken'] ?? null) === $csrfToken, 'Session did not retain the setup CSRF token.');

        $ownerActorHash = hash_hmac('sha256', $remoteAddress . "\0" . $ownerId, (string) isq_config()['app_secret'], true);
        foreach (['owner.catalogue.write', 'owner.order-status.write'] as $scope) {
            $rateSnapshots[] = [
                'scope' => $scope,
                'actorHash' => $ownerActorHash,
                'rows' => admin_test_rate_snapshot($pdo, $scope, $ownerActorHash),
            ];
        }

        $candidate = $pdo->query(
            'SELECT f.slug, o.* FROM isq_fruit_offerings o '
            . 'JOIN isq_fruits f ON f.id = o.fruit_id AND f.is_active = 1 '
            . 'LEFT JOIN isq_fruit_offering_history h ON h.fruit_id = o.fruit_id '
            . 'AND h.sale_mode = o.sale_mode AND h.offering_version = o.version + 1 '
            . 'WHERE h.id IS NULL ORDER BY (f.slug = \'rocket\') DESC, f.slug, o.sale_mode LIMIT 1'
        )->fetch();
        admin_test_assert(is_array($candidate), 'No catalogue offering is safe for an optimistic update test.');
        $offeringBefore = $candidate;
        $historyBefore = admin_test_offering_history($pdo, (int) $candidate['fruit_id'], (string) $candidate['sale_mode']);

        $catalogue = admin_test_request('GET', $base . '/admin/catalogue.php');
        admin_test_assert($catalogue['status'] === 200, 'Authenticated catalogue read failed.');
        $catalogueOffering = null;
        foreach (($catalogue['json']['data']['fruits'] ?? []) as $fruit) {
            if (($fruit['id'] ?? null) === $candidate['slug']) {
                $catalogueOffering = $fruit['offerings'][$candidate['sale_mode']] ?? null;
                break;
            }
        }
        admin_test_assert(is_array($catalogueOffering), 'The selected offering was missing from the owner catalogue.');
        admin_test_assert((int) ($catalogueOffering['version'] ?? 0) === (int) $candidate['version'], 'Owner catalogue returned the wrong offering version.');

        $missingCsrf = admin_test_request('POST', $base . '/admin/catalogue.php', [
            'fruitSlug' => $candidate['slug'],
            'mode' => $candidate['sale_mode'],
            'priceMad' => '4321.09',
            'availability' => 'available',
            'quantityAvailable' => 7,
            'expectedVersion' => (int) $candidate['version'],
        ]);
        admin_test_assert($missingCsrf['status'] === 403, 'An authenticated write without CSRF was not rejected.');
        admin_test_assert(($missingCsrf['json']['error']['code'] ?? null) === 'CSRF_REJECTED', 'Missing CSRF used the wrong error code.');

        $unchanged = $pdo->prepare('SELECT * FROM isq_fruit_offerings WHERE fruit_id = ? AND sale_mode = ?');
        $unchanged->execute([$candidate['fruit_id'], $candidate['sale_mode']]);
        admin_test_assert(
            admin_test_rows_equal($candidate, $unchanged->fetch(), [
                'fruit_id', 'sale_mode', 'price_mad', 'availability', 'quantity_available',
                'needs_owner_review', 'version', 'updated_by', 'created_at', 'updated_at',
            ]),
            'Rejected CSRF request changed the offering.'
        );
        admin_test_assert(
            admin_test_offering_history($pdo, (int) $candidate['fruit_id'], (string) $candidate['sale_mode']) === $historyBefore,
            'Rejected CSRF request changed offering history.'
        );

        $offeringTestState = [
            'price_mad' => '4321.09',
            'availability' => 'available',
            'quantity_available' => '7',
            'needs_owner_review' => '0',
            'version' => (string) ((int) $candidate['version'] + 1),
            'updated_by' => (string) $ownerId,
        ];
        $updated = admin_test_request('POST', $base . '/admin/catalogue.php', [
            'fruitSlug' => $candidate['slug'],
            'mode' => $candidate['sale_mode'],
            'priceMad' => '4321.09',
            'availability' => 'available',
            'quantityAvailable' => 7,
            'expectedVersion' => (int) $candidate['version'],
        ], $csrfToken);
        admin_test_assert($updated['status'] === 200 && ($updated['json']['ok'] ?? false) === true, 'CSRF-authenticated catalogue update failed.');
        admin_test_assert(($updated['json']['data']['offering']['priceMad'] ?? null) === '4321.09', 'Updated price did not round-trip.');
        admin_test_assert(($updated['json']['data']['offering']['availability'] ?? null) === 'available', 'Updated availability did not round-trip.');
        admin_test_assert(($updated['json']['data']['offering']['quantityAvailable'] ?? null) === 7, 'Updated quantity did not round-trip.');
        admin_test_assert(($updated['json']['data']['offering']['needsOwnerReview'] ?? null) === false, 'Catalogue update did not clear owner review.');
        admin_test_assert(
            ($updated['json']['data']['offering']['version'] ?? null) === (int) $candidate['version'] + 1,
            'Catalogue update did not advance the optimistic version.'
        );

        $historyAfter = admin_test_offering_history($pdo, (int) $candidate['fruit_id'], (string) $candidate['sale_mode']);
        admin_test_assert(count($historyAfter) === count($historyBefore) + 1, 'Catalogue update did not append exactly one history row.');
        $catalogueHistory = $historyAfter[array_key_last($historyAfter)];
        admin_test_assert((int) $catalogueHistory['offering_version'] === (int) $candidate['version'] + 1, 'Catalogue history stored the wrong version.');
        admin_test_assert((int) $catalogueHistory['changed_by'] === $ownerId, 'Catalogue history did not attribute the test owner.');

        $conflict = admin_test_request('POST', $base . '/admin/catalogue.php', [
            'fruitSlug' => $candidate['slug'],
            'mode' => $candidate['sale_mode'],
            'priceMad' => '111.11',
            'availability' => 'available',
            'quantityAvailable' => 1,
            'expectedVersion' => (int) $candidate['version'],
        ], $csrfToken);
        admin_test_assert($conflict['status'] === 409, 'A stale catalogue write was not rejected.');
        admin_test_assert(($conflict['json']['error']['code'] ?? null) === 'VERSION_CONFLICT', 'Stale catalogue write used the wrong error code.');
        admin_test_assert(
            ($conflict['json']['error']['details']['currentVersion'] ?? null) === (int) $candidate['version'] + 1,
            'Catalogue conflict did not return the current version.'
        );
        admin_test_assert(
            count(admin_test_offering_history($pdo, (int) $candidate['fruit_id'], (string) $candidate['sale_mode'])) === count($historyBefore) + 1,
            'Rejected catalogue conflict appended history.'
        );

        $orderReference = admin_test_reference($pdo);
        $orderBuyerMarker = 'Admin API test ' . bin2hex(random_bytes(4));
        $insertOrder = $pdo->prepare(
            'INSERT INTO isq_orders '
            . '(reference, status_token_hash, request_key_hash, request_payload_hash, buyer_first_name, roblox_username, '
            . 'payment_method, city, quoted_total_mad, status, public_note, version) '
            . "VALUES (?, ?, ?, ?, ?, 'AdminApiFixture', 'cash_plus', 'Test fixture', 4321.09, 'new', NULL, 1)"
        );
        $insertOrder->bindValue(1, $orderReference);
        $insertOrder->bindValue(2, random_bytes(32), PDO::PARAM_LOB);
        $insertOrder->bindValue(3, random_bytes(32), PDO::PARAM_LOB);
        $insertOrder->bindValue(4, random_bytes(32), PDO::PARAM_LOB);
        $insertOrder->bindValue(5, $orderBuyerMarker);
        $insertOrder->execute();
        $orderId = (int) $pdo->lastInsertId();
        admin_test_assert($orderId > 0, 'Could not create the isolated order fixture.');
        $insertItem = $pdo->prepare(
            'INSERT INTO isq_order_items (order_id, fruit_id, sale_mode, quantity, unit_price_mad) VALUES (?, ?, ?, 1, 4321.09)'
        );
        $insertItem->execute([$orderId, $candidate['fruit_id'], $candidate['sale_mode']]);
        $insertInitialHistory = $pdo->prepare(
            "INSERT INTO isq_order_status_history (order_id, from_status, to_status, public_note, order_version, changed_by) "
            . "VALUES (?, NULL, 'new', NULL, 1, NULL)"
        );
        $insertInitialHistory->execute([$orderId]);

        $orders = admin_test_request('GET', $base . '/admin/orders.php?limit=100');
        admin_test_assert($orders['status'] === 200, 'Authenticated order list failed.');
        $listedOrder = null;
        foreach (($orders['json']['data']['orders'] ?? []) as $order) {
            if (($order['reference'] ?? null) === $orderReference) {
                $listedOrder = $order;
                break;
            }
        }
        admin_test_assert(is_array($listedOrder), 'The isolated order fixture was missing from the owner queue.');
        admin_test_assert(($listedOrder['buyer']['firstName'] ?? null) === $orderBuyerMarker, 'Owner order list returned the wrong buyer.');
        admin_test_assert(($listedOrder['status'] ?? null) === 'new' && ($listedOrder['version'] ?? null) === 1, 'Owner order list returned the wrong initial state.');

        $orderNote = 'Admin API integration test status';
        $orderUpdated = admin_test_request('POST', $base . '/admin/order-status.php', [
            'reference' => $orderReference,
            'status' => 'contacted',
            'publicNote' => $orderNote,
            'expectedVersion' => 1,
            'csrfToken' => $csrfToken,
        ]);
        admin_test_assert($orderUpdated['status'] === 200, 'Owner order status update failed.');
        admin_test_assert(($orderUpdated['json']['data']['status'] ?? null) === 'contacted', 'Order status did not round-trip.');
        admin_test_assert(($orderUpdated['json']['data']['publicNote'] ?? null) === $orderNote, 'Order public note did not round-trip.');
        admin_test_assert(($orderUpdated['json']['data']['version'] ?? null) === 2, 'Order status update did not advance the version.');

        $orderHistory = $pdo->prepare(
            'SELECT from_status, to_status, public_note, order_version, changed_by '
            . 'FROM isq_order_status_history WHERE order_id = ? ORDER BY order_version'
        );
        $orderHistory->execute([$orderId]);
        $orderHistoryRows = $orderHistory->fetchAll();
        admin_test_assert(count($orderHistoryRows) === 2, 'Order status update did not append exactly one history row.');
        admin_test_assert($orderHistoryRows[1]['from_status'] === 'new' && $orderHistoryRows[1]['to_status'] === 'contacted', 'Order history stored the wrong transition.');
        admin_test_assert((int) $orderHistoryRows[1]['changed_by'] === $ownerId, 'Order history did not attribute the test owner.');

        $orderConflict = admin_test_request('POST', $base . '/admin/order-status.php', [
            'reference' => $orderReference,
            'status' => 'confirmed',
            'publicNote' => 'This must not persist',
            'expectedVersion' => 1,
            'csrfToken' => $csrfToken,
        ]);
        admin_test_assert($orderConflict['status'] === 409, 'A stale order status write was not rejected.');
        admin_test_assert(($orderConflict['json']['error']['code'] ?? null) === 'VERSION_CONFLICT', 'Stale order write used the wrong error code.');
        $orderHistory->execute([$orderId]);
        admin_test_assert(count($orderHistory->fetchAll()) === 2, 'Rejected order conflict appended history.');

        $logout = admin_test_request('POST', $base . '/admin/logout.php', ['csrfToken' => $csrfToken]);
        admin_test_assert($logout['status'] === 200 && ($logout['json']['data']['authenticated'] ?? null) === false, 'Owner logout failed.');
        $afterLogout = admin_test_request('GET', $base . '/admin/session.php');
        admin_test_assert(($afterLogout['json']['data']['authenticated'] ?? null) === false, 'Logged-out session remained authenticated.');
        $rejectedAfterLogout = admin_test_request('GET', $base . '/admin/catalogue.php');
        admin_test_assert($rejectedAfterLogout['status'] === 401, 'Logged-out session retained owner access.');
        admin_test_assert(($rejectedAfterLogout['json']['error']['code'] ?? null) === 'AUTH_REQUIRED', 'Post-logout rejection used the wrong error code.');
    }
} catch (Throwable $error) {
    $failure = $error;
} finally {
    try {
        if ($ownerId === null && is_string($ownerUsername)) {
            $recoverOwner = $pdo->prepare(
                'SELECT id FROM isq_owner_users WHERE singleton_key = 1 AND username = ? LIMIT 1'
            );
            $recoverOwner->execute([$ownerUsername]);
            $recoveredOwnerId = $recoverOwner->fetchColumn();
            if ($recoveredOwnerId !== false) {
                $ownerId = (int) $recoveredOwnerId;
            }
        }
        if ($ownerId !== null) {
            $pdo->beginTransaction();
            try {
                if ($orderId !== null) {
                    $deleteOrder = $pdo->prepare(
                        'DELETE FROM isq_orders WHERE id = ? AND reference = ? AND buyer_first_name = ?'
                    );
                    $deleteOrder->execute([$orderId, $orderReference, $orderBuyerMarker]);
                    if ($deleteOrder->rowCount() !== 1) {
                        throw new RuntimeException('Cleanup refused to delete an order that no longer matched the exact test fixture.');
                    }
                }

                if (is_array($offeringBefore)) {
                    $lockOffering = $pdo->prepare(
                        'SELECT * FROM isq_fruit_offerings WHERE fruit_id = ? AND sale_mode = ? FOR UPDATE'
                    );
                    $lockOffering->execute([$offeringBefore['fruit_id'], $offeringBefore['sale_mode']]);
                    $currentOffering = $lockOffering->fetch();
                    if (!is_array($currentOffering)) {
                        throw new RuntimeException('Cleanup could not find the snapshotted offering.');
                    }
                    $offeringKeys = [
                        'fruit_id', 'sale_mode', 'price_mad', 'availability', 'quantity_available',
                        'needs_owner_review', 'version', 'updated_by', 'created_at', 'updated_at',
                    ];
                    $alreadyOriginal = admin_test_rows_equal($offeringBefore, $currentOffering, $offeringKeys);
                    if (!$alreadyOriginal) {
                        if (!is_array($offeringTestState)
                            || !admin_test_rows_equal($offeringTestState, $currentOffering, array_keys($offeringTestState))) {
                            throw new RuntimeException('Cleanup refused to overwrite an offering that no longer matched the test update.');
                        }
                        $deleteHistory = $pdo->prepare(
                            'DELETE FROM isq_fruit_offering_history WHERE fruit_id = ? AND sale_mode = ? '
                            . 'AND offering_version = ? AND changed_by = ?'
                        );
                        $deleteHistory->execute([
                            $offeringBefore['fruit_id'],
                            $offeringBefore['sale_mode'],
                            (int) $offeringBefore['version'] + 1,
                            $ownerId,
                        ]);
                        if ($deleteHistory->rowCount() !== 1) {
                            throw new RuntimeException('Cleanup could not identify exactly one test catalogue history row.');
                        }

                        $restoreOffering = $pdo->prepare(
                            'UPDATE isq_fruit_offerings SET price_mad = ?, availability = ?, quantity_available = ?, '
                            . 'needs_owner_review = ?, version = ?, updated_by = ?, created_at = ?, updated_at = ? '
                            . 'WHERE fruit_id = ? AND sale_mode = ? AND version = ? AND updated_by = ?'
                        );
                        $restoreOffering->execute([
                            $offeringBefore['price_mad'],
                            $offeringBefore['availability'],
                            $offeringBefore['quantity_available'],
                            $offeringBefore['needs_owner_review'],
                            $offeringBefore['version'],
                            $offeringBefore['updated_by'],
                            $offeringBefore['created_at'],
                            $offeringBefore['updated_at'],
                            $offeringBefore['fruit_id'],
                            $offeringBefore['sale_mode'],
                            (int) $offeringBefore['version'] + 1,
                            $ownerId,
                        ]);
                        if ($restoreOffering->rowCount() !== 1) {
                            throw new RuntimeException('Cleanup did not restore the exact offering snapshot.');
                        }
                    }
                }

                $externalReferences = $pdo->prepare(
                    'SELECT '
                    . '(SELECT COUNT(*) FROM isq_fruit_offerings WHERE updated_by = ?) + '
                    . '(SELECT COUNT(*) FROM isq_fruit_offering_history WHERE changed_by = ?) + '
                    . '(SELECT COUNT(*) FROM isq_order_status_history WHERE changed_by = ?) AS reference_count'
                );
                $externalReferences->execute([$ownerId, $ownerId, $ownerId]);
                if ((int) $externalReferences->fetchColumn() !== 0) {
                    throw new RuntimeException('Cleanup refused to delete the test owner because unexpected rows reference it.');
                }
                $deleteOwner = $pdo->prepare(
                    'DELETE FROM isq_owner_users WHERE id = ? AND singleton_key = 1 AND username = ?'
                );
                $deleteOwner->execute([$ownerId, $ownerUsername]);
                if ($deleteOwner->rowCount() !== 1) {
                    throw new RuntimeException('Cleanup could not identify the exact test owner.');
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
        }
    } catch (Throwable $error) {
        $cleanupFailures[] = $error->getMessage();
    }

    foreach (array_reverse($rateSnapshots) as $snapshot) {
        try {
            admin_test_restore_rate_snapshot($pdo, $snapshot['scope'], $snapshot['actorHash'], $snapshot['rows']);
        } catch (Throwable $error) {
            $cleanupFailures[] = 'Rate-limit cleanup failed for ' . $snapshot['scope'] . ': ' . $error->getMessage();
        }
    }

    if (is_array($offeringBefore) && is_array($historyBefore) && $cleanupFailures === []) {
        try {
            $verifyOffering = $pdo->prepare('SELECT * FROM isq_fruit_offerings WHERE fruit_id = ? AND sale_mode = ?');
            $verifyOffering->execute([$offeringBefore['fruit_id'], $offeringBefore['sale_mode']]);
            $restored = $verifyOffering->fetch();
            admin_test_assert(is_array($restored), 'Restored offering is missing.');
            admin_test_assert(
                admin_test_rows_equal($offeringBefore, $restored, [
                    'fruit_id', 'sale_mode', 'price_mad', 'availability', 'quantity_available',
                    'needs_owner_review', 'version', 'updated_by', 'created_at', 'updated_at',
                ]),
                'Offering cleanup did not restore the exact original state and version.'
            );
            admin_test_assert(
                admin_test_offering_history($pdo, (int) $offeringBefore['fruit_id'], (string) $offeringBefore['sale_mode']) === $historyBefore,
                'Offering cleanup did not restore the exact original history.'
            );
            admin_test_assert((int) $pdo->query('SELECT COUNT(*) FROM isq_owner_users')->fetchColumn() === 0, 'The test owner remains after cleanup.');
            if ($orderId !== null) {
                $verifyOrder = $pdo->prepare('SELECT COUNT(*) FROM isq_orders WHERE id = ? AND reference = ?');
                $verifyOrder->execute([$orderId, $orderReference]);
                admin_test_assert((int) $verifyOrder->fetchColumn() === 0, 'The test order remains after cleanup.');
            }
        } catch (Throwable $error) {
            $cleanupFailures[] = $error->getMessage();
        }
    }

    $sessionPath = realpath(__DIR__ . '/../api/_private/sessions');
    if (is_string($sessionPath)) {
        foreach (array_keys($sessionIds) as $sessionId) {
            $sessionFile = $sessionPath . DIRECTORY_SEPARATOR . 'sess_' . $sessionId;
            if (is_file($sessionFile) && !unlink($sessionFile)) {
                $cleanupFailures[] = 'Could not remove the exact test session file ' . basename($sessionFile) . '.';
            }
        }
    }
    if (is_file($cookieJar) && !unlink($cookieJar)) {
        $cleanupFailures[] = 'Could not remove the temporary cookie jar.';
    }
}

if ($failure !== null || $cleanupFailures !== []) {
    $messages = [];
    if ($failure !== null) {
        $messages[] = $failure->getMessage();
    }
    array_push($messages, ...$cleanupFailures);
    fwrite(STDERR, "Admin API integration tests failed:\n- " . implode("\n- ", $messages) . "\n");
    exit(1);
}

if ($skipped) {
    fwrite(STDOUT, "Admin API integration tests skipped: an owner already exists; local owner state was not touched.\n");
    exit(0);
}

fwrite(STDOUT, "Admin API integration tests passed; owner, order, sessions, rate limits, and catalogue state were restored.\n");
