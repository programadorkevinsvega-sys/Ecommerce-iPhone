import type { D1Database } from "@cloudflare/workers-types";
import type { CmsPageInput,CmsRepository } from "../application/AdminCms";
import { mediaKeysFromText } from "../../shared-kernel";

export class D1CmsRepository implements CmsRepository{
 constructor(private readonly db:D1Database){}
 async list(){return(await this.db.prepare("SELECT id,slug,title,content,seo_title AS seoTitle,seo_description AS seoDescription,canonical_url AS canonicalUrl,active,updated_by AS updatedBy,created_at AS createdAt,updated_at AS updatedAt FROM cms_pages ORDER BY updated_at DESC").all()).results;}
 async save(input:CmsPageInput,id?:string,adminUserId?:string){
  const pageId=id?.trim()||crypto.randomUUID();
  const previous=id?await this.db.prepare("SELECT content FROM cms_pages WHERE id=?").bind(pageId).first<{content:string}>():null;
  const previousKeys=previous?mediaKeysFromText(previous.content):[];
  const currentKeys=new Set(mediaKeysFromText(input.content));
  const removed=previousKeys.filter((key)=>!currentKeys.has(key));
  const statements=[this.db.prepare("INSERT INTO cms_pages(id,slug,title,content,seo_title,seo_description,canonical_url,active,updated_by) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,content=excluded.content,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,active=excluded.active,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(pageId,input.slug,input.title,input.content,input.seoTitle??null,input.seoDescription??null,input.canonicalUrl??null,input.active===false?0:1,adminUserId??null)];
  statements.push(...removed.map((key)=>this.db.prepare("INSERT OR IGNORE INTO media_cleanup_queue (object_key) VALUES (?)").bind(key)));
  const result=await this.db.batch(statements);
  if(result[0]?.meta.changes!==1)throw new Error("CMS_PAGE_NOT_SAVED");
  return pageId;
 }
 async setActive(id:string,active:boolean,adminUserId:string){const r=await this.db.prepare("UPDATE cms_pages SET active=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(active?1:0,adminUserId,id).run();if(r.meta.changes!==1)throw new Error("CMS_PAGE_NOT_FOUND");return true;}
}