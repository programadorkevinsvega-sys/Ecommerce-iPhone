import { describe, expect, it } from "vitest";
import { NotificationService } from "./NotificationService";
import type { NotificationEvent } from "../domain/NotificationEvent";
import type { EmailProvider, NotificationOutboxRepository, OutboxRecord } from "./NotificationPorts";

class MemoryOutbox implements NotificationOutboxRepository {
  records = new Map<string, NotificationEvent>();
  deliveries = new Set<string>();
  async enqueue(e:NotificationEvent){this.records.set(e.id,e);return true;}
  async pending(_limit:number):Promise<OutboxRecord[]>{return [];}
  async markQueued(_id:string){}
  async markProcessed(id:string){this.records.delete(id)}
  async markFailed(_id:string,_error:string,_retryAt:string){}
  async hasDelivery(_id:string,_channel:"EMAIL",recipient:string,template:string){return this.deliveries.has(`${recipient}:${template}`)}
  async recordDelivery(input:Parameters<NotificationOutboxRepository["recordDelivery"]>[0]){if(input.status==="SENT")this.deliveries.add(`${input.recipient}:${input.template}`)}
}
class MemoryEmail implements EmailProvider { sent:unknown[]=[]; async send(input:Parameters<EmailProvider["send"]>[0]){this.sent.push(input);return {id:"resend-1"}} }

describe("NotificationService",()=>{
  it("sends an order-created email and marks the event processed",async()=>{
    const outbox=new MemoryOutbox(); const email=new MemoryEmail(); const service=new NotificationService(outbox,email);
    const event:NotificationEvent={id:"evt-1",eventType:"OrderCreated",aggregateId:"ord-1",createdAt:new Date().toISOString(),payload:{email:"buyer@example.com",orderNumber:"VEGA-1001",status:"PENDING_PAYMENT"}};
    await service.process(event);
    expect(email.sent).toHaveLength(1); expect(outbox.records.has("evt-1")).toBe(false); expect(outbox.deliveries.size).toBe(1);
  });
  it("is idempotent when the delivery already exists",async()=>{
    const outbox=new MemoryOutbox(); const email=new MemoryEmail(); outbox.deliveries.add("buyer@example.com:ORDER_PAID");
    const service=new NotificationService(outbox,email);
    await service.process({id:"evt-2",eventType:"OrderPaid",aggregateId:"ord-2",createdAt:new Date().toISOString(),payload:{email:"buyer@example.com",orderNumber:"VEGA-1002"}});
    expect(email.sent).toHaveLength(0);
  });
});
