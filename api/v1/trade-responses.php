<?php
declare(strict_types=1);

define('ISQ_TRADING_LIBRARY_ONLY', true);
require_once __DIR__ . '/trades.php';

$method = isq_method(['GET', 'POST']);
$tradePublicId = isq_trading_validate_trade_id($_GET['tradeId'] ?? null);
$pdo = isq_db();
$trade = isq_trading_trade_row($pdo, $tradePublicId);
if (!$trade) {
    isq_fail('TRADE_NOT_FOUND', 'The trade was not found.', 404);
}

if ($method === 'GET') {
    isq_rate_limit('responses.read', 180, 60, $tradePublicId);
    $responses = isq_trading_load_responses($pdo, (int) $trade['id']);
    $counts = isq_trading_response_counts($pdo, [(int) $trade['id']]);
    isq_ok(['responses' => $responses, 'responseCount' => $counts[(int) $trade['id']] ?? 0, 'trade' => isq_trading_load_trade($pdo, $trade)]);
}

isq_require_same_origin();
isq_rate_limit('responses.create', 10, 600, $tradePublicId);
$input = isq_input();
$requestId = isq_validate_request_id($input['requestId'] ?? null);
$username = isq_validate_username($input['username'] ?? null);
$note = isq_trading_note($input['note'] ?? '', 160, 'note');
$mode = (string) $trade['sale_mode'];
$offered = isq_trading_validate_lines($input['offered'] ?? null, $mode, 'offered');
$tradeItems = isq_trading_items_for_trades($pdo, [(int) $trade['id']]);
$tradeOffered = array_column($tradeItems[(int) $trade['id']]['offered'] ?? [], 'fruitId');
if (array_intersect($tradeOffered, array_column($offered, 'fruitSlug')) !== []) {
    isq_fail('VALIDATION_FAILED', 'A response must offer different fruits from the original offer.', 422, ['field' => 'offered']);
}
$resolved = isq_trading_resolve_lines($pdo, $offered, 'offered');
$normalized = compact('username', 'note', 'offered');
$requestKey = isq_trading_request_key('response:create:' . $tradePublicId, $requestId);
$payloadHash = isq_trading_payload_hash($normalized);
$manageToken = isq_trading_capability('response:create:' . $tradePublicId, $requestId);

$existing = $pdo->prepare('SELECT * FROM isq_trade_responses WHERE request_key_hash = ? LIMIT 1');
$existing->execute([$requestKey]);
$responseRow = $existing->fetch();
if ($responseRow) {
    if ((int) $responseRow['trade_id'] !== (int) $trade['id'] || !hash_equals((string) $responseRow['request_payload_hash'], $payloadHash)) {
        isq_fail('IDEMPOTENCY_CONFLICT', 'This request ID was already used with different data.', 409);
    }
    if ((string) $responseRow['outcome'] === 'removed') {
        isq_fail('IDEMPOTENCY_GONE', 'The original response is no longer available.', 410);
    }
    $response = isq_trading_load_response($pdo, $responseRow);
    $counts = isq_trading_response_counts($pdo, [(int) $trade['id']]);
    isq_ok(['response' => $response, 'manageToken' => $manageToken, 'responseCount' => $counts[(int) $trade['id']] ?? 0], 200, ['idempotentReplay' => true]);
}

try {
    $pdo->beginTransaction();
    $lockedTrade = isq_trading_trade_row($pdo, $tradePublicId, true);
    if (!$lockedTrade) {
        $pdo->rollBack();
        isq_fail('TRADE_NOT_FOUND', 'The trade was not found.', 404);
    }
    if ((string) $lockedTrade['status'] !== 'open' || strtotime((string) $lockedTrade['expires_at'] . ' UTC') <= time()) {
        $pdo->rollBack();
        isq_fail('TRADE_NOT_OPEN', 'This trade no longer accepts responses.', 409);
    }
    $publicId = isq_public_id('RSP');
    $insert = $pdo->prepare(
        "INSERT INTO isq_trade_responses (public_id, trade_id, manage_token_hash, request_key_hash, request_payload_hash, username, note, outcome) "
        . "VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')"
    );
    $insert->execute([$publicId, (int) $lockedTrade['id'], isq_token_hash($manageToken), $requestKey, $payloadHash, $username, $note === '' ? null : $note]);
    $responseId = (int) $pdo->lastInsertId();
    $itemInsert = $pdo->prepare('INSERT INTO isq_trade_response_items (response_id, fruit_id, quantity) VALUES (?, ?, ?)');
    foreach ($resolved as $line) {
        $itemInsert->execute([$responseId, $line['fruitId'], $line['quantity']]);
    }
    $pdo->exec('UPDATE isq_trades SET version = version + 1 WHERE id = ' . (int) $lockedTrade['id']);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
        $concurrent = $pdo->prepare('SELECT * FROM isq_trade_responses WHERE request_key_hash = ? LIMIT 1');
        $concurrent->execute([$requestKey]);
        $responseRow = $concurrent->fetch();
        if ($responseRow
            && (int) $responseRow['trade_id'] === (int) $trade['id']
            && (string) $responseRow['outcome'] !== 'removed'
            && hash_equals((string) $responseRow['request_payload_hash'], $payloadHash)) {
            $response = isq_trading_load_response($pdo, $responseRow);
            $counts = isq_trading_response_counts($pdo, [(int) $trade['id']]);
            isq_ok([
                'response' => $response,
                'manageToken' => $manageToken,
                'responseCount' => $counts[(int) $trade['id']] ?? 0,
            ], 200, ['idempotentReplay' => true]);
        }
    }
    throw $error;
}

$created = $pdo->prepare('SELECT * FROM isq_trade_responses WHERE public_id = ? AND trade_id = ? LIMIT 1');
$created->execute([$publicId, (int) $trade['id']]);
$responseRow = $created->fetch();
if (!$responseRow) {
    throw new RuntimeException('Created response could not be loaded.');
}
$response = isq_trading_load_response($pdo, $responseRow);
$counts = isq_trading_response_counts($pdo, [(int) $trade['id']]);
isq_ok(['response' => $response, 'manageToken' => $manageToken, 'responseCount' => $counts[(int) $trade['id']] ?? 0], 201);
