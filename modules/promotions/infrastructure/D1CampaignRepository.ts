import type { D1Database } from "@cloudflare/workers-types";
import type { CampaignRepository } from "../application/MarketingPorts";
import type { Campaign } from "../domain/Marketing";
export class D1CampaignRepository implements CampaignRepository{
 constructor(private readonly db:D1Database){}
 async list():Promise<readonly Campaign[]>{const r=await this.db.prepare("SELECT id,slug,name,description,starts_at AS startsAt,ends_at AS endsAt,active FROM marketing_campaigns ORDER BY starts_at DESC").all<Campaign & {active:number}>();return r.results.map(x=>({...x,active:x.active===1}));}
 async save(input:Campaign):Promise<void>{const r=await this.db.prepare("INSERT INTO marketing_campaigns(id,name,slug,description,starts_at,ends_at,active) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,updated_at=CURRENT_TIMESTAMP").bind(input.id,input.name,input.slug,input.description??null,input.startsAt,input.endsAt,input.active?1:0).run();if(r.meta.changes!==1)throw new Error("CAMPAIGN_NOT_SAVED");}
}
