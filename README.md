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
