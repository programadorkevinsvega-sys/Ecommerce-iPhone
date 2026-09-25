export type DiscountType = "PERCENT" | "FIXED";
export type Applicability = Readonly<{ productIds:readonly string[]; categoryIds:readonly string[] }>;
export type Promotion = Readonly<{ id:string; code:string; name:string; discountType:DiscountType; discountValue:number; minSubtotalInCents:number; maxUses:number|null; usedCount:number; startsAt:string; endsAt:string; active:boolean } & Applicability>;
export type Coupon = Readonly<{ id:string; code:string; name:string; discountType:DiscountType; discountValue:number; minSubtotalInCents:number; maxUses:number|null; usedCount:number; maxUsesPerCustomer:number|null; startsAt:string; endsAt:string; active:boolean } & Applicability>;
export type Campaign = Readonly<{ id:string; slug:string; name:string; description?:string; startsAt:string; endsAt:string; active:boolean }>;

export function validateDiscount(type:DiscountType,value:number):void {
  if(type==="PERCENT" && (!Number.isSafeInteger(value) || value<1 || value>100)) throw new Error("INVALID_PERCENT_DISCOUNT");
  if(type==="FIXED" && (!Number.isSafeInteger(value) || value<1)) throw new Error("INVALID_FIXED_DISCOUNT");
}
export function validateWindow(startsAt:string,endsAt:string):void {
  const start=Date.parse(startsAt), end=Date.parse(endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) throw new Error("INVALID_MARKETING_WINDOW");
}
export function validateApplicability(value:Applicability):void {
  const ids=[...value.productIds,...value.categoryIds];
  if(ids.some(id=>!id.trim()||id.length>128)) throw new Error("INVALID_MARKETING_TARGET");
  if(value.productIds.length>500||value.categoryIds.length>500) throw new Error("TOO_MANY_MARKETING_TARGETS");
}
