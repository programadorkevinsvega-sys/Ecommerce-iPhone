export type AdminStepUpScope =
  "payments:refund" | "payments:void" | "admins:manage" | "settings:write";

export interface AdminStepUpRepository {
  create(
    input: Readonly<{
      adminUserId: string;
      sessionTokenHash: string;
      tokenHash: string;
      scope: AdminStepUpScope;
      expiresAt: string;
    }>,
  ): Promise<void>;

  hasValid(
    input: Readonly<{
      adminUserId: string;
      sessionTokenHash: string;
      tokenHash: string;
      scope: AdminStepUpScope;
    }>,
  ): Promise<boolean>;
}
