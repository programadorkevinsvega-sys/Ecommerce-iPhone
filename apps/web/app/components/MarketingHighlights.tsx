import Image from "next/image";
import Link from "next/link";
import type {PublicBanner,PublicFeatured} from "@modules/cms/application/PublicMarketing";

export function MarketingBanners({items}:{items:readonly PublicBanner[]}){
  if(!items.length)return null;
  return <section className="section" aria-labelledby="marketing-banners-title"><div className="section-heading"><p className="eyebrow">Marketing</p><h2 id="marketing-banners-title">Novedades y oportunidades.</h2></div><div className="marketing-banner-grid">{items.map(x=><article className="marketing-banner" key={x.id}><Image src={x.imageUrl} alt={x.altText} width={1200} height={600} sizes="(max-width: 800px) 100vw, 50vw" unoptimized/><div><h3>{x.name}</h3>{x.href&&<Link className="button secondary" href={x.href}>Ver más</Link>}</div></article>)}</div></section>;
}

function featuredHref(item:PublicFeatured){
  if(item.contentType==="PRODUCT")return item.slug?"/iphone/"+encodeURIComponent(item.slug):"/catalog";
  if(item.contentType==="BLOG_POST")return item.slug?"/blog/"+encodeURIComponent(item.slug):"/blog";
  if(item.contentType==="LANDING_PAGE")return item.slug?"/landing/"+encodeURIComponent(item.slug):"/";
  return item.slug?"/content/"+encodeURIComponent(item.slug):"/";
}

export function FeaturedContent({items}:{items:readonly PublicFeatured[]}){
  if(!items.length)return null;
  return <section className="section" aria-labelledby="featured-content-title"><div className="section-heading"><p className="eyebrow">Destacados</p><h2 id="featured-content-title">Contenido seleccionado.</h2></div><div className="category-grid">{items.map(x=><Link className="category-card" href={featuredHref(x)} key={x.id}><span>{x.title}</span><span aria-hidden="true">↗</span></Link>)}</div></section>;
}
