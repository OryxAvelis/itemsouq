# Itemsouq

Itemsouq is a Moroccan Blox Fruits marketplace interface for browsing fruit offers, comparing trades, preparing WhatsApp orders, and managing catalogue availability from a private owner dashboard.

## Live website

- Website: [itemsouq.infinityfree.me](https://itemsouq.infinityfree.me/)
- Hosting: InfinityFree shared hosting
- Backend: PHP 8 and MySQL
- Production status: [InfinityFree Status](https://status.infinityfree.com/)

The public storefront is progressively enhanced: its bundled catalogue keeps the main browsing experience available when the hosting provider or database is temporarily unreachable. Database-backed catalogue updates, orders, trades, and the owner dashboard require the PHP API to be online.

## Features

- Responsive French and Moroccan Darija storefront
- Physical and permanent fruit catalogue
- Search, rarity/type filters, favourites, comparison, and cart UI
- Trade calculator and community trade submissions
- Duplicate fruit quantities in trade offers
- WhatsApp-assisted ordering with Cash Plus and Wafacash preferences
- Private owner dashboard for prices, availability, quantities, and order status
- MySQL-backed catalogue, trade, order, history, session, and rate-limit data

## Project structure

```text
admin/          Private owner interface
api/v1/         Public and owner PHP API endpoints
api/_private/   Shared backend services and private runtime configuration
assets/         Styles, scripts, branding, and fruit images
database/       Idempotent MySQL migrations, installer, and schema checks
tests/          Local API and localization regression tests
```

## InfinityFree deployment

1. Upload the runtime files to the hosting account's `htdocs` directory.
2. Create a MySQL database in the InfinityFree client area.
3. Import `database/itemsouq-infinityfree.sql` with phpMyAdmin.
4. Copy `api/_private/config.example.php` to `api/_private/config.local.php` locally.
5. Fill it with the exact MySQL hostname, database name, username, and password shown by InfinityFree. The database host is not `localhost`.
6. Generate separate random `app_secret` and `setup_token` values and set `origin` to the canonical HTTPS website URL.
7. Upload only that configuration file to `htdocs/api/_private/config.local.php`.
8. Open `/admin/` and create the single owner account.

Never commit `config.local.php`, database passwords, setup tokens, session files, logs, backups, or deployment ZIP files. They are excluded by `.gitignore`, and `api/_private/.htaccess` denies direct web access on Apache-compatible hosting.

InfinityFree may redirect valid pages to its own 404 screen during a server or website-IP incident. If the files exist in `htdocs` but `/admin/` and `/api/` unexpectedly return the provider's 404 page, check the [official status page](https://status.infinityfree.com/) before re-uploading or changing database credentials.

For the full schema, API, privacy, retention, and local verification notes, see [database/README.md](database/README.md).

## Local development

Use XAMPP MySQL and PHP, import the database migrations, then serve the project root:

```powershell
php -S 127.0.0.1:8012 -t .
```

Open `http://127.0.0.1:8012/` for the storefront and `http://127.0.0.1:8012/admin/` for the owner dashboard.

## Disclaimer

Itemsouq is an independent project and is not affiliated with Roblox or Blox Fruits. Never share a Roblox password, PIN, one-time code, or sensitive banking information through the website.
