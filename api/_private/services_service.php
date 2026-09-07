<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/** @param array<string,mixed> $row @return array<string,mixed> */
function isq_service_data(array $row): array
{
    return [
        'id' => (string) $row['public_id'],
        'titleFr' => (string) $row['title_fr'],
        'titleAry' => (string) $row['title_ary'],
        'descriptionFr' => (string) $row['description_fr'],
        'descriptionAry' => (string) $row['description_ary'],
        'priceMad' => $row['price_mad'] === null ? null : number_format((float) $row['price_mad'], 2, '.', ''),
        'availability' => (string) $row['availability'],
        'sortOrder' => (int) $row['sort_order'],
        'isFeatured' => (bool) $row['is_featured'],
        'isArchived' => (bool) $row['is_archived'],
        'version' => (int) $row['version'],
        'createdAt' => isq_iso((string) $row['created_at']),
        'updatedAt' => isq_iso((string) $row['updated_at']),
    ];
}

/** @return array{services:list<array<string,mixed>>,updatedAt:?string} */
function isq_services_data(bool $ownerView = false): array
{
    $sql = 'SELECT public_id, title_fr, title_ary, description_fr, description_ary, price_mad, availability, sort_order, '
        . 'is_featured, is_archived, version, created_at, updated_at FROM isq_services';
    if (!$ownerView) {
        $sql .= " WHERE is_archived = 0 AND availability <> 'hidden'";
    }
    $sql .= $ownerView ? ' ORDER BY sort_order, id' : ' ORDER BY is_featured DESC, sort_order, id';

    $services = [];
    $updatedAt = null;
    foreach (isq_db()->query($sql) as $row) {
        $service = isq_service_data($row);
        $services[] = $service;
        if ($service['updatedAt'] !== null && ($updatedAt === null || strcmp($service['updatedAt'], $updatedAt) > 0)) {
            $updatedAt = $service['updatedAt'];
        }
    }
    return ['services' => $services, 'updatedAt' => $updatedAt];
}

function isq_validate_service_id(mixed $value): string
{
    $serviceId = is_string($value) ? strtoupper(trim($value)) : '';
    if (!preg_match('/^SVC-[0-9A-HJKMNP-TV-Z]{16}$/', $serviceId)) {
        isq_fail('VALIDATION_FAILED', 'Choose a valid service.', 422, ['field' => 'serviceId']);
    }
    return $serviceId;
}

function isq_validate_service_text(mixed $value, string $field, int $minimum, int $maximum): string
{
    $text = is_string($value) ? trim($value) : '';
    $text = preg_replace('/\\s+/u', ' ', $text) ?? '';
    $length = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);
    if ($length < $minimum || $length > $maximum || preg_match('/[<>\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/u', $text)) {
        isq_fail(
            'VALIDATION_FAILED',
            str_starts_with($field, 'title') ? 'Each title must contain 3–100 plain-text characters.' : 'Each description must contain at most 300 plain-text characters.',
            422,
            ['field' => $field]
        );
    }
    return $text;
}

function isq_service_copy_is_safe(string ...$copyParts): bool
{
    $copy = implode(' ', $copyParts);
    if (class_exists('Normalizer')) {
        $normalized = Normalizer::normalize($copy, Normalizer::FORM_KC);
        if (is_string($normalized)) {
            $copy = $normalized;
        }
    }
    $copy = preg_replace('/\\p{Cf}+/u', '', $copy) ?? $copy;
    $copy = preg_replace('/[^\\p{L}\\p{N}]+/u', ' ', $copy) ?? $copy;
    $credentialPattern = '/\\b(?:password|passcode|credential|login|otp|2fa|cookie|session[ -]?token)\\b|'
        . 'mot\\s+de\\s+passe|\\bmdp\\b|كلمة\\s+(?:المرور|السر)|باسورد|باسوورد|كوكي(?:ز)?|'
        . '(?:كود|رمز).{0,12}(?:تحقق|دخول|سري|otp|2fa)|(?:تحقق|دخول).{0,12}(?:كود|رمز)|بيانات\\s+الدخول/ui';
    $account = '(?:accounts?|comptes?|حساب(?:ات)?)';
    $sale = '(?:sell(?:ing)?|sale|buy(?:ing)?|transfer|vends?|vend(?:re|u)?|vente|ach[eè]te?r?|achat|transfert|'
        . 'n?bi3|lbi3|n?chri|chra|بيع|شراء|للبيع|للشراء|نقل)';
    $value = '(?:level|niveau|max|mad|dhs?|dirhams?|price|prix|ثمن|السعر|درهم)';
    $game = '(?:roblox|blox\\s*fruits?)';
    $accountSalePattern = '/(?:' . $sale . '.{0,48}' . $account . '|'
        . $account . '.{0,48}' . $sale . '|'
        . $game . '.{0,48}' . $account . '|'
        . $account . '.{0,48}' . $game . '|'
        . $account . '.{0,48}' . $value . '|'
        . $value . '.{0,48}' . $account . ')/ui';
    return preg_match($credentialPattern, $copy) !== 1 && preg_match($accountSalePattern, $copy) !== 1;
}

function isq_require_safe_service_copy(string ...$copyParts): void
{
    if (!isq_service_copy_is_safe(...$copyParts)) {
        isq_fail(
            'SERVICE_CONTENT_NOT_ALLOWED',
            'Services cannot advertise account transfers or contain passwords, login details, cookies, or security codes.',
            422,
            ['fields' => ['titleFr', 'titleAry', 'descriptionFr', 'descriptionAry']]
        );
    }
}

function isq_validate_service_price(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    $rawPrice = is_int($value) || is_float($value) || is_string($value) ? trim((string) $value) : '';
    if (!preg_match('/^(?:0|[1-9]\\d{0,7})(?:\\.\\d{1,2})?$/', $rawPrice)) {
        isq_fail('VALIDATION_FAILED', 'Enter a valid MAD price with at most two decimals.', 422, ['field' => 'priceMad']);
    }
    return number_format((float) $rawPrice, 2, '.', '');
}

function isq_validate_service_availability(mixed $value): string
{
    $availability = is_string($value) ? $value : '';
    if (!in_array($availability, ['available', 'out_of_stock', 'on_request', 'hidden'], true)) {
        isq_fail('VALIDATION_FAILED', 'Choose a valid availability.', 422, ['field' => 'availability']);
    }
    return $availability;
}

function isq_validate_service_sort_order(mixed $value): int
{
    $sortOrder = filter_var($value, FILTER_VALIDATE_INT);
    if ($sortOrder === false || $sortOrder < 0 || $sortOrder > 65535) {
        isq_fail('VALIDATION_FAILED', 'Sort order must be between 0 and 65,535.', 422, ['field' => 'sortOrder']);
    }
    return $sortOrder;
}

function isq_validate_service_featured(mixed $value): bool
{
    if (!is_bool($value)) {
        isq_fail('VALIDATION_FAILED', 'isFeatured must be true or false.', 422, ['field' => 'isFeatured']);
    }
    return $value;
}

/** @param array<string,mixed> $input */
function isq_reject_unknown_service_fields(array $input): void
{
    $allowed = [
        'action', 'serviceId', 'titleFr', 'titleAry', 'descriptionFr', 'descriptionAry', 'priceMad', 'availability',
        'sortOrder', 'isFeatured', 'expectedVersion', 'csrfToken',
    ];
    $unknown = array_values(array_diff(array_keys($input), $allowed));
    if ($unknown !== []) {
        isq_fail('VALIDATION_FAILED', 'The request contains unsupported service fields.', 422, ['fields' => $unknown]);
    }
}
