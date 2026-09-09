import { describe,expect,it } from "vitest";
import { assertOrderTransition } from "./Order";
describe("Order state machine",()=>{it("allows payment flow",()=>{expect(()=>assertOrderTransition("PENDING_PAYMENT","PAYMENT_PROCESSING")).not.toThrow();expect(()=>assertOrderTransition("PAYMENT_PROCESSING","PAID")).not.toThrow();});it("rejects invalid transitions",()=>{expect(()=>assertOrderTransition("PENDING_PAYMENT","SHIPPED")).toThrow();expect(()=>assertOrderTransition("DELIVERED","PAID")).toThrow();});});
