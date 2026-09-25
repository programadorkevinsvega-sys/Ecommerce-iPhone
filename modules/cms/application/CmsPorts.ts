import type { Banner, BlogCategory, BlogPost, CmsPage, Faq, FeaturedContent, LandingPage } from "../domain/Content";

export interface CmsPageRepository { list():Promise<readonly CmsPage[]>; findPublishedBySlug(slug:string):Promise<CmsPage|null>; save(page:CmsPage):Promise<void>; }
export interface BlogRepository { listPublished(input?:{categorySlug?:string;limit?:number;offset?:number}):Promise<readonly BlogPost[]>; findPublishedBySlug(slug:string):Promise<BlogPost|null>; save(post:BlogPost):Promise<void>; }
export interface BlogCategoryRepository { listPublic():Promise<readonly BlogCategory[]>; save(category:BlogCategory):Promise<void>; }
export interface FaqRepository { listPublic():Promise<readonly Faq[]>; save(faq:Faq):Promise<void>; }
export interface LandingPageRepository { findPublishedBySlug(slug:string):Promise<LandingPage|null>; save(page:LandingPage):Promise<void>; }
export interface BannerRepository { listActive(placement:string,at:string):Promise<readonly Banner[]>; save(banner:Banner):Promise<void>; }
export interface FeaturedContentRepository { listActive(placement:string,at:string):Promise<readonly FeaturedContent[]>; save(item:FeaturedContent):Promise<void>; }
