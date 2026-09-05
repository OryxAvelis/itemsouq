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
