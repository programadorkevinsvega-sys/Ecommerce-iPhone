# Domain Modules

Each business capability is isolated as a module. A module owns its domain model and exposes application-level contracts instead of leaking infrastructure concerns.

Planned modules include auth, users, customers, catalog, inventory, cart, checkout, orders, payments, shipping, services, reviews, coupons, promotions, notifications, CMS, SEO, analytics and support.

Dependency rule:

`domain <- application <- infrastructure` within each module.

Cross-module communication should use explicit application contracts or domain events rather than importing another module's internals.
