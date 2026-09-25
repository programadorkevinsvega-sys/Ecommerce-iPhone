import { NextResponse } from "next/server";
import { ReviewModeration } from "../../../../../../modules/reviews/application/ReviewModeration";
import { D1ReviewModerationRepository } from "../../../../../../modules/reviews/infrastructure/D1ReviewModerationRepository";
import { D1AuditPort } from "../../../../../../modules/admin/infrastructure/D1AuditPort";
import { currentCustomerId } from "../../../../../../lib/customerSession";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const customerId=await currentCustomerId(); if(!customerId)return NextResponse.json({error:"Authentication required"},{status:401});
  const {env}=getCloudflareContext(); const {id}=await params; const body=(await request.json()) as Record<string,unknown>;
  if(typeof body.reason!=="string"||typeof body.details!=="undefined"&&typeof body.details!=="string") throw new Error("INVALID_REVIEW_REPORT");
  const reportId=await new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB)).report({reviewId:id,customerId,reason:body.reason,...(typeof body.details==="string"?{details:body.details}:{})});
  return NextResponse.json({id:reportId},{status:201});
 }catch(e){const code=e instanceof Error?e.message:"UNKNOWN";const status=code==="UNAUTHORIZED"?401:code==="REVIEW_REPORT_ALREADY_EXISTS"?409:400;return NextResponse.json({error:status===401?"Authentication required":code},{status});}
}
