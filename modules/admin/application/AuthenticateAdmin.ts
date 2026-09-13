import type { AdminUser } from "../domain/AdminUser";
import type { AdminRole } from "../domain/AdminRole";
import type { AdminRepository } from "./AdminRepository";
import type { AdminSessionRepository } from "./AdminSessionRepository";
import type { PasswordHasher } from "./PasswordHasher";
import type { AuditPort } from "./AuditPort";
import type { CreateAdminSession } from "./CreateAdminSession";

export type AdminPrincipal = Readonly<{
  id: string;
  email: string;
  role: AdminRole;
  firstName: string;
  lastName: string;
}>;

export type AuthenticationResult = Readonly<{
  admin: AdminPrincipal;
  token: string;
  expiresAt: Date;
}>;

function principal(user: AdminUser): AdminPrincipal {
  const value = user.toPrimitives();
  return { id: value.id, email: value.email, role: value.role, firstName: value.firstName, lastName: value.lastName };
}

function newToken(): string {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export class AuthenticateAdmin {
  constructor(
    private readonly admins: AdminRepository,
    private readonly sessions: AdminSessionRepository,
    private readonly passwords: PasswordHasher,
    private readonly audit: AuditPort,
    private readonly createSession: CreateAdminSession,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(emailInput: string, password: string, ipHash?: string, userAgentHash?: string): Promise<AuthenticationResult> {
    const email = emailInput.trim().toLowerCase();
    if (!email || !password) throw new Error("INVALID_CREDENTIALS");

    const user = await this.admins.findByEmail(email);
    if (!user) {
      await this.passwords.verifyUnknownAccount(password);
      await this.audit.audit(null, "ADMIN_LOGIN_FAILED", "admin_user", null, { reason: "invalid_credentials", email, ipHash: ipHash ?? null });
      throw new Error("INVALID_CREDENTIALS");
    }

    const current = user.toPrimitives();
    if (current.lockedUntil && new Date(current.lockedUntil).getTime() > this.now().getTime()) {
      await this.audit.audit(user.getId(), "ADMIN_LOGIN_BLOCKED", "admin_user", user.getId(), { reason: "account_locked", lockedUntil: current.lockedUntil, ipHash: ipHash ?? null });
      throw new Error("ACCOUNT_LOCKED");
    }

    if (!(await this.passwords.verify(password, current.passwordHash))) {
      user.recordFailedLogin();
      await this.admins.save(user);
      await this.audit.audit(user.getId(), "ADMIN_LOGIN_FAILED", "admin_user", user.getId(), { reason: "invalid_credentials", ipHash: ipHash ?? null });
      throw new Error("INVALID_CREDENTIALS");
    }

    user.recordSuccessfulLogin();
    await this.admins.save(user);
    await this.sessions.revokeAll(user.getId());

    const token = newToken();
    const expiresAt = new Date(this.now().getTime() + 8 * 86_400_000);
    await this.createSession.execute(user.getId(), token, expiresAt, ipHash, userAgentHash);
    await this.audit.audit(user.getId(), "ADMIN_LOGIN_SUCCESS", "admin_user", user.getId(), { role: current.role, ipHash: ipHash ?? null });

    return { admin: principal(user), token, expiresAt };
  }
}
