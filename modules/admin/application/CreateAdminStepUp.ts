import type { AdminRepository } from "./AdminRepository";
import type { PasswordHasher } from "./PasswordHasher";
import type { AuditPort } from "./AuditPort";
import type { AdminStepUpRepository, AdminStepUpScope } from "./AdminStepUpRepository";

export const ADMIN_STEP_UP_TTL_MS = 5 * 60 * 1000;
const ALLOWED_SCOPES = new Set<AdminStepUpScope>([
  "payments:refund",
  "payments:void",
  "admins:manage",
  "settings:write",
]);

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export class CreateAdminStepUp {
  constructor(
    private readonly admins: AdminRepository,
    private readonly passwords: PasswordHasher,
    private readonly grants: AdminStepUpRepository,
    private readonly audit: AuditPort,
    private readonly hash: (value: string) => Promise<string>,
    private readonly now: () => Date = () => new Date(),
    private readonly generateToken: () => string = createToken,
  ) {}

  async execute(input: Readonly<{
    adminUserId: string;
    sessionToken: string;
    password: string;
    scope: AdminStepUpScope;
    ipHash?: string;
  }>): Promise<Readonly<{ token: string; expiresAt: Date }>> {
    const adminUserId = input.adminUserId.trim();
    if (!adminUserId || !input.sessionToken || !input.password || input.password.length > 128) {
      throw new Error("INVALID_STEP_UP");
    }
    if (!ALLOWED_SCOPES.has(input.scope)) throw new Error("INVALID_STEP_UP_SCOPE");

    const admin = await this.admins.findById(adminUserId);
    if (!admin || !admin.active) throw new Error("UNAUTHORIZED");

    const now = this.now();
    const current = admin.toPrimitives();
    if (current.lockedUntil && new Date(current.lockedUntil).getTime() > now.getTime()) {
      await this.audit.audit(adminUserId, "ADMIN_STEP_UP_BLOCKED", "admin_user", adminUserId, {
        reason: "account_locked",
        scope: input.scope,
        ipHash: input.ipHash ?? null,
      });
      throw new Error("ACCOUNT_LOCKED");
    }

    if (!(await this.passwords.verify(input.password, current.passwordHash))) {
      const failure = await this.admins.recordFailedLogin(adminUserId, now, 5, 15);
      await this.audit.audit(adminUserId, "ADMIN_STEP_UP_FAILED", "admin_user", adminUserId, {
        reason: "invalid_credentials",
        scope: input.scope,
        failedLoginCount: failure.failedLoginCount,
        lockedUntil: failure.lockedUntil ?? null,
        ipHash: input.ipHash ?? null,
      });
      if (failure.lockedUntil && new Date(failure.lockedUntil).getTime() > now.getTime()) {
        throw new Error("ACCOUNT_LOCKED");
      }
      throw new Error("INVALID_CREDENTIALS");
    }

    await this.admins.recordSuccessfulLogin(adminUserId, now);
    const token = this.generateToken();
    const expiresAt = new Date(now.getTime() + ADMIN_STEP_UP_TTL_MS);
    await this.grants.create({
      adminUserId,
      sessionTokenHash: await this.hash(input.sessionToken),
      tokenHash: await this.hash(token),
      scope: input.scope,
      expiresAt: expiresAt.toISOString(),
    });
    await this.audit.audit(adminUserId, "ADMIN_STEP_UP_GRANTED", "admin_user", adminUserId, {
      scope: input.scope,
      expiresAt: expiresAt.toISOString(),
      ipHash: input.ipHash ?? null,
    });

    return { token, expiresAt };
  }
}
