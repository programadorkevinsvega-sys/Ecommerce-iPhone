import type { AuditPort } from "../../admin/application/AuditPort";
import { assertModerationTransition, validateReport, type ReviewModerationStatus, type ReviewReport, type ReviewReportStatus } from "../domain/ReviewModeration";
import type { ReviewModerationRepository } from "./ReviewModerationPorts";

export class ReviewModeration {
 constructor(private readonly repository:ReviewModerationRepository,private readonly audit:AuditPort){}
 async report(input:{reviewId:string;customerId:string;reason:string;details?:string}):Promise<string>{
  if(!input.reviewId.trim()||!input.customerId.trim()) throw new Error("INVALID_REVIEW_REPORT");
  validateReport(input.reason,input.details);
  const report:ReviewReport={id:crypto.randomUUID(),reviewId:input.reviewId.trim(),customerId:input.customerId.trim(),reason:input.reason.trim(),...(input.details?.trim()?{details:input.details.trim()}:{}),status:"OPEN"};
  await this.repository.createReport(report);
  await this.audit.audit(report.customerId,"CUSTOMER_REVIEW_REPORTED","product_review",report.reviewId,{reportId:report.id});
  return report.id;
 }
 async moderate(input:{reviewId:string;to:ReviewModerationStatus;response?:string;adminUserId:string}):Promise<void>{
  const current=await this.repository.getStatus(input.reviewId);
  if(!current) throw new Error("REVIEW_NOT_FOUND");
  assertModerationTransition(current,input.to);
  if(input.response!==undefined&&input.response.trim().length>2000) throw new Error("INVALID_REVIEW_MODERATION");
  await this.repository.moderate({reviewId:input.reviewId,from:current,to:input.to,adminUserId:input.adminUserId,...(input.response?.trim()?{response:input.response.trim()}: {})});
  await this.audit.audit(input.adminUserId,"ADMIN_REVIEW_MODERATION_TRANSITION","product_review",input.reviewId,{from:current,to:input.to});
 }
 async listReports(status?:ReviewReportStatus){return this.repository.listReports(status);}
 async resolveReport(input:{id:string;status:Exclude<ReviewReportStatus,"OPEN">;adminUserId:string}){
  await this.repository.resolveReport(input);
  await this.audit.audit(input.adminUserId,"ADMIN_REVIEW_REPORT_RESOLVED","review_report",input.id,{status:input.status});
 }
}
