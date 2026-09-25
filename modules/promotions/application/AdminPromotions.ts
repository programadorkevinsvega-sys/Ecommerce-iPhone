import type { AuditPort } from "../../admin/application/AuditPort";
import { validateApplicability, validateDiscount, validateWindow, type Promotion } from "../domain/Marketing";

export type PromotionInput = Readonly<Omit<Promotion,"id"|"usedCount"> & { id?:string }>;
export interface PromotionRepository {
  list():Promise<readonly Promotion[]>;
  save(input:Promotion):Promise<string>;
  setActive(id:string,active:boolean):Promise<boolean>;
}

export class AdminPromotions {
  constructor(private readonly repository:PromotionRepository,private readonly audit:AuditPort){}
  list():Promise<readonly Promotion[]>{return this.repository.list();}
  async save(input:PromotionInput,adminUserId:string):Promise<string>{
    const code=input.code.trim().toUpperCase();
    const name=input.name.trim();
    const usedCount=input.id ? (await this.repository.list()).find(x=>x.id===input.id)?.usedCount ?? 0 : 0;
    if(!/^[A-Z0-9_-]{3,64}$/u.test(code)||!name||name.length>200||!Number.isSafeInteger(input.minSubtotalInCents)||input.minSubtotalInCents<0||!Number.isSafeInteger(usedCount)||usedCount<0)throw new Error("INVALID_PROMOTION");
    if(input.maxUses!==null&&(!Number.isSafeInteger(input.maxUses)||input.maxUses<1||input.maxUses<usedCount))throw new Error("INVALID_MAX_USES");
    validateDiscount(input.discountType,input.discountValue); validateWindow(input.startsAt,input.endsAt); validateApplicability({productIds:input.productIds,categoryIds:input.categoryIds});
    const promotion:Promotion={id:input.id?.trim()||crypto.randomUUID(),code,name,discountType:input.discountType,discountValue:input.discountValue,minSubtotalInCents:input.minSubtotalInCents,maxUses:input.maxUses,usedCount,startsAt:input.startsAt,endsAt:input.endsAt,active:input.active,productIds:[...input.productIds],categoryIds:[...input.categoryIds]};
    await this.repository.save(promotion);
    await this.audit.audit(adminUserId,"ADMIN_PROMOTION_SAVED","promotion",promotion.id,{code});
    return promotion.id;
  }
  async setActive(id:string,active:boolean,adminUserId:string):Promise<boolean>{
    const promotionId=id.trim(); if(!promotionId)throw new Error("PROMOTION_ID_REQUIRED");
    const updated=await this.repository.setActive(promotionId,active);
    await this.audit.audit(adminUserId,"ADMIN_PROMOTION_ACTIVATED","promotion",promotionId,{active});
    return updated;
  }
}
