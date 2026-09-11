export type ReviewRepository = {
  list(status?: string, productId?: string, limit?: number, offset?: number): Promise<unknown[]>;
  moderate(id: string, status: "APPROVED" | "REJECTED", response?: string): Promise<boolean>;
};

export class AdminReviews {
  constructor(private readonly repository: ReviewRepository) {}
  list(status?: string, productId?: string, limit = 50, offset = 0) { if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) throw new Error("INVALID_REVIEW_STATUS"); return this.repository.list(status, productId?.trim() || undefined, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)); }
  moderate(id: string, status: "APPROVED" | "REJECTED", response?: string) { const value = response?.trim(); if (!id.trim() || !["APPROVED", "REJECTED"].includes(status) || (value && value.length > 2000)) throw new Error("INVALID_REVIEW_MODERATION"); return this.repository.moderate(id.trim(), status, value); }
}
