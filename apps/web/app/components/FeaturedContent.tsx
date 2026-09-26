import Link from "next/link";
import type {PublicFeatured} from "@modules/cms/application/PublicMarketing";

function href(item:PublicFeatured){
  if(item.contentType==="PRODUCT")return `/catalog?product=${encodeURIComponent(item.contentId)}`;
  if(item.contentType==="BLOG_POST")return item.slug?`/blog/${encodeURIComponent(item.slug)}`:"/blog";
  if(item.contentType==="LANDING_PAGE")return item.slug?`/landing/${encodeURIComponent(item.slug)}`:"/";
  return item.slug?`/content/${encodeURIComponent(item.slug)}`:"/";
}

export default function FeaturedContent({items}:{items:readonly PublicFeatured[]}){
  if(!items.length)return null;
  return <section className="section" aria-labelledby="featured-content-title"><div className="section-heading"><p className="eyebrow">Destacados</p><h2 id="featured-content-title">Contenido seleccionado.</h2></div><div className="category-grid">{items.map(item=><Link className="category-card" href={href(item)} key={item.id}><span>{item.title}</span><span aria-hidden="true">↗</span></Link>)}</div></section>;
}
