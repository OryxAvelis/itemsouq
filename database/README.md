# Itemsouq database and owner API

This backend covers only three product areas: owner-managed fruit prices and availability, public community trades with responses, and WhatsApp order references/status. It creates no customer accounts and contains no FruityBlox rotation/provider feature.

## Install locally

The migration files are intentionally idempotent and create only `isq_` tables. Existing legacy tables are not altered or dropped.

From `C:\xampp\htdocs\itemsouq`, run the five files in order with phpMyAdmin or the XAMPP MySQL client:

```powershell
& 'C:\xampp\mysql\bin\mysql.exe' -h 127.0.0.1 -u root itemsouq --execute="source database/migrations/001_core.sql; source database/migrations/002_catalogue.sql; source database/migrations/003_trading.sql; source database/migrations/004_orders.sql; source database/migrations/005_seed_fruits.sql;"
```

The local defaults are database `itemsouq`, user `root`, blank password, and one-time setup token `itemsouq-local-setup`. Open `/admin/`, create the sole owner account, and choose a password of at least 12 characters.

## Install on InfinityFree

1. Export the existing database from phpMyAdmin.
2. Create the target database in the InfinityFree control panel.
3. Import `001` through `005` in order using phpMyAdmin.
4. Copy `api/_private/config.example.php` to `api/_private/config.local.php`.
5. Set the exact SQL hostname shown in the control panel; do not use `localhost`.
6. Generate independent random `app_secret` and `setup_token` values, set the canonical HTTPS `origin`, and upload the private configuration.
7. Visit `/admin/` once, create the owner, then rotate the setup token to a new unused random value. Production configuration always requires a long setup token even though the endpoint is permanently disabled once the singleton owner exists.

`config.local.php`, session files, logs, and backups are ignored by Git. `api/_private/.htaccess` and `database/.htaccess` deny web access, but secrets should be placed outside the public web root when the hosting layout permits it.

## Seed policy

`005_seed_fruits.sql` contains the 41 Fandom reference fruits and 82 physical/permanent offerings. Prices and quantities reproduce the previous browser prototype, but every offering starts with `needs_owner_review = 1`. Until the owner saves it, the public API safely presents it as `on_request` with no available quantity. Saving it in the owner dashboard records an immutable history snapshot and clears the review marker.

Rerunning the seed refreshes canonical Fandom metadata but does not overwrite an owner-edited offering. Production contains no demo trades, responses, orders, customer records, or invented reputation figures.

## Public API

- `GET api/v1/catalogue.php`
- `GET|POST api/v1/trades.php`
- `GET api/v1/trade.php?id=TRD-...`
- `GET|POST api/v1/trade-responses.php?tradeId=TRD-...`
- `POST api/v1/trade-action.php`
- `POST api/v1/trade-response-action.php`
- `POST api/v1/orders.php`
- `GET api/v1/order-status.php?reference=ISQ-...` with its bearer status token

Public catalogue JSON is wrapped as `{ "ok": true, "data": { "fruits": [...] }, "meta": {...} }`. Money values are decimal strings. `meta.catalogueVersion` is a stable hash of the returned snapshot; each offering also has its own optimistic-lock `version`.

## Owner API

- `GET api/v1/admin/session.php`
- `POST api/v1/admin/setup.php`
- `POST api/v1/admin/login.php`
- `POST api/v1/admin/logout.php`
- `GET|POST api/v1/admin/catalogue.php`
- `GET api/v1/admin/orders.php`
- `POST api/v1/admin/order-status.php`

Owner writes require the HttpOnly session cookie, exact same-origin request, and `X-CSRF-Token`. Catalogue and order updates include `expectedVersion`; stale edits return HTTP 409.

## Security and privacy

- PDO uses native prepared statements, `utf8mb4`, UTC, and a strict SQL mode.
- Owner sessions are Secure on HTTPS, HttpOnly, SameSite Strict, idle for 30 minutes, and absolute for 8 hours.
- Public capability/status tokens are random, only their SHA-256 hashes are stored, and they are sent in the Authorization header rather than URLs.
- MySQL-backed write limits store only HMAC pseudonyms, never raw IP addresses.
- Orders store only the submitted first name, Roblox username, payment preference, optional city, item snapshots, reference, and status. Never store WhatsApp numbers, passwords, PINs, OTPs, bank details, or transfer codes.
- Admin/status responses are `no-store`; the public catalogue uses an ETag and a short cache.

InfinityFree does not provide application cron jobs, so retention needs a short monthly owner routine in phpMyAdmin: anonymize names, usernames, and cities on terminal orders once the agreed support window ends, and delete expired or removed community trades once they are no longer needed. Cascading foreign keys remove their item and response children. The `terminal_at` and `anonymized_at` columns make that review auditable; rate-limit pseudonyms already expire and are pruned opportunistically. Choose and document the actual retention windows before launch (90 days is a reasonable starting point, not legal advice), and never place personal information in a public status note.

## Verification

The read-only checks do not change database state:

```powershell
php database/tests/offline.php
php database/tests/schema_smoke.php
```

The first checks migration safety, seed parity, helper availability, and ID formats. The second verifies the already-installed schema, seed counts, foreign keys, and safe public catalogue state.

With local MySQL and `php -S 127.0.0.1:8012 -t .` running, the remaining regression tests are:

```powershell
php tests/orders-api-test.php
php tests/trading-api-test.php
php tests/admin-api-test.php
node tests/locale-coverage.js
```

Run the HTTP integration tests only on a local development database, never production. They create isolated test records and restore their exact changes; the admin test also refuses to replace an existing owner.
