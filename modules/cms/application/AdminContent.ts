import type { AuditPort } from "../../admin/application/AuditPort";
import type { CmsKind,CmsValue } from "./CmsContentPorts";
import { validatePublication,validateSeo } from "../domain/Content";
import type { CmsContentRepository } from "./CmsContentPorts";

export class AdminContent{
 constructor(private readonly repo:CmsContentRepository,private readonly audit:AuditPort){}
 list(kind:CmsKind){return this.repo.list(kind);}
 async save(kind:CmsKind,v:CmsValue,adminId:string):Promise<string>{
  if(!adminId.trim())throw new Error("ADMIN_ID_REQUIRED");
  const value=v as unknown as Record<string,unknown>;
  if("seoTitle" in value||"seoDescription" in value||"canonicalUrl" in value)validateSeo(value);
  if(typeof value.status==="string")validatePublication(value.status as "DRAFT"|"SCHEDULED"|"PUBLISHED"|"ARCHIVED",typeof value.scheduledAt==="string"?value.scheduledAt:undefined,typeof value.publishedAt==="string"?value.publishedAt:undefined);
  const slug=typeof value.slug==="string"?value.slug.trim().toLowerCase():"";
  if((kind==="BLOG_CATEGORY"||kind==="BLOG_POST"||kind==="LANDING_PAGE")&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))throw new Error("INVALID_CONTENT_SLUG");
  const title=typeof value.title==="string"?value.title.trim():"";
  const body=typeof value.content==="string"?value.content:"";
  if((kind==="BLOG_POST"||kind==="LANDING_PAGE")&&(!title||title.length>200||body.length>100000))throw new Error("INVALID_CONTENT");
  if(kind==="FAQ"&&(!String(value.question??"").trim()||!String(value.answer??"").trim()||String(value.question).length>500||String(value.answer).length>10000))throw new Error("INVALID_FAQ");
  if(kind==="BANNER"&&(!String(value.name??"").trim()||!String(value.placement??"").trim()||!/^https?:\/\//iu.test(String(value.imageUrl??""))))throw new Error("INVALID_BANNER");
  if(kind==="FEATURED"&&(!String(value.contentId??"").trim()||!String(value.placement??"").trim()))throw new Error("INVALID_FEATURED_CONTENT");
  const id=await this.repo.save(kind,v);await this.audit.audit(adminId,"ADMIN_CONTENT_SAVED",kind,id,{});return id;
 }
 async setActive(kind:CmsKind,id:string,active:boolean,adminId:string){const ok=await this.repo.setActive(kind,id,active);if(!ok)throw new Error("CONTENT_NOT_FOUND");await this.audit.audit(adminId,"ADMIN_CONTENT_ACTIVE_CHANGED",kind,id,{active});}
}
