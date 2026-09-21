import { describe, expect, it, vi } from "vitest";
import { RepairOrder } from "../domain/RepairOrder";
import type { RepairOrderRepository } from "./RepairOrderRepository";
import { RepairOrderManagement } from "./RepairOrderManagement";

function makeOrder(assignedTechnicianId = "tech-1") {
  return RepairOrder.create({
    id: "order-1",
    orderNumber: "REP-2026-ABC12345",
    customerId: "customer-1",
    email: "customer@example.com",
    status: "DIAGNOSING",
    problemReported: "No enciende.",
    assignedTechnicianId,
    receivedAt: "2026-09-20T00:00:00.000Z",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    device: {
      id: "device-1",
      brand: "Apple",
      model: "iPhone 15 Pro",
      conditions: [],
    },
  });
}

function setup() {
  const order = makeOrder();
  const repository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(order),
    findByServiceRequestId: vi.fn(),
    findByPublicToken: vi.fn(),
    list: vi.fn().mockResolvedValue([order]),
  } as unknown as RepairOrderRepository;

  return { order, repository, manager: new RepairOrderManagement(repository) };
}

describe("RepairOrderManagement technician assignment", () => {
  it("lists only assignments selected by the repository", async () => {
    const context = setup();

    await expect(context.manager.listAssigned("tech-1")).resolves.toEqual([context.order]);
    expect(context.repository.list).toHaveBeenCalledWith({ technicianId: "tech-1", limit: 100 });
  });

  it("rejects access to another technician's order", async () => {
    const context = setup();

    await expect(context.manager.getAssigned("order-1", "tech-2")).rejects.toThrow("FORBIDDEN");
    expect(context.repository.save).not.toHaveBeenCalled();
  });

  it("persists technical updates under the authenticated technician actor", async () => {
    const context = setup();

    await context.manager.updateTechnicalRecordAssigned(
      "order-1",
      { diagnosisSummary: "Pantalla dañada.", workSummary: "Revisión inicial.", conditions: [] },
      "tech-1",
    );

    expect(context.repository.save).toHaveBeenCalledWith(context.order, "tech-1");
  });
  it("omits undefined optional technical fields under exactOptionalPropertyTypes", async () => {
    const context = setup();

    await context.manager.updateTechnicalRecordAssigned(
      "order-1",
      { diagnosisSummary: undefined, workSummary: undefined, conditions: [] },
      "tech-1",
    );

    expect(context.order.toPrimitives().diagnosisSummary).toBeUndefined();
    expect(context.order.toPrimitives().workSummary).toBeUndefined();
  });

});
