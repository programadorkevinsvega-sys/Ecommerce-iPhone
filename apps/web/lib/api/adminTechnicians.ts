import { getCloudflareContext } from "@opennextjs/cloudflare";
import { technicianManagementApplication } from "../../../../modules/technicians/infrastructure/D1TechnicianComposition";
import { PERMISSIONS, requireAdmin } from "../adminAuth";

export async function listTechnicians(){
  await requireAdmin(PERMISSIONS.techniciansManage);
  const {env}=getCloudflareContext();
  return technicianManagementApplication(env).list();
}
export async function createTechnician(body:Record<string,unknown>){
  const {admin,env}=await requireAdmin(PERMISSIONS.techniciansManage);
  return technicianManagementApplication(env).create(body,admin.id);
}
export async function updateTechnician(body:Record<string,unknown>){
  const {admin,env}=await requireAdmin(PERMISSIONS.techniciansManage);
  return technicianManagementApplication(env).update(body,admin.id);
}
