import type { AdminUser } from "../domain/AdminUser";
import type { AdminRole } from "../domain/AdminRole";
import type { AdminRepository } from "./AdminRepository";
import type { AdminSessionRepository } from "./AdminSessionRepository";
import type { PasswordHasher } from "./PasswordHasher";
import type { AuditPort } from "./AuditPort";

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
    private readonly hashToken: (value: string) => Promise<string>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(emailInput: string, password: string, ipHash?: string, userAgentHash?: string): Promise<AuthenticationResult> {
    const email = emailInput.trim().toLowerCase();
    if (!email || !password) throw new Error("INVALID_CREDENTIALS");

    const user = await this.admins.findByEmail(email);
    if (!user) {
      await this.audit.audit("", "ADMIN_LOGIN_FAILED", "admin_user", null, { reason: "invalid_credentials", email, ipHash: ipHash ?? null });
      throw new Error("INVALID_CREDENTIALS");
    }

    const current = user.toPrimitives();
    if (current.lockedUntil && new Date(current.lockedUntil).getTime() > this.now().getTime()) {
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
    await this.sessions.create(user.getId(), await this.hashToken(token), expiresAt.toISOString(), ipHash, userAgentHash);
    await this.audit.audit(user.getId(), "ADMIN_LOGIN_SUCCESS", "admin_user", user.getId(), { role: current.role, ipHash: ipHash ?? null });

    return { admin: principal(user), token, expiresAt };
  }
}
