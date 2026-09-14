import { describe, expect, it } from "vitest";
import { RepairOrder, assertRepairOrderTransition } from "./RepairOrder";

const order = () => RepairOrder.create({ id: "r1", orderNumber: "REP-2026-ABCDEF12", email: "client@example.com", status: "RECEIVED", problemReported: "Pantalla rota", receivedAt: "2026-09-13T00:00:00.000Z", createdAt: "2026-09-13T00:00:00.000Z", updatedAt: "2026-09-13T00:00:00.000Z", device: { id: "d1", brand: "Apple", model: "iPhone 15 Pro", conditions: [] } });

describe("RepairOrder", () => {
  it("allows the initial diagnosis transition", () => { const value = order(); value.transitionTo("DIAGNOSING"); expect(value.toPrimitives().status).toBe("DIAGNOSING"); });
  it("rejects skipping from received to ready", () => { expect(() => assertRepairOrderTransition("RECEIVED", "READY")).toThrow("INVALID_REPAIR_TRANSITION"); });
  it("records delivery time only when delivered", () => { const value = order(); value.transitionTo("DIAGNOSING"); expect(value.toPrimitives().deliveredAt).toBeUndefined(); });
  it("validates protected order numbers", () => { expect(() => RepairOrder.create({ ...order().toPrimitives(), orderNumber: "REP-2026-1" })).toThrow("INVALID_REPAIR_ORDER_NUMBER"); });
  it("updates the technical record without losing the device identity", () => { const value = order(); value.updateTechnicalRecord({ diagnosisSummary: "Pantalla dañada", workSummary: "Cambio de display", conditions: [{ component: "Pantalla", condition: "DAMAGED", notes: "Cristal roto" }] }); expect(value.toPrimitives().diagnosisSummary).toBe("Pantalla dañada"); expect(value.toPrimitives().device.conditions[0]?.condition).toBe("DAMAGED"); expect(value.toPrimitives().device.model).toBe("iPhone 15 Pro"); });
});
