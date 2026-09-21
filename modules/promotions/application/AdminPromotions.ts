export type PromotionInput = Readonly<{
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minSubtotalInCents?: number;
  maxUses?: number | null;
  startsAt: string;
  endsAt: string;
  active?: boolean;
}>;

export type PromotionRepository = {
  list(): Promise<unknown[]>;
  save(input: PromotionInput, id?: string): Promise<string>;
  setActive(id: string, active: boolean): Promise<boolean>;
};

import type { AuditPort } from "../../admin/application/AuditPort";

export class AdminPromotions {
  constructor(
    private readonly repository: PromotionRepository,
    private readonly audit: AuditPort,
  ) {}

  list() {
    return this.repository.list();
  }

  async save(input: PromotionInput, id: string | undefined, adminUserId: string): Promise<string> {
    if (!input || typeof input !== "object") throw new Error("INVALID_PROMOTION");

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const min = input.minSubtotalInCents ?? 0;
    const startsAt = input.startsAt.trim();
    const endsAt = input.endsAt.trim();
    const startsAtMs = Date.parse(startsAt);
    const endsAtMs = Date.parse(endsAt);

    if (
      !/^[A-Z0-9_-]{3,64}$/.test(code) ||
      !name ||
      name.length > 200 ||
      (input.discountType !== "PERCENT" && input.discountType !== "FIXED") ||
      !Number.isSafeInteger(input.discountValue) ||
      input.discountValue <= 0 ||
      !Number.isSafeInteger(min) ||
      min < 0 ||
      !startsAt ||
      !endsAt ||
      !Number.isFinite(startsAtMs) ||
      !Number.isFinite(endsAtMs) ||
      endsAtMs <= startsAtMs
    ) {
      throw new Error("INVALID_PROMOTION");
    }

    if (input.discountType === "PERCENT" && input.discountValue > 100) {
      throw new Error("INVALID_PERCENT_DISCOUNT");
    }

    if (
      input.maxUses !== undefined &&
      input.maxUses !== null &&
      (!Number.isSafeInteger(input.maxUses) || input.maxUses < 1)
    ) {
      throw new Error("INVALID_MAX_USES");
    }

    const promotionId = await this.repository.save(
      {
        ...input,
        code,
        name,
        startsAt,
        endsAt,
        minSubtotalInCents: min,
      },
      id,
    );
    await this.audit.audit(adminUserId, "ADMIN_PROMOTION_SAVED", "promotion", promotionId, { code });
    return promotionId;
  }

  async setActive(id: string, active: boolean, adminUserId: string): Promise<boolean> {
    if (!id.trim()) throw new Error("PROMOTION_ID_REQUIRED");
    const promotionId = id.trim();
    const updated = await this.repository.setActive(promotionId, active);
    await this.audit.audit(adminUserId, "ADMIN_PROMOTION_ACTIVATED", "promotion", promotionId, { active });
    return updated;
  }
}
