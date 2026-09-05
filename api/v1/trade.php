<?php
declare(strict_types=1);

define('ISQ_TRADING_LIBRARY_ONLY', true);
require_once __DIR__ . '/trades.php';

isq_method('GET');
isq_rate_limit('trade.read', 180, 60);

$tradeId = isq_trading_validate_trade_id($_GET['id'] ?? null);
$pdo = isq_db();
$row = isq_trading_trade_row($pdo, $tradeId);
if (!$row) {
    isq_fail('TRADE_NOT_FOUND', 'The trade was not found.', 404);
}

isq_ok(['trade' => isq_trading_load_trade($pdo, $row)]);
