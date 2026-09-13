import { describe, expect, it, vi } from "vitest";
import { AdminResources } from "./AdminResources";
import type { AdminResourceRepository } from "./AdminResourceRepository";

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

function actor() {
  return { id: "admin-1", email: "admin@example.com", role: "ADMIN" as const };
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
