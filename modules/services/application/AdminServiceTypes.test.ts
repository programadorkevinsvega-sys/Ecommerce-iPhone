import { describe, expect, it, vi } from "vitest";
import { AdminServiceTypes } from "./AdminServiceTypes";
import { ServiceTypeDefinition } from "../domain/ServiceTypeDefinition";
import type { ServiceTypeRepository } from "./ServiceTypeRepository";

function repository(initial?: ReturnType<ServiceTypeDefinition["toPrimitives"]>): ServiceTypeRepository {
  let current = initial ? ServiceTypeDefinition.create(initial) : null;
  return {
    findByCode: vi.fn(async (code: string) => current?.toPrimitives().code === code ? current : null),
    listEnabled: vi.fn(async () => current?.toPrimitives().enabled ? [current] : []),
    listAll: vi.fn(async () => current ? [current] : []),
    save: vi.fn(async (value: ServiceTypeDefinition) => { current = value; }),
    disable: vi.fn(async (code: string) => { if (!current || current.toPrimitives().code !== code || !current.toPrimitives().enabled) return false; current = ServiceTypeDefinition.create({ ...current.toPrimitives(), enabled: false }); return true; }),
  };
}

function validInput() {
  return {
    code: "SCREEN_REPAIR",
    slug: "cambio-pantalla",
    name: "Cambio de pantalla",
    description: "Reemplazo profesional de pantalla.",
    category: "REPAIR",
    priceFromInCents: 15000000,
    fixedPriceInCents: 25000000,
    estimatedMinutes: 120,
    warrantyDays: 180,
    requiresDiagnosis: true,
    requiresApproval: true,
    compatibility: [{ brand: "Apple", model: "iPhone 15 Pro" }],
    requirements: [{ description: "Respaldar datos antes de la recepción.", required: true }],
    workflow: { quoteRequired: true, paymentRequired: true, technicianApprovalRequired: true, adminApprovalRequired: false, customerOwnershipProofRequired: true, allowedStatuses: ["PENDING", "QUOTED", "PAID", "PROCESSING", "COMPLETED"] },
  };
}

describe("AdminServiceTypes", () => {
  it("creates a fully configured service type", async () => {
    const repositoryMock = repository();
    const audit = { audit: vi.fn().mockResolvedValue(undefined) };
    const service = new AdminServiceTypes(repositoryMock, audit);
    const result = await service.create(validInput(), "admin-1");
    expect(result.code).toBe("SCREEN_REPAIR");
    expect(result.compatibility).toEqual([{ brand: "Apple", model: "iPhone 15 Pro" }]);
    expect(result.requirements).toEqual([{ description: "Respaldar datos antes de la recepción.", required: true }]);
    expect(audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_SERVICE_TYPE_CREATED", "service_type", "SCREEN_REPAIR", { slug: "cambio-pantalla" });
  });

  it("updates the service without allowing the immutable code to change", async () => {
    const repositoryMock = repository();
    const audit = { audit: vi.fn().mockResolvedValue(undefined) };
    const service = new AdminServiceTypes(repositoryMock, audit);
    await service.create(validInput(), "admin-1");
    const result = await service.update("SCREEN_REPAIR", { name: "Cambio de display", enabled: false }, "admin-1");
    expect(result.code).toBe("SCREEN_REPAIR");
    expect(result.name).toBe("Cambio de display");
    expect(result.enabled).toBe(false);
    expect(audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_SERVICE_TYPE_UPDATED", "service_type", "SCREEN_REPAIR", expect.any(Object));
  });

  it("archives a service and records the administrative action", async () => {
    const repositoryMock = repository();
    const audit = { audit: vi.fn().mockResolvedValue(undefined) };
    const service = new AdminServiceTypes(repositoryMock, audit);
    await service.create(validInput(), "admin-1");
    await expect(service.disable("SCREEN_REPAIR", "admin-1")).resolves.toEqual({ code: "SCREEN_REPAIR", enabled: false });
    expect(repositoryMock.disable).toHaveBeenCalledWith("SCREEN_REPAIR");
    expect(audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_SERVICE_TYPE_DISABLED", "service_type", "SCREEN_REPAIR", { enabled: false });
  });

  it("rejects an invalid price range", async () => {
    const service = new AdminServiceTypes(repository(), { audit: vi.fn().mockResolvedValue(undefined) });
    await expect(service.create({ ...validInput(), priceFromInCents: 30000000, fixedPriceInCents: 20000000 }, "admin-1")).rejects.toThrow("Price from cannot exceed fixed price");
  });
});
