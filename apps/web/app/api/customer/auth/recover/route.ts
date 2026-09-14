import { NextResponse } from "next/server";
import { CustomerAccountService } from "../../../../../../../modules/customers/application/CustomerAccountService";
import { commerceContext } from "../../../../../lib/commerce";
import { publishNotificationEvent } from "../../../../../lib/notifications";

export async function POST(request:Request){try{const input=await request.json() as Record<string,unknown>;const context=await commerceContext();const reset=await new CustomerAccountService(context.customerRepository).requestPasswordReset(input);if(reset){const origin=new URL(request.url).origin;await publishNotificationEvent({id:crypto.randomUUID(),eventType:"CustomerPasswordResetRequested",aggregateId:reset.email,payload:{email:reset.email,resetUrl:`${origin}/cuenta/recuperar?token=${encodeURIComponent(reset.token)}`,expiresInMinutes:30}});}}catch{}return NextResponse.json({message:"Si la cuenta existe, recibirás instrucciones para recuperar el acceso."},{headers:{"cache-control":"no-store"}});}
