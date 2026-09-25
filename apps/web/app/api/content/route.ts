import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type Kind="blog"|"blog-categories"|"faqs"|"landing"|"banners"|"featured";
const allowed=new Set<Kind>(["blog","blog-categories","faqs","landing","banners","featured"]);

export async function GET(request:Request){
 const kind=new URL(request.url).searchParams.get("kind") as Kind|null;
 if(!kind||!allowed.has(kind))return NextResponse.json({error:"Invalid content kind"},{status:400});
 const {env}=getCloudflareContext();const now=new Date().toISOString();
 if(kind==="blog-categories")return json(await env.DB.prepare("SELECT id,slug,name,description FROM cms_blog_categories WHERE active=1 ORDER BY name ASC").all());
 if(kind==="blog")return json(await env.DB.prepare("SELECT id,slug,title,excerpt,content,category_id AS categoryId,cover_image_url AS coverImageUrl,published_at AS publishedAt,seo_title AS seoTitle,seo_description AS seoDescription,canonical_url AS canonicalUrl FROM cms_blog_posts WHERE status='PUBLISHED' AND published_at<=? ORDER BY published_at DESC").bind(now).all());
 if(kind==="faqs")return json(await env.DB.prepare("SELECT id,question,answer,sort_order AS sortOrder FROM cms_faqs WHERE active=1 AND (published_at IS NULL OR published_at<=?) ORDER BY sort_order ASC,id ASC").bind(now).all());
 if(kind==="landing")return json(await env.DB.prepare("SELECT id,slug,title,content,seo_title AS seoTitle,seo_description AS seoDescription,canonical_url AS canonicalUrl,published_at AS publishedAt FROM cms_landing_pages WHERE status='PUBLISHED' AND published_at<=? ORDER BY published_at DESC").bind(now).all());
 if(kind==="banners")return json(await env.DB.prepare("SELECT id,name,placement,image_url AS imageUrl,alt_text AS altText,href,priority FROM marketing_banners WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) ORDER BY priority DESC,created_at DESC").bind(now,now).all());
 return json(await env.DB.prepare("SELECT id,content_type AS contentType,content_id AS contentId,placement,priority FROM marketing_featured_content WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) ORDER BY priority DESC,created_at DESC").bind(now,now).all());
}
function json(value:unknown){return NextResponse.json(value,{headers:{"cache-control":"public, max-age=60, stale-while-revalidate=300"}});}
