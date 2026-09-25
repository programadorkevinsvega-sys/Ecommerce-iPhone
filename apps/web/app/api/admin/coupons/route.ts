import { NextResponse } from "next/server";
import type { CouponInput } from "@modules/promotions/application/AdminCoupons";
import { adminCouponsApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";

export async function GET(){try{const {env}=await requireAdmin(PERMISSIONS.promotionsWrite);return NextResponse.json({items:await adminCouponsApplication(env).list()},{headers:{"cache-control":"no-store"}});}catch(e){return error(e);}}
export async function POST(request:Request){try{const {env,admin}=await requireAdmin(PERMISSIONS.promotionsWrite);const body=(await request.json()) as Record<string,unknown>;const input=parseCoupon(body);const id=await new AdminCoupons(new D1CouponRepository(env.DB),new D1AuditPort(env.DB)).save(input,admin.id);return NextResponse.json({id},{status:201});}catch(e){return error(e);}}
function parseCoupon(body:Record<string,unknown>):CouponInput {
 const ids=(value:unknown):string[]=>Array.isArray(value)&&value.every(x=>typeof x==="string")?value:[];
 const limit=(value:unknown):number|null=>value===undefined||value===null?null:Number.isSafeInteger(value)?value:0;
 if(typeof body.code!=="string"||typeof body.name!=="string"||!["PERCENT","FIXED"].includes(String(body.discountType))||!Number.isSafeInteger(body.discountValue)||!Number.isSafeInteger(body.minSubtotalInCents)||typeof body.startsAt!=="string"||typeof body.endsAt!=="string"||typeof body.active!=="boolean") throw new Error("INVALID_COUPON");
 return {id:typeof body.id==="string"?body.id:undefined,code:body.code,name:body.name,discountType:body.discountType as "PERCENT"|"FIXED",discountValue:body.discountValue,minSubtotalInCents:body.minSubtotalInCents,maxUses:limit(body.maxUses),maxUsesPerCustomer:limit(body.maxUsesPerCustomer),startsAt:body.startsAt,endsAt:body.endsAt,active:body.active,productIds:ids(body.productIds),categoryIds:ids(body.categoryIds),};
}
function error(e:unknown){const code=e instanceof Error?e.message:"UNKNOWN";const status=code==="UNAUTHORIZED"?401:code==="FORBIDDEN"?403:code==="COUPON_NOT_FOUND"?404:code==="COUPON_REDEMPTION_CONFLICT"?409:400;return NextResponse.json({error:status===401?"Authentication required":status===403?"Forbidden":code},{status});}
