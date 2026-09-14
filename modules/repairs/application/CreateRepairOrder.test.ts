import { describe, expect, it, vi } from "vitest";
import { CreateRepairOrder } from "./CreateRepairOrder";

const request = (type = "REPAIR") => ({ toPrimitives: () => ({ id: "s1", email: "client@example.com", type, deviceBrand: "Apple", deviceModel: "iPhone 15 Pro", problemDescription: "Pantalla rota", customerId: "c1", deviceSerialLast4: "1234", imeiLast4: "5678", status: "PENDING", currency: "COP", createdAt: "2026-09-13", updatedAt: "2026-09-13" }) });

describe("CreateRepairOrder", () => {
  it("converts a repair request once", async () => {
    const requests = { findById: vi.fn().mockResolvedValue(request()) };
    const orders = { findByServiceRequestId: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) };
    const result = await new CreateRepairOrder(requests as never, orders as never).execute("s1", "admin-1");
    expect(result.toPrimitives().orderNumber).toMatch(/^REP-2026-[A-Z0-9]{12}$/);
    expect(orders.save).toHaveBeenCalledOnce();
  });
  it("rejects a second order for the same request", async () => {
    const orders = { findByServiceRequestId: vi.fn().mockResolvedValue({}), save: vi.fn() };
    await expect(new CreateRepairOrder({} as never, orders as never).execute("s1", "admin-1")).rejects.toThrow("REPAIR_ORDER_ALREADY_EXISTS");
  });
  it("does not convert non-repair services", async () => {
    const requests = { findById: vi.fn().mockResolvedValue(request("DIAGNOSTIC")) };
    const orders = { findByServiceRequestId: vi.fn().mockResolvedValue(null), save: vi.fn() };
    await expect(new CreateRepairOrder(requests as never, orders as never).execute("s1", "admin-1")).rejects.toThrow("SERVICE_REQUEST_NOT_REPAIR");
  });
});
