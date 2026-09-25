import type { AuditPort } from "../../admin/application/AuditPort";
import { validateApplicability, validateDiscount, validateWindow, type Coupon } from "../domain/Marketing";
import type { CouponRepository } from "./MarketingPorts";

export type CouponInput=Readonly<Omit<Coupon,"id"|"usedCount"> & { id?:string; usedCount?:number }>;

export class AdminCoupons {
  constructor(private readonly repository:CouponRepository,private readonly audit:AuditPort) {}
  list(){return this.repository.list();}
  async save(input:CouponInput,adminUserId:string):Promise<string> {
    const code=input.code.trim().toUpperCase();
    const name=input.name.trim();
    const productIds=[...input.productIds], categoryIds=[...input.categoryIds];
    const usedCount=input.usedCount??0;
    if(!/^[A-Z0-9_-]{3,64}$/u.test(code)||!name||name.length>200||!Number.isSafeInteger(usedCount)||usedCount<0||input.minSubtotalInCents<0||!Number.isSafeInteger(input.minSubtotalInCents)) throw new Error("INVALID_COUPON");
    if(input.maxUses!==null&&(!Number.isSafeInteger(input.maxUses)||input.maxUses<1||input.maxUses<usedCount)) throw new Error("INVALID_MAX_USES");
    if(input.maxUsesPerCustomer!==null&&(!Number.isSafeInteger(input.maxUsesPerCustomer)||input.maxUsesPerCustomer<1)) throw new Error("INVALID_MAX_USES_PER_CUSTOMER");
    validateDiscount(input.discountType,input.discountValue); validateWindow(input.startsAt,input.endsAt); validateApplicability({productIds,categoryIds});
    const coupon:Coupon={id:input.id?.trim()||crypto.randomUUID(),code,name,discountType:input.discountType,discountValue:input.discountValue,minSubtotalInCents:input.minSubtotalInCents,maxUses:input.maxUses,usedCount,maxUsesPerCustomer:input.maxUsesPerCustomer,startsAt:input.startsAt,endsAt:input.endsAt,active:input.active,productIds,categoryIds};
    await this.repository.save(coupon); await this.audit.audit(adminUserId,"ADMIN_COUPON_SAVED","coupon",coupon.id,{code});
    return coupon.id;
  }
  async setActive(id:string,active:boolean,adminUserId:string):Promise<void> {
    const coupon=await this.repository.list().then(xs=>xs.find(x=>x.id===id));
    if(!coupon) throw new Error("COUPON_NOT_FOUND");
    await this.repository.save({...coupon,active}); await this.audit.audit(adminUserId,"ADMIN_COUPON_ACTIVATED","coupon",id,{active});
  }
}
