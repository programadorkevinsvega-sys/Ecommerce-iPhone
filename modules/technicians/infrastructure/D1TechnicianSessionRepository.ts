import type { D1Database } from "@cloudflare/workers-types";
import type { TechnicianSessionRepository } from "../application/TechnicianSessionRepository";
import { TechnicianUser } from "../domain/TechnicianUser";

export class D1TechnicianSessionRepository implements TechnicianSessionRepository {
  constructor(private readonly db:D1Database){}
  async create(userId:string,tokenHash:string,expiresAt:string,ipHash?:string,userAgentHash?:string){const id=crypto.randomUUID();await this.db.prepare("INSERT INTO technician_sessions(id,technician_user_id,token_hash,expires_at,ip_hash,user_agent_hash) VALUES(?,?,?,?,?,?)").bind(id,userId,tokenHash,expiresAt,ipHash??null,userAgentHash??null).run();return id;}
  async findByTokenHash(tokenHash:string){const row=await this.db.prepare("SELECT s.id AS session_id,t.* FROM technician_sessions s JOIN technician_users t ON t.id=s.technician_user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND t.active=1 LIMIT 1").bind(tokenHash).first<Record<string,unknown>>();if(!row)return null;return {sessionId:String(row.session_id),user:TechnicianUser.create(String(row.id),{email:String(row.email),passwordHash:String(row.password_hash),firstName:String(row.first_name),lastName:String(row.last_name),...(row.phone?{phone:String(row.phone)}:{}),active:Number(row.active)===1,failedLoginCount:Number(row.failed_login_count??0),...(row.locked_until?{lockedUntil:String(row.locked_until)}:{}),...(row.last_login_at?{lastLoginAt:String(row.last_login_at)}:{}),createdAt:String(row.created_at),updatedAt:String(row.updated_at)})};}
  async revoke(sessionId:string){await this.db.prepare("UPDATE technician_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL").bind(sessionId).run();}
  async revokeAll(userId:string){await this.db.prepare("UPDATE technician_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE technician_user_id=? AND revoked_at IS NULL").bind(userId).run();}
}
