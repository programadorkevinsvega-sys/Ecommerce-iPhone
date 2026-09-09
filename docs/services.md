# FASE 05 — Services

The services bounded context is a configurable service-management platform for device support, with DDD/Clean Architecture boundaries and a D1-backed catalog.

## Configurable service catalog

Service types are data, not hardcoded application branches. Each type contains:

- `code`, `slug`, `name`, `description`
- category: `DEVICE`, `NETWORK`, `SOFTWARE`, `REPAIR`, `OTHER`
- workflow policy: quote/payment requirements, technician/admin approval, ownership-proof requirement and allowed statuses
- enabled flag
- metadata for business-specific extensions
- display ordering

Default types are seeded by `migrations/0005_service_types.sql`. Future admin tooling can create or modify additional types without changing the domain model. Examples include battery replacement, screen repair, data migration or other business-defined services.

## Workflow

The request state machine models:

`PENDING → QUOTED → PAYMENT_PENDING → PAID → PROCESSING → WAITING_CUSTOMER → COMPLETED`

Rejection/refund paths are modeled explicitly. Service-type policies additionally determine whether quotation, payment and approval steps are required.

## Privacy

IMEI and serial numbers are never returned in full. The current intake persists only the final four characters and records whether an identifier was supplied. Do not put full IMEI/serial values in URLs, logs, analytics or public content. Access to sensitive device information should remain auditable.

## Customer API

- `GET /api/services` — enabled service catalog and current customer's requests.
- `POST /api/services` — create a request after validating the configured service policy.
- `GET /api/services/:id` — retrieve a request only for its owning customer session.

## Application boundary

Application ports include `ServiceTypeRepository` and `ServiceRequestRepository`. `ServiceWorkflowService` provides policy-aware transition, quote and assignment operations without importing infrastructure or provider SDKs. Administrative authorization belongs to the admin bounded context in FASE 06; these operations must not be exposed publicly until RBAC is in place.

## Payment boundary

A service request can carry a provider-agnostic `paymentId`. Payment orchestration remains behind the payments bounded context; no service code imports a provider SDK. Refund handling is represented in the service state machine and should be invoked only by authorized application workflows.

## Security boundary

The catalog is intentionally configurable so each buyer/business can define its own operational policies and service offerings. Configurability does not grant unauthorized access, credential collection, or security-bypass capabilities; those remain outside the implementation boundary.
