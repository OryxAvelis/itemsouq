-- Source: database\migrations\001_core.sql
-- Itemsouq core support tables. Safe to re-run; legacy tables are untouched.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS isq_schema_migrations (
    version VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description VARCHAR(160) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_owner_users (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    singleton_key TINYINT UNSIGNED NOT NULL DEFAULT 1,
    username VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_owner_singleton (singleton_key),
    UNIQUE KEY uq_isq_owner_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_rate_limit_buckets (
    scope VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    actor_hash BINARY(32) NOT NULL,
    window_started_at DATETIME NOT NULL,
    hit_count INT UNSIGNED NOT NULL DEFAULT 1,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (scope, actor_hash, window_started_at),
    KEY idx_isq_rate_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('001_core', 'Owner authentication and database-backed write throttling');


-- Source: database\migrations\002_catalogue.sql
-- Owner-managed fruit prices and availability.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS isq_fruits (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(60) NOT NULL,
    rarity ENUM('Common','Uncommon','Rare','Legendary','Mythical') NOT NULL,
    fruit_type ENUM('Natural','Elemental','Beast') NOT NULL,
    beli_value INT UNSIGNED NOT NULL,
    robux_value SMALLINT UNSIGNED NOT NULL,
    image_path VARCHAR(180) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_fruit_slug (slug),
    UNIQUE KEY uq_isq_fruit_sort (sort_order),
    KEY idx_isq_fruit_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_fruit_offerings (
    fruit_id SMALLINT UNSIGNED NOT NULL,
    sale_mode ENUM('physical','permanent') NOT NULL,
    price_mad DECIMAL(10,2) NULL,
    availability ENUM('available','out_of_stock','on_request','hidden') NOT NULL DEFAULT 'hidden',
    quantity_available SMALLINT UNSIGNED NULL,
    needs_owner_review TINYINT(1) NOT NULL DEFAULT 1,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by SMALLINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (fruit_id, sale_mode),
    KEY idx_isq_offering_public (availability, sale_mode, fruit_id),
    KEY idx_isq_offering_updated_by (updated_by),
    CONSTRAINT fk_isq_offering_fruit FOREIGN KEY (fruit_id) REFERENCES isq_fruits (id) ON DELETE RESTRICT,
    CONSTRAINT fk_isq_offering_owner FOREIGN KEY (updated_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_fruit_offering_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    fruit_id SMALLINT UNSIGNED NOT NULL,
    sale_mode ENUM('physical','permanent') NOT NULL,
    price_mad DECIMAL(10,2) NULL,
    availability ENUM('available','out_of_stock','on_request','hidden') NOT NULL,
    quantity_available SMALLINT UNSIGNED NULL,
    needs_owner_review TINYINT(1) NOT NULL,
    offering_version INT UNSIGNED NOT NULL,
    changed_by SMALLINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_offering_history_version (fruit_id, sale_mode, offering_version),
    KEY idx_isq_offering_history_time (fruit_id, sale_mode, changed_at),
    KEY idx_isq_offering_history_owner (changed_by),
    CONSTRAINT fk_isq_offering_history_fruit FOREIGN KEY (fruit_id) REFERENCES isq_fruits (id) ON DELETE RESTRICT,
    CONSTRAINT fk_isq_offering_history_owner FOREIGN KEY (changed_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('002_catalogue', 'Normalized fruit reference data and owner-managed offerings');


-- Source: database\migrations\003_trading.sql
-- Public community trades with capability-based management (no customer accounts).
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS isq_trades (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    manage_token_hash BINARY(32) NOT NULL,
    request_key_hash BINARY(32) NOT NULL,
    request_payload_hash BINARY(32) NOT NULL,
    username VARCHAR(20) NOT NULL,
    sale_mode ENUM('physical','permanent') NOT NULL,
    note VARCHAR(180) NULL,
    status ENUM('open','matched','completed','closed','removed') NOT NULL DEFAULT 'open',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_trade_public_id (public_id),
    UNIQUE KEY uq_isq_trade_token (manage_token_hash),
    UNIQUE KEY uq_isq_trade_request (request_key_hash),
    KEY idx_isq_trade_feed (status, sale_mode, created_at, id),
    KEY idx_isq_trade_expiry (status, expires_at),
    KEY idx_isq_trade_username (username, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_trade_items (
    trade_id BIGINT UNSIGNED NOT NULL,
    side ENUM('offered','wanted') NOT NULL,
    fruit_id SMALLINT UNSIGNED NOT NULL,
    quantity TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (trade_id, side, fruit_id),
    KEY idx_isq_trade_item_filter (fruit_id, side, trade_id),
    CONSTRAINT fk_isq_trade_item_trade FOREIGN KEY (trade_id) REFERENCES isq_trades (id) ON DELETE CASCADE,
    CONSTRAINT fk_isq_trade_item_fruit FOREIGN KEY (fruit_id) REFERENCES isq_fruits (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_trade_responses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    trade_id BIGINT UNSIGNED NOT NULL,
    manage_token_hash BINARY(32) NOT NULL,
    request_key_hash BINARY(32) NOT NULL,
    request_payload_hash BINARY(32) NOT NULL,
    username VARCHAR(20) NOT NULL,
    note VARCHAR(160) NULL,
    outcome ENUM('pending','accepted','declined','withdrawn','removed') NOT NULL DEFAULT 'pending',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_response_public_id (public_id),
    UNIQUE KEY uq_isq_response_token (manage_token_hash),
    UNIQUE KEY uq_isq_response_request (request_key_hash),
    KEY idx_isq_response_trade (trade_id, outcome, created_at, id),
    CONSTRAINT fk_isq_response_trade FOREIGN KEY (trade_id) REFERENCES isq_trades (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_trade_response_items (
    response_id BIGINT UNSIGNED NOT NULL,
    fruit_id SMALLINT UNSIGNED NOT NULL,
    quantity TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (response_id, fruit_id),
    KEY idx_isq_response_item_fruit (fruit_id, response_id),
    CONSTRAINT fk_isq_response_item_response FOREIGN KEY (response_id) REFERENCES isq_trade_responses (id) ON DELETE CASCADE,
    CONSTRAINT fk_isq_response_item_fruit FOREIGN KEY (fruit_id) REFERENCES isq_fruits (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('003_trading', 'Community trades, quantities, responses, and capability ownership');


-- Source: database\migrations\004_orders.sql
-- WhatsApp order references and owner-managed status history.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS isq_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reference CHAR(19) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status_token_hash BINARY(32) NOT NULL,
    request_key_hash BINARY(32) NOT NULL,
    request_payload_hash BINARY(32) NOT NULL,
    buyer_first_name VARCHAR(40) NOT NULL,
    roblox_username VARCHAR(30) NOT NULL,
    payment_method ENUM('cash_plus','wafacash') NOT NULL,
    city VARCHAR(80) NULL,
    quoted_total_mad DECIMAL(10,2) NOT NULL,
    status ENUM('new','contacted','confirmed','payment_pending','paid','delivering','completed','cancelled') NOT NULL DEFAULT 'new',
    public_note VARCHAR(240) NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    terminal_at DATETIME NULL,
    anonymized_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_order_reference (reference),
    UNIQUE KEY uq_isq_order_status_token (status_token_hash),
    UNIQUE KEY uq_isq_order_request (request_key_hash),
    KEY idx_isq_order_owner_queue (status, updated_at, id),
    KEY idx_isq_order_terminal (terminal_at, anonymized_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_order_items (
    order_id BIGINT UNSIGNED NOT NULL,
    fruit_id SMALLINT UNSIGNED NOT NULL,
    sale_mode ENUM('physical','permanent') NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_price_mad DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_id, fruit_id, sale_mode),
    KEY idx_isq_order_item_fruit (fruit_id, order_id),
    CONSTRAINT fk_isq_order_item_order FOREIGN KEY (order_id) REFERENCES isq_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_isq_order_item_fruit FOREIGN KEY (fruit_id) REFERENCES isq_fruits (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS isq_order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    from_status ENUM('new','contacted','confirmed','payment_pending','paid','delivering','completed','cancelled') NULL,
    to_status ENUM('new','contacted','confirmed','payment_pending','paid','delivering','completed','cancelled') NOT NULL,
    public_note VARCHAR(240) NULL,
    order_version INT UNSIGNED NOT NULL,
    changed_by SMALLINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_isq_order_history_version (order_id, order_version),
    KEY idx_isq_order_history_time (order_id, changed_at, id),
    KEY idx_isq_order_history_owner (changed_by),
    CONSTRAINT fk_isq_order_history_order FOREIGN KEY (order_id) REFERENCES isq_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_isq_order_history_owner FOREIGN KEY (changed_by) REFERENCES isq_owner_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('004_orders', 'WhatsApp order references, item snapshots, and status history');


-- Source: database\migrations\005_seed_fruits.sql
-- Canonical Fandom reference catalogue plus the current prototype price/quantity values.
-- IMPORTANT: every seeded offering has needs_owner_review = 1. The owner must review
-- and save each value before it is treated as confirmed business data.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

INSERT INTO isq_fruits
    (id, slug, display_name, rarity, fruit_type, beli_value, robux_value, image_path, sort_order)
VALUES
    (1, 'rocket', 'Rocket', 'Common', 'Natural', 5000, 50, 'assets/images/fruits/rocket.webp', 1),
    (2, 'spin', 'Spin', 'Common', 'Natural', 7500, 75, 'assets/images/fruits/spin.webp', 2),
    (3, 'blade', 'Blade', 'Common', 'Natural', 30000, 100, 'assets/images/fruits/blade.webp', 3),
    (4, 'spring', 'Spring', 'Common', 'Natural', 60000, 180, 'assets/images/fruits/spring.webp', 4),
    (5, 'bomb', 'Bomb', 'Common', 'Natural', 80000, 220, 'assets/images/fruits/bomb.webp', 5),
    (6, 'smoke', 'Smoke', 'Common', 'Elemental', 100000, 250, 'assets/images/fruits/smoke.webp', 6),
    (7, 'spike', 'Spike', 'Common', 'Natural', 180000, 380, 'assets/images/fruits/spike.webp', 7),
    (8, 'flame', 'Flame', 'Uncommon', 'Elemental', 250000, 550, 'assets/images/fruits/flame.webp', 8),
    (9, 'ice', 'Ice', 'Uncommon', 'Elemental', 350000, 750, 'assets/images/fruits/ice.webp', 9),
    (10, 'sand', 'Sand', 'Uncommon', 'Elemental', 420000, 850, 'assets/images/fruits/sand.webp', 10),
    (11, 'dark', 'Dark', 'Uncommon', 'Elemental', 500000, 950, 'assets/images/fruits/dark.webp', 11),
    (12, 'eagle', 'Eagle', 'Uncommon', 'Beast', 550000, 975, 'assets/images/fruits/eagle.webp', 12),
    (13, 'diamond', 'Diamond', 'Uncommon', 'Natural', 600000, 1000, 'assets/images/fruits/diamond.webp', 13),
    (14, 'light', 'Light', 'Rare', 'Elemental', 650000, 1100, 'assets/images/fruits/light.webp', 14),
    (15, 'rubber', 'Rubber', 'Rare', 'Natural', 750000, 1200, 'assets/images/fruits/rubber.webp', 15),
    (16, 'ghost', 'Ghost', 'Rare', 'Natural', 940000, 1275, 'assets/images/fruits/ghost.webp', 16),
    (17, 'magma', 'Magma', 'Rare', 'Elemental', 960000, 1300, 'assets/images/fruits/magma.webp', 17),
    (18, 'quake', 'Quake', 'Legendary', 'Natural', 1000000, 1500, 'assets/images/fruits/quake.webp', 18),
    (19, 'buddha', 'Buddha', 'Legendary', 'Beast', 1200000, 1650, 'assets/images/fruits/buddha.webp', 19),
    (20, 'love', 'Love', 'Legendary', 'Natural', 1300000, 1700, 'assets/images/fruits/love.webp', 20),
    (21, 'creation', 'Creation', 'Legendary', 'Natural', 1400000, 1750, 'assets/images/fruits/creation.webp', 21),
    (22, 'spider', 'Spider', 'Legendary', 'Natural', 1500000, 1800, 'assets/images/fruits/spider.webp', 22),
    (23, 'sound', 'Sound', 'Legendary', 'Natural', 1700000, 1900, 'assets/images/fruits/sound.webp', 23),
    (24, 'phoenix', 'Phoenix', 'Legendary', 'Beast', 1800000, 2000, 'assets/images/fruits/phoenix.webp', 24),
    (25, 'portal', 'Portal', 'Legendary', 'Natural', 1900000, 2000, 'assets/images/fruits/portal.webp', 25),
    (26, 'lightning', 'Lightning', 'Legendary', 'Elemental', 2100000, 2100, 'assets/images/fruits/lightning.webp', 26),
    (27, 'pain', 'Pain', 'Legendary', 'Natural', 2300000, 2200, 'assets/images/fruits/pain.webp', 27),
    (28, 'blizzard', 'Blizzard', 'Legendary', 'Elemental', 2400000, 2250, 'assets/images/fruits/blizzard.webp', 28),
    (29, 'gravity', 'Gravity', 'Mythical', 'Natural', 2500000, 2300, 'assets/images/fruits/gravity.webp', 29),
    (30, 'mammoth', 'Mammoth', 'Mythical', 'Beast', 2700000, 2350, 'assets/images/fruits/mammoth.webp', 30),
    (31, 't-rex', 'T-Rex', 'Mythical', 'Beast', 2700000, 2350, 'assets/images/fruits/t-rex.webp', 31),
    (32, 'dough', 'Dough', 'Mythical', 'Elemental', 2800000, 2400, 'assets/images/fruits/dough.webp', 32),
    (33, 'shadow', 'Shadow', 'Mythical', 'Natural', 2900000, 2425, 'assets/images/fruits/shadow.webp', 33),
    (34, 'venom', 'Venom', 'Mythical', 'Natural', 3000000, 2450, 'assets/images/fruits/venom.webp', 34),
    (35, 'gas', 'Gas', 'Mythical', 'Elemental', 3200000, 2500, 'assets/images/fruits/gas.webp', 35),
    (36, 'spirit', 'Spirit', 'Mythical', 'Natural', 3400000, 2550, 'assets/images/fruits/spirit.webp', 36),
    (37, 'tiger', 'Tiger', 'Mythical', 'Beast', 5000000, 3000, 'assets/images/fruits/tiger.webp', 37),
    (38, 'yeti', 'Yeti', 'Mythical', 'Beast', 5000000, 3000, 'assets/images/fruits/yeti.webp', 38),
    (39, 'kitsune', 'Kitsune', 'Mythical', 'Beast', 8000000, 4000, 'assets/images/fruits/kitsune.webp', 39),
    (40, 'control', 'Control', 'Mythical', 'Natural', 9000000, 4000, 'assets/images/fruits/control.webp', 40),
    (41, 'dragon', 'Dragon', 'Mythical', 'Beast', 15000000, 5000, 'assets/images/fruits/dragon.webp', 41)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    rarity = VALUES(rarity),
    fruit_type = VALUES(fruit_type),
    beli_value = VALUES(beli_value),
    robux_value = VALUES(robux_value),
    image_path = VALUES(image_path),
    sort_order = VALUES(sort_order),
    is_active = 1;

INSERT INTO isq_fruit_offerings
    (fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, version)
VALUES
    (1, 'physical', 10.00, 'available', 2, 1, 1),
    (1, 'permanent', 25.00, 'available', 1, 1, 1),
    (2, 'physical', 10.00, 'available', 1, 1, 1),
    (2, 'permanent', 25.00, 'available', 1, 1, 1),
    (3, 'physical', 10.00, 'available', 3, 1, 1),
    (3, 'permanent', 25.00, 'available', 1, 1, 1),
    (4, 'physical', 10.00, 'available', 3, 1, 1),
    (4, 'permanent', 30.00, 'available', 1, 1, 1),
    (5, 'physical', 15.00, 'available', 5, 1, 1),
    (5, 'permanent', 35.00, 'available', 1, 1, 1),
    (6, 'physical', 15.00, 'available', 2, 1, 1),
    (6, 'permanent', 40.00, 'available', 1, 1, 1),
    (7, 'physical', 20.00, 'available', 4, 1, 1),
    (7, 'permanent', 60.00, 'available', 1, 1, 1),
    (8, 'physical', 20.00, 'available', 1, 1, 1),
    (8, 'permanent', 85.00, 'available', 1, 1, 1),
    (9, 'physical', 25.00, 'available', 4, 1, 1),
    (9, 'permanent', 115.00, 'available', 1, 1, 1),
    (10, 'physical', 30.00, 'available', 1, 1, 1),
    (10, 'permanent', 130.00, 'available', 1, 1, 1),
    (11, 'physical', 30.00, 'available', 2, 1, 1),
    (11, 'permanent', 145.00, 'available', 1, 1, 1),
    (12, 'physical', 30.00, 'available', 4, 1, 1),
    (12, 'permanent', 150.00, 'available', 1, 1, 1),
    (13, 'physical', 35.00, 'available', 1, 1, 1),
    (13, 'permanent', 150.00, 'available', 1, 1, 1),
    (14, 'physical', 35.00, 'available', 5, 1, 1),
    (14, 'permanent', 165.00, 'available', 1, 1, 1),
    (15, 'physical', 35.00, 'available', 1, 1, 1),
    (15, 'permanent', 180.00, 'available', 1, 1, 1),
    (16, 'physical', 40.00, 'available', 3, 1, 1),
    (16, 'permanent', 195.00, 'available', 1, 1, 1),
    (17, 'physical', 40.00, 'available', 4, 1, 1),
    (17, 'permanent', 195.00, 'available', 1, 1, 1),
    (18, 'physical', 40.00, 'available', 4, 1, 1),
    (18, 'permanent', 225.00, 'available', 1, 1, 1),
    (19, 'physical', 45.00, 'available', 5, 1, 1),
    (19, 'permanent', 250.00, 'available', 1, 1, 1),
    (20, 'physical', 50.00, 'available', 2, 1, 1),
    (20, 'permanent', 255.00, 'available', 1, 1, 1),
    (21, 'physical', 50.00, 'available', 2, 1, 1),
    (21, 'permanent', 265.00, 'available', 1, 1, 1),
    (22, 'physical', 50.00, 'available', 1, 1, 1),
    (22, 'permanent', 270.00, 'available', 1, 1, 1),
    (23, 'physical', 55.00, 'available', 2, 1, 1),
    (23, 'permanent', 285.00, 'available', 1, 1, 1),
    (24, 'physical', 55.00, 'available', 2, 1, 1),
    (24, 'permanent', 300.00, 'available', 1, 1, 1),
    (25, 'physical', 60.00, 'available', 2, 1, 1),
    (25, 'permanent', 300.00, 'available', 1, 1, 1),
    (26, 'physical', 60.00, 'available', 3, 1, 1),
    (26, 'permanent', 315.00, 'available', 1, 1, 1),
    (27, 'physical', 65.00, 'available', 3, 1, 1),
    (27, 'permanent', 330.00, 'available', 1, 1, 1),
    (28, 'physical', 65.00, 'available', 5, 1, 1),
    (28, 'permanent', 340.00, 'available', 1, 1, 1),
    (29, 'physical', 65.00, 'available', 3, 1, 1),
    (29, 'permanent', 345.00, 'available', 1, 1, 1),
    (30, 'physical', 70.00, 'available', 4, 1, 1),
    (30, 'permanent', 355.00, 'available', 1, 1, 1),
    (31, 'physical', 70.00, 'available', 3, 1, 1),
    (31, 'permanent', 355.00, 'available', 1, 1, 1),
    (32, 'physical', 70.00, 'available', 4, 1, 1),
    (32, 'permanent', 360.00, 'available', 1, 1, 1),
    (33, 'physical', 70.00, 'available', 5, 1, 1),
    (33, 'permanent', 365.00, 'available', 1, 1, 1),
    (34, 'physical', 70.00, 'available', 3, 1, 1),
    (34, 'permanent', 370.00, 'available', 1, 1, 1),
    (35, 'physical', 75.00, 'available', 4, 1, 1),
    (35, 'permanent', 375.00, 'available', 1, 1, 1),
    (36, 'physical', 75.00, 'available', 1, 1, 1),
    (36, 'permanent', 385.00, 'available', 1, 1, 1),
    (37, 'physical', 90.00, 'available', 3, 1, 1),
    (37, 'permanent', 450.00, 'available', 1, 1, 1),
    (38, 'physical', 90.00, 'available', 2, 1, 1),
    (38, 'permanent', 450.00, 'available', 1, 1, 1),
    (39, 'physical', 115.00, 'available', 5, 1, 1),
    (39, 'permanent', 600.00, 'available', 1, 1, 1),
    (40, 'physical', 120.00, 'available', 3, 1, 1),
    (40, 'permanent', 600.00, 'available', 1, 1, 1),
    (41, 'physical', 155.00, 'available', 4, 1, 1),
    (41, 'permanent', 750.00, 'available', 1, 1, 1)
ON DUPLICATE KEY UPDATE fruit_id = VALUES(fruit_id);

INSERT IGNORE INTO isq_fruit_offering_history
    (fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, offering_version, changed_by)
SELECT fruit_id, sale_mode, price_mad, availability, quantity_available, needs_owner_review, version, NULL
FROM isq_fruit_offerings;

INSERT IGNORE INTO isq_schema_migrations (version, description)
VALUES ('005_seed_fruits', '41 Fandom fruits and 82 prototype offerings flagged for owner review');
