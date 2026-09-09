import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1ServiceRequestRepository } from "../../../../../modules/services/infrastructure/D1ServiceRequestRepository";
import { D1ServiceTypeRepository } from "../../../../../modules/services/infrastructure/D1ServiceTypeRepository";
import { ServiceRequest } from "../../../../../modules/services/domain/ServiceRequest";

const last4 = (value: unknown) => { const v=String(value??"").replace(/\D/g,""); return v.length>=4?v.slice(-4):undefined; };

export async function GET(){
  try {
    const customerId=(await cookies()).get("customer_id")?.value;
    const {env}=getCloudflareContext();
    const typesRepo=new D1ServiceTypeRepository(env.DB);
    const types=(await typesRepo.listEnabled()).map(x=>x.toPrimitives());
    if(!customerId)return NextResponse.json({services:types,requests:[]});
    const repo=new D1ServiceRequestRepository(env.DB);
    return NextResponse.json({services:types,requests:(await repo.listForCustomer(customerId)).map(x=>x.toPrimitives())});
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load services"},{status:500});}
}

export async function POST(request:Request){
  try {
    const body=await request.json() as Record<string,unknown>;
    const email=String(body.email??"").trim().toLowerCase();
    const customerId=(await cookies()).get("customer_id")?.value;
    const type=String(body.type??"").trim().toUpperCase();
    const {env}=getCloudflareContext();
    const typesRepo=new D1ServiceTypeRepository(env.DB);
    const definition=await typesRepo.findByCode(type);
    if(!definition || !definition.toPrimitives().enabled) return NextResponse.json({error:"Service type is not available"},{status:400});
    const policy=definition.toPrimitives().workflow;
    const carrier=body.carrier?String(body.carrier).trim():undefined;
    if(type==="CARRIER_UNLOCK" && !carrier) return NextResponse.json({error:"Carrier is required"},{status:400});
    const service=ServiceRequest.create(crypto.randomUUID(),{customerId,email,type,deviceBrand:String(body.deviceBrand??"").trim(),deviceModel:String(body.deviceModel??"").trim(),deviceSerialLast4:last4(body.serial),imeiLast4:last4(body.imei),carrier,problemDescription:String(body.problemDescription??"").trim(),customerNotes:body.customerNotes?String(body.customerNotes).trim():undefined,currency:"COP"});
    if(policy.customerOwnershipProofRequired && !service.toPrimitives().imeiLast4 && !service.toPrimitives().deviceSerialLast4) return NextResponse.json({error:"Device ownership information is required for this service"},{status:400});
    const repo=new D1ServiceRequestRepository(env.DB);
    await repo.save(service);
    await repo.audit(service.getId(),"ServiceRequestCreated",{type,customerId:customerId??null,deviceBrand:service.toPrimitives().deviceBrand,deviceModel:service.toPrimitives().deviceModel,imeiProvided:Boolean(body.imei),serialProvided:Boolean(body.serial),policy:{quoteRequired:policy.quoteRequired,paymentRequired:policy.paymentRequired,technicianApprovalRequired:policy.technicianApprovalRequired,adminApprovalRequired:policy.adminApprovalRequired}});
    return NextResponse.json({request:service.toPrimitives(),serviceType:definition.toPrimitives()}, {status:201});
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid service request"},{status:400});}
}
