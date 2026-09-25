import {notFound} from "next/navigation";
import {publicContent} from "../../../lib/publicContent";
import StoreHeader from "../../components/StoreHeader";
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=await (await publicContent()).get("page",slug);if(!p)return {title:"Contenido no encontrado"};return {title:p.seoTitle||p.title,description:p.seoDescription||undefined,alternates:p.canonicalUrl?{canonical:p.canonicalUrl}:undefined};}
export default async function CmsPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=await (await publicContent()).get("page",slug);if(!p)notFound();return <main className="store-shell"><StoreHeader activeHref="/"/><article className="content-article"><p className="eyebrow">Contenido</p><h1>{p.title}</h1><div className="content-body">{p.content}</div></article></main>}
