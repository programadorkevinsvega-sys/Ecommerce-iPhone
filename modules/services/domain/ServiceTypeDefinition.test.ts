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
  it("supports catalog pricing, requirements and compatibility",()=>{
    const type=ServiceTypeDefinition.create({...validServiceType,priceFromInCents:100000,fixedPriceInCents:150000,estimatedMinutes:90,warrantyDays:180,requiresDiagnosis:true,requiresApproval:true,compatibility:[{brand:"Apple",model:"iPhone 15 Pro"}],requirements:[{description:"Equipo apagado",required:true}]});
    expect(type.toPrimitives().compatibility?.[0].model).toBe("iPhone 15 Pro");
    expect(type.toPrimitives().requirements?.[0].description).toBe("Equipo apagado");
  });
  it("rejects inconsistent or invalid catalog pricing",()=>{
    expect(()=>ServiceTypeDefinition.create({...validServiceType,priceFromInCents:200000,fixedPriceInCents:100000})).toThrow();
    expect(()=>ServiceTypeDefinition.create({...validServiceType,estimatedMinutes:0})).toThrow();
  });
});
