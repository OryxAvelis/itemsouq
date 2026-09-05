<?php
declare(strict_types=1);

const ISQ_API_VERSION = '1';
const ISQ_MAX_JSON_BYTES = 32768;

if (PHP_SAPI !== 'cli') {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

function isq_is_local(): bool
{
    if (PHP_SAPI === 'cli') {
        return true;
    }

    $remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (!in_array($remoteAddress, ['127.0.0.1', '::1'], true)) {
        return false;
    }

    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\\d+$/', '', $host) ?? $host;
    return in_array($host, ['127.0.0.1', 'localhost', '::1'], true);
}

/** @return array<string,mixed> */
function isq_config(): array
{
    static $config;
    if (is_array($config)) {
        return $config;
    }

    $localFile = __DIR__ . '/config.local.php';
    $fileConfig = [];
    if (is_file($localFile)) {
        $loaded = require $localFile;
        if (!is_array($loaded)) {
            throw new RuntimeException('config.local.php must return an array.');
        }
        $fileConfig = $loaded;
    }

    $local = isq_is_local();
    $env = static function (string $name): ?string {
        $value = getenv($name);
        return $value === false || $value === '' ? null : $value;
    };

    $fileDb = is_array($fileConfig['db'] ?? null) ? $fileConfig['db'] : [];
    $config = [
        'db' => [
            'host' => $env('ISQ_DB_HOST') ?? $fileDb['host'] ?? ($local ? '127.0.0.1' : ''),
            'port' => (int) ($env('ISQ_DB_PORT') ?? $fileDb['port'] ?? 3306),
            'name' => $env('ISQ_DB_NAME') ?? $fileDb['name'] ?? ($local ? 'itemsouq' : ''),
            'user' => $env('ISQ_DB_USER') ?? $fileDb['user'] ?? ($local ? 'root' : ''),
            'password' => $env('ISQ_DB_PASSWORD') ?? $fileDb['password'] ?? '',
        ],
        'app_secret' => $env('ISQ_APP_SECRET')
            ?? ($fileConfig['app_secret'] ?? ($local ? 'itemsouq-local-development-secret-change-before-deploying' : '')),
        'setup_token' => $env('ISQ_SETUP_TOKEN')
            ?? ($fileConfig['setup_token'] ?? ($local ? 'itemsouq-local-setup' : '')),
        'origin' => rtrim((string) ($env('ISQ_ORIGIN') ?? $fileConfig['origin'] ?? ''), '/'),
        'session_name' => (string) ($env('ISQ_SESSION_NAME') ?? $fileConfig['session_name'] ?? 'itemsouq_owner'),
    ];

    if (!$local) {
        $db = $config['db'];
        if ($db['host'] === '' || $db['name'] === '' || $db['user'] === '') {
            throw new RuntimeException('Production database configuration is incomplete.');
        }
        if (strlen((string) $config['app_secret']) < 32 || strlen((string) $config['setup_token']) < 24) {
            throw new RuntimeException('Production secrets are missing or too short.');
        }
        $origin = (string) $config['origin'];
        $originParts = $origin === '' ? false : parse_url($origin);
        $originPath = is_array($originParts) ? (string) ($originParts['path'] ?? '') : '';
        if (!is_array($originParts)
            || filter_var($origin, FILTER_VALIDATE_URL) === false
            || strtolower((string) ($originParts['scheme'] ?? '')) !== 'https'
            || (string) ($originParts['host'] ?? '') === ''
            || isset($originParts['user'])
            || isset($originParts['pass'])
            || isset($originParts['query'])
            || isset($originParts['fragment'])
            || ($originPath !== '' && $originPath !== '/')) {
            throw new RuntimeException('A canonical HTTPS production origin is required.');
        }
    }

    return $config;
}

function isq_db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = isq_config()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) $db['host'],
        (int) $db['port'],
        (string) $db['name']
    );
    $pdo = new PDO($dsn, (string) $db['user'], (string) $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => true,
    ]);
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET SESSION time_zone = '+00:00'");
    $pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

    return $pdo;
}

function isq_json_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: DENY');
    header('Content-Security-Policy: frame-ancestors \'none\'');
}

/** @param string|list<string> $allowed */
function isq_method(string|array $allowed): string
{
    $allowed = array_map('strtoupper', (array) $allowed);
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? (PHP_SAPI === 'cli' ? 'CLI' : 'GET')));
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        isq_fail('METHOD_NOT_ALLOWED', 'This request method is not allowed.', 405);
    }
    return $method;
}

/** @return array<string,mixed> */
function isq_input(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > ISQ_MAX_JSON_BYTES) {
        isq_fail('PAYLOAD_TOO_LARGE', 'The request body is too large.', 413);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''), 2)[0]));
    if ($contentType !== 'application/json') {
        isq_fail('UNSUPPORTED_MEDIA_TYPE', 'The request body must use application/json.', 415);
    }
    if (strlen($raw) > ISQ_MAX_JSON_BYTES) {
        isq_fail('PAYLOAD_TOO_LARGE', 'The request body is too large.', 413);
    }

    try {
        $decoded = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        isq_fail('INVALID_JSON', 'The request body must be valid JSON.', 400);
    }
    if (!is_array($decoded) || !str_starts_with(ltrim($raw), '{')) {
        isq_fail('INVALID_JSON', 'The JSON body must be an object.', 400);
    }
    return $decoded;
}

/** @param array<string,mixed> $data @param array<string,mixed> $meta */
function isq_ok(array $data = [], int $status = 200, array $meta = []): never
{
    isq_json_headers();
    http_response_code($status);
    $body = ['ok' => true, 'data' => $data];
    if ($meta !== []) {
        $body['meta'] = $meta;
    }
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

/** @param array<string,mixed> $details */
function isq_fail(string $code, string $message, int $status = 400, array $details = []): never
{
    isq_json_headers();
    http_response_code($status);
    $error = ['code' => $code, 'message' => $message];
    if ($details !== []) {
        $error['details'] = $details;
    }
    echo json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function isq_header(string $name): ?string
{
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    $value = $_SERVER[$serverName] ?? null;
    return is_string($value) && trim($value) !== '' ? trim($value) : null;
}

function isq_bearer_token(): ?string
{
    $authorization = isq_header('Authorization');
    if ($authorization === null && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $authorization = trim((string) $value);
                break;
            }
        }
    }
    if ($authorization !== null && preg_match('/^Bearer\\s+([A-Za-z0-9_-]{24,128})$/', $authorization, $matches)) {
        return $matches[1];
    }
    return null;
}

function isq_token_hash(string $token): string
{
    return hash('sha256', $token, true);
}

function isq_random_token(int $bytes = 32): string
{
    if ($bytes < 16 || $bytes > 64) {
        throw new InvalidArgumentException('Token size must be between 16 and 64 bytes.');
    }
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function isq_public_id(string $prefix, int $characters = 16): string
{
    if (!preg_match('/^[A-Z]{2,5}$/', $prefix) || $characters < 10 || $characters > 32) {
        throw new InvalidArgumentException('Invalid public ID format.');
    }
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $bytes = random_bytes($characters);
    $suffix = '';
    for ($index = 0; $index < $characters; $index++) {
        $suffix .= $alphabet[ord($bytes[$index]) & 31];
    }
    return $prefix . '-' . $suffix;
}

function isq_order_reference(): string
{
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $bytes = random_bytes(8);
    $suffix = '';
    for ($index = 0; $index < 8; $index++) {
        $suffix .= $alphabet[ord($bytes[$index]) & 31];
    }
    return 'ISQ-' . gmdate('ymd') . '-' . $suffix;
}

function isq_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function isq_expected_origin(): string
{
    $configured = (string) (isq_config()['origin'] ?? '');
    if ($configured !== '') {
        return $configured;
    }
    $scheme = isq_is_https() ? 'https' : 'http';
    return $scheme . '://' . (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function isq_require_same_origin(): void
{
    if (PHP_SAPI === 'cli') {
        return;
    }
    $origin = isq_header('Origin');
    $fetchSite = strtolower((string) (isq_header('Sec-Fetch-Site') ?? ''));
    if ($origin !== null && hash_equals(isq_expected_origin(), rtrim($origin, '/'))) {
        return;
    }
    if ($origin === null && $fetchSite === 'same-origin') {
        return;
    }
    isq_fail('ORIGIN_REJECTED', 'The request origin is not allowed.', 403);
}

function isq_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $config = isq_config();
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Strict');
    $sessionPath = __DIR__ . '/sessions';
    if (!is_dir($sessionPath) && !mkdir($sessionPath, 0700, true) && !is_dir($sessionPath)) {
        throw new RuntimeException('The private session directory could not be created.');
    }
    session_save_path($sessionPath);
    session_name((string) $config['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isq_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

/** @return array{id:int,username:string} */
function isq_require_admin(): array
{
    isq_start_session();
    $now = time();
    $adminId = filter_var($_SESSION['isq_admin_id'] ?? null, FILTER_VALIDATE_INT);
    $created = filter_var($_SESSION['isq_admin_created'] ?? null, FILTER_VALIDATE_INT);
    $seen = filter_var($_SESSION['isq_admin_seen'] ?? null, FILTER_VALIDATE_INT);
    if (!$adminId || !$created || !$seen || $now - $created > 28800 || $now - $seen > 1800) {
        $_SESSION = [];
        isq_fail('AUTH_REQUIRED', 'Owner authentication is required.', 401);
    }

    $statement = isq_db()->prepare('SELECT id, username FROM isq_owner_users WHERE id = ? AND is_active = 1 LIMIT 1');
    $statement->execute([$adminId]);
    $admin = $statement->fetch();
    if (!$admin) {
        $_SESSION = [];
        isq_fail('AUTH_REQUIRED', 'Owner authentication is required.', 401);
    }
    $_SESSION['isq_admin_seen'] = $now;
    return ['id' => (int) $admin['id'], 'username' => (string) $admin['username']];
}

/** @param array<string,mixed>|null $input */
function isq_require_csrf(?array $input = null): void
{
    isq_start_session();
    $provided = isq_header('X-CSRF-Token');
    if ($provided === null && is_array($input) && is_string($input['csrfToken'] ?? null)) {
        $provided = $input['csrfToken'];
    }
    $expected = $_SESSION['isq_csrf'] ?? null;
    if (!is_string($provided) || !is_string($expected) || !hash_equals($expected, $provided)) {
        isq_fail('CSRF_REJECTED', 'The security token is missing or invalid.', 403);
    }
}

function isq_actor_hash(?string $subject = null): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $material = $ip . ($subject === null ? '' : "\0" . $subject);
    return hash_hmac('sha256', $material, (string) isq_config()['app_secret'], true);
}

function isq_rate_limit(string $scope, int $limit, int $windowSeconds, ?string $subject = null): void
{
    if (!preg_match('/^[a-z0-9_.:-]{2,64}$/', $scope) || $limit < 1 || $windowSeconds < 1) {
        throw new InvalidArgumentException('Invalid rate-limit configuration.');
    }
    $now = time();
    $window = intdiv($now, $windowSeconds) * $windowSeconds;
    $windowStart = gmdate('Y-m-d H:i:s', $window);
    $expires = gmdate('Y-m-d H:i:s', $window + max($windowSeconds * 2, 86400));
    $actorHash = isq_actor_hash($subject);
    $pdo = isq_db();
    $statement = $pdo->prepare(
        'INSERT INTO isq_rate_limit_buckets (scope, actor_hash, window_started_at, hit_count, expires_at) '
        . 'VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE hit_count = hit_count + 1, expires_at = VALUES(expires_at)'
    );
    $statement->execute([$scope, $actorHash, $windowStart, $expires]);
    $check = $pdo->prepare(
        'SELECT hit_count FROM isq_rate_limit_buckets WHERE scope = ? AND actor_hash = ? AND window_started_at = ?'
    );
    $check->execute([$scope, $actorHash, $windowStart]);
    $count = (int) $check->fetchColumn();

    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM isq_rate_limit_buckets WHERE expires_at < UTC_TIMESTAMP() LIMIT 250');
    }
    if ($count > $limit) {
        $retryAfter = max(1, $window + $windowSeconds - $now);
        header('Retry-After: ' . $retryAfter);
        isq_fail('RATE_LIMITED', 'Too many requests. Please try again later.', 429, ['retryAfter' => $retryAfter]);
    }
}

function isq_iso(DateTimeInterface|string|null $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    try {
        $date = $value instanceof DateTimeInterface ? DateTimeImmutable::createFromInterface($value) : new DateTimeImmutable($value, new DateTimeZone('UTC'));
    } catch (Throwable) {
        return null;
    }
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\\TH:i:s\\Z');
}

function isq_validate_request_id(mixed $value): string
{
    $requestId = is_string($value) ? strtolower(trim($value)) : '';
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $requestId)) {
        isq_fail('VALIDATION_FAILED', 'A valid requestId UUID is required.', 422, ['field' => 'requestId']);
    }
    return $requestId;
}

function isq_validate_username(mixed $value, string $field = 'username'): string
{
    $username = is_string($value) ? trim($value) : '';
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $username)) {
        isq_fail('VALIDATION_FAILED', 'The Roblox username must contain 3–20 letters, numbers, or underscores.', 422, ['field' => $field]);
    }
    return $username;
}

/** @return list<array{fruitSlug:string,quantity:int}> */
function isq_validate_trade_lines(mixed $value, string $mode, string $field = 'items'): array
{
    if (!in_array($mode, ['physical', 'permanent'], true) || !is_array($value) || !array_is_list($value)) {
        isq_fail('VALIDATION_FAILED', 'Invalid trade items.', 422, ['field' => $field]);
    }
    $result = [];
    $seen = [];
    $slots = 0;
    foreach ($value as $line) {
        if (!is_array($line)) {
            isq_fail('VALIDATION_FAILED', 'Each trade item must be an object.', 422, ['field' => $field]);
        }
        $slug = is_string($line['fruitSlug'] ?? null) ? strtolower(trim($line['fruitSlug'])) : '';
        $quantity = filter_var($line['quantity'] ?? null, FILTER_VALIDATE_INT);
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || $quantity === false || $quantity < 1 || $quantity > 4) {
            isq_fail('VALIDATION_FAILED', 'Invalid fruit or quantity.', 422, ['field' => $field]);
        }
        if ($mode === 'permanent' && $quantity !== 1) {
            isq_fail('VALIDATION_FAILED', 'Permanent fruits must have quantity 1.', 422, ['field' => $field]);
        }
        if (isset($seen[$slug])) {
            isq_fail('VALIDATION_FAILED', 'Duplicate fruits must be combined into one quantity.', 422, ['field' => $field]);
        }
        $seen[$slug] = true;
        $slots += $quantity;
        $result[] = ['fruitSlug' => $slug, 'quantity' => $quantity];
    }
    if ($slots < 1 || $slots > 4) {
        isq_fail('VALIDATION_FAILED', 'Each trade side must contain 1–4 fruits in total.', 422, ['field' => $field]);
    }
    return $result;
}

if (PHP_SAPI !== 'cli') {
    set_exception_handler(static function (Throwable $error): never {
        error_log('[itemsouq] ' . $error::class . ': ' . $error->getMessage());
        isq_fail('SERVER_ERROR', 'The server could not complete the request.', 500);
    });
}
