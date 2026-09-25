import type { AuditPort } from "../../admin/application/AuditPort";
import { validateWindow,type Campaign } from "../domain/Marketing";
import type { CampaignRepository } from "./MarketingPorts";
export class AdminCampaigns{
 constructor(private readonly repo:CampaignRepository,private readonly audit:AuditPort){}
 list(){return this.repo.list();}
 async save(input:Omit<Campaign,"id"> & {id?:string},adminId:string){const name=input.name.trim(),slug=input.slug.trim().toLowerCase();if(!name||name.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)||slug.length>120)throw new Error("INVALID_CAMPAIGN");validateWindow(input.startsAt,input.endsAt);const campaign:Campaign={id:input.id?.trim()||crypto.randomUUID(),name,slug,startsAt:input.startsAt,endsAt:input.endsAt,active:input.active,...(input.description?.trim()?{description:input.description.trim()}: {})};await this.repo.save(campaign);await this.audit.audit(adminId,"ADMIN_CAMPAIGN_SAVED","campaign",campaign.id,{slug});return campaign.id;} async setActive(id:string,active:boolean,adminId:string){const campaign=(await this.repo.list()).find(x=>x.id===id);if(!campaign)throw new Error("CAMPAIGN_NOT_FOUND");await this.repo.save({...campaign,active});await this.audit.audit(adminId,"ADMIN_CAMPAIGN_ACTIVE_CHANGED","campaign",id,{active});}
}