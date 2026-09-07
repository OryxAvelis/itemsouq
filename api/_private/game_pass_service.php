<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/** @return array{gamePasses:list<array<string,mixed>>,updatedAt:?string,reviewCount:int} */
function isq_game_pass_catalogue_data(bool $ownerView = false): array
{
    $statement = isq_db()->query(
        'SELECT p.id, p.slug, p.display_name, p.short_description, p.robux_value, '
        . 'p.image_path, p.source_url, p.sort_order, o.price_mad, o.availability, '
        . 'o.quantity_available, o.needs_owner_review, o.version, o.updated_at '
        . 'FROM isq_game_passes p '
        . 'LEFT JOIN isq_game_pass_offerings o ON o.game_pass_id = p.id '
        . 'WHERE p.is_active = 1 '
        . ($ownerView ? '' : "AND (o.availability IS NULL OR o.availability <> 'hidden') ")
        . 'ORDER BY p.sort_order, p.id'
    );

    $gamePasses = [];
    $updatedAt = null;
    $reviewCount = 0;
    foreach ($statement as $row) {
        $offering = null;
        if ($row['availability'] !== null) {
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
            $offering = [
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
        $gamePasses[] = [
            'id' => (string) $row['slug'],
            'name' => (string) $row['display_name'],
            'description' => (string) $row['short_description'],
            'robux' => (int) $row['robux_value'],
            'image' => (string) $row['image_path'],
            'sourceUrl' => (string) $row['source_url'],
            'sortOrder' => (int) $row['sort_order'],
            'offering' => $offering,
        ];
    }

    return ['gamePasses' => $gamePasses, 'updatedAt' => $updatedAt, 'reviewCount' => $reviewCount];
}
