import { describe, expect, it } from "vitest";
import { ServiceCustomerPortal } from "./ServiceCustomerPortal";
import { ServiceRequest } from "../domain/ServiceRequest";

const makeRequest = () => ServiceRequest.create("svc-1", {
  customerId: "customer-1", email: "customer@example.com", type: "REPAIR", deviceBrand: "Apple",
  deviceModel: "iPhone", problemDescription: "Broken screen", currency: "COP",
});

const portal = () => {
  const request = makeRequest();
  const requests = { findById: async () => request, save: async () => undefined, listForCustomer: async () => [request], listQueue: async () => [request], audit: async () => undefined };
  return new ServiceCustomerPortal(requests as never, { findByCode: async () => null, listEnabled: async () => [], listAll: async () => [], save: async () => undefined } as never, { create: () => request } as never);
};

describe("ServiceCustomerPortal", () => {
  it("does not disclose a service request to another customer", async () => {
    await expect(portal().getOwned("svc-1", "customer-2")).rejects.toThrow("Service request not found");
  });

  it("returns a service request to its owner", async () => {
    await expect(portal().getOwned("svc-1", "customer-1")).resolves.toMatchObject({ id: "svc-1", customerId: "customer-1" });
  });
});
