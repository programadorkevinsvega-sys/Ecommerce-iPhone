import type { ReviewReportStatus, ReviewModerationStatus } from "../domain/ReviewModeration";

export type { ReviewReportStatus, ReviewModerationStatus };
export const REVIEW_REPORT_STATUSES: readonly ReviewReportStatus[] = [
  "OPEN","REVIEWED","DISMISSED","ACTIONED",
];
export const REVIEW_REPORT_RESOLUTION_STATUSES: readonly Exclude<ReviewReportStatus, "OPEN">[] = [
  "REVIEWED","DISMISSED","ACTIONED",
];
