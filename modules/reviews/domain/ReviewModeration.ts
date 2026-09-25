export type ReviewReportStatus = "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED";
export type ReviewModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReviewReport = Readonly<{ id:string; reviewId:string; customerId:string; reason:string; details?:string; status:ReviewReportStatus; resolvedBy?:string; resolvedAt?:string }>;

export function assertModerationTransition(from:ReviewModerationStatus,to:ReviewModerationStatus):void {
  const allowed:Record<ReviewModerationStatus,readonly ReviewModerationStatus[]> = {
    PENDING:["APPROVED","REJECTED"],
    APPROVED:["REJECTED"],
    REJECTED:["APPROVED"],
  };
  if(from===to || !allowed[from].includes(to)) throw new Error("INVALID_REVIEW_MODERATION_TRANSITION");
}
export function validateReport(reason:string,details?:string):void {
  if(!reason.trim() || reason.trim().length>200) throw new Error("INVALID_REVIEW_REPORT");
  if(details !== undefined && details.length>2000) throw new Error("INVALID_REVIEW_REPORT_DETAILS");
}
