-- Owner-managed Game Pass catalogue and generic service listings.
-- Game Pass reference metadata is seeded from the Blox Fruits Wiki; owner-set
-- MAD prices and quantities remain separate. Services intentionally contain no
-- account credential, password, cookie, payment-secret, or customer data fields.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS isq_game_passes (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    short_description VARCHAR(240) NOT NULL,
    robux_value SMALLINT UNSIGNED NOT NULL,
    image_path VARCHAR(180) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_url VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_game_pass_slug (slug),
    UNIQUE KEY uq_isq_game_pass_sort (sort_order),
    KEY idx_isq_game_pass_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_game_pass_offerings (
    game_pass_id SMALLINT UNSIGNED NOT NULL,
    price_mad DECIMAL(10,2) NULL,
    availability ENUM('available','out_of_stock','on_request','hidden') NOT NULL DEFAULT 'on_request',
    quantity_available SMALLINT UNSIGNED NULL,
    needs_owner_review TINYINT(1) NOT NULL DEFAULT 1,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by SMALLINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (game_pass_id),
    KEY idx_isq_game_pass_offering_public (availability, game_pass_id),
    KEY idx_isq_game_pass_offering_owner (updated_by),
    CONSTRAINT fk_isq_game_pass_offering_pass FOREIGN KEY (game_pass_id) REFERENCES isq_game_passes (id) ON DELETE RESTRICT,
    CONSTRAINT fk_isq_game_pass_offering_owner FOREIGN KEY (updated_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_game_pass_offering_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    game_pass_id SMALLINT UNSIGNED NOT NULL,
    price_mad DECIMAL(10,2) NULL,
    availability ENUM('available','out_of_stock','on_request','hidden') NOT NULL,
    quantity_available SMALLINT UNSIGNED NULL,
    needs_owner_review TINYINT(1) NOT NULL,
    offering_version INT UNSIGNED NOT NULL,
    changed_by SMALLINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_game_pass_history_version (game_pass_id, offering_version),
    KEY idx_isq_game_pass_history_time (game_pass_id, changed_at),
    KEY idx_isq_game_pass_history_owner (changed_by),
    CONSTRAINT fk_isq_game_pass_history_pass FOREIGN KEY (game_pass_id) REFERENCES isq_game_passes (id) ON DELETE RESTRICT,
    CONSTRAINT fk_isq_game_pass_history_owner FOREIGN KEY (changed_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title_fr VARCHAR(100) NOT NULL,
    title_ary VARCHAR(100) NOT NULL,
    description_fr VARCHAR(300) NOT NULL,
    description_ary VARCHAR(300) NOT NULL,
    price_mad DECIMAL(10,2) NULL,
    availability ENUM('available','out_of_stock','on_request','hidden') NOT NULL DEFAULT 'hidden',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by SMALLINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_service_public_id (public_id),
    KEY idx_isq_service_public (is_archived, availability, sort_order, id),
    KEY idx_isq_service_owner (updated_by),
    CONSTRAINT fk_isq_service_owner FOREIGN KEY (updated_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_service_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id BIGINT UNSIGNED NOT NULL,
    title_fr VARCHAR(100) NOT NULL,
    title_ary VARCHAR(100) NOT NULL,
    description_fr VARCHAR(300) NOT NULL,
    description_ary VARCHAR(300) NOT NULL,
    price_mad DECIMAL(10,2) NULL,
    availability ENUM('available','out_of_stock','on_request','hidden') NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    is_featured TINYINT(1) NOT NULL,
    is_archived TINYINT(1) NOT NULL,
    service_version INT UNSIGNED NOT NULL,
    changed_by SMALLINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_service_history_version (service_id, service_version),
    KEY idx_isq_service_history_time (service_id, changed_at),
    KEY idx_isq_service_history_owner (changed_by),
    CONSTRAINT fk_isq_service_history_service FOREIGN KEY (service_id) REFERENCES isq_services (id) ON DELETE CASCADE,
    CONSTRAINT fk_isq_service_history_owner FOREIGN KEY (changed_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO isq_game_passes
    (id, slug, display_name, short_description, robux_value, image_path, source_url, sort_order)
VALUES
    (1, '2x-boss-drops', '2x Boss Drops Chance', 'Doubles the chance of receiving item drops from defeated bosses.', 350, 'assets/images/gamepasses/boss-drops.png', 'https://blox-fruits.fandom.com/wiki/Shop', 1),
    (2, 'fast-boats', 'Fast Boats', 'Unlocks the Miracle and Sentinel boats.', 350, 'assets/images/gamepasses/fast-boats.png', 'https://blox-fruits.fandom.com/wiki/Shop', 2),
    (3, '2x-money', '2x Money', 'Doubles Beli earned from NPCs and quests.', 450, 'assets/images/gamepasses/money.png', 'https://blox-fruits.fandom.com/wiki/Shop', 3),
    (4, '2x-mastery', '2x Mastery', 'Doubles Mastery experience earned from defeated NPCs.', 450, 'assets/images/gamepasses/mastery.png', 'https://blox-fruits.fandom.com/wiki/Shop', 4),
    (5, 'dark-blade', 'Dark Blade', 'Grants the permanent Dark Blade sword.', 1200, 'assets/images/gamepasses/dark-blade.png', 'https://blox-fruits.fandom.com/wiki/Shop', 5),
    (6, 'fruit-notifier', 'Fruit Notifier', 'Alerts the player when a Blox Fruit spawns and shows its distance.', 2700, 'assets/images/gamepasses/notifier.png', 'https://blox-fruits.fandom.com/wiki/Shop', 6)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    short_description = VALUES(short_description),
    robux_value = VALUES(robux_value),
    image_path = VALUES(image_path),
    source_url = VALUES(source_url),
    sort_order = VALUES(sort_order),
    is_active = 1;

INSERT INTO isq_game_pass_offerings
    (game_pass_id, price_mad, availability, quantity_available, needs_owner_review, version)
VALUES
    (1, NULL, 'on_request', NULL, 1, 1),
    (2, NULL, 'on_request', NULL, 1, 1),
    (3, NULL, 'on_request', NULL, 1, 1),
    (4, NULL, 'on_request', NULL, 1, 1),
    (5, NULL, 'on_request', NULL, 1, 1),
    (6, NULL, 'on_request', NULL, 1, 1)
ON DUPLICATE KEY UPDATE game_pass_id = VALUES(game_pass_id);

INSERT IGNORE INTO isq_game_pass_offering_history
    (game_pass_id, price_mad, availability, quantity_available, needs_owner_review, offering_version, changed_by)
SELECT game_pass_id, price_mad, availability, quantity_available, needs_owner_review, version, NULL
FROM isq_game_pass_offerings;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('006_game_passes_services', 'Owner-managed Game Pass offerings and empty generic services catalogue');
