# Domain package

Shared domain-level contracts that are truly cross-context belong here only when they do not encode a specific business capability.

Prefer `modules/shared-kernel` for primitives such as entities, value objects, aggregates, domain events, and results.

No framework, database, Cloudflare, HTTP, or provider SDK dependencies are allowed.
