import type { AdminRole } from "../domain/AdminRole";
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
    if (!tokensMatch(suppliedToken, expectedToken)) throw new Error("NOT_FOUND");
    const email = String(input.email ?? "").trim().toLowerCase();
    const password = String(input.password ?? "");
    const firstName = String(input.firstName ?? "Administrador").trim();
    const lastName = String(input.lastName ?? "Principal").trim();
    const role = String(input.role ?? "SUPER_ADMIN") as AdminRole;
    if (!email || !password || !firstName || !lastName) throw new Error("INVALID_ADMIN_DATA");
    if (password.length < 12 || password.length > 128) throw new Error("INVALID_ADMIN_PASSWORD");
    if (role !== "SUPER_ADMIN") throw new Error("INVALID_ROLE");
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

    if (!(await this.admins.createInitialSuperAdmin(user))) throw new Error("ADMIN_ALREADY_EXISTS");
    await this.audit.audit(user.getId(), "ADMIN_BOOTSTRAPPED", "admin_user", user.getId(), { role, email });
    return user.getId();
  }
}

function tokensMatch(supplied: string | null, expected: string | undefined): boolean {
  if (!supplied || !expected) return false;
  const suppliedBytes = new TextEncoder().encode(supplied);
  const expectedBytes = new TextEncoder().encode(expected);
  let difference = suppliedBytes.length ^ expectedBytes.length;
  const length = Math.max(suppliedBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (suppliedBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}
