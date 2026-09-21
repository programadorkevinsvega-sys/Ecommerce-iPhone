import { describe, expect, it, vi } from "vitest";
import { AdminReviews, type ReviewRepository } from "./AdminReviews";
import type { AuditPort } from "../../admin/application/AuditPort";

function setup() {
  const repository: ReviewRepository = {
    list: vi.fn().mockResolvedValue([]),
    moderate: vi.fn().mockResolvedValue(true),
  };
  const audit: AuditPort = { audit: vi.fn().mockResolvedValue(undefined) };
  return { repository, audit, service: new AdminReviews(repository, audit) };
}

describe("AdminReviews", () => {
  it("audits moderation inside the application layer", async () => {
    const context = setup();
    await context.service.moderate("review-1", "APPROVED", "Valid purchase", "admin-1");
    expect(context.audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_REVIEW_MODERATED", "product_review", "review-1", { status: "APPROVED" });
  });

  it("rejects invalid moderation without touching the repository", async () => {
    const context = setup();
    await expect(context.service.moderate("", "APPROVED", undefined, "admin-1")).rejects.toThrow("INVALID_REVIEW_MODERATION");
    expect(context.repository.moderate).not.toHaveBeenCalled();
  });
});