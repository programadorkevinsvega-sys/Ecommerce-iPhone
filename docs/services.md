# FASE 05 — Services

The services bounded context handles legitimate device support: carrier unlock requests, diagnostics, repairs and configuration.

## Supported services

- `CARRIER_UNLOCK`: carrier/operator unlocks only when legitimately authorized.
- `DIAGNOSTIC`: technical diagnosis.
- `REPAIR`: repair intake and quotation.
- `CONFIGURATION`: setup, migration and configuration.

Activation Lock bypass, account bypass, credential collection and manufacturer-security evasion are explicitly out of scope.

## Workflow

`PENDING → QUOTED → PAYMENT_PENDING → PAID → PROCESSING → WAITING_CUSTOMER → COMPLETED`

Rejection/refund paths are modeled explicitly. Every mutation writes an audit event.

## Privacy

IMEI and serial numbers are never returned in full. The request API stores only the final four characters and records whether an identifier was supplied. Do not put IMEI/serial values in URLs, logs, analytics or public content.

## Customer API

- `GET /api/services` — service catalog and current customer's requests.
- `POST /api/services` — create a request.
- `GET /api/services/:id` — retrieve a request only for its owning customer session.

## Application boundary

`ServiceManagement` exposes quote, assignment, status transition and completion operations through an application repository port. Administrative authorization belongs to the admin bounded context in FASE 06; these operations must not be exposed publicly.

## Payment boundary

A service request can carry a provider-agnostic `paymentId`. Payment orchestration remains behind the payments bounded context; no service code imports a provider SDK. Refund handling is represented in the service state machine and should be invoked only by authorized application workflows.
