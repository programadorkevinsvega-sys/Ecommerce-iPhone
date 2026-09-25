export type PublicBanner=Readonly<{id:string;name:string;placement:string;imageUrl:string;altText:string;href?:string;priority:number}>;
export type PublicFaq=Readonly<{id:string;question:string;answer:string;sortOrder:number}>;
export type PublicFeatured=Readonly<{id:string;contentType:"PRODUCT"|"BLOG_POST"|"CMS_PAGE"|"LANDING_PAGE";contentId:string;placement:string;priority:number;slug?:string;title?:string}>;
export interface PublicMarketingRepository{
 listBanners(placement:string,limit?:number):Promise<readonly PublicBanner[]>;
 listFaqs(limit?:number):Promise<readonly PublicFaq[]>;
 listFeatured(placement:string,limit?:number):Promise<readonly PublicFeatured[]>;
}
export class PublicMarketing{
 constructor(private readonly repository:PublicMarketingRepository){}
 banners(placement:string,limit=8){return this.repository.listBanners(placement,Math.min(Math.max(limit,1),20));}
 faqs(limit=50){return this.repository.listFaqs(Math.min(Math.max(limit,1),100));}
 featured(placement:string,limit=12){return this.repository.listFeatured(placement,Math.min(Math.max(limit,1),30));}
}