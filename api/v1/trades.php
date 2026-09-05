<?php
declare(strict_types=1);

require_once __DIR__ . '/../_private/bootstrap.php';

header('Cache-Control: no-store, max-age=0');

function isq_trading_validate_trade_id(mixed $value): string
{
    $id = is_string($value) ? strtoupper(trim($value)) : '';
    if (!preg_match('/^TRD-[0-9A-HJKMNP-TV-Z]{16}$/', $id)) {
        isq_fail('VALIDATION_FAILED', 'A valid trade ID is required.', 422, ['field' => 'tradeId']);
    }
    return $id;
}

function isq_trading_validate_response_id(mixed $value): string
{
    $id = is_string($value) ? strtoupper(trim($value)) : '';
    if (!preg_match('/^RSP-[0-9A-HJKMNP-TV-Z]{16}$/', $id)) {
        isq_fail('VALIDATION_FAILED', 'A valid response ID is required.', 422, ['field' => 'responseId']);
    }
    return $id;
}

function isq_trading_note(mixed $value, int $maximum, string $field): string
{
    if ($value === null) {
        return '';
    }
    if (!is_string($value)) {
        isq_fail('VALIDATION_FAILED', 'The note must be text.', 422, ['field' => $field]);
    }
    $note = trim($value);
    $length = function_exists('mb_strlen') ? mb_strlen($note, 'UTF-8') : strlen($note);
    if ($length > $maximum) {
        isq_fail('VALIDATION_FAILED', sprintf('The note must contain at most %d characters.', $maximum), 422, ['field' => $field]);
    }
    return $note;
}

/** @return list<array{fruitSlug:string,quantity:int}> */
function isq_trading_validate_lines(mixed $value, string $mode, string $field): array
{
    if (is_array($value) && array_is_list($value)) {
        $value = array_map(static function (mixed $line): mixed {
            if (is_array($line) && !isset($line['fruitSlug']) && is_string($line['fruitId'] ?? null)) {
                $line['fruitSlug'] = $line['fruitId'];
            }
            return $line;
        }, $value);
    }
    return isq_validate_trade_lines($value, $mode, $field);
}

/** @param list<array{fruitSlug:string,quantity:int}> $lines @return list<array{fruitId:int,fruitSlug:string,quantity:int}> */
function isq_trading_resolve_lines(PDO $pdo, array $lines, string $field): array
{
    $slugs = array_column($lines, 'fruitSlug');
    $placeholders = implode(',', array_fill(0, count($slugs), '?'));
    $statement = $pdo->prepare("SELECT id, slug FROM isq_fruits WHERE is_active = 1 AND slug IN ($placeholders)");
    $statement->execute($slugs);
    $ids = [];
    foreach ($statement->fetchAll() as $row) {
        $ids[(string) $row['slug']] = (int) $row['id'];
    }
    if (count($ids) !== count($slugs)) {
        isq_fail('VALIDATION_FAILED', 'One or more fruits are unavailable.', 422, ['field' => $field]);
    }
    return array_map(static fn (array $line): array => [
        'fruitId' => $ids[$line['fruitSlug']],
        'fruitSlug' => $line['fruitSlug'],
        'quantity' => $line['quantity'],
    ], $lines);
}

function isq_trading_request_key(string $scope, string $requestId): string
{
    return hash('sha256', $scope . "\0" . $requestId, true);
}

/** @param array<string,mixed> $payload */
function isq_trading_payload_hash(array $payload): string
{
    return hash('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), true);
}

function isq_trading_capability(string $scope, string $requestId): string
{
    $raw = hash_hmac('sha256', $scope . "\0" . $requestId, (string) isq_config()['app_secret'], true);
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

/** @return array<string,mixed>|false */
function isq_trading_trade_row(PDO $pdo, string $publicId, bool $forUpdate = false, bool $includeRemoved = false): array|false
{
    $sql = 'SELECT * FROM isq_trades WHERE public_id = ?' . ($includeRemoved ? '' : " AND status <> 'removed'") . ' LIMIT 1';
    if ($forUpdate) {
        $sql .= ' FOR UPDATE';
    }
    $statement = $pdo->prepare($sql);
    $statement->execute([$publicId]);
    return $statement->fetch();
}

/** @param list<int> $tradeIds @return array<int,array{offered:list<array{fruitId:string,quantity:int}>,wanted:list<array{fruitId:string,quantity:int}>}> */
function isq_trading_items_for_trades(PDO $pdo, array $tradeIds): array
{
    if ($tradeIds === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($tradeIds), '?'));
    $statement = $pdo->prepare(
        "SELECT i.trade_id, i.side, f.slug, i.quantity FROM isq_trade_items i "
        . "JOIN isq_fruits f ON f.id = i.fruit_id WHERE i.trade_id IN ($placeholders) "
        . 'ORDER BY i.trade_id, i.side, f.sort_order'
    );
    $statement->execute($tradeIds);
    $result = [];
    foreach ($tradeIds as $tradeId) {
        $result[$tradeId] = ['offered' => [], 'wanted' => []];
    }
    foreach ($statement->fetchAll() as $row) {
        $tradeId = (int) $row['trade_id'];
        $side = (string) $row['side'];
        if (!isset($result[$tradeId]) || !isset($result[$tradeId][$side])) {
            continue;
        }
        $result[$tradeId][$side][] = ['fruitId' => (string) $row['slug'], 'quantity' => (int) $row['quantity']];
    }
    return $result;
}

/** @param list<int> $tradeIds @return array<int,int> */
function isq_trading_response_counts(PDO $pdo, array $tradeIds): array
{
    if ($tradeIds === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($tradeIds), '?'));
    $statement = $pdo->prepare(
        "SELECT trade_id, COUNT(*) AS total FROM isq_trade_responses WHERE trade_id IN ($placeholders) "
        . "AND outcome <> 'removed' GROUP BY trade_id"
    );
    $statement->execute($tradeIds);
    $result = array_fill_keys($tradeIds, 0);
    foreach ($statement->fetchAll() as $row) {
        $result[(int) $row['trade_id']] = (int) $row['total'];
    }
    return $result;
}

/** @param array<string,mixed> $row @param array{offered:list<array{fruitId:string,quantity:int}>,wanted:list<array{fruitId:string,quantity:int}>} $items @return array<string,mixed> */
function isq_trading_trade_dto(array $row, array $items, int $responseCount): array
{
    $status = (string) $row['status'];
    if ($status === 'open' && strtotime((string) $row['expires_at'] . ' UTC') <= time()) {
        $status = 'expired';
    }
    return [
        'id' => (string) $row['public_id'],
        'username' => (string) $row['username'],
        'mode' => (string) $row['sale_mode'],
        'status' => $status,
        'note' => (string) ($row['note'] ?? ''),
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
        'expiresAt' => isq_iso((string) $row['expires_at']),
        'version' => (int) $row['version'],
        'offered' => $items['offered'],
        'wanted' => $items['wanted'],
        'responseCount' => $responseCount,
    ];
}

/** @return array<string,mixed> */
function isq_trading_load_trade(PDO $pdo, array $row): array
{
    $tradeId = (int) $row['id'];
    $items = isq_trading_items_for_trades($pdo, [$tradeId]);
    $counts = isq_trading_response_counts($pdo, [$tradeId]);
    return isq_trading_trade_dto($row, $items[$tradeId], $counts[$tradeId] ?? 0);
}

/** @return list<array<string,mixed>> */
function isq_trading_load_responses(PDO $pdo, int $tradeId): array
{
    $statement = $pdo->prepare(
        "SELECT * FROM isq_trade_responses WHERE trade_id = ? AND outcome <> 'removed' ORDER BY created_at DESC, id DESC LIMIT 50"
    );
    $statement->execute([$tradeId]);
    $rows = array_reverse($statement->fetchAll());
    if ($rows === []) {
        return [];
    }
    $responseIds = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    $placeholders = implode(',', array_fill(0, count($responseIds), '?'));
    $itemStatement = $pdo->prepare(
        "SELECT i.response_id, f.slug, i.quantity FROM isq_trade_response_items i "
        . "JOIN isq_fruits f ON f.id = i.fruit_id WHERE i.response_id IN ($placeholders) "
        . 'ORDER BY i.response_id, f.sort_order'
    );
    $itemStatement->execute($responseIds);
    $items = array_fill_keys($responseIds, []);
    foreach ($itemStatement->fetchAll() as $item) {
        $items[(int) $item['response_id']][] = ['fruitId' => (string) $item['slug'], 'quantity' => (int) $item['quantity']];
    }
    return array_map(static fn (array $row): array => [
        'id' => (string) $row['public_id'],
        'username' => (string) $row['username'],
        'offered' => $items[(int) $row['id']] ?? [],
        'note' => (string) ($row['note'] ?? ''),
        'outcome' => (string) $row['outcome'],
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
        'version' => (int) $row['version'],
    ], $rows);
}

/** @param array<string,mixed> $row @return array<string,mixed> */
function isq_trading_load_response(PDO $pdo, array $row): array
{
    $statement = $pdo->prepare(
        'SELECT f.slug, i.quantity FROM isq_trade_response_items i '
        . 'JOIN isq_fruits f ON f.id = i.fruit_id WHERE i.response_id = ? ORDER BY f.sort_order'
    );
    $statement->execute([(int) $row['id']]);
    $offered = array_map(static fn (array $item): array => [
        'fruitId' => (string) $item['slug'],
        'quantity' => (int) $item['quantity'],
    ], $statement->fetchAll());
    return [
        'id' => (string) $row['public_id'],
        'username' => (string) $row['username'],
        'offered' => $offered,
        'note' => (string) ($row['note'] ?? ''),
        'outcome' => (string) $row['outcome'],
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
        'version' => (int) $row['version'],
    ];
}

function isq_trading_assert_capability(array $row, ?string $token): void
{
    if ($token === null || !hash_equals((string) $row['manage_token_hash'], isq_token_hash($token))) {
        isq_fail('CAPABILITY_REJECTED', 'The management token is missing or invalid.', 403);
    }
}

function isq_trading_list(): never
{
    isq_rate_limit('trades.read', 180, 60);
    $mode = strtolower(trim((string) ($_GET['mode'] ?? 'all')));
    $status = strtolower(trim((string) ($_GET['status'] ?? 'all')));
    $limit = filter_var($_GET['limit'] ?? 50, FILTER_VALIDATE_INT);
    if (!in_array($mode, ['all', 'physical', 'permanent'], true)
        || !in_array($status, ['all', 'open', 'matched', 'completed', 'closed'], true)
        || $limit === false || $limit < 1 || $limit > 100) {
        isq_fail('VALIDATION_FAILED', 'Invalid trade filters.', 422);
    }

    $where = ["status <> 'removed'"];
    $parameters = [];
    if ($mode !== 'all') {
        $where[] = 'sale_mode = ?';
        $parameters[] = $mode;
    }
    if ($status === 'open') {
        $where[] = "status = 'open' AND expires_at > UTC_TIMESTAMP()";
    } elseif ($status !== 'all') {
        $where[] = 'status = ?';
        $parameters[] = $status;
    }
    $parameters[] = $limit;
    $pdo = isq_db();
    $statement = $pdo->prepare('SELECT * FROM isq_trades WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC, id DESC LIMIT ?');
    foreach ($parameters as $index => $parameter) {
        $statement->bindValue($index + 1, $parameter, $index === array_key_last($parameters) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $statement->execute();
    $rows = $statement->fetchAll();
    $tradeIds = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    $items = isq_trading_items_for_trades($pdo, $tradeIds);
    $counts = isq_trading_response_counts($pdo, $tradeIds);
    $trades = array_map(static fn (array $row): array => isq_trading_trade_dto(
        $row,
        $items[(int) $row['id']] ?? ['offered' => [], 'wanted' => []],
        $counts[(int) $row['id']] ?? 0
    ), $rows);

    $stats = $pdo->query(
        "SELECT (SELECT COUNT(*) FROM isq_trades WHERE status = 'open' AND expires_at > UTC_TIMESTAMP()) AS open_count, "
        . "(SELECT COUNT(*) FROM isq_trade_responses r JOIN isq_trades t ON t.id = r.trade_id "
        . "WHERE r.outcome <> 'removed' AND t.status <> 'removed') AS response_count"
    )->fetch();
    isq_ok(['trades' => $trades, 'stats' => [
        'open' => (int) ($stats['open_count'] ?? 0),
        'responses' => (int) ($stats['response_count'] ?? 0),
    ], 'nextCursor' => null]);
}

function isq_trading_create(): never
{
    isq_require_same_origin();
    isq_rate_limit('trades.create', 6, 600);
    $input = isq_input();
    $requestId = isq_validate_request_id($input['requestId'] ?? null);
    $username = isq_validate_username($input['username'] ?? null);
    $mode = is_string($input['mode'] ?? null) ? strtolower(trim($input['mode'])) : '';
    if (!in_array($mode, ['physical', 'permanent'], true)) {
        isq_fail('VALIDATION_FAILED', 'Invalid trade mode.', 422, ['field' => 'mode']);
    }
    $note = isq_trading_note($input['note'] ?? '', 180, 'note');
    $offered = isq_trading_validate_lines($input['offered'] ?? null, $mode, 'offered');
    $wanted = isq_trading_validate_lines($input['wanted'] ?? null, $mode, 'wanted');
    if (array_intersect(array_column($offered, 'fruitSlug'), array_column($wanted, 'fruitSlug')) !== []) {
        isq_fail('VALIDATION_FAILED', 'The same fruit cannot appear on both sides.', 422, ['field' => 'wanted']);
    }

    $normalized = compact('username', 'mode', 'note', 'offered', 'wanted');
    $requestKey = isq_trading_request_key('trade:create', $requestId);
    $payloadHash = isq_trading_payload_hash($normalized);
    $manageToken = isq_trading_capability('trade:create', $requestId);
    $pdo = isq_db();
    $resolvedOffered = isq_trading_resolve_lines($pdo, $offered, 'offered');
    $resolvedWanted = isq_trading_resolve_lines($pdo, $wanted, 'wanted');

    $existing = $pdo->prepare('SELECT * FROM isq_trades WHERE request_key_hash = ? LIMIT 1');
    $existing->execute([$requestKey]);
    $row = $existing->fetch();
    if ($row) {
        if (!hash_equals((string) $row['request_payload_hash'], $payloadHash)) {
            isq_fail('IDEMPOTENCY_CONFLICT', 'This request ID was already used with different data.', 409);
        }
        isq_ok(['trade' => isq_trading_load_trade($pdo, $row), 'manageToken' => $manageToken], 200, ['idempotentReplay' => true]);
    }

    try {
        $pdo->beginTransaction();
        $publicId = isq_public_id('TRD');
        $insert = $pdo->prepare(
            'INSERT INTO isq_trades (public_id, manage_token_hash, request_key_hash, request_payload_hash, username, sale_mode, note, status, expires_at) '
            . "VALUES (?, ?, ?, ?, ?, ?, ?, 'open', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))"
        );
        $insert->execute([$publicId, isq_token_hash($manageToken), $requestKey, $payloadHash, $username, $mode, $note === '' ? null : $note]);
        $tradeId = (int) $pdo->lastInsertId();
        $itemInsert = $pdo->prepare('INSERT INTO isq_trade_items (trade_id, side, fruit_id, quantity) VALUES (?, ?, ?, ?)');
        foreach (['offered' => $resolvedOffered, 'wanted' => $resolvedWanted] as $side => $lines) {
            foreach ($lines as $line) {
                $itemInsert->execute([$tradeId, $side, $line['fruitId'], $line['quantity']]);
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            $concurrent = $pdo->prepare('SELECT * FROM isq_trades WHERE request_key_hash = ? LIMIT 1');
            $concurrent->execute([$requestKey]);
            $row = $concurrent->fetch();
            if ($row && hash_equals((string) $row['request_payload_hash'], $payloadHash)) {
                isq_ok([
                    'trade' => isq_trading_load_trade($pdo, $row),
                    'manageToken' => $manageToken,
                ], 200, ['idempotentReplay' => true]);
            }
        }
        throw $error;
    }

    $row = isq_trading_trade_row($pdo, $publicId);
    if (!$row) {
        throw new RuntimeException('Created trade could not be loaded.');
    }
    isq_ok(['trade' => isq_trading_load_trade($pdo, $row), 'manageToken' => $manageToken], 201);
}

if (!defined('ISQ_TRADING_LIBRARY_ONLY')) {
    $method = isq_method(['GET', 'POST']);
    if ($method === 'GET') {
        isq_trading_list();
    }
    isq_trading_create();
}
