export type PublicationStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type CmsContentType = "PAGE" | "BLOG_POST" | "FAQ" | "LANDING_PAGE" | "BANNER" | "FEATURED";

export type SeoFields = Readonly<{
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
}>;

export type CmsPage = Readonly<{ id:string; slug:string; title:string; content:string; active:boolean } & SeoFields>;
export type BlogCategory = Readonly<{ id:string; slug:string; name:string; description?:string; active:boolean }>;
export type BlogPost = Readonly<{ id:string; slug:string; title:string; excerpt?:string; content:string; categoryId?:string; coverImageUrl?:string; status:PublicationStatus; scheduledAt?:string; publishedAt?:string; authorAdminId?:string } & SeoFields>;
export type Faq = Readonly<{ id:string; question:string; answer:string; sortOrder:number; active:boolean; publishedAt?:string }>;
export type LandingPage = Readonly<{ id:string; slug:string; title:string; content:string; status:PublicationStatus; scheduledAt?:string; publishedAt?:string } & SeoFields>;
export type Banner = Readonly<{ id:string; name:string; placement:string; imageUrl:string; altText:string; href?:string; startsAt?:string; endsAt?:string; priority:number; active:boolean }>;
export type FeaturedContent = Readonly<{ id:string; contentType:CmsContentType; contentId:string; placement:string; startsAt?:string; endsAt?:string; priority:number; active:boolean }>;

export function validatePublication(status:PublicationStatus, scheduledAt?:string, publishedAt?:string):void {
  if(status==="SCHEDULED" && !scheduledAt) throw new Error("SCHEDULED_CONTENT_REQUIRES_DATE");
  if(status==="PUBLISHED" && !publishedAt) throw new Error("PUBLISHED_CONTENT_REQUIRES_DATE");
  if(scheduledAt && !Number.isFinite(Date.parse(scheduledAt))) throw new Error("INVALID_SCHEDULE_DATE");
  if(publishedAt && !Number.isFinite(Date.parse(publishedAt))) throw new Error("INVALID_PUBLISH_DATE");
}
export function validateSeo(fields:SeoFields):void {
  if(fields.seoTitle !== undefined && (!fields.seoTitle.trim() || fields.seoTitle.length>200)) throw new Error("INVALID_SEO_TITLE");
  if(fields.seoDescription !== undefined && fields.seoDescription.length>500) throw new Error("INVALID_SEO_DESCRIPTION");
  if(fields.canonicalUrl !== undefined && !/^https:\/\//iu.test(fields.canonicalUrl)) throw new Error("INVALID_CANONICAL_URL");
}
