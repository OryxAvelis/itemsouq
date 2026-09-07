<?php
declare(strict_types=1);

require_once __DIR__ . '/../../_private/services_service.php';

$method = isq_method(['GET', 'POST']);
header('Cache-Control: no-store');
$admin = isq_require_admin();

if ($method === 'GET') {
    $catalogue = isq_services_data(true);
    isq_ok(['services' => $catalogue['services']], 200, ['updatedAt' => $catalogue['updatedAt']]);
}

isq_require_same_origin();
$input = isq_input();
isq_require_csrf($input);
isq_rate_limit('owner.services.write', 120, 600, (string) $admin['id']);
isq_reject_unknown_service_fields($input);

$action = is_string($input['action'] ?? null) ? strtolower(trim($input['action'])) : '';
if (!in_array($action, ['create', 'update', 'archive', 'restore'], true)) {
    isq_fail('VALIDATION_FAILED', 'Choose create, update, archive, or restore.', 422, ['field' => 'action']);
}

$pdo = isq_db();
$serviceId = null;
$expectedVersion = null;
$existing = null;
if ($action !== 'create') {
    $serviceId = isq_validate_service_id($input['serviceId'] ?? null);
    $expectedVersion = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
    if ($expectedVersion === false || $expectedVersion < 1) {
        isq_fail('VALIDATION_FAILED', 'A valid expectedVersion is required.', 422, ['field' => 'expectedVersion']);
    }
    $readExisting = $pdo->prepare('SELECT * FROM isq_services WHERE public_id = ? LIMIT 1');
    $readExisting->execute([$serviceId]);
    $existing = $readExisting->fetch();
    if (!is_array($existing)) {
        isq_fail('SERVICE_NOT_FOUND', 'The selected service was not found.', 404);
    }
}

if ($action === 'create') {
    $titleFr = isq_validate_service_text($input['titleFr'] ?? null, 'titleFr', 3, 100);
    $titleAry = isq_validate_service_text($input['titleAry'] ?? null, 'titleAry', 3, 100);
    $descriptionFr = isq_validate_service_text($input['descriptionFr'] ?? '', 'descriptionFr', 0, 300);
    $descriptionAry = isq_validate_service_text($input['descriptionAry'] ?? '', 'descriptionAry', 0, 300);
    isq_require_safe_service_copy($titleFr, $titleAry, $descriptionFr, $descriptionAry);
    $price = isq_validate_service_price($input['priceMad'] ?? null);
    $availability = array_key_exists('availability', $input)
        ? isq_validate_service_availability($input['availability'])
        : 'hidden';
    $sortOrder = array_key_exists('sortOrder', $input)
        ? isq_validate_service_sort_order($input['sortOrder'])
        : min(65535, (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM isq_services')->fetchColumn());
    $isFeatured = array_key_exists('isFeatured', $input)
        ? isq_validate_service_featured($input['isFeatured'])
        : false;
    if ($availability === 'available' && $price === null) {
        isq_fail('VALIDATION_FAILED', 'Available services need a MAD price.', 422, ['field' => 'priceMad']);
    }
} elseif ($action === 'update') {
    $titleFr = array_key_exists('titleFr', $input)
        ? isq_validate_service_text($input['titleFr'], 'titleFr', 3, 100)
        : (string) $existing['title_fr'];
    $titleAry = array_key_exists('titleAry', $input)
        ? isq_validate_service_text($input['titleAry'], 'titleAry', 3, 100)
        : (string) $existing['title_ary'];
    $descriptionFr = array_key_exists('descriptionFr', $input)
        ? isq_validate_service_text($input['descriptionFr'], 'descriptionFr', 0, 300)
        : (string) $existing['description_fr'];
    $descriptionAry = array_key_exists('descriptionAry', $input)
        ? isq_validate_service_text($input['descriptionAry'], 'descriptionAry', 0, 300)
        : (string) $existing['description_ary'];
    isq_require_safe_service_copy($titleFr, $titleAry, $descriptionFr, $descriptionAry);
    $price = array_key_exists('priceMad', $input)
        ? isq_validate_service_price($input['priceMad'])
        : ($existing['price_mad'] === null ? null : (string) $existing['price_mad']);
    $availability = array_key_exists('availability', $input)
        ? isq_validate_service_availability($input['availability'])
        : (string) $existing['availability'];
    $sortOrder = array_key_exists('sortOrder', $input)
        ? isq_validate_service_sort_order($input['sortOrder'])
        : (int) $existing['sort_order'];
    $isFeatured = array_key_exists('isFeatured', $input)
        ? isq_validate_service_featured($input['isFeatured'])
        : (bool) $existing['is_featured'];
    if ($availability === 'available' && $price === null) {
        isq_fail('VALIDATION_FAILED', 'Available services need a MAD price.', 422, ['field' => 'priceMad']);
    }
} elseif ($action === 'restore') {
    isq_require_safe_service_copy(
        (string) $existing['title_fr'],
        (string) $existing['title_ary'],
        (string) $existing['description_fr'],
        (string) $existing['description_ary']
    );
}

$pdo->beginTransaction();
try {
    if ($action === 'create') {
        $insert = $pdo->prepare(
            'INSERT INTO isq_services '
            . '(public_id, title_fr, title_ary, description_fr, description_ary, price_mad, availability, sort_order, is_featured, updated_by) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $created = false;
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $serviceId = isq_public_id('SVC');
            try {
                $insert->execute([
                    $serviceId, $titleFr, $titleAry, $descriptionFr, $descriptionAry,
                    $price, $availability, $sortOrder, $isFeatured ? 1 : 0, $admin['id'],
                ]);
                $created = true;
                break;
            } catch (PDOException $error) {
                if ((string) ($error->errorInfo[0] ?? '') !== '23000' || (int) ($error->errorInfo[1] ?? 0) !== 1062) {
                    throw $error;
                }
            }
        }
        if (!$created) {
            throw new RuntimeException('Could not allocate a unique service ID.');
        }
        $internalId = (int) $pdo->lastInsertId();
    } else {
        $internalId = (int) $existing['id'];
        if ($action === 'update') {
            $update = $pdo->prepare(
                'UPDATE isq_services SET title_fr = ?, title_ary = ?, description_fr = ?, description_ary = ?, '
                . 'price_mad = ?, availability = ?, '
                . 'sort_order = ?, is_featured = ?, version = version + 1, updated_by = ? '
                . 'WHERE id = ? AND version = ?'
            );
            $update->execute([
                $titleFr, $titleAry, $descriptionFr, $descriptionAry, $price, $availability, $sortOrder, $isFeatured ? 1 : 0,
                $admin['id'], $internalId, $expectedVersion,
            ]);
        } else {
            $archived = $action === 'archive' ? 1 : 0;
            $update = $pdo->prepare(
                'UPDATE isq_services SET is_archived = ?, version = version + 1, updated_by = ? '
                . 'WHERE id = ? AND version = ?'
            );
            $update->execute([$archived, $admin['id'], $internalId, $expectedVersion]);
        }
        if ($update->rowCount() !== 1) {
            $current = $pdo->prepare('SELECT version FROM isq_services WHERE id = ?');
            $current->execute([$internalId]);
            $currentVersion = $current->fetchColumn();
            $pdo->rollBack();
            if ($currentVersion === false) {
                isq_fail('SERVICE_NOT_FOUND', 'The selected service was not found.', 404);
            }
            isq_fail('VERSION_CONFLICT', 'This service changed in another session. Reload and try again.', 409, [
                'currentVersion' => (int) $currentVersion,
            ]);
        }
    }

    $read = $pdo->prepare('SELECT * FROM isq_services WHERE id = ?');
    $read->execute([$internalId]);
    $serviceRow = $read->fetch();
    $history = $pdo->prepare(
        'INSERT INTO isq_service_history '
        . '(service_id, title_fr, title_ary, description_fr, description_ary, price_mad, availability, sort_order, is_featured, '
        . 'is_archived, service_version, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $history->execute([
        $internalId,
        $serviceRow['title_fr'],
        $serviceRow['title_ary'],
        $serviceRow['description_fr'],
        $serviceRow['description_ary'],
        $serviceRow['price_mad'],
        $serviceRow['availability'],
        $serviceRow['sort_order'],
        $serviceRow['is_featured'],
        $serviceRow['is_archived'],
        $serviceRow['version'],
        $admin['id'],
    ]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $error;
}

isq_ok(['service' => isq_service_data($serviceRow)], $action === 'create' ? 201 : 200);
