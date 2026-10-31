import { NextResponse } from "next/server";
import { adminSettingsApplication } from "../../../../lib/adminApplication";
import { PERMISSIONS,requireAdmin,requireAdminStepUp } from "../../../../lib/adminAuth";

export async function GET(){try{const{env}=await requireAdmin(PERMISSIONS.settingsWrite);const items=await adminSettingsApplication(env).list();return NextResponse.json({items:(items as any[]).map(x=>x.sensitive?{...x,valueJson:"[REDACTED]"}:x)},{headers:{"cache-control":"no-store"}})}catch(e){return error(e)}}
export async function PUT(request:Request){try{const{env,admin}=await requireAdminStepUp(PERMISSIONS.settingsWrite,"settings:write");const body=await request.json() as any;const ok=await adminSettingsApplication(env).save({key:String(body.key??""),value:body.value,sensitive:body.sensitive===true},admin.id);return NextResponse.json({updated:ok})}catch(e){return error(e)}}
function error(e:unknown){const c=e instanceof Error?e.message:"UNKNOWN";const s=c==="ADMIN_STEP_UP_REQUIRED"?428:c==="UNAUTHORIZED"?401:c==="FORBIDDEN"?403:400;const message=s===428?"Vuelve a confirmar tu contraseña para autorizar esta operación.":s===401?"Authentication required":s===403?"Forbidden":"No se pudo guardar la configuración.";return NextResponse.json({error:message},{status:s})}
