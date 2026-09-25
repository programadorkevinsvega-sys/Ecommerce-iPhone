import type { AuditPort } from "../../admin/application/AuditPort";
import { validatePublication, validateSeo, type Banner, type BlogCategory, type BlogPost, type Faq, type FeaturedContent, type LandingPage } from "../domain/Content";
import type { CmsContentRepository } from "./CmsContentPorts";

export type ContentInput =
 | {kind:"BLOG_CATEGORY";value:BlogCategory}
 | {kind:"BLOG_POST";value:BlogPost}
 | {kind:"FAQ";value:Faq}
 | {kind:"LANDING_PAGE";value:LandingPage}
 | {kind:"BANNER";value:Banner}
 | {kind:"FEATURED";value:FeaturedContent};

export class AdminContent {
 constructor(private readonly repo:CmsContentRepository,private readonly audit:AuditPort){}
 async list(kind:ContentInput["kind"]){return this.repo.list(kind);}
 async save(input:ContentInput,adminId:string):Promise<string>{
  if(!adminId.trim())throw new Error("ADMIN_ID_REQUIRED");
  const v=input.value;
  if("seoTitle" in v || "seoDescription" in v || "canonicalUrl" in v)validateSeo(v);
  if("status" in v)validatePublication(v.status,v.scheduledAt,v.publishedAt);
  if(input.kind==="BLOG_CATEGORY"&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(v.slug))throw new Error("INVALID_CONTENT_SLUG");
  if(input.kind==="BLOG_POST"||input.kind==="LANDING_PAGE"){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(v.slug)||v.title.trim().length<1||v.title.length>200||v.content.length>100000)throw new Error("INVALID_CONTENT");}
  if(input.kind==="FAQ"&&(!v.question.trim()||!v.answer.trim()||v.question.length>500||v.answer.length>10000))throw new Error("INVALID_FAQ");
  if(input.kind==="BANNER"&&(!v.name.trim()||!v.placement.trim()||!/^https?:\/\//iu.test(v.imageUrl)))throw new Error("INVALID_BANNER");
  if(input.kind==="FEATURED"&&(!v.contentId.trim()||!v.placement.trim()))throw new Error("INVALID_FEATURED_CONTENT");
  const id=await this.repo.save(input.kind,v);
  await this.audit.audit(adminId,"ADMIN_CONTENT_SAVED",input.kind,id,{});
  return id;
 }
 async setActive(kind:ContentInput["kind"],id:string,active:boolean,adminId:string){const ok=await this.repo.setActive(kind,id,active);if(!ok)throw new Error("CONTENT_NOT_FOUND");await this.audit.audit(adminId,"ADMIN_CONTENT_ACTIVE_CHANGED",kind,id,{active});}
}
