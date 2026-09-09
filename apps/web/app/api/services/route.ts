import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ServiceRequestRepository } from "../../../../../modules/services/infrastructure/D1ServiceRequestRepository";
import { ServiceRequest, SERVICE_CATALOG, type ServiceType } from "../../../../../modules/services/domain/ServiceRequest";

const last4 = (value: unknown) => { const v=String(value??"").replace(/\D/g,""); return v.length>=4?v.slice(-4):undefined; };

export async function GET(){
  try { const customerId=(await cookies()).get("customer_id")?.value; if(!customerId)return NextResponse.json({services:SERVICE_CATALOG,requests:[]}); const {env}=getCloudflareContext(); const repo=new D1ServiceRequestRepository(env.DB); return NextResponse.json({services:SERVICE_CATALOG,requests:(await repo.listForCustomer(customerId)).map(x=>x.toPrimitives())}); }
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load services"},{status:500});}
}

export async function POST(request:Request){
  try {
    const body=await request.json() as any; const email=String(body.email??"").trim().toLowerCase(); const customerId=(await cookies()).get("customer_id")?.value;
    const type=String(body.type??"") as ServiceType;
    if(!SERVICE_CATALOG.some(x=>x.type===type)) return NextResponse.json({error:"Invalid service type"},{status:400});
    if(type==="CARRIER_UNLOCK" && !String(body.carrier??"").trim()) return NextResponse.json({error:"Carrier is required"},{status:400});
    const {env}=getCloudflareContext(); const repo=new D1ServiceRequestRepository(env.DB);
    const service=ServiceRequest.create(crypto.randomUUID(),{customerId,email,type,deviceBrand:String(body.deviceBrand??"").trim(),deviceModel:String(body.deviceModel??"").trim(),deviceSerialLast4:last4(body.serial),imeiLast4:last4(body.imei),carrier:body.carrier?String(body.carrier).trim():undefined,problemDescription:String(body.problemDescription??"").trim(),customerNotes:body.customerNotes?String(body.customerNotes).trim():undefined,currency:"COP"});
    await repo.save(service); await repo.audit(service.getId(),"ServiceRequestCreated",{type,customerId:customerId??null,deviceBrand:service.toPrimitives().deviceBrand,deviceModel:service.toPrimitives().deviceModel,imeiProvided:Boolean(body.imei),serialProvided:Boolean(body.serial)});
    return NextResponse.json({request:service.toPrimitives()}, {status:201});
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid service request"},{status:400});}
}
