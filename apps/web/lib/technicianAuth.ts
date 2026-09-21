import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../../../modules/admin/infrastructure/AdminSecurity";
import { technicianAuthApplication } from "../../../modules/technicians/infrastructure/D1TechnicianComposition";

export const TECHNICIAN_COOKIE="technician_session";
export async function currentTechnician(){const token=(await cookies()).get(TECHNICIAN_COOKIE)?.value;const {env}=getCloudflareContext();return technicianAuthApplication(env).resolve(token);}
export async function requireTechnician(){const technician=await currentTechnician();if(!technician)throw new Error("UNAUTHORIZED");const {env}=getCloudflareContext();return{technician,env};}
export async function technicianRequestFingerprint(){const h=await headers();const ip=h.get("CF-Connecting-IP")??h.get("X-Forwarded-For")??"unknown";const userAgent=h.get("User-Agent")??"unknown";return{ipHash:await sha256(ip),userAgentHash:await sha256(userAgent)};}
export async function setTechnicianSession(token:string,expires:Date){(await cookies()).set(TECHNICIAN_COOKIE,token,{httpOnly:true,secure:true,sameSite:"strict",path:"/",expires});}
export async function clearTechnicianSession(){(await cookies()).set(TECHNICIAN_COOKIE,"",{httpOnly:true,secure:true,sameSite:"strict",path:"/",expires:new Date(0)});}
export async function logoutTechnician(){const technician=await currentTechnician();const token=(await cookies()).get(TECHNICIAN_COOKIE)?.value;if(technician){const {env}=getCloudflareContext();const fp=await technicianRequestFingerprint();await technicianAuthApplication(env).logout(technician.id,token,fp.ipHash);}await clearTechnicianSession();}
