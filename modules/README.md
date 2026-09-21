# Domain Modules

## Boundary técnico — 2026-09-21

El bounded context technicians mantiene su estructura DDD/Clean Architecture y evita importar adapters de infraestructura de otros bounded contexts desde su composición interna. La composición transversal requerida por la aplicación se realiza desde el composition root de apps/web.

Las rutas técnicas no ejecutan SQL, no acceden directamente a R2 y no importan runtime adapters; delegan en Application y sus ports.

Each business capability is isolated as a bounded context inside the modular monolith. A module owns its domain model and exposes application-level contracts instead of leaking infrastructure concerns.

## Bounded contexts

`auth`, `users`, `customers`, `catalog`, `inventory`, `cart`, `checkout`, `orders`, `payments`, `shipping`, `unlock`, `services`, `reviews`, `coupons`, `promotions`, `notifications`, `email`, `seo`, `analytics`, `cms`, `support`, `admin`, and `technicians`.

## Internal structure

Business modules follow this convention:

```text
module/
  domain/
  application/
  infrastructure/
  presentation/
  index.ts
```

The first implemented vertical slice is `catalog`, which demonstrates the pattern with a `Product` aggregate, `ProductId` value object, repository port, application use case and in-memory adapter.

## Dependency rules

```text
presentation -> application -> domain
                         \-> ports
infrastructure -----------^ (implements ports)
```

- Domain has no framework or infrastructure dependencies.
- Application orchestrates use cases and depends on ports, never concrete adapters.
- Infrastructure implements application/domain ports.
- Presentation translates transport concerns into application commands/queries.
- Cross-module code may use only the owning module's public `index.ts` contract.
- Direct imports into another module's `domain`, `application`, `infrastructure` or `presentation` internals are forbidden.

The repository contains an automated architecture check in `scripts/check-architecture.mjs` and CI executes it before build/test stages.


## technicians

Operational technician identities and their assigned-work capabilities. This is separate from the Admin RBAC context.

- Domain: `TechnicianUser`
- Authentication/session: `technician_session`
- Persistence: D1
- Repair evidence: R2 through protected application routes
- UI: `apps/web/app/technician/**`
