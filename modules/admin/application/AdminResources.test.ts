import { describe, expect, it, vi } from "vitest";
import { AdminResources } from "./AdminResources";
import type { AdminResourceRepository } from "./AdminResourceRepository";
import { PERMISSIONS, ROLE_PERMISSIONS } from "./Rbac";

function repository(): AdminResourceRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn().mockResolvedValue("product-1"),
    updateProduct: vi.fn().mockResolvedValue(undefined),
    getServiceForMutation: vi.fn().mockResolvedValue({ status: "PENDING", email: "customer@example.com" }),
    quoteService: vi.fn().mockResolvedValue(undefined),
    updateServiceStatus: vi.fn().mockResolvedValue(undefined),
    getOrderForMutation: vi.fn().mockResolvedValue({ status: "PENDING_PAYMENT", email: "customer@example.com", orderNumber: "ORD-1" }),
    updateOrderStatus: vi.fn().mockResolvedValue(undefined),
  };
}

function audit() {
  return { audit: vi.fn().mockResolvedValue(undefined) };
}

function actor(permissions = ROLE_PERMISSIONS.ADMIN) {
  return { id: "admin-1", email: "admin@example.com", role: "ADMIN" as const, permissions };
}

describe("AdminResources", () => {
  it("lists only supported resources", async () => {
    const repo = repository();
    const service = new AdminResources({ repository: repo, audit: audit(), publishNotification: vi.fn().mockResolvedValue(undefined) });
    await expect(service.list({ actor: actor(), resource: "orders", query: "ORD" })).resolves.toEqual([]);
    await expect(service.list({ actor: actor(), resource: "unknown", query: "" })).rejects.toThrow("UNSUPPORTED_RESOURCE");
  });

  it("creates a validated product through the repository port", async () => {
    const repo = repository();
    const auditPort = audit();
    const service = new AdminResources({ repository: repo, audit: auditPort, publishNotification: vi.fn().mockResolvedValue(undefined) });
    const result = await service.create({
      actor: actor(),
      resource: "products",
      body: {
        name: "iPhone",
        slug: "iphone",
        brand: "Apple",
        model: "iPhone 16",
        description: "Device",
        condition: "NEW",
        price_in_cents: 1000000,
        stock: 2,
      },
    });
    expect(result).toEqual({ id: "product-1" });
    expect(repo.createProduct).toHaveBeenCalledOnce();
    expect(auditPort.audit).toHaveBeenCalledOnce();
  });

  it("honors an explicit permission grant outside the base role", async () => {
    const repo = repository();
    const service = new AdminResources({ repository: repo, audit: audit(), publishNotification: vi.fn().mockResolvedValue(undefined) });
    const granted = [...ROLE_PERMISSIONS.SALES, PERMISSIONS.inventoryRead];
    await expect(service.list({
      actor: { id: "sales-1", email: "sales@example.com", role: "SALES", permissions: granted },
      resource: "products",
      query: "",
    })).resolves.toEqual([]);
  });

  it("honors an explicit permission deny even when the base role grants it", async () => {
    const repo = repository();
    const service = new AdminResources({ repository: repo, audit: audit(), publishNotification: vi.fn().mockResolvedValue(undefined) });
    const denied = ROLE_PERMISSIONS.ADMIN.filter((permission) => permission !== PERMISSIONS.ordersRead);
    await expect(service.list({
      actor: { id: "admin-1", email: "admin@example.com", role: "ADMIN", permissions: denied },
      resource: "orders",
      query: "",
    })).rejects.toThrow("FORBIDDEN");
  });

  it("rejects a role with neither base nor effective grant", async () => {
    const repo = repository();
    const service = new AdminResources({ repository: repo, audit: audit(), publishNotification: vi.fn().mockResolvedValue(undefined) });
    await expect(service.create({
      actor: { id: "sales-1", email: "sales@example.com", role: "SALES", permissions: ROLE_PERMISSIONS.SALES },
      resource: "products",
      body: {},
    })).rejects.toThrow("FORBIDDEN");
  });

  it("publishes a notification after an order status change", async () => {
    const repo = repository();
    const auditPort = audit();
    const publishNotification = vi.fn().mockResolvedValue(undefined);
    const service = new AdminResources({ repository: repo, audit: auditPort, publishNotification });
    await service.update({
      actor: actor(),
      resource: "orders",
      id: "order-1",
      body: { status: "PAID" },
    });
    expect(repo.updateOrderStatus).toHaveBeenCalledWith("order-1", "PAID", "admin-1", "PENDING_PAYMENT");
    expect(auditPort.audit).toHaveBeenCalledOnce();
    expect(publishNotification).toHaveBeenCalledWith(expect.objectContaining({ eventType: "OrderPaid", aggregateId: "order-1" }));
  });
});
