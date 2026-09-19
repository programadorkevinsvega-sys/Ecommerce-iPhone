import { describe, expect, it } from "vitest";
import { CustomerDevice } from "./CustomerDevice";

const base = {
  customerId: "customer-1",
  deviceType: "PHONE",
  brand: "Apple",
  model: "iPhone 15 Pro",
  serialLast4: "A1B2",
  imeiLast4: "1234",
  color: "Titanio natural",
  capacity: "256 GB",
  physicalCondition: "Marco con rayones",
  notes: "Equipo recibido apagado.",
};

describe("CustomerDevice", () => {
  it("normalizes a valid device without storing full identifiers", () => {
    const device = CustomerDevice.create("device-1", base);
    expect(device.toPrimitives()).toEqual({ id: "device-1", ...base });
  });

  it("rejects unsupported device types", () => {
    expect(() => CustomerDevice.create("device-1", { ...base, deviceType: "SERVER" })).toThrow();
  });

  it("rejects protected identifiers that are not exactly four alphanumeric characters", () => {
    expect(() => CustomerDevice.create("device-1", { ...base, serialLast4: "12345" })).toThrow();
    expect(() => CustomerDevice.create("device-1", { ...base, imeiLast4: "12" })).toThrow();
  });
});
