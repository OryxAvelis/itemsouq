<?php
declare(strict_types=1);

require_once __DIR__ . '/../_private/catalogue_service.php';

isq_method('GET');
$catalogue = isq_catalogue_data(false);
$catalogueHash = hash('sha256', json_encode($catalogue, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
$etag = '"' . $catalogueHash . '"';
header('ETag: ' . $etag);
header('Cache-Control: public, max-age=60, stale-while-revalidate=120');
if (is_string($_SERVER['HTTP_IF_NONE_MATCH'] ?? null) && trim((string) $_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

isq_ok(
    ['fruits' => $catalogue['fruits']],
    200,
    [
        'updatedAt' => $catalogue['updatedAt'],
        'catalogueVersion' => substr($catalogueHash, 0, 16),
        'reviewCount' => $catalogue['reviewCount'],
        'source' => [
            'label' => 'Blox Fruits Wiki · Fandom',
            'url' => 'https://blox-fruits.fandom.com/wiki/Blox_Fruits',
            'reviewedAt' => '2026-08-30',
        ],
    ]
);

