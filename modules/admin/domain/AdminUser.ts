import { DomainError, Entity } from "../../shared-kernel";
import type { AdminRole } from "../application/Rbac";

export type AdminUserProps = Readonly<{
  email: string;
  passwordHash: string;
  role: AdminRole;
  firstName: string;
  lastName: string;
  active: boolean;
  failedLoginCount: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export class AdminUser extends Entity<string> {
  private constructor(id: string, private props: AdminUserProps) { super(id); }

  static create(id: string, props: Omit<AdminUserProps, "createdAt" | "updatedAt"> & Partial<Pick<AdminUserProps, "createdAt" | "updatedAt">>): AdminUser {
    const email = props.email.trim().toLowerCase();
    if (!email.includes("@") || email.length > 254) throw new DomainError("Valid admin email is required");
    if (!props.firstName.trim() || !props.lastName.trim()) throw new DomainError("Admin name is required");
    if (!props.passwordHash.trim()) throw new DomainError("Password hash is required");
    if (props.failedLoginCount < 0) throw new DomainError("Invalid failed login count");
    const now = new Date().toISOString();
    return new AdminUser(id, { ...props, email, firstName: props.firstName.trim(), lastName: props.lastName.trim(), createdAt: props.createdAt ?? now, updatedAt: props.updatedAt ?? now });
  }

  recordSuccessfulLogin(): void { this.props = { ...this.props, failedLoginCount: 0, lockedUntil: undefined, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
  recordFailedLogin(lockMinutes = 15, maxAttempts = 5): void {
    const failed = this.props.failedLoginCount + 1;
    this.props = { ...this.props, failedLoginCount: failed, lockedUntil: failed >= maxAttempts ? new Date(Date.now() + lockMinutes * 60_000).toISOString() : this.props.lockedUntil, updatedAt: new Date().toISOString() };
  }
  toPrimitives(): AdminUserProps & { id: string } { return { id: this.getId(), ...this.props }; }
}
