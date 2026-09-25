import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const queries={
 page:"SELECT id,slug,title,content,seo_title AS seoTitle,seo_description AS seoDescription,canonical_url AS canonicalUrl FROM cms_pages WHERE slug=? AND active=1 LIMIT 1",
 blog:"SELECT id,slug,title,excerpt,content,category_id AS categoryId,cover_image_url AS coverImageUrl,published_at AS publishedAt,seo_title AS seoTitle,seo_description AS seoDescription,canonical_url AS canonicalUrl FROM cms_blog_posts WHERE slug=? AND status='PUBLISHED' AND published_at<=CURRENT_TIMESTAMP LIMIT 1",
 landing:"SELECT id,slug,title,content,seo_title AS seoTitle,seo_description AS seoDescription,canonical_url AS canonicalUrl,published_at AS publishedAt FROM cms_landing_pages WHERE slug=? AND status='PUBLISHED' AND published_at<=CURRENT_TIMESTAMP LIMIT 1",
} as const;

export async function GET(_request:Request,{params}:{params:Promise<{kind:string;slug:string}>}){
 const {kind,slug}=await params;
 if(!(kind in queries)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))return NextResponse.json({error:"Content not found"},{status:404});
 const {env}=getCloudflareContext();
 const row=await env.DB.prepare(queries[kind as keyof typeof queries]).bind(slug).first();
 if(!row)return NextResponse.json({error:"Content not found"},{status:404});
 return NextResponse.json(row,{headers:{"cache-control":"public, max-age=60, stale-while-revalidate=300"}});
}
