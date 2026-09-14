import { cookies } from "next/headers";
import { commerceContext } from "./commerce";

export async function authenticatedCustomer(){ const token=(await cookies()).get("customer_session")?.value; if(!token)return null; const context=await commerceContext(); const session=await context.customerSession.resolve(token); if(!session)return null; const customer=await context.customerRepository.findAccountById(session.customerId); return customer?{context,session,customer}:null; }
export function customerCookie(response:Response,token:string){(response as any).cookies.set("customer_session",token,{httpOnly:true,sameSite:"lax",secure:true,path:"/",maxAge:60*60*24*30});}
