# Architecture

## Style

Ecommerce iPhone is a modular monolith using Domain-Driven Design and Clean Architecture.

The default dependency direction is:

```text
Presentation -> Application -> Domain
                     |
                     v
               Infrastructure
```

Infrastructure implements ports defined by Application/Domain. Domain code never imports framework code, Cloudflare bindings, database clients, payment SDKs, email SDKs, or HTTP clients.

## Bounded contexts

Each directory under `modules/` represents a bounded context. A module owns its domain model, application use cases, infrastructure adapters, and presentation contracts.

Initial contexts:

- auth
- users
- customers
- catalog
- inventory
- cart
- checkout
- orders
- payments
- shipping
- unlock
- services
- reviews
- coupons
- promotions
- notifications
- email
- seo
- analytics
- cms
- support
- admin

## Cross-module communication

Modules communicate through public application contracts and domain events. A module must not import another module's internal domain entities, repositories, infrastructure adapters, or database implementation.

Events are designed so the in-process publisher can later be replaced by Cloudflare Queues without changing the domain model.

## Persistence

D1 is an infrastructure detail. SQL migrations live at the repository root and are versioned with the code. Domain aggregates are persisted through repository ports.

## Cloudflare

Workers hosts the application runtime. D1 provides relational persistence, R2 stores media, and Queues handle asynchronous work. DNS/CDN/SSL/WAF remain platform concerns outside the domain layer.

## Extraction path

A future microservice extraction should move a complete bounded context behind its existing application contract/event boundary. The goal is to replace the infrastructure adapter and transport boundary, not rewrite the domain.
