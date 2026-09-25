import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ReviewModerationRepository } from "../../../../../modules/reviews/infrastructure/D1ReviewModerationRepository";
import { PERMISSIONS, requireAdmin } from "../../../../../lib/adminAuth";
import { ReviewModeration } from "../../../../../modules/reviews/application/ReviewModeration";
import { D1AuditPort } from "../../../../../modules/admin/infrastructure/D1AuditPort";

export async function GET(request:Request){
 try{const {env}=await requireAdmin(PERMISSIONS.reviewsWrite);const status=new URL(request.url).searchParams.get("status")||undefined;const app=new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB));return NextResponse.json({items:await app.listReports(status as never)},{headers:{"cache-control":"no-store"}});}
 catch(e){return error(e);}
}
export async function PATCH(request:Request){
 try{const {env,admin}=await requireAdmin(PERMISSIONS.reviewsWrite);const body=await request.json() as unknown;if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("INVALID_REVIEW_REPORT");const b=body as Record<string,unknown>;if(typeof b.id!=="string"||!["REVIEWED","DISMISSED","ACTIONED"].includes(String(b.status)))throw new Error("INVALID_REVIEW_REPORT");const app=new ReviewModeration(new D1ReviewModerationRepository(env.DB),new D1AuditPort(env.DB));await app.resolveReport({id:b.id,status:b.status as "REVIEWED"|"DISMISSED"|"ACTIONED",adminUserId:admin.id});return NextResponse.json({updated:true});}
 catch(e){return error(e);}
}
function error(e:unknown){const c=e instanceof Error?e.message:"UNKNOWN";const s=c==="UNAUTHORIZED"?401:c==="FORBIDDEN"?403:c.includes("NOT_FOUND")?404:c.includes("ALREADY")?409:400;return NextResponse.json({error:s===401?"Authentication required":s===403?"Forbidden":c},{status:s});}
