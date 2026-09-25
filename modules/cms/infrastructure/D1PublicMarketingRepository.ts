import type { D1Database } from "@cloudflare/workers-types";
import type { PublicBanner,PublicFaq,PublicFeatured,PublicMarketingRepository } from "../application/PublicMarketing";

type BannerRow={id:string;name:string;placement:string;imageUrl:string;altText:string;href:string|null;priority:number};
type FaqRow={id:string;question:string;answer:string;sortOrder:number};
type FeaturedRow={id:string;contentType:PublicFeatured["contentType"];contentId:string;placement:string;priority:number;slug:string|null;title:string|null};
export class D1PublicMarketingRepository implements PublicMarketingRepository{
 constructor(private readonly db:D1Database){}
 async listBanners(placement:string,limit=8):Promise<readonly PublicBanner[]>{
  const r=await this.db.prepare("SELECT id,name,placement,image_url AS imageUrl,alt_text AS altText,href,priority FROM marketing_banners WHERE placement=? AND active=1 AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>CURRENT_TIMESTAMP) ORDER BY priority DESC,created_at DESC LIMIT ?").bind(placement,limit).all<BannerRow>();
  return r.results.map(x=>({id:x.id,name:x.name,placement:x.placement,imageUrl:x.imageUrl,altText:x.altText,priority:x.priority,...(x.href?{href:x.href}:{})}));
 }
 async listFaqs(limit=50):Promise<readonly PublicFaq[]>{
  const r=await this.db.prepare("SELECT id,question,answer,sort_order AS sortOrder FROM cms_faqs WHERE active=1 AND (published_at IS NULL OR published_at<=CURRENT_TIMESTAMP) ORDER BY sort_order ASC,id ASC LIMIT ?").bind(limit).all<FaqRow>();
  return r.results;
 }
 async listFeatured(placement:string,limit=12):Promise<readonly PublicFeatured[]>{
  const r=await this.db.prepare("SELECT f.id,f.content_type AS contentType,f.content_id AS contentId,f.placement,f.priority,COALESCE(p.slug,b.slug,l.slug,c.slug) AS slug,COALESCE(p.name,b.title,l.title,c.title) AS title FROM marketing_featured_content f LEFT JOIN products p ON f.content_type='PRODUCT' AND p.id=f.content_id LEFT JOIN cms_blog_posts b ON f.content_type='BLOG_POST' AND b.id=f.content_id AND b.status='PUBLISHED' AND b.published_at<=CURRENT_TIMESTAMP LEFT JOIN cms_landing_pages l ON f.content_type='LANDING_PAGE' AND l.id=f.content_id AND l.status='PUBLISHED' AND l.published_at<=CURRENT_TIMESTAMP LEFT JOIN cms_pages c ON f.content_type='CMS_PAGE' AND c.id=f.content_id AND c.active=1 WHERE f.placement=? AND f.active=1 AND (f.starts_at IS NULL OR f.starts_at<=CURRENT_TIMESTAMP) AND (f.ends_at IS NULL OR f.ends_at>CURRENT_TIMESTAMP) ORDER BY f.priority DESC,f.created_at DESC LIMIT ?").bind(placement,limit).all<FeaturedRow>();
  return r.results.filter(x=>x.slug!==null&&x.title!==null).map(x=>({id:x.id,contentType:x.contentType,contentId:x.contentId,placement:x.placement,priority:x.priority,slug:x.slug as string,title:x.title as string}));
 }
}