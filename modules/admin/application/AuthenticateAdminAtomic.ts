import type { AdminRole } from "../domain/AdminRole";
import type { AdminRepository } from "./AdminRepository";
import type { AdminSessionRepository } from "./AdminSessionRepository";
import type { PasswordHasher } from "./PasswordHasher";
import type { AuditPort } from "./AuditPort";
import type { CreateAdminSession } from "./CreateAdminSession";

export type AdminPrincipal = Readonly<{ id:string; email:string; role:AdminRole; firstName:string; lastName:string }>;
export type AuthenticationResult = Readonly<{ admin:AdminPrincipal; token:string; expiresAt:Date }>;
function token():string{return crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");}

export class AuthenticateAdminAtomic {
  constructor(private readonly admins:AdminRepository,private readonly sessions:AdminSessionRepository,private readonly passwords:PasswordHasher,private readonly audit:AuditPort,private readonly createSession:CreateAdminSession,private readonly now:()=>Date=()=>new Date()){}
  async execute(emailInput:string,password:string,ipHash?:string,userAgentHash?:string):Promise<AuthenticationResult>{
    const email=emailInput.trim().toLowerCase();if(!email||!password)throw new Error("INVALID_CREDENTIALS");
    const user=await this.admins.findByEmail(email);
    if(!user){await this.audit.audit("","ADMIN_LOGIN_FAILED","admin_user",null,{reason:"invalid_credentials",email,ipHash:ipHash??null});throw new Error("INVALID_CREDENTIALS");}
    const current=user.toPrimitives(),now=this.now();
    if(current.lockedUntil&&new Date(current.lockedUntil).getTime()>now.getTime())throw new Error("ACCOUNT_LOCKED");
    if(!(await this.passwords.verify(password,current.passwordHash))){
      const state=await this.admins.recordFailedLogin(user.getId(),now,5,15);
      await this.audit.audit(user.getId(),"ADMIN_LOGIN_FAILED","admin_user",user.getId(),{reason:"invalid_credentials",failedLoginCount:state.failedLoginCount,lockedUntil:state.lockedUntil??null,ipHash:ipHash??null});
      if(state.lockedUntil)throw new Error("ACCOUNT_LOCKED");
      throw new Error("INVALID_CREDENTIALS");
    }
    await this.admins.recordSuccessfulLogin(user.getId(),now);
    await this.sessions.revokeAll(user.getId());
    const sessionToken=token(),expiresAt=new Date(now.getTime()+8*86_400_000);
    await this.createSession.execute(user.getId(),sessionToken,expiresAt,ipHash,userAgentHash);
    await this.audit.audit(user.getId(),"ADMIN_LOGIN_SUCCESS","admin_user",user.getId(),{role:current.role,ipHash:ipHash??null});
    return {admin:{id:current.id,email:current.email,role:current.role,firstName:current.firstName,lastName:current.lastName},token:sessionToken,expiresAt};
  }
}
