import type { AdminResourceRepository } from "./AdminResourceRepository";
import { DEFAULT_AUTHORIZATION_POLICY, type AdminRole, type AuthorizationPolicy, type Permission } from "./Rbac";
import { validateProductPatch } from "../../catalog/domain/Product";

export type AdminActor = { id: string; email: string; role: AdminRole };
export type ResourceName = "products" | "customers" | "services" | "orders";
export type AdminNotificationPublisher = (event: { eventType: string; aggregateId: string; payload: Record<string, unknown> }) => Promise<void>;
export type AdminResourcesDeps = { repository: AdminResourceRepository; publishNotification: AdminNotificationPublisher; authorizationPolicy?: AuthorizationPolicy };
const MAX_QUERY_LENGTH = 100;

function clean(value: unknown, max: number): string { return String(value ?? "").trim().slice(0, max); }
function bool(value: unknown): boolean { return value === true || value === 1 || value === "1"; }
function normalizeResource(value: unknown): ResourceName {
  const resource = clean(value, 30);
  if (resource === "products" || resource === "customers" || resource === "services" || resource === "orders") return resource;
  throw new Error("UNSUPPORTED_RESOURCE");
}
export function permissionFor(resource: ResourceName, write = false): Permission {
  if (resource === "customers") return "customers:read";
  if (resource === "services") return write ? "services:write" : "services:read";
  if (resource === "products") return write ? "products:write" : "products:read";
  return write ? "orders:write" : "orders:read";
}
function parseSpecs(value: unknown): string {
  if (value === undefined || value === null || value === "") return "{}";
  const parsed = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { throw new Error("INVALID_PRODUCT"); } })() : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_PRODUCT");
  try { validateProductPatch({ specs_json: parsed }); } catch { throw new Error("INVALID_PRODUCT"); }
  return JSON.stringify(parsed);
}

export class AdminResources {
  private readonly authorizationPolicy: AuthorizationPolicy;
  constructor(private readonly deps: AdminResourcesDeps) { this.authorizationPolicy = deps.authorizationPolicy ?? DEFAULT_AUTHORIZATION_POLICY; }

  async list(input: { actor: AdminActor; resource: unknown; query: unknown }): Promise<unknown[]> {
    const resource = normalizeResource(input.resource); this.authorize(input.actor, permissionFor(resource));
    return this.deps.repository.list(resource, clean(input.query, MAX_QUERY_LENGTH));
  }
  async create(input: { actor: AdminActor; resource: unknown; body: Record<string, unknown> }): Promise<{ id?: string }> {
    const resource = normalizeResource(input.resource); this.authorize(input.actor, permissionFor(resource, true));
    if (resource === "products") return this.createProduct(input.actor, input.body);
    if (resource === "services") return this.quoteService(input.actor, input.body);
    throw new Error("UNSUPPORTED_CREATE");
  }
  async update(input: { actor: AdminActor; resource: unknown; id: string; body: Record<string, unknown> }): Promise<void> {
    const resource = normalizeResource(input.resource); this.authorize(input.actor, permissionFor(resource, true));
    if (resource === "products") return this.updateProduct(input.actor, input.id, input.body);
    if (resource === "orders") return this.updateOrder(input.actor, input.id, input.body);
    if (resource === "services") return this.updateService(input.actor, input.id, input.body);
    throw new Error("UNSUPPORTED_UPDATE");
  }
  private authorize(actor: AdminActor, permission: Permission): void { if (!this.authorizationPolicy.can(actor.role, permission)) throw new Error("FORBIDDEN"); }

  private async createProduct(actor: AdminActor, body: Record<string, unknown>): Promise<{ id: string }> {
    const name = clean(body.name, 180), slug = clean(body.slug, 180), brand = clean(body.brand, 80), model = clean(body.model, 120), description = clean(body.description, 5000), condition = clean(body.condition, 20);
    const priceInCents = Number(body.price_in_cents), stock = Number(body.stock ?? 0);
    if (!name || !slug || !brand || !model || !description || !["NEW", "USED", "REFURBISHED"].includes(condition) || !Number.isInteger(priceInCents) || !Number.isInteger(stock)) throw new Error("INVALID_PRODUCT");
    const specsJson = parseSpecs(body.specs_json);
    try {
      validateProductPatch({ name, description, price_in_cents: priceInCents, stock, warranty_months: Number(body.warranty_months ?? 12), battery_health: body.battery_health ?? null, storage_gb: body.storage_gb ?? null, color: body.color ?? null, specs_json: specsJson });
      validateProductPatch({ seo_title: body.seo_title ?? null, seo_description: body.seo_description ?? null });
    } catch { throw new Error("INVALID_PRODUCT"); }
    const id = await this.deps.repository.createProduct({
      id: crypto.randomUUID(), name, slug, brand, model, description, condition, priceInCents, stock,
      warrantyMonths: Number(body.warranty_months ?? 12), batteryHealth: body.battery_health == null ? null : Number(body.battery_health),
      storageGb: body.storage_gb == null ? null : Number(body.storage_gb), color: body.color ? clean(body.color, 80) : null, specsJson,
    });
    await this.deps.repository.audit(actor.id, "ADMIN_PRODUCT_CREATED", "product", id, { name, slug });
    return { id };
  }

  private async quoteService(actor: AdminActor, body: Record<string, unknown>): Promise<{}> {
    const id = clean(body.id, 100), amountInCents = Number(body.quote_in_cents);
    if (!id || !Number.isInteger(amountInCents) || amountInCents < 0) throw new Error("INVALID_SERVICE_QUOTE");
    const current = await this.deps.repository.getServiceForMutation(id); if (!current) throw new Error("SERVICE_NOT_FOUND");
    await this.deps.repository.quoteService(id, amountInCents, actor.id);
    await this.deps.publishNotification({ eventType: "ServiceStatusChanged", aggregateId: id, payload: { email: current.email, serviceRequestId: id, status: "QUOTED", quoteInCents: amountInCents } });
    return {};
  }

  private async updateProduct(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<void> {
    const allowed = new Set(["name", "description", "price_in_cents", "stock", "active", "seo_title", "seo_description", "warranty_months", "battery_health", "storage_gb", "color", "specs_json"]);
    const fields = Object.keys(body).filter((key) => allowed.has(key)); if (!fields.length) throw new Error("NO_EDITABLE_FIELDS");
    const validation: Record<string, unknown> = Object.fromEntries(fields.map((key) => [key, key === "active" ? bool(body[key]) : body[key]]));
    try { validateProductPatch(validation); } catch { throw new Error("INVALID_PRODUCT"); }
    const values = fields.map((key) => key === "active" ? (bool(body[key]) ? 1 : 0) : key === "specs_json" ? parseSpecs(body[key]) : body[key]);
    await this.deps.repository.updateProduct(id, fields, values);
    await this.deps.repository.audit(actor.id, "ADMIN_RESOURCE_UPDATED", "products", id, body);
  }

  private async updateOrder(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<void> {
    const status = clean(body.status, 30); const allowed = ["PENDING_PAYMENT", "PAYMENT_PROCESSING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED", "REFUND_PENDING", "REFUNDED"];
    if (!allowed.includes(status)) throw new Error("INVALID_ORDER_STATUS");
    const current = await this.deps.repository.getOrderForMutation(id); if (!current) throw new Error("ORDER_NOT_FOUND");
    await this.deps.repository.updateOrderStatus(id, status, actor.id, current.status);
    if (current.status !== status) await this.deps.publishNotification({ eventType: status === "PAID" ? "OrderPaid" : "OrderStatusChanged", aggregateId: id, payload: { email: current.email, orderId: id, orderNumber: current.orderNumber, status } });
  }

  private async updateService(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<void> {
    const status = clean(body.status, 30); const allowed = ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"];
    if (!allowed.includes(status)) throw new Error("INVALID_SERVICE_STATUS");
    const current = await this.deps.repository.getServiceForMutation(id); if (!current) throw new Error("SERVICE_NOT_FOUND");
    await this.deps.repository.updateServiceStatus(id, status, actor.id, current.status);
    if (current.status !== status) await this.deps.publishNotification({ eventType: "ServiceStatusChanged", aggregateId: id, payload: { email: current.email, serviceRequestId: id, status } });
  }
}
