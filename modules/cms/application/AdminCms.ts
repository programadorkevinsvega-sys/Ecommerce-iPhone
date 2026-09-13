import type { AuditPort } from "../../admin/application/AuditPort";

export type CmsPageInput = Readonly<{ slug:string; title:string; content:string; seoTitle?:string; seoDescription?:string; canonicalUrl?:string; active?:boolean }>;
export type CmsRepository = { list():Promise<unknown[]>; save(input:CmsPageInput,id?:string,adminUserId?:string):Promise<string>; setActive(id:string,active:boolean,adminUserId:string):Promise<boolean> };
export class AdminCms {
  constructor(
    private readonly repository: CmsRepository,
    private readonly audit: AuditPort,
  ){}

  list(){return this.repository.list();}

  async save(input:CmsPageInput,id?:string,adminUserId?:string){
    const adminId=adminUserId?.trim();
    if(!adminId)throw new Error("ADMIN_ID_REQUIRED");
    const slug=input.slug.trim().toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>120||!input.title.trim()||input.title.length>200||input.content.length>100_000)throw new Error("INVALID_CMS_PAGE");
    if(input.canonicalUrl&&!/^https:\/\//i.test(input.canonicalUrl))throw new Error("INVALID_CANONICAL_URL");
    const pageId=await this.repository.save({...input,slug,title:input.title.trim()},id,adminId);
    await this.audit.audit(adminId,"ADMIN_CMS_PAGE_SAVED","cms_page",pageId,{slug});
    return pageId;
  }

  async setActive(id:string,active:boolean,adminUserId:string){
    const adminId=adminUserId.trim();
    const pageId=id.trim();
    if(!adminId)throw new Error("ADMIN_ID_REQUIRED");
    if(!pageId)throw new Error("CMS_PAGE_ID_REQUIRED");
    const updated=await this.repository.setActive(pageId,active,adminId);
    await this.audit.audit(adminId,"ADMIN_CMS_PAGE_ACTIVATED","cms_page",pageId,{active});
    return updated;
  }
}
