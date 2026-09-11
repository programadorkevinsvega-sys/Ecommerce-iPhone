import { DomainError, Entity } from "../../shared-kernel";
import { ADMIN_ROLES, type AdminRole } from "./AdminRole";

export type AdminUserProps = Readonly<{ email:string; passwordHash:string; role:AdminRole; firstName:string; lastName:string; active:boolean; failedLoginCount:number; lockedUntil:string|undefined; lastLoginAt:string|undefined; createdAt:string; updatedAt:string }>;
type AdminUserCreateProps = Omit<AdminUserProps,"createdAt"|"updatedAt"|"lockedUntil"|"lastLoginAt"> & Partial<Pick<AdminUserProps,"createdAt"|"updatedAt"|"lockedUntil"|"lastLoginAt">>;

export class AdminUser extends Entity<string>{
 private constructor(id:string,private props:AdminUserProps){super(id);}
 static create(id:string,props:AdminUserCreateProps):AdminUser{
  const email=props.email.trim().toLowerCase();
  if(!email.includes("@")||email.length>254)throw new DomainError("INVALID_ADMIN_EMAIL","Valid admin email is required");
  if(!props.firstName.trim()||!props.lastName.trim())throw new DomainError("INVALID_ADMIN_NAME","Admin name is required");
  if(!props.passwordHash.trim())throw new DomainError("INVALID_PASSWORD_HASH","Password hash is required");
  if(!ADMIN_ROLES.includes(props.role))throw new DomainError("INVALID_ADMIN_ROLE","Invalid admin role");
  if(props.failedLoginCount<0)throw new DomainError("INVALID_FAILED_LOGIN_COUNT","Invalid failed login count");
  const now=new Date().toISOString();
  return new AdminUser(id,{...props,email,firstName:props.firstName.trim(),lastName:props.lastName.trim(),lockedUntil:props.lockedUntil,lastLoginAt:props.lastLoginAt,createdAt:props.createdAt??now,updatedAt:props.updatedAt??now});
 }
 get role():AdminRole{return this.props.role;} get active():boolean{return this.props.active;}
 recordSuccessfulLogin():void{this.props={...this.props,failedLoginCount:0,lockedUntil:undefined,lastLoginAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
 recordFailedLogin(lockMinutes=15,maxAttempts=5):void{const failed=this.props.failedLoginCount+1;this.props={...this.props,failedLoginCount:failed,lockedUntil:failed>=maxAttempts?new Date(Date.now()+lockMinutes*60_000).toISOString():this.props.lockedUntil,updatedAt:new Date().toISOString()};}
 activate():void{this.props={...this.props,active:true,updatedAt:new Date().toISOString()};}
 deactivate():void{this.props={...this.props,active:false,updatedAt:new Date().toISOString()};}
 changeRole(role:AdminRole):void{if(!ADMIN_ROLES.includes(role))throw new DomainError("INVALID_ADMIN_ROLE","Invalid admin role");this.props={...this.props,role,updatedAt:new Date().toISOString()};}
 toPrimitives():AdminUserProps&{id:string}{return{id:this.getId(),...this.props};}
}
