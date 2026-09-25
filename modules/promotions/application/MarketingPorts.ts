import type { Campaign, Coupon, Promotion } from "../domain/Marketing";

export interface PromotionRepository {
  list():Promise<readonly Promotion[]>;
  save(input:Promotion):Promise<void>;
}
export interface CouponRepository {
  list():Promise<readonly Coupon[]>;
  findActiveByCode(code:string,customerId:string,at:string):Promise<Coupon|null>;
  save(input:Coupon):Promise<void>;
  redeem(input:{couponId:string;customerId:string;orderId:string;amountInCents:number}):Promise<void>;
}
export interface CampaignRepository {
  list():Promise<readonly Campaign[]>;
  save(input:Campaign):Promise<void>;
}
export interface MarketingAuditPort {
  audit(actorId:string,action:string,resourceType:string,resourceId:string,payload:Record<string,unknown>):Promise<void>;
}
