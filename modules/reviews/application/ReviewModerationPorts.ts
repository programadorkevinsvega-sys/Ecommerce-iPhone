import type { ReviewReport, ReviewModerationStatus } from "../domain/ReviewModeration";

export interface ReviewModerationRepository {
  getStatus(reviewId:string):Promise<ReviewModerationStatus|null>;
  moderate(input:{reviewId:string;from:ReviewModerationStatus;to:ReviewModerationStatus;response?:string;adminUserId:string}):Promise<void>;
  createReport(report:ReviewReport):Promise<void>;
  listReports(status?:ReviewReport["status"]):Promise<readonly ReviewReport[]>;
  resolveReport(input:{id:string;status:Exclude<ReviewReport["status"],"OPEN">;adminUserId:string}):Promise<void>;
}
