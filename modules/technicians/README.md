# Technicians bounded context

## Responsibility

The `technicians` bounded context manages operational technician identities and their authenticated work against assigned repair orders.

A technician is **not** an `admin_users` RBAC role.

## Domain

- `TechnicianUser`

## Application

- `TechnicianAuthService`
- `TechnicianManagement`
- `TechnicianDeviceService`
- technician password hashing
- technician token hashing
- technician repositories and session repositories

## Infrastructure

- `D1TechnicianRepository`
- `D1TechnicianSessionRepository`
- `D1TechnicianPasswordHasher`
- `D1TechnicianTokenHasher`
- `D1TechnicianComposition`

## Persistence

- `technician_users`
- `technician_sessions`
- `technician_audit_events`

Migration:

- `0030_technician_accounts.sql`

## Authentication

- Public registration: no.
- Account creation: Admin only.
- Cookie: `technician_session`.
- Session lifetime: 12 hours.
- Successful login revokes previous sessions.
- Failed login threshold: 5.
- Lockout: 15 minutes.
- Login/logout events are audited.

Unknown-account authentication still executes a password-verification path to reduce account-enumeration timing differences.

## Operational authorization

The authenticated technician may only:

- read assigned orders;
- update diagnosis and technical work records of assigned orders;
- change allowed technical statuses;
- register/update the customer device linked to an assigned order;
- upload repair evidence for assigned orders;
- update their own profile.

Technicians cannot use this identity to access administrative operations.

## Web

- `/technician/login`
- `/technician`
- `/technician/orders`
- `/technician/devices`
- `/technician/profile`

## API

- `/api/technician/auth/login`
- `/api/technician/auth/logout`
- `/api/technician/auth/session`
- `/api/technician/orders`
- `/api/technician/orders/[id]/media`
- `/api/technician/devices`
- `/api/technician/profile`

## Tests

Current tests include:

- `TechnicianUser.test.ts`
- `TechnicianAuthService.test.ts`
- `TechnicianDeviceService.test.ts`

The context is implemented but requires a successful build/deploy/verify cycle, visual consistency hardening of `/technician/**`, and final production certification. The invalid source encoding issue previously found in `TechnicianUser.ts` has been corrected.
