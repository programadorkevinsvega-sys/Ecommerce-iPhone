import Image from "next/image";
import Link from "next/link";
import type {PublicBanner} from "@modules/cms/application/PublicMarketing";

export default function MarketingBanners({items}:{items:readonly PublicBanner[]}){
  if(!items.length)return null;
  return <section className="section" aria-labelledby="marketing-banners-title"><div className="section-heading"><p className="eyebrow">Promociones</p><h2 id="marketing-banners-title">Ofertas y novedades.</h2></div><div className="category-grid">{items.map(item=><article className="category-card" key={item.id}><Image src={item.imageUrl} alt={item.altText} width={960} height={540} sizes="(max-width: 800px) 100vw, 33vw" unoptimized/><span>{item.name}</span>{item.href&&<Link href={item.href} aria-label={item.name}>Ver más ↗</Link>}</article>)}</div></section>;
}
