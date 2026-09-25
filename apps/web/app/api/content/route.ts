import {NextResponse} from "next/server";
import {publicContent} from "../../../../lib/publicContent";
import {publicMarketing} from "../../../../lib/publicMarketing";

type Kind="blog"|"blog-categories"|"faqs"|"landing"|"banners"|"featured";
const allowed:ReadonlySet<Kind>=new Set(["blog","blog-categories","faqs","landing","banners","featured"]);
export async function GET(request:Request){const kind=new URL(request.url).searchParams.get("kind");if(!kind||!allowed.has(kind as Kind))return NextResponse.json({error:"Invalid content kind"},{status:400});const marketing=await publicMarketing();if(kind==="faqs")return json(await marketing.faqs());if(kind==="banners")return json(await marketing.banners("HOME"));if(kind==="featured")return json(await marketing.featured("HOME"));const content=await publicContent();if(kind==="blog-categories")return json(await content.categories());return json(await content.list(kind as "blog"|"landing"));}
function json(value:unknown){return NextResponse.json(value,{headers:{"cache-control":"public, max-age=60, stale-while-revalidate=300"}});}
