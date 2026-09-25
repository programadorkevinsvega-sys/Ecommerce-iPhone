import type { AuditPort } from "../../admin/application/AuditPort";
import type { CmsKind,CmsValue } from "./CmsContentPorts";
import { validateBanner,validateFeatured,validatePublication,validateSeo,type Banner,type FeaturedContent,type SeoFields } from "../domain/Content";
import type { CmsContentRepository } from "./CmsContentPorts";

export class AdminContent{
 constructor(private readonly repo:CmsContentRepository,private readonly audit:AuditPort){}
 list(kind:CmsKind){return this.repo.list(kind);}
 async save(kind:CmsKind,v:CmsValue,adminId:string):Promise<string>{
  if(!adminId.trim())throw new Error("ADMIN_ID_REQUIRED");
  if(!v.id.trim()||v.id.length>128)throw new Error("INVALID_CONTENT_ID");
  const value=v as unknown as Record<string,unknown>;
  if("seoTitle" in value||"seoDescription" in value||"canonicalUrl" in value)validateSeo(value as SeoFields);
  if(typeof value.status==="string")validatePublication(value.status as "DRAFT"|"SCHEDULED"|"PUBLISHED"|"ARCHIVED",typeof value.scheduledAt==="string"?value.scheduledAt:undefined,typeof value.publishedAt==="string"?value.publishedAt:undefined);
  const slug=typeof value.slug==="string"?value.slug.trim().toLowerCase():"";
  if((kind==="BLOG_CATEGORY"||kind==="BLOG_POST"||kind==="LANDING_PAGE")&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))throw new Error("INVALID_CONTENT_SLUG");
  const title=typeof value.title==="string"?value.title.trim():"";
  const body=typeof value.content==="string"?value.content:"";
  if(kind==="BLOG_CATEGORY"){
   const name=typeof value.name==="string"?value.name.trim():"";
   if(!name||name.length>200)throw new Error("INVALID_BLOG_CATEGORY");
  }
  if(kind==="BLOG_POST"||kind==="LANDING_PAGE"){
   if(!title||title.length>200||typeof value.content!=="string"||body.length>100000)throw new Error("INVALID_CONTENT");
   if(typeof value.status!=="string")throw new Error("INVALID_CONTENT_STATUS");
  }
  if(kind==="FAQ"){
   const question=typeof value.question==="string"?value.question.trim():"";
   const answer=typeof value.answer==="string"?value.answer.trim():"";
   if(!question||!answer||question.length>500||answer.length>10000||!Number.isSafeInteger(value.sortOrder)||Number(value.sortOrder)<0)throw new Error("INVALID_FAQ");
  }
  if(kind==="BANNER"){
   if(typeof value.name!=="string"||typeof value.placement!=="string"||typeof value.imageUrl!=="string"||typeof value.altText!=="string"||typeof value.active!=="boolean"||!Number.isSafeInteger(value.priority))throw new Error("INVALID_BANNER");
   validateBanner(value as unknown as Banner);
  }
  if(kind==="FEATURED"){
   if(typeof value.contentId!=="string"||typeof value.contentType!=="string"||typeof value.placement!=="string"||typeof value.active!=="boolean"||!Number.isSafeInteger(value.priority))throw new Error("INVALID_FEATURED_CONTENT");
   validateFeatured(value as unknown as FeaturedContent);
  }
  const id=await this.repo.save(kind,v);
  await this.audit.audit(adminId,"ADMIN_CONTENT_SAVED",kind,id,{kind});
  return id;
 }
 async setActive(kind:CmsKind,id:string,active:boolean,adminId:string){
  if(!id.trim()||id.length>128)throw new Error("INVALID_CONTENT_ID");
  const ok=await this.repo.setActive(kind,id.trim(),active);
  if(!ok)throw new Error("CONTENT_NOT_FOUND");
  await this.audit.audit(adminId,"ADMIN_CONTENT_ACTIVE_CHANGED",kind,id.trim(),{active});
 }
}
