import { AdminUser } from "../domain/AdminUser";
import type { AdminRole } from "../domain/AdminRole";
import { ADMIN_ROLES } from "../domain/AdminRole";

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  list(): Promise<ReadonlyArray<AdminUser>>;
  countActiveSuperAdmins(): Promise<number>;
  save(user: AdminUser): Promise<void>;
  saveSuperAdminTransition(user: AdminUser, expectedActive: boolean): Promise<boolean>;
}
export interface PasswordHasher { hash(password: string): Promise<string>; }
export interface SessionRepository { revokeAllSessions(adminUserId: string): Promise<void>; }
export interface AuditPort { audit(adminUserId: string, action: string, resourceType: string, resourceId: string | null, payload: unknown): Promise<void>; }
export type AdminUserListItem = Readonly<{ id:string; email:string; role:AdminRole; firstName:string; lastName:string; active:boolean; failedLoginCount:number; lockedUntil:string|undefined; lastLoginAt:string|undefined; createdAt:string; updatedAt:string }>;
function requireString(value: unknown,error:string): string { const v=String(value??"").trim(); if(!v) throw new Error(error); return v; }
function parseRole(value: unknown,fallback:AdminRole="ADMIN"): AdminRole { const role=String(value??fallback).trim() as AdminRole; if(!ADMIN_ROLES.includes(role)) throw new Error("INVALID_ROLE"); return role; }
function toListItem(user:AdminUser):AdminUserListItem { const v=user.toPrimitives(); return {id:v.id,email:v.email,role:v.role,firstName:v.firstName,lastName:v.lastName,active:v.active,failedLoginCount:v.failedLoginCount,lockedUntil:v.lockedUntil,lastLoginAt:v.lastLoginAt,createdAt:v.createdAt,updatedAt:v.updatedAt}; }

export class AdminUserManagement {
  constructor(private readonly users:AdminUserRepository,private readonly passwords:PasswordHasher,private readonly sessions:SessionRepository,private readonly audit:AuditPort){}
  async list(){ return (await this.users.list()).map(toListItem); }
  async create(input:Record<string,unknown>,actorId:string){
    const actor=await this.requireActor(actorId); const email=requireString(input.email,"INVALID_ADMIN_DATA").toLowerCase(); const password=requireString(input.password,"INVALID_ADMIN_DATA");
    const firstName=requireString(input.firstName,"INVALID_ADMIN_DATA"); const lastName=requireString(input.lastName,"INVALID_ADMIN_DATA"); const role=parseRole(input.role);
    if(await this.users.findByEmail(email)) throw new Error("ADMIN_ALREADY_EXISTS");
    const user=AdminUser.create(crypto.randomUUID(),{email,passwordHash:await this.passwords.hash(password),role,firstName,lastName,active:true,failedLoginCount:0});
    await this.users.save(user); await this.audit.audit(actor.getId(),"ADMIN_USER_CREATED","admin_user",user.getId(),{email,role}); return user.getId();
  }
  async update(input:Record<string,unknown>,actorId:string){
    const actor=await this.requireActor(actorId); const id=requireString(input.id,"ID_REQUIRED"); const user=await this.requireTarget(id); const current=user.toPrimitives();
    if(current.role==="TECHNICIAN") throw new Error("LEGACY_TECHNICIAN_ACCOUNT");
    const role=input.role===undefined?current.role:parseRole(input.role); const active=input.active===undefined?current.active:input.active===true;
    if(id===actor.getId()&&!active) throw new Error("SELF_DEACTIVATION_FORBIDDEN"); if(id===actor.getId()&&role!==actor.role) throw new Error("ADMIN_SELF_ROLE_CHANGE_FORBIDDEN");
    let passwordHash=current.passwordHash; if(typeof input.password==="string"&&input.password.length>0) passwordHash=await this.passwords.hash(input.password);
    const email=input.email===undefined?current.email:requireString(input.email,"INVALID_ADMIN_DATA").toLowerCase();
    if(email!==current.email){const existing=await this.users.findByEmail(email); if(existing&&existing.getId()!==id) throw new Error("ADMIN_ALREADY_EXISTS");}
    const next=AdminUser.create(current.id,{...current,email,firstName:input.firstName===undefined?current.firstName:requireString(input.firstName,"INVALID_ADMIN_DATA"),lastName:input.lastName===undefined?current.lastName:requireString(input.lastName,"INVALID_ADMIN_DATA"),role,active,passwordHash});
    if(current.role==="SUPER_ADMIN"&&current.active&&(role!=="SUPER_ADMIN"||!active)){if(!await this.users.saveSuperAdminTransition(next,true)) throw new Error("LAST_SUPER_ADMIN_PROTECTED");} else await this.users.save(next);
    if(passwordHash!==current.passwordHash||role!==current.role||active!==current.active) await this.sessions.revokeAllSessions(id);
    await this.audit.audit(actor.getId(),"ADMIN_USER_UPDATED","admin_user",id,{fields:Object.keys(input).filter(f=>f!=="password")});
  }
  async activate(targetId:string,actorId:string){const actor=await this.requireActor(actorId);const target=await this.requireTarget(targetId);if(target.role==="TECHNICIAN") throw new Error("LEGACY_TECHNICIAN_ACCOUNT");target.activate();await this.users.save(target);await this.audit.audit(actor.getId(),"ADMIN_ACTIVATED","admin_user",target.getId(),{role:target.role});}
  async deactivate(targetId:string,actorId:string){
    const actor=await this.requireActor(actorId);const target=await this.requireTarget(targetId);if(target.getId()===actor.getId()) throw new Error("SELF_DEACTIVATION_FORBIDDEN");
    const current=target.toPrimitives();target.deactivate();
    if(current.role==="SUPER_ADMIN"&&current.active){if(!await this.users.saveSuperAdminTransition(target,true)) throw new Error("LAST_SUPER_ADMIN_PROTECTED");} else await this.users.save(target);
    await this.sessions.revokeAllSessions(target.getId()); await this.audit.audit(actor.getId(),"ADMIN_DEACTIVATED","admin_user",target.getId(),{role:target.role});
  }
  async changeRole(targetId:string,roleInput:unknown,actorId:string){
    const actor=await this.requireActor(actorId);const target=await this.requireTarget(targetId);if(target.role==="TECHNICIAN") throw new Error("LEGACY_TECHNICIAN_ACCOUNT");const role=parseRole(roleInput,target.role);if(target.getId()===actor.getId()) throw new Error("ADMIN_SELF_ROLE_CHANGE_FORBIDDEN");if(target.role===role)return;
    const previousRole=target.role;const wasActive=target.active;target.changeRole(role);
    if(previousRole==="SUPER_ADMIN"&&wasActive&&role!=="SUPER_ADMIN"){if(!await this.users.saveSuperAdminTransition(target,true)) throw new Error("LAST_SUPER_ADMIN_PROTECTED");} else await this.users.save(target);
    await this.sessions.revokeAllSessions(target.getId());await this.audit.audit(actor.getId(),"ADMIN_ROLE_CHANGED","admin_user",target.getId(),{previousRole,role});
  }
  async resetPassword(targetId:string,password:string,actorId:string){const actor=await this.requireActor(actorId);const target=await this.requireTarget(targetId);if(target.role==="TECHNICIAN") throw new Error("LEGACY_TECHNICIAN_ACCOUNT");const value=requireString(password,"INVALID_PASSWORD");const current=target.toPrimitives();const passwordHash=await this.passwords.hash(value);await this.users.save(AdminUser.create(current.id,{...current,passwordHash}));await this.sessions.revokeAllSessions(target.getId());await this.audit.audit(actor.getId(),"ADMIN_PASSWORD_RESET","admin_user",target.getId(),{});}
  private async requireActor(id:string){const actorId=id.trim();if(!actorId)throw new Error("ADMIN_NOT_FOUND");const actor=await this.users.findById(actorId);if(!actor||!actor.active)throw new Error("ADMIN_NOT_FOUND");return actor;}
  private async requireTarget(id:string){const target=await this.users.findById(id.trim());if(!target)throw new Error("ADMIN_NOT_FOUND");return target;}
}
