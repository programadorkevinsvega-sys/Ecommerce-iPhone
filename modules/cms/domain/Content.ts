export type PublicationStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type CmsContentType = "PAGE" | "BLOG_POST" | "FAQ" | "LANDING_PAGE" | "BANNER" | "FEATURED";

export type SeoFields = Readonly<{seoTitle?:string;seoDescription?:string;canonicalUrl?:string}>;
export type CmsPage = Readonly<{id:string;slug:string;title:string;content:string;active:boolean}&SeoFields>;
export type BlogCategory = Readonly<{id:string;slug:string;name:string;description?:string;active:boolean}>;
export type BlogPost = Readonly<{id:string;slug:string;title:string;excerpt?:string;content:string;categoryId?:string;coverImageUrl?:string;status:PublicationStatus;scheduledAt?:string;publishedAt?:string;authorAdminId?:string}&SeoFields>;
export type Faq = Readonly<{id:string;question:string;answer:string;sortOrder:number;active:boolean;publishedAt?:string}>;
export type LandingPage = Readonly<{id:string;slug:string;title:string;content:string;status:PublicationStatus;scheduledAt?:string;publishedAt?:string}&SeoFields>;
export type Banner = Readonly<{id:string;name:string;placement:string;imageUrl:string;altText:string;href?:string;startsAt?:string;endsAt?:string;priority:number;active:boolean}>;
export type FeaturedContent = Readonly<{id:string;contentType:CmsContentType;contentId:string;placement:string;startsAt?:string;endsAt?:string;priority:number;active:boolean}>;

export function validatePublication(status:PublicationStatus,scheduledAt?:string,publishedAt?:string):void {
  if(status==="SCHEDULED"&&!scheduledAt) throw new Error("SCHEDULED_CONTENT_REQUIRES_DATE");
  if(status==="PUBLISHED"&&!publishedAt) throw new Error("PUBLISHED_CONTENT_REQUIRES_DATE");
  if(scheduledAt&&!Number.isFinite(Date.parse(scheduledAt))) throw new Error("INVALID_SCHEDULE_DATE");
  if(publishedAt&&!Number.isFinite(Date.parse(publishedAt))) throw new Error("INVALID_PUBLISH_DATE");
  if(scheduledAt&&publishedAt&&Date.parse(publishedAt)<Date.parse(scheduledAt)) throw new Error("INVALID_PUBLICATION_WINDOW");
}
export function validateSeo(fields:SeoFields):void {
  if(fields.seoTitle!==undefined&&(!fields.seoTitle.trim()||fields.seoTitle.length>200)) throw new Error("INVALID_SEO_TITLE");
  if(fields.seoDescription!==undefined&&fields.seoDescription.length>500) throw new Error("INVALID_SEO_DESCRIPTION");
  if(fields.canonicalUrl!==undefined&&!/^https:\/\//iu.test(fields.canonicalUrl)) throw new Error("INVALID_CANONICAL_URL");
}
export function validateBanner(value:Banner):void {
  if(!value.id.trim()||!value.name.trim()||value.name.length>200||!value.placement.trim()||value.placement.length>100||!value.altText.trim()||value.altText.length>300) throw new Error("INVALID_BANNER");
  if(!/^https:\/\//iu.test(value.imageUrl)) throw new Error("INVALID_BANNER_IMAGE_URL");
  if(value.href!==undefined&&!/^https:\/\//iu.test(value.href)&&!value.href.startsWith("/")) throw new Error("INVALID_BANNER_LINK");
  validateDateWindow(value.startsAt,value.endsAt,"INVALID_BANNER_WINDOW");
  if(!Number.isSafeInteger(value.priority)||value.priority<0||value.priority>100000) throw new Error("INVALID_BANNER_PRIORITY");
}
export function validateFeatured(value:FeaturedContent):void {
  if(!value.id.trim()||!value.contentId.trim()||!value.placement.trim()||value.placement.length>100) throw new Error("INVALID_FEATURED_CONTENT");
  if(!["PRODUCT","BLOG_POST","CMS_PAGE","LANDING_PAGE"].includes(value.contentType)) throw new Error("INVALID_FEATURED_CONTENT_TYPE");
  validateDateWindow(value.startsAt,value.endsAt,"INVALID_FEATURED_WINDOW");
  if(!Number.isSafeInteger(value.priority)||value.priority<0||value.priority>100000) throw new Error("INVALID_FEATURED_PRIORITY");
}
function validateDateWindow(startsAt:string|undefined,endsAt:string|undefined,error:string):void {
  if(startsAt!==undefined&&!Number.isFinite(Date.parse(startsAt))) throw new Error(error);
  if(endsAt!==undefined&&!Number.isFinite(Date.parse(endsAt))) throw new Error(error);
  if(startsAt!==undefined&&endsAt!==undefined&&Date.parse(endsAt)<=Date.parse(startsAt)) throw new Error(error);
}
