import { NextResponse } from "next/server";
import { CustomerAccountService } from "../../../../../../../modules/customers/application/CustomerAccountService";
import { commerceContext } from "../../../../../lib/commerce";

export async function POST(request:Request){try{const input=await request.json() as Record<string,unknown>;const context=await commerceContext();await new CustomerAccountService(context.customerRepository).resetPassword(input);return NextResponse.json({ok:true},{headers:{"cache-control":"no-store"}});}catch{return NextResponse.json({error:"El enlace no es válido o ya expiró."},{status:422,headers:{"cache-control":"no-store"}});}}
