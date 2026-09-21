export type ReviewRepository = {
  list(status?: string, productId?: string, limit?: number, offset?: number): Promise<unknown[]>;
  moderate(id: string, status: "APPROVED" | "REJECTED", response?: string): Promise<boolean>;
};

import type { AuditPort } from "../../admin/application/AuditPort";

export class AdminReviews {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly audit: AuditPort,
  ) {}

  list(status?: string, productId?: string, limit = 50, offset = 0) {
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) throw new Error("INVALID_REVIEW_STATUS");
    return this.repository.list(status, productId?.trim() || undefined, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));
  }

  async moderate(id: string, status: "APPROVED" | "REJECTED", response: string | undefined, adminUserId: string): Promise<boolean> {
    const value = response?.trim();
    if (!id.trim() || !["APPROVED", "REJECTED"].includes(status) || (value && value.length > 2000)) throw new Error("INVALID_REVIEW_MODERATION");
    const reviewId = id.trim();
    const updated = await this.repository.moderate(reviewId, status, value);
    await this.audit.audit(adminUserId, "ADMIN_REVIEW_MODERATED", "product_review", reviewId, { status });
    return updated;
  }
}
