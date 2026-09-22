-- Add the Magnet fruit introduced in Blox Fruits Update 30.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

INSERT INTO isq_fruits
    (id, slug, display_name, rarity, fruit_type, beli_value, robux_value, image_path, sort_order)
VALUES
    (42, 'magnet', 'Magnet', 'Mythical', 'Natural', 6000000, 3500, 'assets/images/fruits/magnet.webp', 42)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    rarity = VALUES(rarity),
    fruit_type = VALUES(fruit_type),
    beli_value = VALUES(beli_value),
    robux_value = VALUES(robux_value),
    image_path = VALUES(image_path),
    is_active = 1;

INSERT INTO isq_fruit_offerings
    (fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, version)
VALUES
    (42, 'physical', NULL, 'on_request', NULL, 1, 1),
    (42, 'permanent', NULL, 'on_request', NULL, 1, 1)
ON DUPLICATE KEY UPDATE fruit_id = VALUES(fruit_id);

INSERT IGNORE INTO isq_fruit_offering_history
    (fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, offering_version, changed_by)
SELECT fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, version, NULL
FROM isq_fruit_offerings
WHERE fruit_id = 42;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('007_add_magnet_fruit', 'Magnet Fandom fruit and two owner-review offerings');
