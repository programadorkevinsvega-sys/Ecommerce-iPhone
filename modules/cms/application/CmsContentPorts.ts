import type { Banner, BlogCategory, BlogPost, Faq, FeaturedContent, LandingPage } from "../domain/Content";
export type CmsKind="BLOG_CATEGORY"|"BLOG_POST"|"FAQ"|"LANDING_PAGE"|"BANNER"|"FEATURED";
export type CmsValue=BlogCategory|BlogPost|Faq|LandingPage|Banner|FeaturedContent;
export interface CmsContentRepository{list(kind:CmsKind):Promise<readonly CmsValue[]>;save(kind:CmsKind,value:CmsValue):Promise<string>;setActive(kind:CmsKind,id:string,active:boolean):Promise<boolean>;}
