import {NextResponse} from "next/server";
import {publicContent} from "../../../../../lib/publicContent";
const kinds=new Set(["page","blog","landing"]);
export async function GET(_request:Request,{params}:{params:Promise<{kind:string;slug:string}>}){const {kind,slug}=await params;if(!kinds.has(kind)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))return NextResponse.json({error:"Content not found"},{status:404});const row=await (await publicContent()).get(kind as "page"|"blog"|"landing",slug);if(!row)return NextResponse.json({error:"Content not found"},{status:404});return NextResponse.json(row,{headers:{"cache-control":"public, max-age=60, stale-while-revalidate=300"}});}
