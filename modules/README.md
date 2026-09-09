# Domain Modules

Each business capability is isolated as a bounded context inside the modular monolith. A module owns its domain model and exposes application-level contracts instead of leaking infrastructure concerns.

## Bounded contexts

`auth`, `users`, `customers`, `catalog`, `inventory`, `cart`, `checkout`, `orders`, `payments`, `shipping`, `unlock`, `services`, `reviews`, `coupons`, `promotions`, `notifications`, `email`, `seo`, `analytics`, `cms`, `support`, and `admin`.

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
