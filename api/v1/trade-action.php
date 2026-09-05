<?php
declare(strict_types=1);

define('ISQ_TRADING_LIBRARY_ONLY', true);
require_once __DIR__ . '/trades.php';

isq_method('POST');
isq_require_same_origin();
$input = isq_input();
$tradePublicId = isq_trading_validate_trade_id($input['tradeId'] ?? null);
isq_rate_limit('trade.manage', 30, 600, $tradePublicId);
$token = isq_bearer_token();
if ($token === null) {
    isq_fail('CAPABILITY_REJECTED', 'The management token is missing or invalid.', 403);
}
$action = is_string($input['action'] ?? null) ? strtolower(trim($input['action'])) : '';
if (!in_array($action, ['set_status', 'remove'], true)) {
    isq_fail('VALIDATION_FAILED', 'Invalid trade action.', 422, ['field' => 'action']);
}
$requestedVersion = filter_var($input['version'] ?? null, FILTER_VALIDATE_INT);
if ($requestedVersion === false || $requestedVersion < 1) {
    isq_fail('VALIDATION_FAILED', 'A valid trade version is required.', 422, ['field' => 'version']);
}

$pdo = isq_db();
try {
    $pdo->beginTransaction();
    $row = isq_trading_trade_row($pdo, $tradePublicId, true, true);
    if (!$row) {
        $pdo->rollBack();
        isq_fail('TRADE_NOT_FOUND', 'The trade was not found.', 404);
    }
    if ((string) $row['status'] === 'removed') {
        if ($action === 'remove' && hash_equals((string) $row['manage_token_hash'], isq_token_hash($token))) {
            $pdo->rollBack();
            isq_ok(['tradeId' => $tradePublicId, 'removed' => true], 200, ['idempotentReplay' => true]);
        }
        $pdo->rollBack();
        isq_fail('TRADE_NOT_FOUND', 'The trade was not found.', 404);
    }
    if (!hash_equals((string) $row['manage_token_hash'], isq_token_hash($token))) {
        $pdo->rollBack();
        isq_fail('CAPABILITY_REJECTED', 'The management token is missing or invalid.', 403);
    }

    $targetStatus = $action === 'remove'
        ? 'removed'
        : (is_string($input['status'] ?? null) ? strtolower(trim($input['status'])) : '');
    if ($action === 'set_status' && !in_array($targetStatus, ['open', 'completed', 'closed'], true)) {
        $pdo->rollBack();
        isq_fail('VALIDATION_FAILED', 'Invalid trade status.', 422, ['field' => 'status']);
    }
    $expiredOpen = (string) $row['status'] === 'open'
        && strtotime((string) $row['expires_at'] . ' UTC') <= time();
    $alreadyTarget = (string) $row['status'] === $targetStatus
        && !($targetStatus === 'open' && $expiredOpen);
    if ((int) $row['version'] !== $requestedVersion && !$alreadyTarget) {
        $pdo->rollBack();
        isq_fail('VERSION_CONFLICT', 'The trade changed on another device. Reload and try again.', 409, ['currentVersion' => (int) $row['version']]);
    }

    if (!$alreadyTarget) {
        if ($targetStatus === 'open') {
            $decline = $pdo->prepare("UPDATE isq_trade_responses SET outcome = 'declined', version = version + 1 WHERE trade_id = ? AND outcome = 'accepted'");
            $decline->execute([(int) $row['id']]);
            $update = $pdo->prepare("UPDATE isq_trades SET status = 'open', version = version + 1, expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY) WHERE id = ?");
        } else {
            $update = $pdo->prepare('UPDATE isq_trades SET status = ?, version = version + 1 WHERE id = ?');
        }
        if ($targetStatus === 'open') {
            $update->execute([(int) $row['id']]);
        } else {
            $update->execute([$targetStatus, (int) $row['id']]);
        }
    }
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $error;
}

if ($targetStatus === 'removed') {
    isq_ok(['tradeId' => $tradePublicId, 'removed' => true]);
}
$updated = isq_trading_trade_row($pdo, $tradePublicId);
if (!$updated) {
    throw new RuntimeException('Updated trade could not be loaded.');
}
isq_ok(['trade' => isq_trading_load_trade($pdo, $updated)]);
