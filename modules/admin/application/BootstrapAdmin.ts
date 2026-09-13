import type { AdminRole } from "../domain/AdminRole";
import { ADMIN_ROLES } from "../domain/AdminRole";
import { AdminUser } from "../domain/AdminUser";
import type { AdminRepository } from "./AdminRepository";
import type { PasswordHasher } from "./PasswordHasher";
import type { AuditPort } from "./AuditPort";

export class BootstrapAdmin {
  constructor(
    private readonly admins: AdminRepository,
    private readonly passwords: PasswordHasher,
    private readonly audit: AuditPort,
  ) {}

  async execute(input: Record<string, unknown>, suppliedToken: string | null, expectedToken: string | undefined): Promise<string> {
    if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) throw new Error("NOT_FOUND");
    const email = String(input.email ?? "").trim().toLowerCase();
    const password = String(input.password ?? "");
    const firstName = String(input.firstName ?? "").trim();
    const lastName = String(input.lastName ?? "").trim();
    const role = String(input.role ?? "SUPER_ADMIN") as AdminRole;
    if (!email || !password || !firstName || !lastName) throw new Error("INVALID_ADMIN_DATA");
    if (!ADMIN_ROLES.includes(role)) throw new Error("INVALID_ROLE");
    if (await this.admins.findByEmail(email)) throw new Error("ADMIN_ALREADY_EXISTS");

    const user = AdminUser.create(crypto.randomUUID(), {
      email,
      passwordHash: await this.passwords.hash(password),
      role,
      firstName,
      lastName,
      active: true,
      failedLoginCount: 0,
    });

    await this.admins.save(user);
    await this.audit.audit(user.getId(), "ADMIN_BOOTSTRAPPED", "admin_user", user.getId(), { role, email });
    return user.getId();
  }
}
