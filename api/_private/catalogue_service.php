<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/** @return array{fruits:list<array<string,mixed>>,updatedAt:?string,reviewCount:int} */
function isq_catalogue_data(bool $ownerView = false): array
{
    $statement = isq_db()->query(
        'SELECT f.id, f.slug, f.display_name, f.rarity, f.fruit_type, f.beli_value, f.robux_value, '
        . 'f.image_path, f.sort_order, o.sale_mode, o.price_mad, o.availability, '
        . 'o.quantity_available, o.needs_owner_review, o.version, o.updated_at '
        . 'FROM isq_fruits f '
        . 'LEFT JOIN isq_fruit_offerings o ON o.fruit_id = f.id '
        . 'WHERE f.is_active = 1 ORDER BY f.sort_order, FIELD(o.sale_mode, \'physical\', \'permanent\')'
    );

    $fruits = [];
    $updatedAt = null;
    $reviewCount = 0;
    foreach ($statement as $row) {
        $slug = (string) $row['slug'];
        if (!isset($fruits[$slug])) {
            $fruits[$slug] = [
                'id' => $slug,
                'name' => (string) $row['display_name'],
                'rarity' => (string) $row['rarity'],
                'type' => (string) $row['fruit_type'],
                'beli' => (int) $row['beli_value'],
                'robux' => (int) $row['robux_value'],
                'image' => (string) $row['image_path'],
                'sortOrder' => (int) $row['sort_order'],
                'offerings' => ['physical' => null, 'permanent' => null],
            ];
        }
        if ($row['sale_mode'] === null) {
            continue;
        }
        $mode = (string) $row['sale_mode'];
        $hidden = $row['availability'] === 'hidden';
        $needsReview = (bool) $row['needs_owner_review'];
        $publicUnconfirmed = !$ownerView && $needsReview && !$hidden;
        if ($needsReview) {
            $reviewCount++;
        }
        $rowUpdated = isq_iso((string) $row['updated_at']);
        if ($rowUpdated !== null && ($updatedAt === null || strcmp($rowUpdated, $updatedAt) > 0)) {
            $updatedAt = $rowUpdated;
        }
        $fruits[$slug]['offerings'][$mode] = [
            'priceMad' => (!$ownerView && $hidden) || $row['price_mad'] === null
                ? null
                : number_format((float) $row['price_mad'], 2, '.', ''),
            'availability' => $publicUnconfirmed ? 'on_request' : (string) $row['availability'],
            'quantityAvailable' => (!$ownerView && ($hidden || $needsReview)) || $row['quantity_available'] === null
                ? null
                : (int) $row['quantity_available'],
            'needsOwnerReview' => $needsReview,
            'version' => (int) $row['version'],
            'updatedAt' => $rowUpdated,
        ];
    }

    return ['fruits' => array_values($fruits), 'updatedAt' => $updatedAt, 'reviewCount' => $reviewCount];
}
