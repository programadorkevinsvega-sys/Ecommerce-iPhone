import { describe, expect, it } from "vitest";
import { ServiceWorkflowService } from "./ServiceWorkflowService";
import { ServiceRequest } from "../domain/ServiceRequest";

const request = () => ServiceRequest.create("svc-1", {
  customerId: "cust-1", email: "customer@example.com", type: "REPAIR", deviceBrand: "Apple",
  deviceModel: "iPhone", problemDescription: "Broken screen", currency: "COP",
});

const repos = (item = request()) => ({
  findById: async () => item,
  save: async () => undefined,
  listForCustomer: async () => [item],
  listQueue: async () => [item],
  audit: async () => undefined,
});

const types = (allowedStatuses: string[] = ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"], quoteRequired = true) => ({
  findByCode: async () => ({ toPrimitives: () => ({ workflow: { allowedStatuses, quoteRequired } }) }),
  listEnabled: async () => [], listAll: async () => [], save: async () => undefined,
});

describe("ServiceWorkflowService", () => {
  it("rejects a status outside the configured service policy", async () => {
    const service = new ServiceWorkflowService(repos(), types(["PENDING"]));
    await expect(service.transition("svc-1", "COMPLETED", "admin-1")).rejects.toThrow("Status is not allowed by service policy");
  });

  it("requires a configured quote policy before quoting", async () => {
    const service = new ServiceWorkflowService(repos(), types(undefined, false));
    await expect(service.quote("svc-1", 10000, "admin-1")).rejects.toThrow("does not require a quote");
  });

  it("requires completion to be enabled by the service policy", async () => {
    const service = new ServiceWorkflowService(repos(), types(["PENDING"]));
    await expect(service.complete("svc-1", "Fixed", "admin-1")).rejects.toThrow("Completion is not allowed by service policy");
  });
});
