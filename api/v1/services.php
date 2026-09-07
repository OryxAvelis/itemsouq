<?php
declare(strict_types=1);

require_once __DIR__ . '/../_private/services_service.php';

isq_method('GET');
$catalogue = isq_services_data(false);
$catalogueHash = hash('sha256', json_encode($catalogue, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
$etag = '"' . $catalogueHash . '"';
header('ETag: ' . $etag);
header('Cache-Control: public, max-age=60, stale-while-revalidate=120');
if (is_string($_SERVER['HTTP_IF_NONE_MATCH'] ?? null) && trim((string) $_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

isq_ok(
    ['services' => $catalogue['services']],
    200,
    ['updatedAt' => $catalogue['updatedAt'], 'catalogueVersion' => substr($catalogueHash, 0, 16)]
);
