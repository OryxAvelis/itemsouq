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
