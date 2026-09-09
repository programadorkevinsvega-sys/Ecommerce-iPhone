import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ServiceRequestRepository } from "../../../../../../modules/services/infrastructure/D1ServiceRequestRepository";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{const customerId=(await cookies()).get("customer_id")?.value; if(!customerId)return NextResponse.json({error:"Authentication required"},{status:401}); const {id}=await params; const {env}=getCloudflareContext(); const repo=new D1ServiceRequestRepository(env.DB); const item=await repo.findById(id); if(!item)return NextResponse.json({error:"Service request not found"},{status:404}); const p=item.toPrimitives(); if(p.customerId!==customerId)return NextResponse.json({error:"Not found"},{status:404}); return NextResponse.json({request:p});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load request"},{status:500});}
}
