import { describe, expect, it } from "vitest";
import { ServiceTypeDefinition } from "./ServiceTypeDefinition";

const validServiceType = {
  code: "CARRIER_UNLOCK",
  slug: "desbloqueo-operador",
  name: "Desbloqueo de operador",
  description: "Gestión de solicitudes autorizadas.",
  category: "NETWORK" as const,
  enabled: true,
  workflow: {
    initialStatus: "PENDING" as const,
    quoteRequired: true,
    paymentRequired: true,
    technicianApprovalRequired: true,
    adminApprovalRequired: false,
    customerOwnershipProofRequired: true,
    allowedStatuses: ["PENDING", "COMPLETED", "REJECTED"],
  },
  metadata: {},
};

describe("ServiceTypeDefinition",()=>{
  it("creates a valid configurable type",()=>{
    const type=ServiceTypeDefinition.create(validServiceType);
    expect(type.toPrimitives().code).toBe("CARRIER_UNLOCK");
    expect(type.toPrimitives().workflow.quoteRequired).toBe(true);
  });
  it("rejects invalid codes",()=>expect(()=>ServiceTypeDefinition.create({...validServiceType,code:"invalid-code"})).toThrow());
  it("requires PENDING in the workflow",()=>expect(()=>ServiceTypeDefinition.create({...validServiceType,workflow:{...validServiceType.workflow,allowedStatuses:["QUOTED"]}})).toThrow());
  it("supports arbitrary business service codes",()=>{
    const type=ServiceTypeDefinition.create({...validServiceType,code:"BATTERY_REPLACEMENT",slug:"cambio-bateria",name:"Cambio de batería"});
    expect(type.toPrimitives().code).toBe("BATTERY_REPLACEMENT");
  });
});
