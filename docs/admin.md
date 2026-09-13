# Admin / Backoffice

Phase 06 implements the administrative bounded context and its server-side integration.

## Security

- HttpOnly + Secure + SameSite=Strict admin session cookie.
- Sessions are stored in D1 as SHA-256 token hashes and expire after 8 days.
- Successful login revokes previous sessions for the user.
- Passwords use PBKDF2-HMAC-SHA-256 with a per-password random salt and 150,000 iterations. Plaintext passwords are never persisted.
- Five consecutive failed attempts temporarily lock an account for 15 minutes.
- RBAC is enforced in the server-side application boundary; UI visibility is not a security control.
- Admin actions are written to `admin_audit_log`.
- IMEI/serial values remain masked to last four characters in service records exposed to the admin API.

## Roles

`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES`, `SUPPORT`, `INVENTORY`, `FINANCE`, `CONTENT_EDITOR`, `TECHNICIAN`.

Permissions cover dashboard, products, orders, customers, services, refunds, inventory, configurable service types, admin users and audit visibility.

## Implemented endpoints

- `POST /api/admin/auth/login`
- `GET /api/admin/auth`
- `DELETE /api/admin/auth`
- `POST /api/admin/auth/bootstrap`
- `GET /api/admin/dashboard`
- `GET/POST/PATCH /api/admin/resources`
- `GET/POST /api/admin/service-types`
- `GET/POST/PATCH /api/admin/users`

## First administrator

Set `ADMIN_EMAIL` as a Cloudflare runtime variable and `ADMIN_PASSWORD` plus `ADMIN_BOOTSTRAP_TOKEN` as Worker secrets. Call the bootstrap endpoint once with the token in `X-Admin-Bootstrap-Token`, then rotate/remove the bootstrap secrets. The endpoint does not accept credentials from the request body. Never commit these values.

```sh
curl -X POST \
  "https://iphone.jnmtortas.com/api/admin/auth/bootstrap" \
  -H "X-Admin-Bootstrap-Token: TU_TOKEN"
```

The endpoint stores only the PBKDF2-SHA256 password hash in D1. After a successful bootstrap, sign in at `/admin/login` and remove or rotate the bootstrap secrets.

## Backoffice

`/admin/login` is the administrative login. `/admin` provides operational metrics and protected views for orders, products, customers and services.

## Production validation

The code and migration are committed, but the first real production login/bootstrap requires the D1 migration to be applied and the runtime secret to exist. GitHub Actions/Cloudflare execution is the final external validation step.
