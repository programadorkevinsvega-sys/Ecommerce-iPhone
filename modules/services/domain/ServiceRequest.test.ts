import { describe, expect, it } from "vitest";
import { ServiceRequest } from "./ServiceRequest";

describe("ServiceRequest",()=>{
 const base={email:"customer@example.com",type:"DIAGNOSTIC" as const,deviceBrand:"Apple",deviceModel:"iPhone 17",problemDescription:"La batería se descarga rápido",currency:"COP"};
 it("creates a pending request",()=>expect(ServiceRequest.create("s1",base).toPrimitives().status).toBe("PENDING"));
 it("requires carrier for legitimate unlock",()=>expect(()=>ServiceRequest.create("s1",{...base,type:"CARRIER_UNLOCK"})).toThrow());
 it("only exposes identifier suffixes in primitives",()=>expect(ServiceRequest.create("s1",{...base,imeiLast4:"6789",deviceSerialLast4:"ABCD"}).toPrimitives()).toMatchObject({imeiLast4:"6789",deviceSerialLast4:"ABCD"}));
 it("enforces workflow transitions",()=>{const s=ServiceRequest.create("s1",base);s.quote(50000);s.transitionTo("PAYMENT_PENDING");expect(()=>s.transitionTo("COMPLETED")).toThrow();});
});
