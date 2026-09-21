import type { TechnicianPasswordHasher } from "./TechnicianPasswordHasher";
import type { TechnicianRepository } from "./TechnicianRepository";
import type { TechnicianSessionRepository } from "./TechnicianSessionRepository";
import type { TechnicianTokenHasher } from "./TechnicianTokenHasher";

export class TechnicianAuthService {
  constructor(
    private readonly users: TechnicianRepository,
    private readonly sessions: TechnicianSessionRepository,
    private readonly passwords: TechnicianPasswordHasher,
    private readonly tokens: TechnicianTokenHasher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async authenticate(emailInput: string, password: string, ipHash?: string, userAgentHash?: string) {
    const email = emailInput.trim().toLowerCase();
    if (!email || !password) throw new Error("INVALID_CREDENTIALS");

    const user = await this.users.findByEmail(email);
    if (!user) {
      await this.passwords.verifyUnknownAccount(password);
      await this.users.audit(null, "LOGIN_FAILED", "technician_user", undefined, { reason: "invalid_credentials", email }, ipHash);
      throw new Error("INVALID_CREDENTIALS");
    }

    const current = user.toPrimitives();
    const now = this.now();

    if (!current.active) throw new Error("ACCOUNT_DISABLED");
    if (current.lockedUntil && new Date(current.lockedUntil).getTime() > now.getTime()) {
      throw new Error("ACCOUNT_LOCKED");
    }

    if (!(await this.passwords.verify(password, current.passwordHash))) {
      const state = await this.users.recordFailedLogin(user.getId(), now, 5, 15);
      await this.users.audit(user.getId(), "LOGIN_FAILED", "technician_user", user.getId(), state, ipHash);
      if (state.lockedUntil) throw new Error("ACCOUNT_LOCKED");
      throw new Error("INVALID_CREDENTIALS");
    }

    await this.users.recordSuccessfulLogin(user.getId(), now);
    await this.sessions.revokeAll(user.getId());

    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const tokenHash = await this.tokens.hash(token);
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    await this.sessions.create(user.getId(), tokenHash, expiresAt.toISOString(), ipHash, userAgentHash);
    await this.users.audit(user.getId(), "LOGIN_SUCCEEDED", "technician_user", user.getId(), {}, ipHash);

    return {
      principal: {
        id: current.id,
        email: current.email,
        firstName: current.firstName,
        lastName: current.lastName,
        ...(current.phone ? { phone: current.phone } : {}),
      },
      token,
      expiresAt,
    };
  }

  async resolve(token: string | null | undefined) {
    if (!token) return null;

    const found = await this.sessions.findByTokenHash(await this.tokens.hash(token));
    if (!found) return null;

    const p = found.user.toPrimitives();
    return {
      id: p.id,
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      ...(p.phone ? { phone: p.phone } : {}),
    };
  }

  async logout(userId: string, token: string | null | undefined, ipHash?: string) {
    if (!userId || !token) return;

    const found = await this.sessions.findByTokenHash(await this.tokens.hash(token));
    if (!found) return;

    await this.sessions.revoke(found.sessionId);
    await this.users.audit(userId, "LOGOUT", "technician_user", userId, {}, ipHash);
  }
}
