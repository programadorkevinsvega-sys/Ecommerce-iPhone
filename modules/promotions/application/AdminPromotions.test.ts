import { describe, expect, it, vi } from "vitest";
import { AdminPromotions, type PromotionRepository } from "./AdminPromotions";
import type { AuditPort } from "../../admin/application/AuditPort";

function setup() {
  const repository: PromotionRepository = {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue("promotion-1"),
    setActive: vi.fn().mockResolvedValue(true),
  };
  const audit: AuditPort = { audit: vi.fn().mockResolvedValue(undefined) };
  return { repository, audit, service: new AdminPromotions(repository, audit) };
}

describe("AdminPromotions", () => {
  it("audits a real promotion mutation with the actor", async () => {
    const context = setup();
    const id = await context.service.save(
      {
        code: "IPHONE10",
        name: "iPhone 10",
        discountType: "PERCENT",
        discountValue: 10,
        minSubtotalInCents: 0,
        maxUses: null,
        maxUsesPerCustomer: null,
        startsAt: "2026-09-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
        active: true,
        productIds: [],
        categoryIds: [],
      },
      "admin-1",
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(context.audit.audit).toHaveBeenCalledWith(
      "admin-1",
      "ADMIN_PROMOTION_SAVED",
      "promotion",
      id,
      { code: "IPHONE10" },
    );
  });

  it("audits activation changes", async () => {
    const context = setup();
    await context.service.setActive("promotion-1", true, "admin-1");
    expect(context.audit.audit).toHaveBeenCalledWith("admin-1", "ADMIN_PROMOTION_ACTIVATED", "promotion", "promotion-1", { active: true });
  });
});