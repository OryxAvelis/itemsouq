<?php
declare(strict_types=1);

define('ISQ_TRADING_LIBRARY_ONLY', true);
require_once __DIR__ . '/trades.php';

isq_method('POST');
isq_require_same_origin();
$input = isq_input();
$tradePublicId = isq_trading_validate_trade_id($input['tradeId'] ?? null);
$responsePublicId = isq_trading_validate_response_id($input['responseId'] ?? null);
$action = is_string($input['action'] ?? null) ? strtolower(trim($input['action'])) : '';
if (!in_array($action, ['set_outcome', 'withdraw'], true)) {
    isq_fail('VALIDATION_FAILED', 'Invalid response action.', 422, ['field' => 'action']);
}
isq_rate_limit('response.manage', 30, 600, $tradePublicId);
$token = isq_bearer_token();
if ($token === null) {
    isq_fail('CAPABILITY_REJECTED', 'The management token is missing or invalid.', 403);
}
$requestedVersion = filter_var($input['version'] ?? null, FILTER_VALIDATE_INT);
if ($requestedVersion === false || $requestedVersion < 1) {
    isq_fail('VALIDATION_FAILED', 'A valid version is required.', 422, ['field' => 'version']);
}
$outcome = $action === 'set_outcome' && is_string($input['outcome'] ?? null)
    ? strtolower(trim($input['outcome']))
    : '';
if ($action === 'set_outcome' && !in_array($outcome, ['accepted', 'declined'], true)) {
    isq_fail('VALIDATION_FAILED', 'Invalid response outcome.', 422, ['field' => 'outcome']);
}

$pdo = isq_db();
try {
    $pdo->beginTransaction();
    $statement = $pdo->prepare(
        'SELECT r.*, t.public_id AS trade_public_id, t.manage_token_hash AS trade_manage_token_hash, '
        . 't.status AS trade_status, t.version AS trade_version, t.expires_at AS trade_expires_at '
        . 'FROM isq_trade_responses r JOIN isq_trades t ON t.id = r.trade_id '
        . 'WHERE r.public_id = ? AND t.public_id = ? LIMIT 1 FOR UPDATE'
    );
    $statement->execute([$responsePublicId, $tradePublicId]);
    $row = $statement->fetch();
    if (!$row || in_array((string) $row['outcome'], ['removed'], true) || (string) $row['trade_status'] === 'removed') {
        $pdo->rollBack();
        isq_fail('RESPONSE_NOT_FOUND', 'The response was not found.', 404);
    }

    $expectedHash = $action === 'withdraw' ? (string) $row['manage_token_hash'] : (string) $row['trade_manage_token_hash'];
    if (!hash_equals($expectedHash, isq_token_hash($token))) {
        $pdo->rollBack();
        isq_fail('CAPABILITY_REJECTED', 'The management token is missing or invalid.', 403);
    }
    $actualVersion = $action === 'withdraw' ? (int) $row['version'] : (int) $row['trade_version'];
    $targetOutcome = $action === 'withdraw' ? 'withdrawn' : $outcome;
    if ($actualVersion !== $requestedVersion && (string) $row['outcome'] !== $targetOutcome) {
        $pdo->rollBack();
        isq_fail('VERSION_CONFLICT', 'The response changed. Reload and try again.', 409, ['currentVersion' => $actualVersion]);
    }

    if ((string) $row['outcome'] !== $targetOutcome) {
        if ((string) $row['outcome'] !== 'pending') {
            $pdo->rollBack();
            isq_fail('RESPONSE_NOT_PENDING', 'This response can no longer be changed.', 409);
        }
        if ($action === 'set_outcome') {
            if (!in_array((string) $row['trade_status'], ['open', 'matched'], true)
                || strtotime((string) $row['trade_expires_at'] . ' UTC') <= time()) {
                $pdo->rollBack();
                isq_fail('TRADE_NOT_OPEN', 'This trade can no longer be managed.', 409);
            }
            if ($outcome === 'accepted') {
                $decline = $pdo->prepare("UPDATE isq_trade_responses SET outcome = 'declined', version = version + 1 WHERE trade_id = ? AND id <> ? AND outcome = 'pending'");
                $decline->execute([(int) $row['trade_id'], (int) $row['id']]);
                $responseUpdate = $pdo->prepare("UPDATE isq_trade_responses SET outcome = 'accepted', version = version + 1 WHERE id = ?");
                $responseUpdate->execute([(int) $row['id']]);
                $tradeUpdate = $pdo->prepare("UPDATE isq_trades SET status = 'matched', version = version + 1 WHERE id = ?");
                $tradeUpdate->execute([(int) $row['trade_id']]);
            } else {
                $responseUpdate = $pdo->prepare("UPDATE isq_trade_responses SET outcome = 'declined', version = version + 1 WHERE id = ?");
                $responseUpdate->execute([(int) $row['id']]);
                $tradeUpdate = $pdo->prepare('UPDATE isq_trades SET version = version + 1 WHERE id = ?');
                $tradeUpdate->execute([(int) $row['trade_id']]);
            }
        } else {
            $responseUpdate = $pdo->prepare("UPDATE isq_trade_responses SET outcome = 'withdrawn', version = version + 1 WHERE id = ?");
            $responseUpdate->execute([(int) $row['id']]);
            $tradeUpdate = $pdo->prepare('UPDATE isq_trades SET version = version + 1 WHERE id = ?');
            $tradeUpdate->execute([(int) $row['trade_id']]);
        }
    }
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $error;
}

$trade = isq_trading_trade_row($pdo, $tradePublicId);
if (!$trade) {
    isq_fail('TRADE_NOT_FOUND', 'The trade was not found.', 404);
}
isq_ok([
    'trade' => isq_trading_load_trade($pdo, $trade),
    'responses' => isq_trading_load_responses($pdo, (int) $trade['id']),
]);
