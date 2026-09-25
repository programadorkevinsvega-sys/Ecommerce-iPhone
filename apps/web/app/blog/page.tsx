import Image from "next/image";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type Post={slug:string;title:string;excerpt:string|null;coverImageUrl:string|null;publishedAt:string};
export const dynamic = "force-dynamic";

export default async function BlogPage(){
 const {env}=getCloudflareContext({async:true});const rows=await env.DB.prepare("SELECT slug,title,excerpt,cover_image_url AS coverImageUrl,published_at AS publishedAt FROM cms_blog_posts WHERE status='PUBLISHED' AND published_at<=CURRENT_TIMESTAMP ORDER BY published_at DESC").all<Post>();
 return <main className="store-shell"><section className="catalog-hero"><p className="eyebrow">Blog</p><h1>Noticias y contenido.</h1><p>Consejos, novedades y contenido editorial de la tienda.</p></section><section className="catalog-grid">{rows.results.map(p=><article className="product-card" key={p.slug}>{p.coverImageUrl&&<div className="relative aspect-video overflow-hidden"><Image src={p.coverImageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" unoptimized /> </div>}<p className="eyebrow">{new Date(p.publishedAt).toLocaleDateString("es-CO")}</p><h2>{p.title}</h2>{p.excerpt&&<p>{p.excerpt}</p>}<Link className="button secondary" href={"/blog/"+p.slug}>Leer</Link></article>)}</section></main>;
}
