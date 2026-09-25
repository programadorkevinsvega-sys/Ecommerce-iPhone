import type { D1Database } from "@cloudflare/workers-types";
import type { ReviewModerationRepository } from "../application/ReviewModerationPorts";
import type { ReviewReport, ReviewModerationStatus } from "../domain/ReviewModeration";

export class D1ReviewModerationRepository implements ReviewModerationRepository {
 constructor(private readonly db:D1Database){}
 async getStatus(reviewId:string):Promise<ReviewModerationStatus|null>{
  const row=await this.db.prepare("SELECT status FROM product_reviews WHERE id=?").bind(reviewId).first<{status:ReviewModerationStatus}>();
  return row?.status??null;
 }
 async moderate(input:{reviewId:string;from:ReviewModerationStatus;to:ReviewModerationStatus;response?:string;adminUserId:string}):Promise<void>{
  const result=await this.db.batch([
   this.db.prepare("UPDATE product_reviews SET status=?,admin_response=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(input.to,input.response??null,input.reviewId,input.from),
   this.db.prepare("INSERT INTO review_moderation_events(id,review_id,admin_user_id,from_status,to_status,response) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),input.reviewId,input.adminUserId,input.from,input.to,input.response??null),
  ]);
  if(result[0]?.meta.changes!==1) throw new Error("REVIEW_MODERATION_CONFLICT");
 }
 async createReport(report:ReviewReport):Promise<void>{
  try{await this.db.prepare("INSERT INTO review_reports(id,review_id,customer_id,reason,details,status) VALUES(?,?,?,?,?,?)").bind(report.id,report.reviewId,report.customerId,report.reason,report.details??null,report.status).run();}
  catch{throw new Error("REVIEW_REPORT_ALREADY_EXISTS");}
 }
 async listReports(status?:ReviewReport["status"]){
  const r=status?await this.db.prepare("SELECT id,review_id AS reviewId,customer_id AS customerId,reason,details,status,resolved_by AS resolvedBy,resolved_at AS resolvedAt FROM review_reports WHERE status=? ORDER BY created_at DESC").bind(status).all():await this.db.prepare("SELECT id,review_id AS reviewId,customer_id AS customerId,reason,details,status,resolved_by AS resolvedBy,resolved_at AS resolvedAt FROM review_reports ORDER BY created_at DESC").all();
  return r.results as unknown as readonly ReviewReport[];
 }
 async resolveReport(input:{id:string;status:Exclude<ReviewReport["status"],"OPEN">;adminUserId:string}):Promise<void>{
  const result=await this.db.prepare("UPDATE review_reports SET status=?,resolved_by=?,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='OPEN'").bind(input.status,input.adminUserId,input.id).run();
  if(result.meta.changes!==1) throw new Error("REVIEW_REPORT_NOT_FOUND_OR_RESOLVED");
 }
}
