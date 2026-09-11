import type { D1Database } from "@cloudflare/workers-types";
import type { AdminSettingInput,SettingsRepository } from "../application/AdminSettings";
export class D1AdminSettingsRepository implements SettingsRepository{
 constructor(private readonly db:D1Database){}
 async list(){return(await this.db.prepare("SELECT key,value_json AS valueJson,sensitive,updated_by AS updatedBy,updated_at AS updatedAt FROM admin_settings ORDER BY key ASC").all()).results;}
 async save(input:AdminSettingInput,adminUserId:string){const r=await this.db.prepare(`INSERT INTO admin_settings(key,value_json,sensitive,updated_by) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,sensitive=excluded.sensitive,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(input.key,JSON.stringify(input.value),input.sensitive===true?1:0,adminUserId).run();if(r.meta.changes!==1)throw new Error("SETTING_NOT_SAVED");return true;}
}
