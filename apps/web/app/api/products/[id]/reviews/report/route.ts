import { NextResponse } from "next/server";
import { ReviewModeration } from "@modules/reviews/application/ReviewModeration";
import { D1ReviewModerationRepository } from "@modules/reviews/infrastructure/D1ReviewModerationRepository";
import { D1AuditPort } from "@modules/admin/infrastructure/D1AuditPort";
import { currentCustomerId } from "../../../../../../lib/customerSession";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const customerId=await currentCustomerId();
  if(!customerId)return NextResponse.json({error:"Authentication required"},{status:401,headers:{"cache-control":"no-store"}});
  const {id}=await params;
  if(!id.trim()||id.length>128)return NextResponse.json({error:"Invalid review"},{status:422});
  const {env}=await getCloudflareContext({async:true});
  const body=await request.json() as unknown;
  if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("INVALID_REVIEW_REPORT");
  const value=body as Record<string,unknown>;
  if(typeof value.reason!=="string"||typeof value.details!=="undefined"&&typeof value.details!=="string")throw new Error("INVALID_REVIEW_REPORT");
  const reportId=await new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB)).report({reviewId:id.trim(),customerId,reason:value.reason,...(typeof value.details==="string"?{details:value.details}:{})});
  return NextResponse.json({id:reportId},{status:201,headers:{"cache-control":"no-store"}});
 }catch(e){
  const code=e instanceof Error?e.message:"UNKNOWN";
  const status=code==="UNAUTHORIZED"?401:code==="REVIEW_NOT_FOUND"?404:code==="REVIEW_REPORT_ALREADY_EXISTS"?409:code==="REVIEW_REPORT_RATE_LIMIT"?429:code.startsWith("INVALID_")?422:500;
  return NextResponse.json({error:status===401?"Authentication required":status===404?"Review not found":status===409?"Review already reported":status===429?"Too many reports":status===422?"Invalid report":"No pudimos completar la operación."},{status,headers:{"cache-control":"no-store"}});
 }
}
