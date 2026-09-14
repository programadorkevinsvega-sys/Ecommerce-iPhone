import { NextResponse } from "next/server";
import { CustomerAccountService } from "../../../../../../modules/customers/application/CustomerAccountService";
import { authenticatedCustomer } from "../../../../lib/customerAccount";

export async function PATCH(request:Request){try{const current=await authenticatedCustomer();if(!current)return NextResponse.json({error:"Inicia sesión para continuar."},{status:401});const input=await request.json() as Record<string,unknown>;const customer=await new CustomerAccountService(current.context.customerRepository).profile(current.session.customerId,input);return NextResponse.json({customer},{headers:{"cache-control":"no-store"}});}catch(error){const code=error instanceof Error?error.message:"";return NextResponse.json({error:code==="CUSTOMER_NOT_FOUND"?"No encontramos tu cuenta.":"Revisa los datos ingresados e inténtalo nuevamente."},{status:code==="CUSTOMER_NOT_FOUND"?404:422,headers:{"cache-control":"no-store"}});}}
