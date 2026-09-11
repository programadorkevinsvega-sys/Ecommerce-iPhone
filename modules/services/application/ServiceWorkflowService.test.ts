import { describe, expect, it } from "vitest";
import { ServiceWorkflowService, parseServiceRequestStatus } from "./ServiceWorkflowService";
import { ServiceRequest } from "../domain/ServiceRequest";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";
import type { ServiceRequestRepository } from "./ServiceRequestRepository";

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
}) as unknown as ServiceRequestRepository;

const types = (allowedStatuses: string[] = ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"], quoteRequired = true) => ({
  findByCode: async () => ({ toPrimitives: () => ({ workflow: { allowedStatuses, quoteRequired } }) }),
  listEnabled: async () => [], listAll: async () => [], save: async () => undefined,
}) as unknown as ServiceTypeRepository;

describe("parseServiceRequestStatus", () => {
  it("accepts only known service states", () => expect(parseServiceRequestStatus("PROCESSING")).toBe("PROCESSING"));
  it("rejects arbitrary status input", () => expect(() => parseServiceRequestStatus("DROP_TABLE")).toThrow("Invalid service status"));
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

  it("requires a positive integer quote", async () => {
    const service = new ServiceWorkflowService(repos(), types());
    await expect(service.quote("svc-1", 0, "admin-1")).rejects.toThrow("Quote must be a positive integer");
    await expect(service.quote("svc-1", 10.5, "admin-1")).rejects.toThrow("Quote must be a positive integer");
  });

  it("requires completion to be enabled by the service policy", async () => {
    const service = new ServiceWorkflowService(repos(), types(["PENDING"]));
    await expect(service.complete("svc-1", "Fixed", "admin-1")).rejects.toThrow("Completion is not allowed by service policy");
  });

  it("rejects empty or oversized resolution notes", async () => {
    const service = new ServiceWorkflowService(repos(), types());
    await expect(service.complete("svc-1", "   ", "admin-1")).rejects.toThrow("Resolution notes are required");
    await expect(service.complete("svc-1", "x".repeat(4001), "admin-1")).rejects.toThrow("Resolution notes are too long");
  });

  it("normalizes technician assignment", async () => {
    const item = request();
    const service = new ServiceWorkflowService(repos(item), types());
    await service.assign("svc-1", "  tech-1  ", "admin-1");
    expect(item.toPrimitives().assignedTechnicianId).toBe("tech-1");
  });
});
