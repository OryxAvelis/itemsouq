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
