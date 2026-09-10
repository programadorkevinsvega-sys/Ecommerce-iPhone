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
    audit: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AdminResources", () => {
  it("lists only supported resources", async () => {
    const repo = repository();
    const service = new AdminResources({ repository: repo, publishNotification: vi.fn().mockResolvedValue(undefined) });
    await expect(service.list({ resource: "orders", query: "ORD" })).resolves.toEqual([]);
    await expect(service.list({ resource: "unknown", query: "" })).rejects.toThrow("UNSUPPORTED_RESOURCE");
  });

  it("creates a validated product through the repository port", async () => {
    const repo = repository();
    const service = new AdminResources({ repository: repo, publishNotification: vi.fn().mockResolvedValue(undefined) });
    const result = await service.create({
      actor: { id: "admin-1", email: "admin@example.com", role: "ADMIN" },
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
    expect(repo.audit).toHaveBeenCalledOnce();
  });

  it("publishes a notification after an order status change", async () => {
    const repo = repository();
    const publishNotification = vi.fn().mockResolvedValue(undefined);
    const service = new AdminResources({ repository: repo, publishNotification });
    await service.update({
      actor: { id: "admin-1", email: "admin@example.com", role: "ADMIN" },
      resource: "orders",
      id: "order-1",
      body: { resource: "orders", status: "PAID" },
    });
    expect(repo.updateOrderStatus).toHaveBeenCalledWith("order-1", "PAID", "admin-1", "PENDING_PAYMENT");
    expect(publishNotification).toHaveBeenCalledWith(expect.objectContaining({ eventType: "OrderPaid", aggregateId: "order-1" }));
  });
});
