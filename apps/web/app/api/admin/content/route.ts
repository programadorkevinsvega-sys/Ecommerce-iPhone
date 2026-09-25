import { NextResponse } from "next/server";
import { adminContentApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS, requireAdmin } from "../../../../lib/adminAuth";
import type { CmsKind,CmsValue } from "../../../../../modules/cms/application/CmsContentPorts";

const kinds:ReadonlySet<CmsKind>=new Set(["BLOG_CATEGORY","BLOG_POST","FAQ","LANDING_PAGE","BANNER","FEATURED"]);
export async function GET(request:Request){
 try{const {env}=await requireAdmin(PERMISSIONS.cmsWrite);const kind=readKind(request);return NextResponse.json({items:await adminContentApplication(env).list(kind)},{headers:{"cache-control":"no-store"}});}catch(e){return error(e);}
}
export async function POST(request:Request){
 try{const {env,admin}=await requireAdmin(PERMISSIONS.cmsWrite);const body=await request.json() as unknown;if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("INVALID_CONTENT");const b=body as Record<string,unknown>;const kind=readKindValue(b.kind);if(!b.value||typeof b.value!=="object"||Array.isArray(b.value))throw new Error("INVALID_CONTENT");const id=await adminContentApplication(env).save(kind,b.value as CmsValue,admin.id);return NextResponse.json({id},{status:201});}catch(e){return error(e);}
}
export async function PATCH(request:Request){
 try{const {env,admin}=await requireAdmin(PERMISSIONS.cmsWrite);const body=await request.json() as unknown;if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("INVALID_CONTENT");const b=body as Record<string,unknown>;const kind=readKindValue(b.kind);if(typeof b.id!=="string"||typeof b.active!=="boolean")throw new Error("INVALID_CONTENT");await adminContentApplication(env).setActive(kind,b.id,b.active,admin.id);return NextResponse.json({updated:true});}catch(e){return error(e);}
}
function readKind(request:Request):CmsKind{return readKindValue(new URL(request.url).searchParams.get("kind"));}
function readKindValue(v:unknown):CmsKind{if(typeof v!=="string"||!kinds.has(v as CmsKind))throw new Error("INVALID_CONTENT_KIND");return v as CmsKind;}
function error(e:unknown){const c=e instanceof Error?e.message:"UNKNOWN";const s=c==="UNAUTHORIZED"?401:c==="FORBIDDEN"?403:c==="CONTENT_NOT_FOUND"?404:c==="INVALID_CONTENT_KIND"?400:400;return NextResponse.json({error:s===401?"Authentication required":s===403?"Forbidden":c},{status:s});}
