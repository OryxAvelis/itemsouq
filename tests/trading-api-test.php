<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/_private/bootstrap.php';

$base = rtrim((string) (getenv('ISQ_TEST_BASE_URL') ?: 'http://127.0.0.1:8012'), '/') . '/api/v1';
$origin = preg_replace('~/api/v1$~', '', $base) ?: 'http://127.0.0.1:8012';
$tradeId = null;
$testHost = strtolower((string) parse_url($base, PHP_URL_HOST));

if (in_array($testHost, ['127.0.0.1', 'localhost', '::1'], true)) {
    isq_db()->exec("DELETE FROM isq_rate_limit_buckets WHERE scope IN ('trades.create','responses.create','trade.manage','response.manage')");
}

function test_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/** @return array{status:int,json:array<string,mixed>,raw:string} */
function test_request(string $method, string $url, ?array $body = null, ?string $token = null): array
{
    global $origin;
    $curl = curl_init($url);
    if ($curl === false) {
        throw new RuntimeException('Could not initialize cURL.');
    }
    $headers = ['Accept: application/json', 'Origin: ' . $origin];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR),
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 10,
    ]);
    $raw = curl_exec($curl);
    if (!is_string($raw)) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException('HTTP request failed: ' . $message);
    }
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    $json = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($json)) {
        throw new RuntimeException('API response was not a JSON object.');
    }
    return ['status' => $status, 'json' => $json, 'raw' => $raw];
}

function test_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

try {
    $baseline = test_request('GET', $base . '/trades.php?status=all&limit=100');
    test_assert($baseline['status'] === 200 && ($baseline['json']['ok'] ?? false) === true, 'Trade feed did not load.');
    $baselineResponses = (int) ($baseline['json']['data']['stats']['responses'] ?? 0);

    $requestId = test_uuid();
    $createBody = [
        'requestId' => $requestId,
        'username' => 'ApiTestTrader',
        'mode' => 'physical',
        'note' => 'Automated integration test',
        'offered' => [['fruitSlug' => 'kitsune', 'quantity' => 2]],
        'wanted' => [['fruitSlug' => 'dragon', 'quantity' => 1]],
    ];
    $created = test_request('POST', $base . '/trades.php', $createBody);
    test_assert($created['status'] === 201 && ($created['json']['ok'] ?? false) === true, 'Trade creation failed.');
    $trade = $created['json']['data']['trade'] ?? [];
    $tradeId = (string) ($trade['id'] ?? '');
    $tradeToken = (string) ($created['json']['data']['manageToken'] ?? '');
    test_assert(preg_match('/^TRD-[0-9A-Z]{16}$/', $tradeId) === 1, 'Server did not create a public trade ID.');
    test_assert(strlen($tradeToken) >= 43, 'Server did not return a strong one-time management token.');
    test_assert((int) ($trade['offered'][0]['quantity'] ?? 0) === 2, 'Duplicate fruit quantity did not round-trip.');

    $replay = test_request('POST', $base . '/trades.php', $createBody);
    test_assert($replay['status'] === 200, 'Idempotent trade replay failed.');
    test_assert(($replay['json']['data']['trade']['id'] ?? null) === $tradeId, 'Idempotent replay created another trade.');
    test_assert(($replay['json']['data']['manageToken'] ?? null) === $tradeToken, 'Idempotent replay did not recover the same capability.');

    $feed = test_request('GET', $base . '/trades.php?status=all&limit=100');
    test_assert(strpos($feed['raw'], $tradeToken) === false && strpos($feed['raw'], 'manageToken') === false, 'Public feed leaked a management token.');
    $feedIds = array_column($feed['json']['data']['trades'] ?? [], 'id');
    test_assert(in_array($tradeId, $feedIds, true), 'Created trade was not visible in the shared feed.');

    $expire = isq_db()->prepare("UPDATE isq_trades SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE public_id = ?");
    $expire->execute([$tradeId]);
    $expired = test_request('GET', $base . '/trade.php?id=' . rawurlencode($tradeId));
    test_assert(($expired['json']['data']['trade']['status'] ?? null) === 'expired', 'Expired open trade was not reported as expired.');
    $reopened = test_request('POST', $base . '/trade-action.php', [
        'tradeId' => $tradeId,
        'action' => 'set_status',
        'status' => 'open',
        'version' => (int) $expired['json']['data']['trade']['version'],
    ], $tradeToken);
    test_assert(($reopened['json']['data']['trade']['status'] ?? null) === 'open', 'Expired trade could not be reopened.');
    test_assert(strtotime((string) ($reopened['json']['data']['trade']['expiresAt'] ?? '')) > time(), 'Reopening did not extend trade expiry.');

    $responseRequestId = test_uuid();
    $responseBody = [
        'requestId' => $responseRequestId,
        'username' => 'ApiTestReply',
        'note' => 'Dragon is ready',
        'offered' => [['fruitSlug' => 'dragon', 'quantity' => 1]],
    ];
    $responseCreated = test_request('POST', $base . '/trade-responses.php?tradeId=' . rawurlencode($tradeId), $responseBody);
    test_assert($responseCreated['status'] === 201, 'Trade response creation failed.');
    $responseId = (string) ($responseCreated['json']['data']['response']['id'] ?? '');
    $responseToken = (string) ($responseCreated['json']['data']['manageToken'] ?? '');
    test_assert($responseId !== '' && strlen($responseToken) >= 43, 'Response capability was not returned.');

    $responseReplay = test_request('POST', $base . '/trade-responses.php?tradeId=' . rawurlencode($tradeId), $responseBody);
    test_assert($responseReplay['status'] === 200, 'Idempotent response replay failed.');
    test_assert(($responseReplay['json']['data']['response']['id'] ?? null) === $responseId, 'Response replay created another response.');
    test_assert(($responseReplay['json']['data']['manageToken'] ?? null) === $responseToken, 'Response replay did not recover the same capability.');

    $withdrawnCreated = test_request('POST', $base . '/trade-responses.php?tradeId=' . rawurlencode($tradeId), [
        'requestId' => test_uuid(),
        'username' => 'ApiTestWithdraw',
        'note' => 'Temporary response',
        'offered' => [['fruitSlug' => 'rocket', 'quantity' => 1]],
    ]);
    $withdrawnResponse = $withdrawnCreated['json']['data']['response'] ?? [];
    $withdrawnToken = (string) ($withdrawnCreated['json']['data']['manageToken'] ?? '');
    test_assert($withdrawnCreated['status'] === 201 && is_string($withdrawnResponse['id'] ?? null) && strlen($withdrawnToken) >= 43, 'Withdrawable response was not created.');
    $withdrawn = test_request('POST', $base . '/trade-response-action.php', [
        'tradeId' => $tradeId,
        'responseId' => (string) ($withdrawnResponse['id'] ?? ''),
        'action' => 'withdraw',
        'version' => (int) ($withdrawnResponse['version'] ?? 0),
    ], $withdrawnToken);
    $withdrawnOutcomes = array_column($withdrawn['json']['data']['responses'] ?? [], 'outcome', 'id');
    test_assert(($withdrawnOutcomes[$withdrawnResponse['id']] ?? null) === 'withdrawn', 'Response owner could not withdraw with its capability.');

    $detail = test_request('GET', $base . '/trade.php?id=' . rawurlencode($tradeId));
    $version = (int) ($detail['json']['data']['trade']['version'] ?? 0);
    $wrong = test_request('POST', $base . '/trade-action.php', [
        'tradeId' => $tradeId, 'action' => 'set_status', 'status' => 'completed', 'version' => $version,
    ], str_repeat('A', 43));
    test_assert($wrong['status'] === 403, 'Wrong trade capability was not rejected.');

    $accepted = test_request('POST', $base . '/trade-response-action.php', [
        'tradeId' => $tradeId,
        'responseId' => $responseId,
        'action' => 'set_outcome',
        'outcome' => 'accepted',
        'version' => $version,
    ], $tradeToken);
    test_assert($accepted['status'] === 200 && ($accepted['json']['data']['trade']['status'] ?? null) === 'matched', 'Accepting a response did not match the trade.');

    $completed = test_request('POST', $base . '/trade-action.php', [
        'tradeId' => $tradeId,
        'action' => 'set_status',
        'status' => 'completed',
        'version' => (int) $accepted['json']['data']['trade']['version'],
    ], $tradeToken);
    test_assert(($completed['json']['data']['trade']['status'] ?? null) === 'completed', 'Trade was not completed.');

    $lateResponse = $responseBody;
    $lateResponse['requestId'] = test_uuid();
    $late = test_request('POST', $base . '/trade-responses.php?tradeId=' . rawurlencode($tradeId), $lateResponse);
    test_assert($late['status'] === 409, 'Completed trade accepted a new response.');

    $removed = test_request('POST', $base . '/trade-action.php', [
        'tradeId' => $tradeId,
        'action' => 'remove',
        'version' => (int) $completed['json']['data']['trade']['version'],
    ], $tradeToken);
    test_assert(($removed['json']['data']['removed'] ?? false) === true, 'Trade removal failed.');
    $removedReplay = test_request('POST', $base . '/trade-action.php', [
        'tradeId' => $tradeId,
        'action' => 'remove',
        'version' => (int) $completed['json']['data']['trade']['version'],
    ], $tradeToken);
    test_assert($removedReplay['status'] === 200 && ($removedReplay['json']['meta']['idempotentReplay'] ?? false) === true, 'Trade removal was not safely replayable.');
    $afterRemoval = test_request('GET', $base . '/trades.php?status=all&limit=100');
    test_assert(!in_array($tradeId, array_column($afterRemoval['json']['data']['trades'] ?? [], 'id'), true), 'Removed trade remained public.');
    test_assert((int) ($afterRemoval['json']['data']['stats']['responses'] ?? -1) === $baselineResponses, 'Response stats included a removed parent trade.');

    echo "Trading API integration tests passed.\n";
} finally {
    if (is_string($tradeId) && $tradeId !== '') {
        $cleanup = isq_db()->prepare('DELETE FROM isq_trades WHERE public_id = ? AND username = ? AND note = ?');
        $cleanup->execute([$tradeId, 'ApiTestTrader', 'Automated integration test']);
    }
    if (in_array($testHost, ['127.0.0.1', 'localhost', '::1'], true)) {
        isq_db()->exec("DELETE FROM isq_rate_limit_buckets WHERE scope IN ('trades.create','responses.create','trade.manage','response.manage')");
    }
}
