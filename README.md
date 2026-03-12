# TimeTiles

Time planner based on a 12x12 grid - each square equals 10 minutes of your day.

## Auth + profile sync

Added basic email/password auth (without email verification) and background synchronization of planner state for authorized users.

### Backend requirements

- PHP 5.6+
- MySQL 5.6+

### Backend setup

1. Deploy `api/*.php` together with static files.
2. Update DB password in `api/config.php`.
3. Open app and register/login in the left panel (`Профиль`).

When the user is authenticated:
- all planner data is stored in the user profile in DB,
- local changes are synchronized in background.

## Troubleshooting auth/sync problems

### 1) Ensure schema exists

By default API attempts to create tables automatically on first request.
If DB user doesn't have `CREATE TABLE` permissions, use browser installer page:

- open `https://<your-domain>/api/install_schema.php`
- the page runs `api/schema.sql` and shows all SQL errors per statement
- after successful import remove `api/install_schema.php` from server for safety

(Alternative CLI method, if available):

```bash
mysql -u <user> -p <database> < api/schema.sql
```

### 2) Enable detailed API errors temporarily

Set in `api/config.php`:

```php
'debug' => true,
```

Then repeat login/register and inspect Network response for `api/auth.php` and `api/sync.php`.
In debug mode API returns extra details in `debug` field (SQL/DB error code).

After debugging, switch it back to `false`.

### 3) Quick server-side checks

- Verify DB credentials in `api/config.php`.
- Verify PHP has sessions enabled and writable session storage.
- Verify responses from `api/auth.php?action=me` include `authenticated: true` after login.
- Verify browser sends cookies to API (same domain/origin, no blocked third-party cookies).
