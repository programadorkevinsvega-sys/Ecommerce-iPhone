import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ReviewModerationRepository } from "@modules/reviews/infrastructure/D1ReviewModerationRepository";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { ReviewModeration } from "@modules/reviews/application/ReviewModeration";
import { D1AuditPort } from "@modules/admin/infrastructure/D1AuditPort";
import type { ReviewReportStatus } from "@modules/reviews/domain/ReviewModeration";

const reportStatuses:readonly ReviewReportStatus[]=["OPEN","REVIEWED","DISMISSED","ACTIONED"];
const resolutionStatuses:readonly Exclude<ReviewReportStatus,"OPEN">[]=["REVIEWED","DISMISSED","ACTIONED"];

export async function GET(request:Request){
 try{
  const {env}=await requireAdmin(PERMISSIONS.reviewsWrite);
  const requested=new URL(request.url).searchParams.get("status");
  const status=requested===null||requested===""?undefined:parseReportStatus(requested);
  const app=new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB));
  return NextResponse.json({items:await app.listReports(status)},{headers:{"cache-control":"no-store"}});
 }catch(e){return error(e);}
}

export async function PATCH(request:Request){
 try{
  const {env,admin}=await requireAdmin(PERMISSIONS.reviewsWrite);
  const body=await request.json() as unknown;
  if(!body||typeof body!=="object"||Array.isArray(body)) throw new Error("INVALID_REVIEW_REPORT");
  const b=body as Record<string,unknown>;
  if(typeof b.id!=="string"||!b.id.trim()||typeof b.status!=="string") throw new Error("INVALID_REVIEW_REPORT");
  const status=parseResolutionStatus(b.status);
  const app=new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB));
  await app.resolveReport({id:b.id.trim(),status,adminUserId:admin.id});
  return NextResponse.json({updated:true});
 }catch(e){return error(e);}
}

function parseReportStatus(value:string):ReviewReportStatus{
 if(!reportStatuses.includes(value as ReviewReportStatus)) throw new Error("INVALID_REVIEW_REPORT");
 return value as ReviewReportStatus;
}
function parseResolutionStatus(value:string):Exclude<ReviewReportStatus,"OPEN">{
 if(!resolutionStatuses.includes(value as Exclude<ReviewReportStatus,"OPEN">)) throw new Error("INVALID_REVIEW_REPORT");
 return value as Exclude<ReviewReportStatus,"OPEN">;
}
function error(e:unknown){
 const c=e instanceof Error?e.message:"UNKNOWN";
 const s=c==="UNAUTHORIZED"?401:c==="FORBIDDEN"?403:c.includes("NOT_FOUND")?404:c.includes("ALREADY")||c.includes("CONFLICT")?409:c.startsWith("INVALID_")?422:500;
 return NextResponse.json({error:s===401?"Authentication required":s===403?"Forbidden":s===404?"Not found":s===422?"Invalid request":"No pudimos completar la operación."},{status:s,headers:{"cache-control":"no-store"}});
}
