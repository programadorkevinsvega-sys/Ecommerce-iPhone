import type { D1Database } from "@cloudflare/workers-types";
import type { ReviewModerationRepository } from "../application/ReviewModerationPorts";
import type { ReviewReport, ReviewModerationStatus } from "../domain/ReviewModeration";

type ReportRow={id:string;reviewId:string;customerId:string;reason:string;details:string|null;status:ReviewReport["status"];resolvedBy:string|null;resolvedAt:string|null};

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
  const result=await this.db.prepare("INSERT INTO review_reports(id,review_id,customer_id,reason,details,status) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM product_reviews WHERE id=?) AND NOT EXISTS (SELECT 1 FROM review_reports WHERE review_id=? AND customer_id=?) AND (SELECT COUNT(*) FROM review_reports WHERE customer_id=? AND created_at>=datetime('now','-1 hour'))<5").bind(report.id,report.reviewId,report.customerId,report.reason,report.details??null,report.status,report.reviewId,report.reviewId,report.customerId,report.customerId).run();
  if(result.meta.changes!==1){
   const review=await this.getStatus(report.reviewId);
   if(!review) throw new Error("REVIEW_NOT_FOUND");
   const duplicate=await this.db.prepare("SELECT 1 FROM review_reports WHERE review_id=? AND customer_id=? LIMIT 1").bind(report.reviewId,report.customerId).first();
   if(duplicate) throw new Error("REVIEW_REPORT_ALREADY_EXISTS");
   throw new Error("REVIEW_REPORT_RATE_LIMIT");
  }
 }
 async listReports(status?:ReviewReport["status"]):Promise<readonly ReviewReport[]>{
  const r=status?await this.db.prepare("SELECT id,review_id AS reviewId,customer_id AS customerId,reason,details,status,resolved_by AS resolvedBy,resolved_at AS resolvedAt FROM review_reports WHERE status=? ORDER BY created_at DESC").bind(status).all<ReportRow>():await this.db.prepare("SELECT id,review_id AS reviewId,customer_id AS customerId,reason,details,status,resolved_by AS resolvedBy,resolved_at AS resolvedAt FROM review_reports ORDER BY created_at DESC").all<ReportRow>();
  return r.results.map(x=>({id:x.id,reviewId:x.reviewId,customerId:x.customerId,reason:x.reason,...(x.details!==null?{details:x.details}:{}),status:x.status,...(x.resolvedBy!==null?{resolvedBy:x.resolvedBy}:{}),...(x.resolvedAt!==null?{resolvedAt:x.resolvedAt}:{})}));
 }
 async resolveReport(input:{id:string;status:Exclude<ReviewReport["status"],"OPEN">;adminUserId:string}):Promise<void>{
  const result=await this.db.prepare("UPDATE review_reports SET status=?,resolved_by=?,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='OPEN'").bind(input.status,input.adminUserId,input.id).run();
  if(result.meta.changes!==1) throw new Error("REVIEW_REPORT_NOT_FOUND_OR_RESOLVED");
 }
}
