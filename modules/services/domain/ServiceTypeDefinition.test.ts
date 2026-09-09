import { describe, expect, it } from "vitest";
import { DEFAULT_SERVICE_TYPES, ServiceTypeDefinition } from "./ServiceTypeDefinition";

describe("ServiceTypeDefinition",()=>{
  it("creates a valid configurable type",()=>{
    const type=ServiceTypeDefinition.create(DEFAULT_SERVICE_TYPES[0]);
    expect(type.toPrimitives().code).toBe("CARRIER_UNLOCK");
    expect(type.toPrimitives().workflow.quoteRequired).toBe(true);
  });
  it("rejects invalid codes",()=>expect(()=>ServiceTypeDefinition.create({...DEFAULT_SERVICE_TYPES[0],code:"invalid-code"})).toThrow());
  it("requires PENDING in the workflow",()=>expect(()=>ServiceTypeDefinition.create({...DEFAULT_SERVICE_TYPES[0],workflow:{...DEFAULT_SERVICE_TYPES[0].workflow,allowedStatuses:["QUOTED"]}})).toThrow());
  it("supports arbitrary business service codes",()=>{
    const type=ServiceTypeDefinition.create({...DEFAULT_SERVICE_TYPES[0],code:"BATTERY_REPLACEMENT",slug:"cambio-bateria",name:"Cambio de batería"});
    expect(type.toPrimitives().code).toBe("BATTERY_REPLACEMENT");
  });
});
