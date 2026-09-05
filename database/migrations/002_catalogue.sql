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
